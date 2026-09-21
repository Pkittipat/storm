/**
 * One-off: copies processes from the old Postgres tables into YAML files in the
 * local data folder (STORMM_DATA_DIR, default .stormm-data).
 * Positions are dropped (layout is derived now). Existing files are never overwritten.
 *
 *   pnpm --filter api export:db
 */
import { PrismaClient } from '@prisma/client';
import { connect, hasErrors, newBoard, newId, toYaml, updateBlock, validate, addBlock, type BlockKind } from '@stormm/process-model';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.env.STORMM_DATA_DIR ?? '.stormm-data');
const prisma = new PrismaClient();

const projectsFile = join(root, 'projects.json');
const projects: { id: string; name: string }[] = existsSync(projectsFile) ? JSON.parse(await readFile(projectsFile, 'utf8')) : [];
const projectIds = new Map<string, string>();
for (const p of await prisma.project.findMany({ orderBy: { createdAt: 'asc' } })) {
  const id = newId(p.name, projects.map((x) => x.id), 'project');
  projects.push({ id, name: p.name });
  projectIds.set(p.id, id);
}
await mkdir(root, { recursive: true });
await writeFile(projectsFile, JSON.stringify(projects, null, 2) + '\n');

const takenProcessIds: string[] = [];
const processes = await prisma.process.findMany({
  orderBy: { createdAt: 'asc' },
  include: { blocks: { orderBy: { createdAt: 'asc' } }, connections: { orderBy: { createdAt: 'asc' } } },
});
for (const p of processes) {
  let board = newBoard(p.name, takenProcessIds);
  takenProcessIds.push(board.id);
  const idOf = new Map<string, string>();
  for (const b of p.blocks) {
    const kind = (b.kind === 'system' ? 'readmodel' : b.kind) as BlockKind;
    const added = addBlock(board, { kind, title: b.title });
    idOf.set(b.id, added.blockId);
    board = updateBlock(added.board, added.blockId, {
      actor: b.actor,
      hotspots: b.hotspots,
      fields: (b.fields as { name: string; type: string }[]).map((f) => ({ name: f.name, type: f.type ?? '' })),
    });
  }
  for (const c of p.connections) board = connect(board, idOf.get(c.sourceId)!, idOf.get(c.targetId)!);

  const projectId = p.projectId ? projectIds.get(p.projectId)! : '_no-project';
  const dir = join(root, 'repos', projectId, 'stormm', 'processes');
  const path = join(dir, `${board.id}.yaml`);
  if (existsSync(path)) {
    console.log(`skip  ${path} (exists)`);
    continue;
  }
  const issues = validate(board);
  if (hasErrors(issues)) {
    console.log(`FAIL  ${p.name}:`, issues.filter((i) => i.level === 'error'));
    continue;
  }
  await mkdir(dir, { recursive: true });
  await writeFile(path, toYaml(board));
  console.log(`wrote ${path} (${p.blocks.length} blocks, ${p.connections.length} connections, ${issues.length} warnings)`);
}
await prisma.$disconnect();
