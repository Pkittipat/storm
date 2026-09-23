import { Body, Controller, Get, HttpCode, Param, Post, Query, Redirect } from '@nestjs/common';
import { ChooseRepoDto } from './dto.js';
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

  /**
   * Where GitHub sends the browser back to after the person installs, updates, or cancels
   * the App. `setup_action` is `install` for a brand new installation or `update` when the
   * App (or its repo access) was already installed and they changed something — both mean
   * "go ahead," only a missing/other value means they backed out.
   */
  @Get('github/callback')
  @Redirect()
  async callback(@Query('installation_id') installationId?: string, @Query('state') state?: string, @Query('setup_action') setupAction?: string) {
    const frontend = process.env.CORS_ORIGIN ?? '';
    if ((setupAction !== 'install' && setupAction !== 'update') || !installationId || !state)
      return { url: `${frontend}/#/?github=cancelled` };

    const result = await this.connect.completeConnect(installationId, state);
    if (result.status === 'connected') return { url: `${frontend}/#/?github=connected&project=${result.projectId}` };

    const repos = result.repos.map((r) => `${r.owner}/${r.repo}`).join(',');
    return {
      url: `${frontend}/#/?github=choose&project=${result.projectId}&installation=${result.installationId}&repos=${encodeURIComponent(repos)}`,
    };
  }

  /** Finishes a connect that needed a repo choice (the installation covers more than one). */
  @Post('projects/:id/github/repo')
  @HttpCode(204)
  chooseRepo(@Param('id') id: string, @Body() dto: ChooseRepoDto) {
    return this.connect.chooseRepo(id, dto.installationId, dto.owner, dto.repo);
  }

  /** Installations already linked to some other project — lets a new project reuse one without going through GitHub again. */
  @Get('github/installations')
  listInstallations() {
    return this.connect.knownInstallations();
  }

  /** A known installation's repos, live from GitHub, for the "connect to existing" picker. */
  @Get('github/installations/:installationId/repos')
  listRepos(@Param('installationId') installationId: string) {
    return this.connect.reposForInstallation(installationId);
  }
}
