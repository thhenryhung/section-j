/**
 * Normalises scraped class-card photos into the bundle the app ships.
 *
 * Input:  ../section-j-data/photos/<personId>.(jpg|jpeg|png|webp)
 * Output: ../section-j-data/photos.json   — { personId: "data:image/webp;base64,…" }
 *
 * Class card photos arrive at wildly different sizes and are mostly uncropped
 * JPEGs. Squaring and re-encoding them to webp takes the bundle from tens of
 * megabytes to roughly three, which matters because the whole thing is decrypted
 * in one go on unlock.
 *
 * Opt-outs are enforced here as well as in the parser: a person whose `photoId`
 * is absent from roster.json has their image dropped, so it is never encrypted,
 * never deployed, and never reaches anybody's browser.
 *
 *   npm run data:photos
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import type { Roster } from '../src/lib/types'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const privateDir = path.resolve(repoRoot, '..', 'section-j-data')
const photosDir = path.join(privateDir, 'photos')
const rosterPath = path.join(privateDir, 'roster.json')
const outPath = path.join(privateDir, 'photos.json')

/**
 * Class-card photos are served at 150×177, so this is a ceiling, not a target:
 * `withoutEnlargement` stops a 150px portrait being upscaled into mush. If HBS
 * ever serves larger originals, raise this and the pipeline will use them.
 */
const MAX_SIZE = 300
const QUALITY = 82

if (!existsSync(photosDir)) {
  console.log(`No photos directory at ${photosDir} — nothing to do.`)
  console.log('(This is expected when working from the public repo alone.)')
  process.exit(0)
}

/** Whose photos are we allowed to publish? Absent roster ⇒ allow all (first run). */
let allowed: Set<string> | null = null
if (existsSync(rosterPath)) {
  const roster = JSON.parse(readFileSync(rosterPath, 'utf8')) as Roster
  allowed = new Set(
    roster.people.map((person) => person.photoId).filter((id): id is string => Boolean(id)),
  )
}

const files = readdirSync(photosDir).filter((file) =>
  /\.(jpe?g|png|webp|gif)$/i.test(file),
)

const photos: Record<string, string> = {}
let skipped = 0
let totalBytes = 0

for (const file of files) {
  const id = path.basename(file, path.extname(file))

  if (allowed && !allowed.has(id)) {
    skipped++
    continue
  }

  const input = readFileSync(path.join(photosDir, file))

  // `attention` crops toward the most visually salient region, which on a
  // head-and-shoulders portrait is reliably the face.
  const square = await sharp(input)
    .resize(MAX_SIZE, MAX_SIZE, {
      fit: 'cover',
      position: sharp.strategy.attention,
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY })
    .toBuffer()

  photos[id] = `data:image/webp;base64,${square.toString('base64')}`
  totalBytes += square.length
}

writeFileSync(outPath, JSON.stringify(photos) + '\n')

const count = Object.keys(photos).length
console.log(`✓ ${outPath}`)
console.log(`  ${count} photos · ${(totalBytes / 1024 / 1024).toFixed(1)} MB before base64`)
if (skipped > 0) {
  console.log(`  ${skipped} skipped — not present in roster.json (opted out or not in section)`)
}
if (count === 0) {
  console.warn('! No photos were written. Check that filenames match person ids.')
}
