import { Module } from '@nestjs/common';
import { GithubAppClient } from './github-app.service.js';
import { GithubConnectController } from './github-connect.controller.js';
import { GithubConnectService } from './github-connect.service.js';

@Module({
  controllers: [GithubConnectController],
  providers: [GithubConnectService, GithubAppClient],
})
export class GithubConnectModule {}
