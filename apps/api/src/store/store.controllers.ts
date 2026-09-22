import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateProcessDto, MoveProcessDto, NameDto, SaveProcessDto } from './dto.js';
import { ProcessStore } from './process-store.service.js';

/** No login yet — the client names itself; falls back to a shared identity if it doesn't. */
const userId = (header?: string) => header || 'anonymous';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly store: ProcessStore) {}

  @Get()
  list() {
    return this.store.listProjects();
  }

  @Post()
  create(@Body() dto: NameDto) {
    return this.store.createProject(dto.name);
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: NameDto) {
    return this.store.renameProject(id, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.store.deleteProject(id);
  }
}

@Controller('processes')
export class ProcessesController {
  constructor(private readonly store: ProcessStore) {}

  @Get()
  list() {
    return this.store.listProcesses();
  }

  @Post()
  create(@Body() dto: CreateProcessDto) {
    return this.store.createProcess(dto.name, dto.projectId ?? null);
  }

  @Get(':id')
  get(@Param('id') id: string, @Headers('x-stormm-user') user?: string) {
    return this.store.getProcess(id, userId(user));
  }

  @Put(':id')
  save(@Param('id') id: string, @Body() dto: SaveProcessDto, @Headers('x-stormm-user') user?: string) {
    return this.store.saveProcess(id, dto.yaml, dto.baseVersion, userId(user));
  }

  @Get(':id/diff')
  diff(@Param('id') id: string, @Headers('x-stormm-user') user?: string) {
    return this.store.diffProcess(id, userId(user));
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Param('id') id: string, @Headers('x-stormm-user') user?: string) {
    return this.store.acceptProcess(id, userId(user));
  }

  @Patch(':id')
  move(@Param('id') id: string, @Body() dto: MoveProcessDto) {
    return this.store.moveProcess(id, dto.projectId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.store.deleteProcess(id);
  }
}
