import { Module } from '@nestjs/common';
import { ProcessStore } from './process-store.service.js';
import { ProcessesController, ProjectsController } from './store.controllers.js';

@Module({
  controllers: [ProjectsController, ProcessesController],
  providers: [ProcessStore],
})
export class StoreModule {}
