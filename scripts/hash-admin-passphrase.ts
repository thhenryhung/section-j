/**
 * One-time helper: hashes the admin passphrase so it can be pasted into the
 * Cloudflare Pages dashboard as the ADMIN_PASSPHRASE_HASH secret. The plain
 * passphrase itself is never stored anywhere — only this salted hash, which
 * `functions/api/admin/login.ts` verifies logins against.
 *
 *   ADMIN_PASSPHRASE='...' npm run admin:hash-passphrase
 */

import { hashAdminPassphrase } from '../src/lib/adminAuth'

const passphrase = process.env.ADMIN_PASSPHRASE ?? ''

if (!passphrase) {
  console.error('✗ Set ADMIN_PASSPHRASE and re-run, e.g.:')
  console.error("  ADMIN_PASSPHRASE='your words here' npm run admin:hash-passphrase")
  process.exit(1)
}

if (passphrase.length < 10) {
  console.error(`✗ ADMIN_PASSPHRASE is only ${passphrase.length} characters. Use at least 10.`)
  process.exit(1)
}

const hash = await hashAdminPassphrase(passphrase)

console.log('Paste this as the ADMIN_PASSPHRASE_HASH secret in the Cloudflare Pages dashboard:')
console.log(hash)
