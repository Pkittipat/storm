import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Processes (e2e)', () => {
  let app: INestApplication<App>;
  let processId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  beforeEach(async () => {
    const res = await request(app.getHttpServer())
      .post('/processes')
      .send({ name: 'Place Order' })
      .expect(201);
    processId = res.body.id;
  });

  afterEach(async () => {
    await request(app.getHttpServer()).delete(`/processes/${processId}`);
  });

  afterAll(async () => {
    await app.close();
  });

  const addBlock = (kind: string, title: string) =>
    request(app.getHttpServer())
      .post(`/processes/${processId}/blocks`)
      .send({ kind, title, x: 0, y: 0 })
      .expect(201)
      .then((r) => r.body);

  it('lists and renames a process', async () => {
    const list = await request(app.getHttpServer()).get('/processes').expect(200);
    expect(list.body.some((p: { id: string }) => p.id === processId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/processes/${processId}`)
      .send({ name: 'Cancel Order' })
      .expect(200);
    const res = await request(app.getHttpServer()).get(`/processes/${processId}`).expect(200);
    expect(res.body.name).toBe('Cancel Order');
  });

  it('creates and updates a block with actor, hotspots and fields', async () => {
    const block = await addBlock('command', 'Place Order');
    await request(app.getHttpServer())
      .patch(`/blocks/${block.id}`)
      .send({
        x: 120,
        actor: 'Customer',
        hotspots: ['What if the cart is empty?'],
        fields: [{ name: 'cartID', type: 'CartID' }],
      })
      .expect(200);

    const res = await request(app.getHttpServer()).get(`/processes/${processId}`).expect(200);
    expect(res.body.blocks[0]).toMatchObject({
      kind: 'command',
      x: 120,
      actor: 'Customer',
      hotspots: ['What if the cart is empty?'],
      fields: [{ name: 'cartID', type: 'CartID' }],
    });

    await request(app.getHttpServer()).patch(`/blocks/${block.id}`).send({ actor: '' }).expect(200);
    const cleared = await request(app.getHttpServer()).get(`/processes/${processId}`);
    expect(cleared.body.blocks[0].actor).toBeNull();
  });

  it('rejects an unknown block kind', () =>
    request(app.getHttpServer())
      .post(`/processes/${processId}/blocks`)
      .send({ kind: 'actor', title: 'Customer', x: 0, y: 0 })
      .expect(400));

  it('connects blocks, rejects self and duplicate links, and cascades on block delete', async () => {
    const cmd = await addBlock('command', 'Place Order');
    const agg = await addBlock('aggregate', 'Order');
    const connect = (sourceId: string, targetId: string) =>
      request(app.getHttpServer())
        .post(`/processes/${processId}/connections`)
        .send({ sourceId, targetId });

    await connect(cmd.id, agg.id).expect(201);
    await connect(cmd.id, agg.id).expect(409);
    await connect(cmd.id, cmd.id).expect(400);

    await request(app.getHttpServer()).delete(`/blocks/${agg.id}`).expect(204);
    const res = await request(app.getHttpServer()).get(`/processes/${processId}`);
    expect(res.body.blocks).toHaveLength(1);
    expect(res.body.connections).toHaveLength(0);
  });

  it('refuses to connect blocks from another process', async () => {
    const other = await request(app.getHttpServer()).post('/processes').send({ name: 'Other' });
    const foreign = await request(app.getHttpServer())
      .post(`/processes/${other.body.id}/blocks`)
      .send({ kind: 'event', title: 'X', x: 0, y: 0 });
    const cmd = await addBlock('command', 'Place Order');

    await request(app.getHttpServer())
      .post(`/processes/${processId}/connections`)
      .send({ sourceId: cmd.id, targetId: foreign.body.id })
      .expect(400);
    await request(app.getHttpServer()).delete(`/processes/${other.body.id}`).expect(204);
  });

  it('returns 404 for a missing process', () =>
    request(app.getHttpServer()).get('/processes/nope').expect(404));
});
