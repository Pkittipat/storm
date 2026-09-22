import { Module } from '@nestjs/common';
import { GithubRepo } from './github-repo.service.js';
import { ProcessStore } from './process-store.service.js';
import { ProcessesController, ProjectsController } from './store.controllers.js';

@Module({
  controllers: [ProjectsController, ProcessesController],
  providers: [ProcessStore, GithubRepo],
})
export class StoreModule {}
