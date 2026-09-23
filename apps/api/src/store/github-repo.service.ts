import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { App, type Octokit } from 'octokit';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GithubFile {
  text: string;
  /** Git blob SHA — identical to `git hash-object`, and what a write must be based on. */
  sha: string;
}

export interface FileDiff {
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  /** Unified diff of this one file; absent when GitHub judges it not worth rendering (e.g. binary). */
  patch?: string;
  additions: number;
  deletions: number;
}

export const MAIN = 'main';

interface Target {
  owner: string;
  repo: string;
  octokit: Octokit;
}

/**
 * Thin wrapper around the GitHub Contents/Git/Repos APIs, authenticated as the Stormm
 * GitHub App. Every method takes `projectId` first and resolves it to a repo via the
 * `GithubInstallation` a project was linked to through the Connect GitHub flow
 * (github-connect/) — falling back to the single `GITHUB_REPO`/`GITHUB_APP_INSTALLATION_ID`
 * in `.env` for a project (or `null`, "no project") that was never connected.
 *
 * Every read/write also takes a `ref` (branch name); callers default to `MAIN` for the
 * agreed state and use a per-user branch for in-progress edits.
 */
@Injectable()
export class GithubRepo {
  private appPromise: Promise<App> | null = null;
  // Installation octokit clients are cheap to keep around for the process lifetime — each
  // covers one repo, and there's at most a handful of projects open at once.
  private readonly octokitByInstallation = new Map<string, Promise<Octokit>>();

  constructor(private readonly prisma: PrismaService) {}

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

  private async octokitFor(installationId: string): Promise<Octokit> {
    let client = this.octokitByInstallation.get(installationId);
    if (!client) {
      client = this.app().then((app) => app.getInstallationOctokit(Number(installationId)));
      this.octokitByInstallation.set(installationId, client);
    }
    return client;
  }

  private async target(projectId: string | null): Promise<Target> {
    const link = projectId ? await this.prisma.githubInstallation.findUnique({ where: { projectId } }) : null;
    if (link) return { owner: link.owner, repo: link.repo, octokit: await this.octokitFor(link.installationId) };

    const repoSpec = process.env.GITHUB_REPO ?? '';
    const [owner, repo] = repoSpec.split('/');
    if (!owner || !repo) throw new Error(`GITHUB_REPO must be "owner/repo", got "${repoSpec}"`);
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    if (!installationId) throw new Error('GITHUB_APP_INSTALLATION_ID is not set');
    return { owner, repo, octokit: await this.octokitFor(installationId) };
  }

  /** `null` if the file doesn't exist on `ref`. */
  async readFile(projectId: string | null, path: string, ref: string = MAIN): Promise<GithubFile | null> {
    const { owner, repo, octokit } = await this.target(projectId);
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
      if (Array.isArray(data) || data.type !== 'file') return null;
      return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  /** File names directly inside `path` on `ref` (non-recursive); `[]` if the folder doesn't exist. */
  async listFiles(projectId: string | null, path: string, ref: string = MAIN): Promise<{ name: string; sha: string }[]> {
    const { owner, repo, octokit } = await this.target(projectId);
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
      return Array.isArray(data) ? data.filter((d) => d.type === 'file').map((d) => ({ name: d.name, sha: d.sha })) : [];
    } catch (e) {
      if (isNotFound(e)) return [];
      throw e;
    }
  }

  /** Creates or updates `path` on `branch`. Pass the current `sha` to update a file; omit it to create one. Returns the new blob SHA. */
  async writeFile(
    projectId: string | null,
    path: string,
    text: string,
    opts: { sha?: string; message: string; branch?: string },
  ): Promise<string> {
    const { owner, repo, octokit } = await this.target(projectId);
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: opts.message,
      content: Buffer.from(text, 'utf8').toString('base64'),
      sha: opts.sha,
      branch: opts.branch ?? MAIN,
    });
    return data.content!.sha!;
  }

  async deleteFile(projectId: string | null, path: string, sha: string, message: string, branch: string = MAIN): Promise<void> {
    const { owner, repo, octokit } = await this.target(projectId);
    await octokit.rest.repos.deleteFile({ owner, repo, path, message, sha, branch });
  }

  /** The commit SHA `branch` currently points at, or `null` if the branch doesn't exist. */
  async branchSha(projectId: string | null, branch: string): Promise<string | null> {
    const { owner, repo, octokit } = await this.target(projectId);
    try {
      const { data } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
      return data.object.sha;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  /** Creates `branch` from `fromSha`. */
  async createBranch(projectId: string | null, branch: string, fromSha: string): Promise<void> {
    const { owner, repo, octokit } = await this.target(projectId);
    await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: fromSha });
  }

  /** `branch`, creating it from `MAIN`'s current tip first if it doesn't exist yet. Returns its sha. */
  async ensureBranch(projectId: string | null, branch: string): Promise<string> {
    const existing = await this.branchSha(projectId, branch);
    if (existing) return existing;
    const mainSha = await this.branchSha(projectId, MAIN);
    if (!mainSha) throw new Error(`${MAIN} branch not found`);
    await this.createBranch(projectId, branch, mainSha);
    return mainSha;
  }

  async deleteBranch(projectId: string | null, branch: string): Promise<void> {
    const { owner, repo, octokit } = await this.target(projectId);
    await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` }).catch((e) => {
      if (!isNotFound(e)) throw e;
    });
  }

  /** The diff for one file between `base` and `head`; `null` if the file didn't change. */
  async diffFile(projectId: string | null, base: string, head: string, path: string): Promise<FileDiff | null> {
    const { owner, repo, octokit } = await this.target(projectId);
    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${base}...${head}` });
    const file = data.files?.find((f) => f.filename === path);
    if (!file) return null;
    return { status: file.status, patch: file.patch, additions: file.additions, deletions: file.deletions };
  }

  /** The open pull request for `head` into `base`, if one exists. */
  async findOpenPullRequest(projectId: string | null, base: string, head: string): Promise<{ number: number } | null> {
    const { owner, repo, octokit } = await this.target(projectId);
    const { data } = await octokit.rest.pulls.list({ owner, repo, state: 'open', base, head: `${owner}:${head}` });
    return data[0] ? { number: data[0].number } : null;
  }

  /** Opens a pull request for `head` into `base`, or returns the existing one if there already is one. */
  async openPullRequest(projectId: string | null, base: string, head: string, title: string): Promise<{ number: number }> {
    const { owner, repo, octokit } = await this.target(projectId);
    try {
      const { data } = await octokit.rest.pulls.create({ owner, repo, base, head, title });
      return { number: data.number };
    } catch (e) {
      const existing = await this.findOpenPullRequest(projectId, base, head);
      if (existing) return existing;
      throw e;
    }
  }

  /**
   * Merges `head` into `base`. Returns `'merged'`, `'up-to-date'` (nothing to merge), or
   * `'conflict'` (needs a manual resolution GitHub can't fast-forward or auto-merge).
   */
  async merge(projectId: string | null, base: string, head: string, message: string): Promise<'merged' | 'up-to-date' | 'conflict'> {
    const { owner, repo, octokit } = await this.target(projectId);
    try {
      const res = await octokit.rest.repos.merge({ owner, repo, base, head, commit_message: message });
      return (res.status as number) === 204 ? 'up-to-date' : 'merged';
    } catch (e) {
      if (isConflict(e)) return 'conflict';
      throw e;
    }
  }
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'status' in e && (e as { status: unknown }).status === 404;
}

function isConflict(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'status' in e && (e as { status: unknown }).status === 409;
}
