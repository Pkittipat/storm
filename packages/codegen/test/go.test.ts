import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseBoard } from '@stormm/process-model'
import { describe, expect, it } from 'vitest'
import { generateGo, type GeneratedFile } from '../src'
import { readFileSync } from 'node:fs'

const board = (yaml: string) => {
  const { board, issues } = parseBoard(yaml)
  if (!board) throw new Error(JSON.stringify(issues))
  return board
}
const CHECKOUT = readFileSync(new URL('./checkout.yaml', import.meta.url), 'utf8')

const hasGo = (() => {
  try {
    execFileSync('go', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

/** Writes the files to a temp dir (as their paths say, minus the output root) and returns it. */
function materialize(files: GeneratedFile[], root: string) {
  const dir = mkdtempSync(join(tmpdir(), 'stormm-codegen-'))
  for (const f of files) {
    const out = join(dir, f.path.slice(root.length + 1))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, f.content)
  }
  return dir
}

describe('generateGo', () => {
  it('is deterministic', () => {
    expect(generateGo(board(CHECKOUT))).toEqual(generateGo(board(CHECKOUT)))
  })

  it('puts the code beside the YAML, one package per aggregate, stubs marked as yours', () => {
    const { files } = generateGo(board(CHECKOUT))
    const paths = Object.fromEntries(files.map((f) => [f.path, f.kind]))
    expect(paths).toMatchObject({
      'stormm/generated/checkout/go.mod': 'generated',
      'stormm/generated/checkout/domain/domain.go': 'generated',
      'stormm/generated/checkout/domain/types.go': 'stub',
      'stormm/generated/checkout/domain/order/order_gen.go': 'generated',
      'stormm/generated/checkout/domain/order/order.go': 'stub',
      'stormm/generated/checkout/domain/order/order_gen_test.go': 'generated',
      'stormm/generated/checkout/domain/shipment/shipment.go': 'stub',
    })
  })

  it('reads commands, events and aggregates off the connections, keeping actor and hotspots as comments', () => {
    const { files } = generateGo(board(CHECKOUT))
    const gen = files.find((f) => f.path.endsWith('order/order_gen.go'))!.content
    expect(gen).toContain('type PlaceOrder struct')
    expect(gen).toContain('// PlaceOrder is the "Place order" command. Performed by Customer.')
    expect(gen).toContain('// Open question: What if the cart is empty?')
    expect(gen).toContain('func (a *Order) PlaceOrder(cmd PlaceOrder) error')
    expect(gen).toContain('type OrderPlaced struct')
  })

  it('respects the output root and module path', () => {
    const { files } = generateGo(board(CHECKOUT), { outputRoot: 'backend', modulePath: 'github.com/acme/shop', goMod: false })
    expect(files.every((f) => f.path.startsWith('backend/'))).toBe(true)
    expect(files.some((f) => f.path.endsWith('go.mod'))).toBe(false)
    expect(files.find((f) => f.path.endsWith('order_gen.go'))!.content).toContain('"github.com/acme/shop/domain"')
  })

  it('reports gaps as issues instead of failing', () => {
    const partial = board(`schemaVersion: 1
id: draft
name: Draft
blocks:
  - { id: place, kind: command, title: Place order }
  - { id: order, kind: aggregate, title: Order }
  - { id: lonely, kind: event, title: Lonely event }
connections:
  - { from: place, to: order }
`)
    const { files, issues } = generateGo(partial)
    expect(issues.map((i) => i.code).sort()).toEqual(['codegen/no-event', 'codegen/orphan-event'])
    expect(files.some((f) => f.path.endsWith('order_gen.go'))).toBe(true)
  })

  it.skipIf(!hasGo)('generates code that builds, vets and passes its own tests', () => {
    const { files } = generateGo(board(CHECKOUT))
    const dir = materialize(files, 'stormm/generated/checkout')
    try {
      const run = (...args: string[]) => execFileSync('go', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
      expect(run('build', './...')).toBe('')
      expect(execFileSync('gofmt', ['-l', '.'], { cwd: dir, encoding: 'utf8' })).toBe('')
      run('vet', './...')
      run('test', './...')
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message: string }
      throw new Error(`${err.message}\n${err.stdout ?? ''}${err.stderr ?? ''}`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
