import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { hasErrors, parseBoard, validate, type Board, type Issue } from '@stormm/process-model'
import { changes, renderChanges } from './changes.js'
import { buildContract } from './contract.js'
import { renderExplain } from './render.js'

const USAGE = `stormm: tools for a Stormm process YAML

  stormm check <process.yaml>
      Validate the storm with the same rules as the Stormm app. Exits 1 on errors.

  stormm changes <process.yaml> --since <git-ref> [--json]
      What differs in the storm since <git-ref>, matched by block id, in the YAML's own terms.
      A file that didn't exist at <git-ref> counts as all new.

  stormm explain <process.yaml> [--json]
      A reading aid for people: units, arrows, slices, the read side and gaps.
`

function fail(message: string, code = 1): never {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

function load(text: string, where: string): { board: Board; issues: Issue[] } {
  const { board, issues } = parseBoard(text)
  if (!board) fail(`${where} can't be read:\n${issues.map((i) => `- ${i.level}: ${i.message}`).join('\n')}`)
  const all = [...issues, ...validate(board)]
  if (hasErrors(all)) fail(`${where} has errors:\n${all.filter((i) => i.level === 'error').map((i) => `- ${i.message}`).join('\n')}`)
  return { board, issues: all }
}

/** The file as it was at `ref`, or null if it didn't exist then. */
function atRef(file: string, ref: string): string | null {
  const cwd = dirname(file)
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd, stdio: 'pipe' })
  } catch {
    fail(`"${ref}" is not a commit in this repository.`)
  }
  try {
    return execFileSync('git', ['show', `${ref}:./${basename(file)}`], { cwd, stdio: 'pipe', encoding: 'utf8' })
  } catch {
    return null
  }
}

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const v = args[i + 1]
  args.splice(i, 2)
  return v ?? fail(`${name} needs a value.`, 2)
}
const json = args.includes('--json')
if (json) args.splice(args.indexOf('--json'), 1)
const since = flag('--since')
const [command, path] = args
if (!command || command === 'help' || command === '--help' || !path) fail(USAGE, command ? 2 : 0)

const file = resolve(path)
let text: string
try {
  text = readFileSync(file, 'utf8')
} catch {
  fail(`Can't read ${path}.`)
}
if (command === 'check') {
  const { board, issues: parseIssues } = parseBoard(text)
  const issues = board ? [...parseIssues, ...validate(board)] : parseIssues
  for (const i of issues) process.stdout.write(`${i.level}: ${i.message}${i.path ? ` (${i.path})` : ''}\n`)
  if (!board || hasErrors(issues)) process.exit(1)
  process.stdout.write(`ok: ${path} is a valid storm (${board.blocks.length} blocks, ${board.connections.length} connections${issues.length ? `, ${issues.length} warning${issues.length > 1 ? 's' : ''}` : ''})\n`)
  process.exit(0)
}

const { board, issues } = load(text, path)
const contract = buildContract(board)

if (command === 'explain') {
  process.stdout.write(json ? JSON.stringify({ ...contract, issues }, null, 2) + '\n' : renderExplain(contract, issues))
} else if (command === 'changes') {
  if (!since) fail('changes needs --since <git-ref>.', 2)
  const old = atRef(file, since)
  const before = old === null ? null : load(old, `${path} at ${since}`).board
  const diff = changes(before, board)
  process.stdout.write(json ? JSON.stringify({ since, new: before === null, ...diff }, null, 2) + '\n' : renderChanges(diff, before, board, since))
} else {
  fail(USAGE, 2)
}
