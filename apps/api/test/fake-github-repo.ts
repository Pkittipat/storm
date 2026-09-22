import { blobSha } from '../src/store/process-store.service.js';

const MAIN = 'main';

class GithubApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * In-memory stand-in for GithubRepo, so e2e tests can exercise ProcessStore
 * without hitting a real GitHub repo. Mirrors the Contents/Git API semantics
 * ProcessStore relies on: blob SHAs, per-branch content, and merge/diff between them.
 */
export class FakeGithubRepo {
  // branch -> path -> text. Branches other than `main` start as a shallow copy of
  // whatever `main` held when they were created, same as a real git branch.
  private readonly branches = new Map<string, Map<string, string>>([[MAIN, new Map()]]);
  // "base->head" pairs with an open pull request, fake PR numbers assigned in order opened.
  private readonly openPulls = new Map<string, number>();
  private nextPullNumber = 1;

  private files(ref: string): Map<string, string> {
    const files = this.branches.get(ref);
    if (!files) throw new GithubApiError(404, `no such branch: ${ref}`);
    return files;
  }

  /** Like a real 404 from GitHub: a missing branch reads the same as a missing file. */
  async readFile(path: string, ref: string = MAIN): Promise<{ text: string; sha: string } | null> {
    const text = this.branches.get(ref)?.get(path);
    return text === undefined ? null : { text, sha: blobSha(text) };
  }

  async listFiles(path: string, ref: string = MAIN): Promise<{ name: string; sha: string }[]> {
    const prefix = `${path}/`;
    const files = this.branches.get(ref);
    if (!files) return [];
    return [...files.keys()]
      .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map((p) => ({ name: p.slice(prefix.length), sha: blobSha(files.get(p)!) }));
  }

  async writeFile(path: string, text: string, opts: { sha?: string; message: string; branch?: string }): Promise<string> {
    const files = this.files(opts.branch ?? MAIN);
    const current = files.get(path);
    if (opts.sha !== undefined && (current === undefined || blobSha(current) !== opts.sha))
      throw new GithubApiError(409, 'sha does not match current file');
    files.set(path, text);
    return blobSha(text);
  }

  async deleteFile(path: string, sha: string, _message: string, branch: string = MAIN): Promise<void> {
    const files = this.files(branch);
    const current = files.get(path);
    if (current === undefined || blobSha(current) !== sha) throw new GithubApiError(409, 'sha does not match current file');
    files.delete(path);
  }

  async branchSha(branch: string): Promise<string | null> {
    return this.branches.has(branch) ? branch : null; // a fake "commit sha", just an opaque non-null marker
  }

  async createBranch(branch: string): Promise<void> {
    this.branches.set(branch, new Map(this.files(MAIN)));
  }

  async ensureBranch(branch: string): Promise<string> {
    if (!this.branches.has(branch)) await this.createBranch(branch);
    return (await this.branchSha(branch))!;
  }

  async deleteBranch(branch: string): Promise<void> {
    this.branches.delete(branch);
  }

  async diffFile(base: string, head: string, path: string) {
    const before = this.files(base).get(path);
    const after = this.files(head).get(path);
    if (before === after) return null;
    return { status: 'modified' as const, patch: `--- ${path}\n+++ ${path}\n(fake diff)`, additions: 0, deletions: 0 };
  }

  async merge(base: string, head: string): Promise<'merged' | 'up-to-date' | 'conflict'> {
    const baseFiles = this.files(base);
    const headFiles = this.files(head);
    let changed = false;
    for (const [path, text] of headFiles) {
      if (baseFiles.get(path) !== text) {
        baseFiles.set(path, text);
        changed = true;
      }
    }
    this.openPulls.delete(`${base}->${head}`); // merging closes any open PR, same as real GitHub
    return changed ? 'merged' : 'up-to-date';
  }

  async findOpenPullRequest(base: string, head: string): Promise<{ number: number } | null> {
    const number = this.openPulls.get(`${base}->${head}`);
    return number === undefined ? null : { number };
  }

  async openPullRequest(base: string, head: string): Promise<{ number: number }> {
    const key = `${base}->${head}`;
    const existing = this.openPulls.get(key);
    if (existing !== undefined) return { number: existing };
    const number = this.nextPullNumber++;
    this.openPulls.set(key, number);
    return { number };
  }

  // ── Test-only helpers, not part of GithubRepo's interface ──────────────────

  /** Reads a file's raw text directly, bypassing the store, to assert on what was committed. */
  read(path: string, branch: string = MAIN): string | undefined {
    return this.files(branch).get(path);
  }

  /** Writes a file directly, bypassing the store, to simulate a hand-edited file. */
  handWrite(path: string, text: string, branch: string = MAIN): void {
    this.files(branch).set(path, text);
  }

  /** File names directly inside `path`, for asserting which files exist after a move. */
  namesIn(path: string, branch: string = MAIN): string[] {
    const prefix = `${path}/`;
    const files = this.files(branch);
    return [...files.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map((p) => p.slice(prefix.length));
  }
}
