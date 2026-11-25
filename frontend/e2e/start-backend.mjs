// Boots an isolated Django instance for the end-to-end suite: a throwaway
// PostgreSQL 16 container (random password, free local port, removed when the
// run ends), seeded demo accounts (password from ZS_DEMO_PASSWORD, generated per
// run by playwright.config.ts), and emails written to files the tests read.
//
// Needs Docker. To use an existing PostgreSQL instead, set E2E_DATABASE_HOST
// (plus E2E_DATABASE_PORT / _NAME / _USER / _PASSWORD); its database is migrated
// and seeded in place.
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const POSTGRES_IMAGE = 'postgres:16-bookworm'
const LABEL = 'zoiko-sports.e2e=1'

const here = dirname(fileURLToPath(import.meta.url))
const backend = resolve(here, '..', '..', 'backend')
const tmp = join(here, '.tmp')
const python = [join(backend, '.venv', 'Scripts', 'python.exe'), join(backend, '.venv', 'bin', 'python')].find(existsSync)
if (!python) throw new Error(`No virtualenv found in ${backend}/.venv — create it and install requirements-dev.txt`)

rmSync(tmp, { recursive: true, force: true })
mkdirSync(join(tmp, 'mail'), { recursive: true })

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim()

let container = null
function removeContainer() {
  if (!container) return
  try {
    docker('rm', '-f', container)
  } catch {
    // Already gone.
  }
  container = null
}

function startDatabase() {
  // Containers from a run that was killed before it could clean up.
  const stale = docker('ps', '-aq', '--filter', `label=${LABEL}`)
  if (stale) docker('rm', '-f', ...stale.split(/\s+/))

  const password = randomBytes(18).toString('base64url')
  container = docker(
    'run', '-d', '--rm', '--label', LABEL,
    '-e', 'POSTGRES_USER=zoiko', '-e', 'POSTGRES_DB=zoiko_e2e', '-e', `POSTGRES_PASSWORD=${password}`,
    '-p', '127.0.0.1::5432',
    POSTGRES_IMAGE,
  )
  const port = docker('port', container, '5432/tcp').split('\n')[0].split(':').pop()
  return { DATABASE_HOST: '127.0.0.1', DATABASE_PORT: port, DATABASE_NAME: 'zoiko_e2e', DATABASE_USER: 'zoiko', DATABASE_PASSWORD: password }
}

const database = process.env.E2E_DATABASE_HOST
  ? {
      DATABASE_HOST: process.env.E2E_DATABASE_HOST,
      DATABASE_PORT: process.env.E2E_DATABASE_PORT ?? '5432',
      DATABASE_NAME: process.env.E2E_DATABASE_NAME ?? 'zoiko_e2e',
      DATABASE_USER: process.env.E2E_DATABASE_USER ?? 'zoiko',
      DATABASE_PASSWORD: process.env.E2E_DATABASE_PASSWORD ?? '',
    }
  : startDatabase()

const settings = {
  ...database,
  // Configured entirely here: never read a developer's backend/.env.
  DJANGO_READ_DOTENV: 'false',
  DJANGO_DEBUG: 'true',
  DJANGO_SECURE_COOKIES: 'false',
  DJANGO_EMAIL_BACKEND: 'django.core.mail.backends.filebased.EmailBackend',
  DJANGO_EMAIL_FILE_PATH: join(tmp, 'mail'),
  AUTH_THROTTLE_RATE: '1000/min',
  FRONTEND_URL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5183',
}
const env = { ...process.env, ...settings }
const manage = (...args) => execFileSync(python, ['manage.py', ...args], { cwd: backend, env, stdio: 'inherit' })

// Tests run operator commands (e.g. `organizations invite`) against this same
// throwaway backend (e2e/manage.ts). Only the variables set above are saved,
// in the git-ignored .tmp folder that is wiped at the start of every run.
writeFileSync(join(tmp, 'backend.json'), JSON.stringify({ python, backend, settings }), { mode: 0o600 })

process.on('exit', removeContainer)
try {
  manage('wait_for_db', '--timeout', '60')
  manage('migrate', '--noinput', '-v', '0')
  manage('seed_demo')
} catch (error) {
  removeContainer()
  throw error
}

const server = spawn(python, ['manage.py', 'runserver', process.env.E2E_API_ADDR ?? '127.0.0.1:8010', '--noreload'], {
  cwd: backend,
  env,
  stdio: 'inherit',
})
const stop = () => {
  server.kill()
  removeContainer()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code) => {
  removeContainer()
  process.exit(code ?? 0)
})
