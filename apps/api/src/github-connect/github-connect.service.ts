import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubAppClient } from './github-app.service.js';

interface PendingConnect {
  projectId: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export type ConnectResult =
  | { status: 'connected'; projectId: string }
  | { status: 'choose'; projectId: string; installationId: string; repos: { owner: string; repo: string }[] };

/**
 * The "Connect GitHub" flow: a project owner starts it, GitHub's own install screen
 * enforces that only someone with real access to a repo can grant it, and the `state`
 * token round-tripped through the redirect is what lets us attribute the resulting
 * installation to the right Stormm project (GitHub has no notion of "project").
 *
 * Pending state lives in memory, not the database — it's single-use and expires in
 * minutes, so losing it on a restart just means the user clicks "Connect" again.
 */
@Injectable()
export class GithubConnectService {
  private readonly pending = new Map<string, PendingConnect>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubApp: GithubAppClient,
  ) {}

  /** The URL to send the browser to; mints and remembers a fresh `state` for this project. */
  startConnect(projectId: string): string {
    this.sweep();
    const state = randomBytes(24).toString('base64url');
    this.pending.set(state, { projectId, expiresAt: Date.now() + STATE_TTL_MS });
    const slug = process.env.GITHUB_APP_SLUG;
    if (!slug) throw new Error('GITHUB_APP_SLUG is not set');
    return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
  }

  /**
   * Verifies `state` and looks up the installation's repos. Saves the link straight away
   * if there's exactly one (the common case); otherwise the person has to say which one —
   * an install can cover several repos (they picked more than one, or it already covered
   * others from a previous connect), and GitHub gives us no way to pre-select just one.
   */
  async completeConnect(installationId: string, state: string): Promise<ConnectResult> {
    const found = this.pending.get(state);
    this.pending.delete(state); // single-use regardless of outcome
    if (!found || found.expiresAt < Date.now()) throw new BadRequestException('This connect link has expired or was already used');

    const repos = await this.githubApp.reposForInstallation(installationId);
    if (repos.length === 0) throw new BadRequestException('No repositories were granted to this installation');
    if (repos.length > 1) return { status: 'choose', projectId: found.projectId, installationId, repos };

    await this.link(found.projectId, installationId, repos[0]);
    return { status: 'connected', projectId: found.projectId };
  }

  /** Finishes a connect that needed a repo choice — validates the pair actually belongs to this installation first. */
  async chooseRepo(projectId: string, installationId: string, owner: string, repo: string): Promise<void> {
    const repos = await this.githubApp.reposForInstallation(installationId);
    if (!repos.some((r) => r.owner === owner && r.repo === repo))
      throw new BadRequestException(`${owner}/${repo} isn't accessible to installation ${installationId}`);
    await this.link(projectId, installationId, { owner, repo });
  }

  private async link(projectId: string, installationId: string, repo: { owner: string; repo: string }): Promise<void> {
    await this.prisma.githubInstallation.upsert({
      where: { projectId },
      create: { projectId, installationId, ...repo },
      update: { installationId, ...repo },
    });
  }

  private sweep() {
    const now = Date.now();
    for (const [state, p] of this.pending) if (p.expiresAt < now) this.pending.delete(state);
  }
}
