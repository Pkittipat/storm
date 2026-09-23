import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubAppClient } from './github-app.service.js';

interface PendingConnect {
  projectId: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

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

  /** Verifies `state`, looks up the new installation's repo, and saves the link. Returns the project id to redirect back to. */
  async completeConnect(installationId: string, state: string): Promise<string> {
    const found = this.pending.get(state);
    this.pending.delete(state); // single-use regardless of outcome
    if (!found || found.expiresAt < Date.now()) throw new BadRequestException('This connect link has expired or was already used');

    const { owner, repo } = await this.githubApp.repoForInstallation(installationId);
    await this.prisma.githubInstallation.upsert({
      where: { projectId: found.projectId },
      create: { projectId: found.projectId, installationId, owner, repo },
      update: { installationId, owner, repo },
    });
    return found.projectId;
  }

  private sweep() {
    const now = Date.now();
    for (const [state, p] of this.pending) if (p.expiresAt < now) this.pending.delete(state);
  }
}
