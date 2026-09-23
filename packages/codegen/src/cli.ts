import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseBoard } from '@stormm/process-model'
import { generateGo } from './go.js'

// Development preview: writes the generated code to a throwaway folder so it can be opened in an editor and tested.
//   pnpm codegen <process.yaml> [outDir]      (default outDir: .stormm-tmp/<process id>)
// pnpm runs scripts inside the package folder; INIT_CWD is where the user actually typed the command.
const base = process.env.INIT_CWD ?? process.cwd()
const [file, out] = process.argv.slice(2)
if (!file) {
  console.error('usage: pnpm codegen <process.yaml> [outDir]')
  process.exit(2)
}
const { board, issues: parseIssues } = parseBoard(readFileSync(resolve(base, file), 'utf8'))
if (!board) {
  console.error(parseIssues.map((i) => `${i.level}: ${i.message}`).join('\n'))
  process.exit(1)
}
const dir = resolve(base, out ?? join('.stormm-tmp', board.id))
// The files carry their repository path; here they go straight under `dir`.
const { files, issues } = generateGo(board, { outputRoot: '.' })
for (const f of files) {
  const target = join(dir, f.path.replace(/^\.\//, ''))
  if (f.kind === 'stub' && existsSync(target)) {
    console.log(`kept   ${target} (yours)`)
    // New commands or events need a hook in the stub; say which, with the code to paste in.
    const mine = readFileSync(target, 'utf8')
    for (const chunk of f.content.split(/\n\n+/)) {
      const name = /^func \(a \*\w+\) (\w+)\(/m.exec(chunk)?.[1]
      if (name && !mine.includes(`) ${name}(`)) console.log(`\n  missing hook ${name} in ${target}; add:\n\n${chunk.replace(/^/gm, '    ')}\n`)
    }
    continue
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, f.content)
  console.log(`${f.kind === 'stub' ? 'stub  ' : 'wrote '} ${target}`)
}
for (const i of issues) console.log(`${i.level}: ${i.message}`)
console.log(`\ncd ${dir} && go test ./...`)
