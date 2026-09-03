/**
 * Encrypts the roster and photo bundle into the static assets the app fetches.
 *
 * This is one half of the privacy boundary; `src/gate/` is the other. Both import
 * `src/lib/crypto.ts`, so the framing and KDF parameters cannot drift.
 *
 * Source selection:
 *   - Real data if ../section-j-data/roster.json exists and USE_SAMPLE is unset.
 *     This is what CI does, after checking out the private repo.
 *   - Otherwise the synthetic sample, which is what every contributor gets.
 *
 * Output (all git-ignored — regenerated on every build):
 *   public/data/roster.enc
 *   public/data/photos.enc
 *   public/data/manifest.json
 *
 *   npm run data:encrypt
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encryptPayload, PBKDF2_ITERATIONS } from '../src/lib/crypto'
import type { MeetupHistory, Roster } from '../src/lib/types'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const privateDir = path.resolve(repoRoot, '..', 'section-j-data')
const outDir = path.join(repoRoot, 'public', 'data')

const realRosterPath = path.join(privateDir, 'roster.json')
const realPhotosPath = path.join(privateDir, 'photos.json')
const realMeetupsPath = path.join(privateDir, 'meetup-history.json')
const sampleRosterPath = path.join(repoRoot, 'data', 'roster.sample.json')
const samplePhotosPath = path.join(repoRoot, 'data', 'photos.sample.json')
const sampleMeetupsPath = path.join(repoRoot, 'data', 'meetup-history.sample.json')

const useSample = process.env.USE_SAMPLE === '1' || !existsSync(realRosterPath)
const rosterPath = useSample ? sampleRosterPath : realRosterPath
const photosPath = useSample ? samplePhotosPath : realPhotosPath
// Meetup history is only person IDs, but those IDs are derived from email
// addresses — knowing that "aexample" dined with "bexample" is still personal
// data, so it lives behind the same passphrase as everything else.
const meetupsPath = useSample ? sampleMeetupsPath : realMeetupsPath

if (!existsSync(rosterPath)) {
  console.error(`✗ No roster found at ${rosterPath}`)
  console.error('  Run `npm run data:sample` first to generate the synthetic roster.')
  process.exit(1)
}

const passphrase = process.env.SECTION_PASSPHRASE ?? (useSample ? 'demo' : '')

if (!passphrase) {
  console.error('✗ SECTION_PASSPHRASE is not set, and this is a build of REAL data.')
  console.error('  Refusing to encrypt the section roster with an empty passphrase.')
  process.exit(1)
}

if (!useSample && passphrase === 'demo') {
  console.error('✗ Refusing to encrypt real section data with the public demo passphrase.')
  process.exit(1)
}

if (!useSample && passphrase.length < 10) {
  console.error(`✗ SECTION_PASSPHRASE is only ${passphrase.length} characters.`)
  console.error('  Use at least 10 — this is the only thing protecting the directory.')
  process.exit(1)
}

const roster = JSON.parse(readFileSync(rosterPath, 'utf8')) as Roster
const photos: Record<string, string> = existsSync(photosPath)
  ? JSON.parse(readFileSync(photosPath, 'utf8'))
  : {}
const meetups: MeetupHistory = existsSync(meetupsPath)
  ? JSON.parse(readFileSync(meetupsPath, 'utf8'))
  : { version: 1, rounds: [] }

const encoder = new TextEncoder()

mkdirSync(outDir, { recursive: true })

const rosterBytes = await encryptPayload(encoder.encode(JSON.stringify(roster)), passphrase)
writeFileSync(path.join(outDir, 'roster.enc'), rosterBytes)

const photoBytes = await encryptPayload(encoder.encode(JSON.stringify(photos)), passphrase)
writeFileSync(path.join(outDir, 'photos.enc'), photoBytes)

const meetupBytes = await encryptPayload(encoder.encode(JSON.stringify(meetups)), passphrase)
writeFileSync(path.join(outDir, 'meetups.enc'), meetupBytes)

/**
 * The manifest is the one unencrypted file, so it must stay boring. A build
 * timestamp for cache-busting and the KDF cost, nothing about who is in the
 * section — not even how many people there are.
 */
writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      iterations: PBKDF2_ITERATIONS,
      sample: useSample,
    },
    null,
    2,
  ) + '\n',
)

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`

/**
 * Say which passphrase was used and where it came from — never the value.
 *
 * Without this, "why won't my passphrase unlock the site" is impossible to
 * diagnose: the payload is encrypted with whatever this script saw, so a
 * mismatch between the build environment and what you type is silent.
 */
const passphraseSource =
  process.env.SECTION_PASSPHRASE !== undefined
    ? 'the SECTION_PASSPHRASE environment variable'
    : 'the built-in "demo" fallback (sample data only)'
console.log(`Source: ${useSample ? 'SYNTHETIC SAMPLE' : 'REAL SECTION DATA'} (${path.relative(repoRoot, rosterPath)})`)
console.log(`Passphrase: ${passphrase.length} characters, from ${passphraseSource}`)
console.log(`✓ public/data/roster.enc   ${kb(rosterBytes.length)}  (${roster.people.length} people)`)
console.log(`✓ public/data/photos.enc   ${kb(photoBytes.length)}  (${Object.keys(photos).length} photos)`)
console.log(`✓ public/data/meetups.enc  ${kb(meetupBytes.length)}  (${meetups.rounds.length} rounds)`)
if (useSample) console.log('  Unlock passphrase for the sample build: "demo"')
