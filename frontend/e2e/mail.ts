import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

const MAIL_DIR = join(dirname(fileURLToPath(import.meta.url)), '.tmp', 'mail')

/** Latest link to `path` (e.g. "/verify-email") emailed to `to` by the e2e backend. */
export async function linkFromEmail(to: string, path: string): Promise<string> {
  let link: string | undefined
  await expect
    .poll(
      () => {
        const pattern = new RegExp(`https?://\\S+${path}\\?uid=[\\w-]+&token=[\\w-]+`, 'g')
        const messages = readdirSync(MAIL_DIR)
          .sort()
          .map((file) => readFileSync(join(MAIL_DIR, file), 'utf8'))
          .flatMap((log) => log.split(/^-{70,}$/m))
          .filter((message) => message.includes(`To: ${to}`))
        link = messages.flatMap((message) => message.match(pattern) ?? []).at(-1)
        return link
      },
      { message: `waiting for ${path} email to ${to}`, timeout: 10_000 },
    )
    .toBeTruthy()
  return link!
}
