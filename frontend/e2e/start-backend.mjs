// Boots an isolated Django instance for the end-to-end suite: fresh SQLite
// database, seeded demo accounts (password from ZS_DEMO_PASSWORD, generated per
// run by playwright.config.ts), and emails written to files the tests read.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const backend = resolve(here, '..', '..', 'backend')
const tmp = join(here, '.tmp')
const python = [join(backend, '.venv', 'Scripts', 'python.exe'), join(backend, '.venv', 'bin', 'python')].find(existsSync)
if (!python) throw new Error(`No virtualenv found in ${backend}/.venv — create it and install requirements.txt`)

rmSync(tmp, { recursive: true, force: true })
mkdirSync(join(tmp, 'mail'), { recursive: true })

const env = {
  ...process.env,
  DJANGO_DEBUG: 'true',
  DJANGO_SQLITE_PATH: join(tmp, 'e2e.sqlite3'),
  DJANGO_EMAIL_BACKEND: 'django.core.mail.backends.filebased.EmailBackend',
  DJANGO_EMAIL_FILE_PATH: join(tmp, 'mail'),
  AUTH_THROTTLE_RATE: '1000/min',
  FRONTEND_URL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5183',
}
const manage = (...args) => execFileSync(python, ['manage.py', ...args], { cwd: backend, env, stdio: 'inherit' })

manage('migrate', '--noinput', '-v', '0')
manage('seed_demo')
const server = spawn(python, ['manage.py', 'runserver', process.env.E2E_API_ADDR ?? '127.0.0.1:8010', '--noreload'], {
  cwd: backend,
  env,
  stdio: 'inherit',
})
const stop = () => server.kill()
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
process.on('exit', stop)
server.on('exit', (code) => process.exit(code ?? 0))
