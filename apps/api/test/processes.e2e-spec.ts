import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addBlock, connect, parseBoard, toYaml, type Board } from '@stormm/process-model';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { blobSha } from './../src/store/process-store.service.js';

describe('Processes as YAML files (e2e)', () => {
  let app: INestApplication<App>;
  let dataDir: string;
  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'stormm-e2e-'));
    process.env.STORMM_DATA_DIR = dataDir;
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const file = (projectId: string, id: string) => join(dataDir, 'repos', projectId, 'stormm', 'processes', `${id}.yaml`);

  const save = (id: string, board: Board, baseVersion: string) =>
    http().put(`/processes/${id}`).send({ yaml: toYaml(board), baseVersion });

  it('runs the acceptance test: add Reserve stock and every reader sees it', async () => {
    const project = (await http().post('/projects').send({ name: 'Checkout' }).expect(201)).body;
    expect(project).toEqual({ id: 'checkout', name: 'Checkout' });

    const created = (await http().post('/processes').send({ name: 'Place order', projectId: 'checkout' }).expect(201)).body;
    expect(created.board.id).toBe('place-order');
    expect(await readFile(file('checkout', 'place-order'), 'utf8')).toBe(toYaml(created.board));

    let board: Board = created.board;
    board = addBlock(board, { kind: 'event', title: 'Order placed' }).board;
    board = addBlock(board, { kind: 'policy', title: 'Reserve stock' }).board;
    board = connect(board, 'order-placed', 'reserve-stock');
    const saved = (await save('place-order', board, created.version).expect(200)).body;

    const text = await readFile(file('checkout', 'place-order'), 'utf8');
    expect(text).toContain('  - { id: reserve-stock, kind: policy, title: Reserve stock }');
    expect(text).toContain('  - { from: order-placed, to: reserve-stock }');
    expect(saved.version).toBe(blobSha(text));

    const reread = (await http().get('/processes/place-order').expect(200)).body;
    expect(reread).toEqual({ projectId: 'checkout', board, version: saved.version, issues: [] });
    expect((await http().get('/processes').expect(200)).body).toEqual([{ id: 'place-order', name: 'Place order', projectId: 'checkout' }]);
  });

  it('refuses a save based on an old version', async () => {
    const created = (await http().post('/processes').send({ name: 'Place order' }).expect(201)).body;
    const first = (await save('place-order', { ...created.board, name: 'Place an order' }, created.version).expect(200)).body;
    const stale = await save('place-order', { ...created.board, name: 'Other' }, created.version).expect(409);
    expect(stale.body.version).toBe(first.version);
    expect(parseBoard(await readFile(file('_no-project', 'place-order'), 'utf8')).board?.name).toBe('Place an order');
  });

  it('refuses YAML with errors, and a changed id, without writing', async () => {
    const created = (await http().post('/processes').send({ name: 'Place order' }).expect(201)).body;
    const before = await readFile(file('_no-project', 'place-order'), 'utf8');

    const broken = { ...created.board, connections: [{ from: 'ghost', to: 'nowhere' }] };
    const res = await save('place-order', broken, created.version).expect(422);
    expect(res.body.issues.map((i: { code: string }) => i.code)).toContain('missing-block');

    await save('place-order', { ...created.board, id: 'renamed' }, created.version).expect(422);
    await http().put('/processes/place-order').send({ yaml: 'id: [', baseVersion: created.version }).expect(422);
    expect(await readFile(file('_no-project', 'place-order'), 'utf8')).toBe(before);
  });

  it('stores hand-formatted YAML in canonical form and keeps warnings', async () => {
    const created = (await http().post('/processes').send({ name: 'Place order' }).expect(201)).body;
    const yaml = 'schemaVersion: 1\nid: place-order\nname: "Place order"\nblocks: [{id: a, kind: event, title: A}]\n';
    const res = (await http().put('/processes/place-order').send({ yaml, baseVersion: created.version }).expect(200)).body;
    expect(res.issues).toEqual([expect.objectContaining({ level: 'warning', code: 'unconnected' })]);
    expect(await readFile(file('_no-project', 'place-order'), 'utf8')).toBe(toYaml(res.board));
  });

  it('keeps ids unique across projects and moves files between repos', async () => {
    await http().post('/projects').send({ name: 'Checkout' }).expect(201);
    await http().post('/processes').send({ name: 'Place order', projectId: 'checkout' }).expect(201);
    const second = (await http().post('/processes').send({ name: 'Place order' }).expect(201)).body;
    expect(second.board.id).toBe('place-order-2');

    await http().patch('/processes/place-order-2').send({ projectId: 'checkout' }).expect(200);
    expect(await readdir(join(dataDir, 'repos', 'checkout', 'stormm', 'processes'))).toEqual(['place-order-2.yaml', 'place-order.yaml']);
    await http().patch('/processes/place-order-2').send({ projectId: 'nope' }).expect(400);

    // Deleting a project keeps its processes under "No project".
    await http().delete('/projects/checkout').expect(204);
    const list = (await http().get('/processes').expect(200)).body;
    expect(list.map((p: { projectId: string | null }) => p.projectId)).toEqual([null, null]);
    expect((await http().get('/projects').expect(200)).body).toEqual([]);
  });

  it('lists a hand-broken file and explains it on open', async () => {
    await http().post('/processes').send({ name: 'Place order' }).expect(201);
    await writeFile(file('_no-project', 'place-order'), 'schemaVersion: 9\n');
    expect((await http().get('/processes').expect(200)).body).toEqual([{ id: 'place-order', name: 'place-order', projectId: null, broken: true }]);
    const res = await http().get('/processes/place-order').expect(422);
    expect(res.body.issues[0].code).toBe('schema-version');
  });

  it('404s unknown processes and projects, and deletes files', async () => {
    await http().get('/processes/nope').expect(404);
    await http().patch('/projects/nope').send({ name: 'X' }).expect(404);
    await http().post('/processes').send({ name: 'X', projectId: 'nope' }).expect(400);
    await http().post('/processes').send({ name: 'Place order' }).expect(201);
    await http().delete('/processes/place-order').expect(204);
    await http().get('/processes/place-order').expect(404);
  });
});
