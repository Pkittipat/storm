import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateBlockDto, UpdateBlockDto } from './dto/block.dto.js';
import { CreateConnectionDto } from './dto/connection.dto.js';
import { CreateProcessDto, UpdateProcessDto } from './dto/process.dto.js';
import { ProcessesService } from './processes.service.js';

@Controller()
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Get('processes')
  list() {
    return this.processes.listProcesses();
  }

  @Post('processes')
  create(@Body() dto: CreateProcessDto) {
    return this.processes.createProcess(dto);
  }

  @Get('processes/:id')
  get(@Param('id') id: string) {
    return this.processes.getProcess(id);
  }

  @Patch('processes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateProcessDto) {
    return this.processes.updateProcess(id, dto);
  }

  @Delete('processes/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.processes.deleteProcess(id);
  }

  @Post('processes/:id/blocks')
  createBlock(@Param('id') id: string, @Body() dto: CreateBlockDto) {
    return this.processes.createBlock(id, dto);
  }

  @Patch('blocks/:id')
  updateBlock(@Param('id') id: string, @Body() dto: UpdateBlockDto) {
    return this.processes.updateBlock(id, dto);
  }

  @Delete('blocks/:id')
  @HttpCode(204)
  removeBlock(@Param('id') id: string) {
    return this.processes.deleteBlock(id);
  }

  @Post('processes/:id/connections')
  createConnection(@Param('id') id: string, @Body() dto: CreateConnectionDto) {
    return this.processes.createConnection(id, dto);
  }

  @Delete('connections/:id')
  @HttpCode(204)
  removeConnection(@Param('id') id: string) {
    return this.processes.deleteConnection(id);
  }
}
