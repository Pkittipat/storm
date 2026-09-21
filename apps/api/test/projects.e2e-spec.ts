import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('groups processes under a project and releases them when it is deleted', async () => {
    const project = (await http().post('/projects').send({ name: 'Ordering' }).expect(201)).body;
    await http().patch(`/projects/${project.id}`).send({ name: 'Orders' }).expect(200);
    const projects = await http().get('/projects').expect(200);
    expect(projects.body).toContainEqual({ id: project.id, name: 'Orders' });

    const inProject = (
      await http().post('/processes').send({ name: 'Place Order', projectId: project.id }).expect(201)
    ).body;
    const loose = (await http().post('/processes').send({ name: 'Restock' }).expect(201)).body;
    expect(inProject.projectId).toBe(project.id);
    expect(loose.projectId).toBeNull();

    // Move in, then back out with null.
    await http().patch(`/processes/${loose.id}`).send({ projectId: project.id }).expect(200);
    await http().patch(`/processes/${loose.id}`).send({ projectId: null }).expect(200);
    const list = await http().get('/processes').expect(200);
    expect(list.body.find((p: { id: string }) => p.id === loose.id).projectId).toBeNull();
    expect(list.body.find((p: { id: string }) => p.id === inProject.id).projectId).toBe(project.id);

    await http().delete(`/projects/${project.id}`).expect(204);
    const kept = await http().get(`/processes/${inProject.id}`).expect(200);
    expect(kept.body.projectId).toBeNull();

    await http().delete(`/processes/${inProject.id}`);
    await http().delete(`/processes/${loose.id}`);
  });

  it('rejects an unknown project', async () => {
    await http().post('/processes').send({ name: 'X', projectId: 'nope' }).expect(400);
    await http().patch('/projects/nope').send({ name: 'X' }).expect(404);
  });
});
