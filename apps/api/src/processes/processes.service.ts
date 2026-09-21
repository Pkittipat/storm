import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBlockDto, UpdateBlockDto } from './dto/block.dto.js';
import { CreateConnectionDto } from './dto/connection.dto.js';
import { CreateProcessDto, UpdateProcessDto } from './dto/process.dto.js';

@Injectable()
export class ProcessesService {
  constructor(private readonly prisma: PrismaService) {}

  listProcesses() {
    return this.prisma.process.findMany({
      select: { id: true, name: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getProcess(id: string) {
    const process = await this.prisma.process.findUnique({
      where: { id },
      include: {
        blocks: { orderBy: { createdAt: 'asc' } },
        connections: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!process) throw new NotFoundException(`Process ${id} not found`);
    return process;
  }

  createProcess(dto: CreateProcessDto) {
    return this.prisma.process.create({
      data: { name: dto.name },
      include: { blocks: true, connections: true },
    });
  }

  async updateProcess(id: string, dto: UpdateProcessDto) {
    await this.getProcess(id);
    return this.prisma.process.update({ where: { id }, data: { name: dto.name } });
  }

  async deleteProcess(id: string) {
    await this.getProcess(id);
    await this.prisma.process.delete({ where: { id } });
  }

  async createBlock(processId: string, dto: CreateBlockDto) {
    await this.getProcess(processId);
    const { kind, title, x, y } = dto;
    return this.prisma.block.create({ data: { kind, title, x, y, processId } });
  }

  async updateBlock(id: string, dto: UpdateBlockDto) {
    await this.findBlock(id);
    const { actor, fields, ...rest } = dto;
    return this.prisma.block.update({
      where: { id },
      data: {
        ...rest,
        ...(actor !== undefined && { actor: actor.trim() || null }),
        ...(fields !== undefined && {
          fields: fields.map(({ name, type }) => ({ name, type })),
        }),
      },
    });
  }

  async deleteBlock(id: string) {
    await this.findBlock(id);
    await this.prisma.block.delete({ where: { id } });
  }

  async createConnection(processId: string, dto: CreateConnectionDto) {
    await this.getProcess(processId);
    if (dto.sourceId === dto.targetId) {
      throw new BadRequestException('A block cannot connect to itself');
    }
    const blocks = await this.prisma.block.count({
      where: { id: { in: [dto.sourceId, dto.targetId] }, processId },
    });
    if (blocks !== 2) {
      throw new BadRequestException('Both blocks must belong to this process');
    }
    try {
      return await this.prisma.connection.create({
        data: { processId, sourceId: dto.sourceId, targetId: dto.targetId },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('These blocks are already connected');
      }
      throw e;
    }
  }

  async deleteConnection(id: string) {
    const connection = await this.prisma.connection.findUnique({ where: { id } });
    if (!connection) throw new NotFoundException(`Connection ${id} not found`);
    await this.prisma.connection.delete({ where: { id } });
  }

  private async findBlock(id: string) {
    const block = await this.prisma.block.findUnique({ where: { id } });
    if (!block) throw new NotFoundException(`Block ${id} not found`);
    return block;
  }
}
