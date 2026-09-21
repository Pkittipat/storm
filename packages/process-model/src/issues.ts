export type IssueLevel = 'error' | 'warning'

export interface Issue {
  level: IssueLevel
  code: string
  message: string
  /** Where in the file, e.g. `flows[0].blocks[2].kind`. */
  path?: string
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === 'error')
