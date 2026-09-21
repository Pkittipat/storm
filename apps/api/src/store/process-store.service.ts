import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  hasErrors,
  newBoard,
  newId,
  parseBoard,
  toYaml,
  validate,
  type Board,
  type Issue,
} from '@stormm/process-model';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

export interface Project {
  id: string;
  name: string;
}

export interface ProcessSummary {
  id: string;
  name: string;
  projectId: string | null;
  /** The file can't be read as a board; open it to see why. */
  broken?: boolean;
}

export interface ProcessFile {
  projectId: string | null;
  board: Board;
  /** Git blob SHA of the file — the version a save must build on, like GitHub's contents API. */
  version: string;
  issues: Issue[];
}

/** Repo folder for processes outside any project; not a slug, so no project id can take it. */
const NO_PROJECT = '_no-project';

/**
 * Stand-in for GitHub until it is connected. Each project is a local "repository"
 * folder holding only Stormm-owned files:
 *
 *   <data dir>/projects.json                                  (Stormm's side: project ↔ repo)
 *   <data dir>/repos/<project id>/stormm/processes/<id>.yaml  (the agreed process)
 *
 * The YAML files are the only record of a process. Every write is validated and
 * written in canonical form, and must name the version it was based on.
 */
@Injectable()
export class ProcessStore {
  private readonly root = resolve(process.env.STORMM_DATA_DIR ?? '.stormm-data');
  // Writes run one at a time so read-check-write sequences never interleave.
  private queue: Promise<unknown> = Promise.resolve();

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private processesDir(projectId: string | null) {
    return join(this.root, 'repos', projectId ?? NO_PROJECT, 'stormm', 'processes');
  }

  // ── Projects ────────────────────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    try {
      return JSON.parse(await readFile(join(this.root, 'projects.json'), 'utf8')) as Project[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  private async saveProjects(projects: Project[]) {
    await atomicWrite(join(this.root, 'projects.json'), JSON.stringify(projects, null, 2) + '\n');
  }

  createProject(name: string): Promise<Project> {
    return this.exclusive(async () => {
      const projects = await this.listProjects();
      const project = { id: newId(name, projects.map((p) => p.id), 'project'), name };
      await mkdir(this.processesDir(project.id), { recursive: true });
      await this.saveProjects([...projects, project]);
      return project;
    });
  }

  renameProject(id: string, name: string): Promise<Project> {
    return this.exclusive(async () => {
      const projects = await this.listProjects();
      if (!projects.some((p) => p.id === id)) throw new NotFoundException(`Project ${id} not found`);
      await this.saveProjects(projects.map((p) => (p.id === id ? { ...p, name } : p)));
      return { id, name };
    });
  }

  /** Its processes are kept and move to "No project". */
  deleteProject(id: string): Promise<void> {
    return this.exclusive(async () => {
      const projects = await this.listProjects();
      if (!projects.some((p) => p.id === id)) throw new NotFoundException(`Project ${id} not found`);
      await mkdir(this.processesDir(null), { recursive: true });
      for (const file of await yamlFiles(this.processesDir(id)))
        await rename(join(this.processesDir(id), file), join(this.processesDir(null), file));
      await rm(join(this.root, 'repos', id), { recursive: true, force: true });
      await this.saveProjects(projects.filter((p) => p.id !== id));
    });
  }

  // ── Processes ───────────────────────────────────────────────────────────

  /** Every process file, as `{ id, projectId, path }`, projects first in project order. */
  private async files(): Promise<{ id: string; projectId: string | null; path: string }[]> {
    const out: { id: string; projectId: string | null; path: string }[] = [];
    for (const projectId of [...(await this.listProjects()).map((p) => p.id), null]) {
      const dir = this.processesDir(projectId);
      for (const file of await yamlFiles(dir)) out.push({ id: basename(file, '.yaml'), projectId, path: join(dir, file) });
    }
    return out;
  }

  private async locate(id: string) {
    const found = (await this.files()).find((f) => f.id === id);
    if (!found) throw new NotFoundException(`Process ${id} not found`);
    return found;
  }

  async listProcesses(): Promise<ProcessSummary[]> {
    const files = await this.files();
    return Promise.all(
      files.map(async ({ id, projectId, path }) => {
        const { board } = parseBoard(await readFile(path, 'utf8'));
        return board ? { id, name: board.name, projectId } : { id, name: id, projectId, broken: true };
      }),
    );
  }

  async getProcess(id: string): Promise<ProcessFile> {
    const { projectId, path } = await this.locate(id);
    const text = await readFile(path, 'utf8');
    const { board, issues } = parseBoard(text);
    if (!board) throw new UnprocessableEntityException({ message: `${id}.yaml can't be read as a process`, issues });
    return { projectId, board, version: blobSha(text), issues: [...issues, ...validate(board), ...fileNameIssues(id, board)] };
  }

  createProcess(name: string, projectId: string | null): Promise<ProcessFile> {
    return this.exclusive(async () => {
      if (projectId !== null && !(await this.listProjects()).some((p) => p.id === projectId))
        throw new BadRequestException(`Project ${projectId} not found`);
      const board = newBoard(name, (await this.files()).map((f) => f.id));
      const text = toYaml(board);
      await mkdir(this.processesDir(projectId), { recursive: true });
      await atomicWrite(join(this.processesDir(projectId), `${board.id}.yaml`), text);
      return { projectId, board, version: blobSha(text), issues: validate(board) };
    });
  }

  /**
   * Replaces the process with `yaml`, which must parse, pass validation without errors,
   * keep the same id, and be based on the current version — otherwise nothing is written.
   * The file is stored in canonical form, whatever formatting was sent.
   */
  saveProcess(id: string, yaml: string, baseVersion: string): Promise<ProcessFile> {
    return this.exclusive(async () => {
      const { projectId, path } = await this.locate(id);
      const current = blobSha(await readFile(path, 'utf8'));
      if (current !== baseVersion)
        throw new ConflictException({ message: 'The process changed since you loaded it', version: current });

      const { board, issues } = parseBoard(yaml);
      if (!board) throw new UnprocessableEntityException({ message: "The YAML can't be read as a process", issues });
      const all = [...issues, ...validate(board), ...fileNameIssues(id, board)];
      if (hasErrors(all)) throw new UnprocessableEntityException({ message: 'The process has errors', issues: all });

      const text = toYaml(board);
      await atomicWrite(path, text);
      return { projectId, board, version: blobSha(text), issues: all };
    });
  }

  moveProcess(id: string, projectId: string | null): Promise<ProcessSummary> {
    return this.exclusive(async () => {
      const found = await this.locate(id);
      if (projectId !== null && !(await this.listProjects()).some((p) => p.id === projectId))
        throw new BadRequestException(`Project ${projectId} not found`);
      if (found.projectId !== projectId) {
        await mkdir(this.processesDir(projectId), { recursive: true });
        await rename(found.path, join(this.processesDir(projectId), `${id}.yaml`));
      }
      const { board } = parseBoard(await readFile(join(this.processesDir(projectId), `${id}.yaml`), 'utf8'));
      return { id, name: board?.name ?? id, projectId };
    });
  }

  deleteProcess(id: string): Promise<void> {
    return this.exclusive(async () => {
      await rm((await this.locate(id)).path);
    });
  }
}

/** The file name is the process id; a file renamed by hand (or an edited id) is an error. */
function fileNameIssues(id: string, board: Board): Issue[] {
  return board.id === id
    ? []
    : [{ level: 'error', code: 'id-mismatch', message: `The file is ${id}.yaml but its id is “${board.id}”; ids are frozen.`, path: 'id' }];
}

/** Same as `git hash-object`: the SHA GitHub reports for a file's content. */
export function blobSha(text: string): string {
  const body = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

async function yamlFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.yaml')).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

async function atomicWrite(path: string, text: string) {
  await mkdir(resolve(path, '..'), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, path);
}
