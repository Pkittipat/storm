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
  slugify,
  toYaml,
  validate,
  type Board,
  type Issue,
} from '@stormm/process-model';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { GithubRepo, MAIN } from './github-repo.service.js';

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

export interface ProcessDiff {
  hasChanges: boolean;
  /** True once the edit has been requested for review (a pull request is open) — see `requestChange`. */
  requested: boolean;
  /** Unified diff of the process file, `main` vs. the user's branch; absent when there's nothing to show. */
  patch?: string;
  additions?: number;
  deletions?: number;
}

/** Repo folder for processes outside any project; not a slug, so no project id can take it. */
const NO_PROJECT = '_no-project';

/**
 * Process files live in the customer's GitHub repo (via the Stormm GitHub App),
 * one file per process:
 *
 *   stormm/processes/<project id>/<id>.yaml
 *
 * Only one repo is connected today (`GITHUB_REPO`), so every project's processes
 * live in that same repo under their own folder — a stand-in for "each project is
 * its own connected repo" until more than one installation exists.
 *
 * The project list itself (`id ↔ name`) is Stormm's own bookkeeping, not customer
 * repo content, so it's kept locally rather than committed to the customer's repo.
 */
@Injectable()
export class ProcessStore {
  private readonly localRoot = resolve(process.env.STORMM_DATA_DIR ?? '.stormm-data');
  // Writes run one at a time so read-check-write sequences never interleave.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly github: GithubRepo) {}

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private processesDir(projectId: string | null) {
    return `stormm/processes/${projectId ?? NO_PROJECT}`;
  }

  private processPath(projectId: string | null, id: string) {
    return `${this.processesDir(projectId)}/${id}.yaml`;
  }

  /**
   * The branch a user's in-progress edits live on, until they're accepted onto `main`.
   * There's no real login yet, so `userId` is just whatever the client sends.
   */
  private userBranch(userId: string) {
    return `user/${slugify(userId, 'anon')}`;
  }

  // ── Projects (Stormm's own bookkeeping — local, not in the customer repo) ─

  async listProjects(): Promise<Project[]> {
    try {
      return JSON.parse(await readFile(join(this.localRoot, 'projects.json'), 'utf8')) as Project[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  private async saveProjects(projects: Project[]) {
    const path = join(this.localRoot, 'projects.json');
    await mkdir(resolve(path, '..'), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(projects, null, 2) + '\n', 'utf8');
    await rename(tmp, path);
  }

  createProject(name: string): Promise<Project> {
    return this.exclusive(async () => {
      const projects = await this.listProjects();
      const project = { id: newId(name, projects.map((p) => p.id), 'project'), name };
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

  /** Its processes are kept in the repo and move to "No project". */
  deleteProject(id: string): Promise<void> {
    return this.exclusive(async () => {
      const projects = await this.listProjects();
      if (!projects.some((p) => p.id === id)) throw new NotFoundException(`Project ${id} not found`);
      for (const file of await this.github.listFiles(this.processesDir(id))) {
        const { text } = (await this.github.readFile(`${this.processesDir(id)}/${file.name}`))!;
        await this.github.writeFile(this.processPath(null, basename(file.name, '.yaml')), text, {
          message: `Move ${file.name} out of ${id} (project deleted)`,
        });
        await this.github.deleteFile(`${this.processesDir(id)}/${file.name}`, file.sha, `Move ${file.name} out of ${id} (project deleted)`);
      }
      await this.saveProjects(projects.filter((p) => p.id !== id));
    });
  }

  // ── Processes (real files in the connected GitHub repo) ────────────────────

  /** Every process file, as `{ id, projectId, path }`, projects first in project order. */
  private async files(): Promise<{ id: string; projectId: string | null; path: string }[]> {
    const out: { id: string; projectId: string | null; path: string }[] = [];
    for (const projectId of [...(await this.listProjects()).map((p) => p.id), null]) {
      const dir = this.processesDir(projectId);
      for (const file of await this.github.listFiles(dir))
        if (file.name.endsWith('.yaml')) out.push({ id: basename(file.name, '.yaml'), projectId, path: `${dir}/${file.name}` });
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
        const { text } = (await this.github.readFile(path))!;
        const { board } = parseBoard(text);
        return board ? { id, name: board.name, projectId } : { id, name: id, projectId, broken: true };
      }),
    );
  }

  /** Reads the user's own in-progress edit if they have one, otherwise the agreed version on `main`. */
  async getProcess(id: string, userId: string): Promise<ProcessFile> {
    const { projectId, path } = await this.locate(id);
    const branch = this.userBranch(userId);
    const onBranch = await this.github.readFile(path, branch);
    const { text, sha } = onBranch ?? (await this.github.readFile(path))!;
    const { board, issues } = parseBoard(text);
    if (!board) throw new UnprocessableEntityException({ message: `${id}.yaml can't be read as a process`, issues });
    return { projectId, board, version: sha, issues: [...issues, ...validate(board), ...fileNameIssues(id, board)] };
  }

  createProcess(name: string, projectId: string | null): Promise<ProcessFile> {
    return this.exclusive(async () => {
      if (projectId !== null && !(await this.listProjects()).some((p) => p.id === projectId))
        throw new BadRequestException(`Project ${projectId} not found`);
      const board = newBoard(name, (await this.files()).map((f) => f.id));
      const text = toYaml(board);
      const sha = await this.github.writeFile(this.processPath(projectId, board.id), text, {
        message: `Create ${board.id}`,
      });
      return { projectId, board, version: sha, issues: validate(board) };
    });
  }

  /**
   * Replaces the process with `yaml`, which must parse, pass validation without errors,
   * keep the same id, and be based on the current version — otherwise nothing is written.
   * The file is stored in canonical form, whatever formatting was sent.
   */
  saveProcess(id: string, yaml: string, baseVersion: string, userId: string): Promise<ProcessFile> {
    return this.exclusive(async () => {
      const { projectId, path } = await this.locate(id);

      const { board, issues } = parseBoard(yaml);
      if (!board) throw new UnprocessableEntityException({ message: "The YAML can't be read as a process", issues });
      const all = [...issues, ...validate(board), ...fileNameIssues(id, board)];
      if (hasErrors(all)) throw new UnprocessableEntityException({ message: 'The process has errors', issues: all });

      const branch = this.userBranch(userId);
      await this.github.ensureBranch(branch);
      const text = toYaml(board);
      try {
        const sha = await this.github.writeFile(path, text, { sha: baseVersion, message: `Update ${id}`, branch });
        return { projectId, board, version: sha, issues: all };
      } catch (e) {
        if (isConflict(e)) {
          const current = await this.github.readFile(path, branch);
          throw new ConflictException({ message: 'The process changed since you loaded it', version: current?.sha });
        }
        throw e;
      }
    });
  }

  /** The diff between the user's in-progress edit and the agreed version on `main`. */
  diffProcess(id: string, userId: string): Promise<ProcessDiff> {
    return this.exclusive(async () => {
      const { path } = await this.locate(id);
      const branch = this.userBranch(userId);
      if (!(await this.github.branchSha(branch))) return { hasChanges: false, requested: false };
      const diff = await this.github.diffFile(MAIN, branch, path);
      if (!diff) return { hasChanges: false, requested: false };
      const requested = (await this.github.findOpenPullRequest(MAIN, branch)) !== null;
      return { hasChanges: true, requested, patch: diff.patch, additions: diff.additions, deletions: diff.deletions };
    });
  }

  /**
   * Marks the user's edit as ready for someone else to review and accept — opens a pull
   * request for their branch (or reuses one already open). Before this, the edit is only
   * visible to the person making it; `acceptProcess` refuses until it's been requested.
   */
  requestChange(id: string, userId: string): Promise<void> {
    return this.exclusive(async () => {
      const { path } = await this.locate(id);
      const branch = this.userBranch(userId);
      if (!(await this.github.branchSha(branch))) throw new BadRequestException(`No changes from ${userId} to request for ${id}`);
      const diff = await this.github.diffFile(MAIN, branch, path);
      if (!diff) throw new BadRequestException(`No changes from ${userId} to request for ${id}`);
      await this.github.openPullRequest(MAIN, branch, `Update ${id} (from ${userId})`);
    });
  }

  /** Merges the user's branch into `main`, making their edit the agreed version. Refuses until it's been requested. */
  acceptProcess(id: string, userId: string): Promise<ProcessFile> {
    return this.exclusive(async () => {
      const { path } = await this.locate(id);
      const branch = this.userBranch(userId);
      if (!(await this.github.branchSha(branch)))
        throw new BadRequestException(`No changes from ${userId} to accept for ${id}`);
      if (!(await this.github.findOpenPullRequest(MAIN, branch)))
        throw new BadRequestException(`${userId}'s change hasn't been requested for review yet`);

      const result = await this.github.merge(MAIN, branch, `Accept ${id} changes from ${userId}`);
      if (result === 'conflict')
        throw new ConflictException({ message: `${id} changed on main since this edit was based; reload and redo the edit` });

      const { text, sha } = (await this.github.readFile(path))!;
      const { board, issues } = parseBoard(text);
      if (!board) throw new UnprocessableEntityException({ message: `${id}.yaml can't be read as a process`, issues });
      return {
        projectId: (await this.locate(id)).projectId,
        board,
        version: sha,
        issues: [...issues, ...validate(board), ...fileNameIssues(id, board)],
      };
    });
  }

  moveProcess(id: string, projectId: string | null): Promise<ProcessSummary> {
    return this.exclusive(async () => {
      const found = await this.locate(id);
      if (projectId !== null && !(await this.listProjects()).some((p) => p.id === projectId))
        throw new BadRequestException(`Project ${projectId} not found`);
      let text: string;
      if (found.projectId !== projectId) {
        const file = (await this.github.readFile(found.path))!;
        text = file.text;
        await this.github.writeFile(this.processPath(projectId, id), text, { message: `Move ${id} to ${projectId ?? 'no project'}` });
        await this.github.deleteFile(found.path, file.sha, `Move ${id} to ${projectId ?? 'no project'}`);
      } else {
        text = (await this.github.readFile(found.path))!.text;
      }
      const { board } = parseBoard(text);
      return { id, name: board?.name ?? id, projectId };
    });
  }

  deleteProcess(id: string): Promise<void> {
    return this.exclusive(async () => {
      const { path } = await this.locate(id);
      const file = (await this.github.readFile(path))!;
      await this.github.deleteFile(path, file.sha, `Delete ${id}`);
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

function isConflict(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'status' in e && [409, 422].includes((e as { status: unknown }).status as number);
}
