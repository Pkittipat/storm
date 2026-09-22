import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { App } from 'octokit';

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

/**
 * Thin wrapper around the GitHub Contents/Git/Repos APIs, authenticated as the Stormm
 * GitHub App installed on one repo (`GITHUB_REPO`). Stands in for what will eventually be
 * "whichever repo this project is connected to" once more than one repo is installed.
 *
 * Every read/write takes a `ref` (branch name); callers default to `MAIN` for the agreed
 * state and use a per-user branch for in-progress edits.
 */
@Injectable()
export class GithubRepo {
  private readonly owner: string;
  private readonly repo: string;
  private octokitPromise: Promise<App['octokit']> | null = null;

  constructor() {
    const repoSpec = process.env.GITHUB_REPO ?? '';
    const [owner, repo] = repoSpec.split('/');
    if (!owner || !repo) throw new Error(`GITHUB_REPO must be "owner/repo", got "${repoSpec}"`);
    this.owner = owner;
    this.repo = repo;
  }

  private async octokit() {
    if (!this.octokitPromise) {
      const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
      if (!keyPath) throw new Error('GITHUB_APP_PRIVATE_KEY_PATH is not set');
      const privateKey = await readFile(resolve(keyPath), 'utf8');
      const app = new App({ appId: process.env.GITHUB_APP_ID!, privateKey });
      this.octokitPromise = app.getInstallationOctokit(Number(process.env.GITHUB_APP_INSTALLATION_ID));
    }
    return this.octokitPromise;
  }

  /** `null` if the file doesn't exist on `ref`. */
  async readFile(path: string, ref: string = MAIN): Promise<GithubFile | null> {
    const octokit = await this.octokit();
    try {
      const { data } = await octokit.rest.repos.getContent({ owner: this.owner, repo: this.repo, path, ref });
      if (Array.isArray(data) || data.type !== 'file') return null;
      return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  /** File names directly inside `path` on `ref` (non-recursive); `[]` if the folder doesn't exist. */
  async listFiles(path: string, ref: string = MAIN): Promise<{ name: string; sha: string }[]> {
    const octokit = await this.octokit();
    try {
      const { data } = await octokit.rest.repos.getContent({ owner: this.owner, repo: this.repo, path, ref });
      return Array.isArray(data) ? data.filter((d) => d.type === 'file').map((d) => ({ name: d.name, sha: d.sha })) : [];
    } catch (e) {
      if (isNotFound(e)) return [];
      throw e;
    }
  }

  /** Creates or updates `path` on `branch`. Pass the current `sha` to update a file; omit it to create one. Returns the new blob SHA. */
  async writeFile(path: string, text: string, opts: { sha?: string; message: string; branch?: string }): Promise<string> {
    const octokit = await this.octokit();
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message: opts.message,
      content: Buffer.from(text, 'utf8').toString('base64'),
      sha: opts.sha,
      branch: opts.branch ?? MAIN,
    });
    return data.content!.sha!;
  }

  async deleteFile(path: string, sha: string, message: string, branch: string = MAIN): Promise<void> {
    const octokit = await this.octokit();
    await octokit.rest.repos.deleteFile({ owner: this.owner, repo: this.repo, path, message, sha, branch });
  }

  /** The commit SHA `branch` currently points at, or `null` if the branch doesn't exist. */
  async branchSha(branch: string): Promise<string | null> {
    const octokit = await this.octokit();
    try {
      const { data } = await octokit.rest.git.getRef({ owner: this.owner, repo: this.repo, ref: `heads/${branch}` });
      return data.object.sha;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  /** Creates `branch` from `fromSha`. */
  async createBranch(branch: string, fromSha: string): Promise<void> {
    const octokit = await this.octokit();
    await octokit.rest.git.createRef({ owner: this.owner, repo: this.repo, ref: `refs/heads/${branch}`, sha: fromSha });
  }

  /** `branch`, creating it from `MAIN`'s current tip first if it doesn't exist yet. Returns its sha. */
  async ensureBranch(branch: string): Promise<string> {
    const existing = await this.branchSha(branch);
    if (existing) return existing;
    const mainSha = await this.branchSha(MAIN);
    if (!mainSha) throw new Error(`${MAIN} branch not found`);
    await this.createBranch(branch, mainSha);
    return mainSha;
  }

  async deleteBranch(branch: string): Promise<void> {
    const octokit = await this.octokit();
    await octokit.rest.git.deleteRef({ owner: this.owner, repo: this.repo, ref: `heads/${branch}` }).catch((e) => {
      if (!isNotFound(e)) throw e;
    });
  }

  /** The diff for one file between `base` and `head`; `null` if the file didn't change. */
  async diffFile(base: string, head: string, path: string): Promise<FileDiff | null> {
    const octokit = await this.octokit();
    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
      owner: this.owner,
      repo: this.repo,
      basehead: `${base}...${head}`,
    });
    const file = data.files?.find((f) => f.filename === path);
    if (!file) return null;
    return { status: file.status, patch: file.patch, additions: file.additions, deletions: file.deletions };
  }

  /**
   * Merges `head` into `base`. Returns `'merged'`, `'up-to-date'` (nothing to merge), or
   * `'conflict'` (needs a manual resolution GitHub can't fast-forward or auto-merge).
   */
  async merge(base: string, head: string, message: string): Promise<'merged' | 'up-to-date' | 'conflict'> {
    const octokit = await this.octokit();
    try {
      const res = await octokit.rest.repos.merge({ owner: this.owner, repo: this.repo, base, head, commit_message: message });
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
