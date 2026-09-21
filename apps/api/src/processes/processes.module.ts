import { Module } from '@nestjs/common';
import { ProcessesController } from './processes.controller.js';
import { ProcessesService } from './processes.service.js';

@Module({
  controllers: [ProcessesController],
  providers: [ProcessesService],
})
export class ProcessesModule {}
