import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { App } from 'octokit';

/**
 * App-level GitHub access — the App's own identity, not scoped to any one installation.
 * Used only during the connect flow, to look up which repo a fresh `installation_id`
 * (one the App wasn't necessarily configured with at startup) actually points to.
 * `GithubRepo` (in `store/`) is the installation-scoped counterpart used for everyday
 * file reads/writes once a project's installation is known.
 */
@Injectable()
export class GithubAppClient {
  private appPromise: Promise<App> | null = null;

  private async app(): Promise<App> {
    if (!this.appPromise) {
      this.appPromise = (async () => {
        const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
        if (!keyPath) throw new Error('GITHUB_APP_PRIVATE_KEY_PATH is not set');
        const privateKey = await readFile(resolve(keyPath), 'utf8');
        return new App({ appId: process.env.GITHUB_APP_ID!, privateKey });
      })();
    }
    return this.appPromise;
  }

  /** Every repo an installation was granted access to — one per Stormm project, but the person installing picks, so it isn't always exactly one. */
  async reposForInstallation(installationId: string): Promise<{ owner: string; repo: string }[]> {
    const app = await this.app();
    const octokit = await app.getInstallationOctokit(Number(installationId));
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation();
    return data.repositories.map((r) => ({ owner: r.owner.login, repo: r.name }));
  }
}
