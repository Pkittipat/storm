import type { Board, Issue } from '@stormm/process-model'

export interface Project {
  id: string
  name: string
}

export interface ProcessSummary {
  id: string
  name: string
  /** null = listed under "No project". */
  projectId: string | null
  /** The file can't be read as a process (e.g. a bad hand edit); opening it explains why. */
  broken?: boolean
}

/** One `stormm/processes/<id>.yaml` file as the API returns it. */
export interface ProcessFile {
  projectId: string | null
  board: Board
  /** Git blob SHA of the stored file; a save must name the version it builds on. */
  version: string
  issues: Issue[]
}

export class ApiError extends Error {
  readonly status: number
  readonly body: { message?: string | string[]; issues?: Issue[]; version?: string } | null
  constructor(message: string, status: number, body: ApiError['body']) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new ApiError(message ?? `${method} ${path} failed (${res.status})`, res.status, data)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  listProcesses: () => request<ProcessSummary[]>('GET', '/processes'),
  getProcess: (id: string) => request<ProcessFile>('GET', `/processes/${id}`),
  createProcess: (name: string, projectId: string | null = null) => request<ProcessFile>('POST', '/processes', { name, projectId }),
  /** Replaces the whole file; refused (409) if it changed since `baseVersion`, or (422) if the YAML has errors. */
  saveProcess: (id: string, yaml: string, baseVersion: string) => request<ProcessFile>('PUT', `/processes/${id}`, { yaml, baseVersion }),
  moveProcess: (id: string, projectId: string | null) => request<ProcessSummary>('PATCH', `/processes/${id}`, { projectId }),
  deleteProcess: (id: string) => request<void>('DELETE', `/processes/${id}`),
  listProjects: () => request<Project[]>('GET', '/projects'),
  createProject: (name: string) => request<Project>('POST', '/projects', { name }),
  renameProject: (id: string, name: string) => request<Project>('PATCH', `/projects/${id}`, { name }),
  deleteProject: (id: string) => request<void>('DELETE', `/projects/${id}`),
}
