// Removes the throwaway PostgreSQL container that start-backend.mjs created.
// Needed because Playwright force-kills the backend process tree when the run
// ends (on Windows its exit handlers never run). Containers are found by label,
// so only this suite's databases are touched. A missing Docker is not an error
// here: start-backend.mjs also removes stale containers at the next start.
import { execFileSync } from 'node:child_process'

const LABEL = 'zoiko-sports.e2e=1'

export default function globalTeardown() {
  try {
    const ids = execFileSync('docker', ['ps', '-aq', '--filter', `label=${LABEL}`], { encoding: 'utf8' }).trim()
    if (ids) execFileSync('docker', ['rm', '-f', ...ids.split(/\s+/)], { stdio: 'ignore' })
  } catch {
    // Docker unavailable: nothing to clean up from here.
  }
}
