import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseBoard, type Board } from '@stormm/process-model'
import { describe, expect, it } from 'vitest'
import { buildContract, changes, names } from '../src'

const PUBLISH_JOB = readFileSync(new URL('../../../plugins/stormm/skills/storm-to-code/examples/go/stormm/publish-job.yaml', import.meta.url), 'utf8')
const board = (yaml: string): Board => {
  const { board, issues } = parseBoard(yaml)
  if (!board) throw new Error(JSON.stringify(issues))
  return board
}

describe('names', () => {
  it('gives every casing from a title', () => {
    expect(names('Whenever job created, log the activity')).toEqual({
      pascal: 'WheneverJobCreatedLogTheActivity',
      camel: 'wheneverJobCreatedLogTheActivity',
      snake: 'whenever_job_created_log_the_activity',
      kebab: 'whenever-job-created-log-the-activity',
    })
  })
})

describe('buildContract', () => {
  const c = buildContract(board(PUBLISH_JOB))
  const unit = (id: string) => c.units.find((u) => u.id === id)!

  it('names each connection from both ends', () => {
    expect(unit('publish-job').links).toEqual({ fedBy: ['job-detail'], handledBy: ['job'] })
    expect(unit('job').links).toEqual({ handles: ['publish-job'], records: ['job-published'] })
    expect(unit('job-published').links.triggers).toHaveLength(2)
    expect(c.arrows.map((a) => a.text)).toContain('Job handles Publish Job')
  })

  it('reports what the storm leaves open', () => {
    expect(c.gaps).toContain('Command "Notify Member" is not handled by any aggregate: the storm doesn\'t say what decides it or which event it records.')
  })
})

describe('changes', () => {
  const after = board(PUBLISH_JOB)

  it('treats a new storm as all work to add', () => {
    const items = changes(null, after)
    expect(items.filter((i) => i.action === 'add')).toHaveLength(after.blocks.length)
    expect(items.filter((i) => i.action === 'connect')).toHaveLength(after.connections.length)
  })

  it('turns a rename, a new field and a new arrow into work', () => {
    const before = board(PUBLISH_JOB)
    const event = before.blocks.find((b) => b.id === 'job-published')!
    event.title = 'Job Created'
    event.fields = event.fields.filter((f) => f.name !== 'publishedAt')
    before.connections = before.connections.filter((c) => c.to !== 'notify-organization-members')
    const texts = changes(before, after).map((i) => i.text)
    expect(texts).toContain('Rename event `JobCreated` → `JobPublished` ("Job Created" → "Job Published"), everywhere it is used.')
    expect(texts.some((t) => t.startsWith('Fields of event Job Published') && t.includes('add publishedAt: time'))).toBe(true)
    expect(texts).toContain('New arrow: Job Published triggers Notify organization members.')
  })
})

describe('the bundled CLI', () => {
  const cli = new URL('../../../plugins/stormm/scripts/stormm.mjs', import.meta.url).pathname

  it('explains a storm', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stormm-cli-'))
    writeFileSync(join(dir, 'p.yaml'), PUBLISH_JOB)
    const out = execFileSync('node', [cli, 'explain', join(dir, 'p.yaml')], { encoding: 'utf8' })
    expect(out).toContain('### Publish Job (by Recruiter)')
    expect(out).toContain('- handled by aggregate: Job')
  })

  it('diffs against a git ref', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stormm-cli-'))
    const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' })
    git('init', '-q')
    writeFileSync(join(dir, 'p.yaml'), PUBLISH_JOB.replace('title: Job Published', 'title: Job Created'))
    git('add', '.')
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'storm')
    writeFileSync(join(dir, 'p.yaml'), PUBLISH_JOB)
    const out = execFileSync('node', [cli, 'changes', join(dir, 'p.yaml'), '--since', 'HEAD'], { encoding: 'utf8' })
    expect(out).toContain('1. Rename event `JobCreated` → `JobPublished`')
  })

  it('fails on a storm with errors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stormm-cli-'))
    writeFileSync(join(dir, 'p.yaml'), PUBLISH_JOB.replace('kind: aggregate', 'kind: entity'))
    expect(() => execFileSync('node', [cli, 'explain', join(dir, 'p.yaml')], { stdio: 'pipe' })).toThrow(/unknown kind/)
  })
})
