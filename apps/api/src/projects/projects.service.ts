import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  listProjects() {
    return this.prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  createProject(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { name: dto.name },
      select: { id: true, name: true },
    });
  }

  async updateProject(id: string, dto: UpdateProjectDto) {
    await this.findProject(id);
    return this.prisma.project.update({
      where: { id },
      data: { name: dto.name },
      select: { id: true, name: true },
    });
  }

  /** Its processes stay, moved to "No project". */
  async deleteProject(id: string) {
    await this.findProject(id);
    await this.prisma.project.delete({ where: { id } });
  }

  private async findProject(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }
}
