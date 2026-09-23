import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { GithubConnectModule } from './github-connect/github-connect.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StoreModule } from './store/store.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Processes live as YAML files (see ProcessStore); Postgres only holds the
    // project-to-GitHub-installation links (see GithubConnectModule).
    PrismaModule,
    StoreModule,
    GithubConnectModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
