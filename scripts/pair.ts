/**
 * Generate a meetup round from the command line.
 *
 * Same algorithm as the in-app admin panel — both import src/lib/pairing.ts — but
 * this version writes straight into the private data repo and prints a summary you
 * can sanity-check before committing.
 *
 *   npm run pair -- --kind dinner --date 2026-09-17
 *   npm run pair -- --kind onetoone --date 2026-10-08 --absent jsmith,alee
 *   npm run pair -- --kind dinner --date 2026-09-17 --dry-run
 *
 * Flags:
 *   --kind      dinner | onetoone            (default: dinner)
 *   --date      YYYY-MM-DD                   (default: today)
 *   --size      people per dinner            (default: 6)
 *   --absent    comma-separated person ids   (default: none)
 *   --seed      integer, for reproducibility (default: derived from the date)
 *   --dry-run   print the round, write nothing
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allocate } from '../src/lib/pairing'
import type { MeetupHistory, MeetupKind, MeetupRound, Roster } from '../src/lib/types'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const privateDir = path.resolve(repoRoot, '..', 'section-j-data')

function flag(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  return value && !value.startsWith('--') ? value : fallback
}

const dryRun = process.argv.includes('--dry-run')
const kind = (flag('kind', 'dinner') as MeetupKind) ?? 'dinner'
const date = flag('date', new Date().toISOString().slice(0, 10))!
const groupSize = Number(flag('size', '6'))
const absentIds = (flag('absent', '') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

if (kind !== 'dinner' && kind !== 'onetoone') {
  console.error(`✗ --kind must be "dinner" or "onetoone", got "${kind}"`)
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`✗ --date must be YYYY-MM-DD, got "${date}"`)
  process.exit(1)
}

// Seeding from the date by default means re-running the same command reproduces
// the same round — useful when you want to re-check a result someone questions.
const seed = Number(flag('seed', String(Number(date.replace(/-/g, '')) % 65536)))

const useSample = !existsSync(path.join(privateDir, 'roster.json'))
const rosterPath = useSample
  ? path.join(repoRoot, 'data', 'roster.sample.json')
  : path.join(privateDir, 'roster.json')
const historyPath = useSample
  ? path.join(repoRoot, 'data', 'meetup-history.sample.json')
  : path.join(privateDir, 'meetup-history.json')

const roster = JSON.parse(readFileSync(rosterPath, 'utf8')) as Roster
const history: MeetupHistory = existsSync(historyPath)
  ? (JSON.parse(readFileSync(historyPath, 'utf8')) as MeetupHistory)
  : { version: 1, rounds: [] }

const knownIds = new Set(roster.people.map((p) => p.id))
const unknown = absentIds.filter((id) => !knownIds.has(id))
if (unknown.length > 0) {
  console.error(`✗ Unknown person id(s) in --absent: ${unknown.join(', ')}`)
  process.exit(1)
}

const result = allocate({ kind, people: roster.people, history, absentIds, groupSize, seed })

const round: MeetupRound = {
  id: `${kind}-${date}`,
  kind,
  date,
  groups: result.groups,
  absentIds,
  generatedAt: new Date().toISOString(),
}

const nameOf = new Map(roster.people.map((p) => [p.id, p.displayName]))

console.log(`\n${kind === 'dinner' ? 'Dinners' : 'Coffee chats'} · ${date}`)
console.log(`Source: ${useSample ? 'SAMPLE DATA' : 'real roster'}  ·  seed ${seed}\n`)

for (const group of result.groups) {
  console.log(`  ${group.label}`)
  for (const id of group.memberIds) console.log(`    · ${nameOf.get(id) ?? id}`)
}

console.log(`\n${result.groups.length} groups`)
console.log(`${result.firstTimeMeetings} pairings are first-time meetings`)
console.log(
  result.maxRepeat === 0
    ? 'No repeat pairings — everybody in this round is meeting someone new.'
    : `Worst repeat in this round: ${result.maxRepeat} previous meeting(s).`,
)
if (absentIds.length > 0) console.log(`Excluded: ${absentIds.map((id) => nameOf.get(id) ?? id).join(', ')}`)

if (dryRun) {
  console.log('\n(--dry-run: nothing written)')
  process.exit(0)
}

const next: MeetupHistory = {
  version: 1,
  rounds: [...history.rounds.filter((r) => r.id !== round.id), round].sort((a, b) =>
    a.date.localeCompare(b.date),
  ),
}

writeFileSync(historyPath, JSON.stringify(next, null, 2) + '\n')
console.log(`\n✓ Wrote ${path.relative(process.cwd(), historyPath)}`)
if (!useSample) console.log('  Commit it to the private data repo, then redeploy.')
