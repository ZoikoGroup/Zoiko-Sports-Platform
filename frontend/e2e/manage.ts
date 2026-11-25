import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface BackendInfo {
  python: string
  backend: string
  settings: Record<string, string>
}

/** Runs `manage.py <args>` against the suite's throwaway backend (started by start-backend.mjs). */
export function manage(...args: string[]): string {
  const info = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '.tmp', 'backend.json'), 'utf8'),
  ) as BackendInfo
  return execFileSync(info.python, ['manage.py', ...args], {
    cwd: info.backend,
    env: { ...process.env, ...info.settings },
    encoding: 'utf8',
  })
}

/** Public ID of the demo organization with this exact name (`organizations list`). */
export function organizationId(name: string): string {
  const line = manage('organizations', 'list')
    .split(/\r?\n/)
    .find((row) => row.trimEnd().endsWith(`  ${name}`))
  if (!line) throw new Error(`No organization named ${name}`)
  return line.split(/\s+/)[0]
}
