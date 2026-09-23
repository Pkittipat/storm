import { Controller, Get, Param, Query, Redirect } from '@nestjs/common';
import { GithubConnectService } from './github-connect.service.js';

@Controller()
export class GithubConnectController {
  constructor(private readonly connect: GithubConnectService) {}

  /** Link a project's "Connect GitHub" button points at; sends the browser on to GitHub's install screen. */
  @Get('projects/:id/github/connect')
  @Redirect()
  start(@Param('id') id: string) {
    return { url: this.connect.startConnect(id) };
  }

  /** Where GitHub sends the browser back to after the person installs (or cancels) the App. */
  @Get('github/callback')
  @Redirect()
  async callback(@Query('installation_id') installationId?: string, @Query('state') state?: string, @Query('setup_action') setupAction?: string) {
    const frontend = process.env.CORS_ORIGIN ?? '';
    if (setupAction !== 'install' || !installationId || !state) return { url: `${frontend}/#/?github=cancelled` };
    const projectId = await this.connect.completeConnect(installationId, state);
    return { url: `${frontend}/#/?github=connected&project=${projectId}` };
  }
}
