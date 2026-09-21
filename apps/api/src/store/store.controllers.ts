import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateProcessDto, MoveProcessDto, NameDto, SaveProcessDto } from './dto.js';
import { ProcessStore } from './process-store.service.js';

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
  get(@Param('id') id: string) {
    return this.store.getProcess(id);
  }

  @Put(':id')
  save(@Param('id') id: string, @Body() dto: SaveProcessDto) {
    return this.store.saveProcess(id, dto.yaml, dto.baseVersion);
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
