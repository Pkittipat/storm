import type { BlockKind } from './components'

export interface BlockField {
  name: string
  type: string
}

export interface Block {
  id: string
  processId: string
  kind: BlockKind
  title: string
  x: number
  y: number
  actor: string | null
  hotspots: string[]
  fields: BlockField[]
}

export interface Connection {
  id: string
  processId: string
  sourceId: string
  targetId: string
}

export interface ProcessSummary {
  id: string
  name: string
}

export interface Process extends ProcessSummary {
  blocks: Block[]
  connections: Connection[]
}

export type BlockPatch = Partial<Pick<Block, 'title' | 'x' | 'y' | 'hotspots' | 'fields'>> & { actor?: string }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new Error(message ?? `${method} ${path} failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  listProcesses: () => request<ProcessSummary[]>('GET', '/processes'),
  getProcess: (id: string) => request<Process>('GET', `/processes/${id}`),
  createProcess: (name: string) => request<Process>('POST', '/processes', { name }),
  renameProcess: (id: string, name: string) => request<ProcessSummary>('PATCH', `/processes/${id}`, { name }),
  deleteProcess: (id: string) => request<void>('DELETE', `/processes/${id}`),
  createBlock: (processId: string, block: Pick<Block, 'kind' | 'title' | 'x' | 'y'>) =>
    request<Block>('POST', `/processes/${processId}/blocks`, block),
  updateBlock: (id: string, patch: BlockPatch) => request<Block>('PATCH', `/blocks/${id}`, patch),
  deleteBlock: (id: string) => request<void>('DELETE', `/blocks/${id}`),
  createConnection: (processId: string, sourceId: string, targetId: string) =>
    request<Connection>('POST', `/processes/${processId}/connections`, { sourceId, targetId }),
  deleteConnection: (id: string) => request<void>('DELETE', `/connections/${id}`),
}
