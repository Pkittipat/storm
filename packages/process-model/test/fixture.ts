import { readFileSync } from 'node:fs'
import { parseBoard, type Board } from '../src'

export const CHECKOUT_YAML = readFileSync(new URL('./checkout.yaml', import.meta.url), 'utf8')

export function checkout(): Board {
  const { board, issues } = parseBoard(CHECKOUT_YAML)
  if (!board) throw new Error(JSON.stringify(issues))
  return board
}
