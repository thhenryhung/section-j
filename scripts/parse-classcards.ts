/**
 * Turns harvested class cards into roster.json.
 *
 * Inputs (all in the private data repo):
 *   raw/classcards.json      from scripts/browser/harvest.js — raw HTML + photos
 *   classcards-export.csv    the HBS contact export (phones, partner)
 *   overrides.json           survey answers and opt-outs (optional)
 *
 * Outputs:
 *   roster.json              the merged roster
 *   photos/<personId>.jpg    photos extracted from the harvest's data URIs
 *
 * Two things learned from the real markup drive most of the code below:
 *
 *  1. HBS writes the literal string "None Listed" into every empty field. It is
 *     on 70 of 90 cards for HBS Activities and 55 for Interests. Left in, it
 *     would become the section's most popular interest, a facet chip reading
 *     "None Listed 70", and a similarity score that matches people for having
 *     nothing in common. Every value goes through `clean()`.
 *
 *  2. The results table has a mailto: link for 89 of 90 people, so email cannot
 *     be the only join key. Names are used as a documented fallback.
 *
 *   npm run data:parse
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import type { Education, Person, PriorRole, Region, Roster } from '../src/lib/types'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const privateDir = path.resolve(repoRoot, '..', 'section-j-data')

const harvestPath = path.join(privateDir, 'raw', 'classcards.json')
const csvPath = path.join(privateDir, 'classcards-export.csv')
const overridesPath = path.join(privateDir, 'overrides.json')
const photosDir = path.join(privateDir, 'photos')
const rosterPath = path.join(privateDir, 'roster.json')

/** HBS's placeholder for "this person left the field blank". */
const PLACEHOLDERS = new Set(['none listed', 'not specified', 'n/a', 'na', 'none', '-', '--'])

/** Normalise one scraped value, collapsing HBS placeholders to undefined. */
function clean(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  const text = value.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  if (PLACEHOLDERS.has(text.toLowerCase())) return undefined
  return text
}

function splitList(value: string | undefined, separator: RegExp): string[] {
  const text = clean(value)
  if (!text) return []
  return text
    .split(separator)
    .map((part) => clean(part))
    .filter((part): part is string => Boolean(part))
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Minimal RFC-4180 reader: quoted fields, escaped quotes, embedded commas. */
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += char
    } else if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') field += char
  }
  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()))
  return body.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key.trim(), (cells[i] ?? '').trim()])),
  )
}

// ---------------------------------------------------------------------------
// Field-specific parsing, all against shapes confirmed from the real cards
// ---------------------------------------------------------------------------

/** Cards print "M/D" — 9/2, 12/25. No year is present, and none is stored. */
function parseBirthday(value: string | undefined): { month: number; day: number } | undefined {
  const text = clean(value)
  if (!text) return undefined
  const match = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(text)
  if (!match) return undefined
  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  return { month, day }
}

/**
 * Home Region is comma-separated, two to four parts. Observed shapes:
 *   "City, Country"                "City, State, Country"
 *   "City Name, State, Country"    "City, Region Name, State, Country"
 * The last part is reliably the country and the first the city; anything in
 * between is a state or region.
 */
function parseRegion(value: string | undefined): Region | undefined {
  const parts = splitList(value, /,/)
  if (parts.length === 0) return undefined
  if (parts.length === 1) return { country: parts[0] }
  return {
    city: parts[0],
    state: parts.length > 2 ? parts[parts.length - 2] : undefined,
    country: parts[parts.length - 1],
  }
}

/**
 * Pre-MBA industry, inferred from employer and title.
 *
 * The cards carry no industry taxonomy — the one italic field that looked like
 * one turned out to be 161 distinct free-text values across 216 roles. So this
 * is a keyword pass, and it is openly approximate: it exists to make the
 * directory's industry facet useful, not to be authoritative. Anyone it gets
 * wrong can correct themselves via overrides.json, which always wins.
 */
const INDUSTRY_RULES: Array<[string, RegExp]> = [
  ['Consulting', /\b(mckinsey|bain|bcg|boston consulting|deloitte|accenture|kearney|oliver wyman|consult)/i],
  ['Private Equity', /\b(private equity|blackstone|kkr|carlyle|apollo|tpg|warburg|advent|bain capital)\b/i],
  ['Venture Capital', /\b(ventures?|vc|sequoia|andreessen|accel|index ventures)\b/i],
  ['Investment Banking', /\b(goldman|morgan stanley|j\.?p\.? ?morgan|jpmorgan|citi|barclays|lazard|evercore|rothschild|investment bank)/i],
  ['Finance', /\b(bank|capital|asset management|hedge fund|equity research|trading|invest)/i],
  ['Technology', /\b(google|meta|amazon|microsoft|apple|software|engineer|saas|technolog|data scien|machine learning|product manager)/i],
  ['Healthcare & Life Sciences', /\b(health|hospital|clinic|pharma|biotech|medic|nurse|physician|life sciences)/i],
  ['Energy & Climate', /\b(energy|oil|gas|petro|solar|renewab|climate|utilit)/i],
  ['Consumer & Retail', /\b(retail|consumer|unilever|p&g|procter|nestl|l'?oreal|brand manager|e-?commerce)/i],
  ['Government & Policy', /\b(government|ministry|federal|army|navy|air force|military|public sector|policy|embassy|united nations|world bank)/i],
  ['Non-profit & Social Impact', /\b(non-?profit|ngo|foundation|charit|social impact|teach for)/i],
  ['Industrials & Manufacturing', /\b(manufactur|industrial|aerospace|automotive|lockheed|boeing|siemens|general electric|logistics|supply chain)/i],
  ['Real Estate', /\b(real estate|property|reit|construction)/i],
  ['Media & Entertainment', /\b(media|entertainment|film|music|publish|advertis|marketing agency)/i],
  ['Education', /\b(school|university|educat|teacher|professor|academ)/i],
  ['Law', /\b(law|legal|attorney|counsel|litigat)/i],
]

function inferIndustry(company?: string, title?: string, description?: string): string | undefined {
  const haystack = [company, title, description].filter(Boolean).join(' ')
  if (!haystack) return undefined
  for (const [industry, pattern] of INDUSTRY_RULES) {
    if (pattern.test(haystack)) return industry
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Card parsing
// ---------------------------------------------------------------------------

type HarvestedPerson = {
  prsnId: string
  nameCell: string
  sectionCell: string
  contactHtml: string
  photoUrl: string | null
  photo: string | null
  detailHtml: string
}

type Harvest = { version: number; harvestedAt: string; count: number; people: HarvestedPerson[] }

type CardFields = {
  email?: string
  phone?: string
  homeRegion?: Region
  birthday?: { month: number; day: number }
  startupExperience?: boolean
  professionalInterests: string[]
  preMBA: PriorRole[]
  education: Education[]
}

function parseCard(entry: HarvestedPerson): CardFields {
  const $ = cheerio.load(entry.detailHtml)

  // --- Additional Information: label in .col-xs-4, value in .col-xs-8 -----
  const extras = new Map<string, string>()
  $('#additional-information .row').each((_, row) => {
    const label = clean($(row).find('.col-xs-4').first().text())
    const valueEl = $(row).find('.col-xs-8').first()
    if (!label || valueEl.length === 0) return
    // <br> separates repeated values; turn it into a delimiter before reading text.
    valueEl.find('br').replaceWith('|')
    extras.set(label.toLowerCase().replace(/:$/, ''), valueEl.text())
  })

  // --- Work experience ---------------------------------------------------
  const preMBA: PriorRole[] = []
  $('#work-experience tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    const first = cells.eq(0)
    const company = clean(first.find('strong').first().text())
    const title = clean(first.find('p.text-muted').first().text())
    const description = clean(first.find('em').first().text())
    const location = clean(cells.eq(1).text())
    const dates = clean(cells.eq(2).text())
    if (!company && !title) return
    preMBA.push({
      company,
      title,
      location,
      description,
      dates,
      industry: inferIndustry(company, title, description),
    })
  })

  // --- Education ---------------------------------------------------------
  const education: Education[] = []
  $('#education tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    const school = clean(cells.eq(0).text())
    if (!school) return
    education.push({
      school,
      degree: clean(cells.eq(1).text()),
      gradDate: clean(cells.eq(2).text()),
    })
  })

  // --- Contact, from the results row -------------------------------------
  const $contact = cheerio.load(`<div>${entry.contactHtml}</div>`)
  const mailto = $contact('a[href^="mailto:"]').attr('href')
  const email = mailto ? clean(decodeURIComponent(mailto.replace(/^mailto:/i, ''))) : undefined

  // Phone: <div><span class="ctryCode">1</span>6175551234</div>
  const phoneDiv = $contact('span.ctryCode').first().parent()
  const countryCode = clean($contact('span.ctryCode').first().text())
  const phoneDigits = clean(phoneDiv.clone().children().remove().end().text())
  const phone = phoneDigits
    ? `${countryCode ? `+${countryCode} ` : ''}${phoneDigits}`
    : undefined

  const startupRaw = clean(extras.get('start-up experience'))

  return {
    email: email?.toLowerCase(),
    phone,
    homeRegion: parseRegion(extras.get('home region')),
    birthday: parseBirthday(extras.get('birthday')),
    startupExperience: startupRaw ? /^yes$/i.test(startupRaw) : undefined,
    // <br>-separated on the card, so `|` after the delimiter substitution.
    professionalInterests: splitList(extras.get('professional interests'), /\|/),
    preMBA,
    education,
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

if (!existsSync(harvestPath)) {
  console.error(`✗ No harvest at ${harvestPath}`)
  console.error('  Run scripts/browser/harvest.js first — see scripts/browser/README.md')
  process.exit(1)
}

const harvest = JSON.parse(readFileSync(harvestPath, 'utf8')) as Harvest
const csvRows = existsSync(csvPath) ? parseCSV(readFileSync(csvPath, 'utf8')) : []

type Override = Partial<Person> & {
  email?: string
  exclude?: boolean
  hidePhone?: boolean
  hidePhoto?: boolean
  hideBirthday?: boolean
}
const overrides: Override[] = existsSync(overridesPath)
  ? (JSON.parse(readFileSync(overridesPath, 'utf8')) as Override[])
  : []

const normaliseName = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/**
 * The results table prints names as "Last, First" — not "First Last" as the
 * column heading suggests. Convert to natural order for display.
 */
function toFirstLast(raw: string | undefined): string {
  const text = clean(raw) ?? ''
  const match = /^([^,]+),\s*(.+)$/.exec(text)
  return match ? `${match[2].trim()} ${match[1].trim()}` : text
}

/**
 * Order-insensitive name key: tokens lowercased, stripped of punctuation, sorted.
 * "Patel, Rina", "Rina Patel" and "rina patel" all collapse to the same
 * value.
 *
 * Sorting the tokens is the whole point. The results table prints "Last, First"
 * while the contact export holds First and Last in separate columns, so an
 * earlier version that matched on concatenation never joined at all — it silently
 * dropped the one classmate whose row carries no mailto and who therefore depends
 * on the name fallback.
 */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

const csvByEmail = new Map<string, Record<string, string>>()
const csvByName = new Map<string, Record<string, string>>()
for (const row of csvRows) {
  const email = row['E-mail Address']?.toLowerCase()
  if (email) csvByEmail.set(email, row)
  const name = nameKey(`${row['First Name']} ${row['Last Name']}`)
  if (name) csvByName.set(name, row)
}

const usedIds = new Set<string>()
function makeId(email: string | undefined, displayName: string): string {
  const base = email
    ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
    : normaliseName(displayName).slice(0, 16)
  let id = base || 'person'
  let n = 2
  while (usedIds.has(id)) id = `${base}${n++}`
  usedIds.add(id)
  return id
}

mkdirSync(photosDir, { recursive: true })

const people: Person[] = []
const warnings: string[] = []
let photosWritten = 0

for (const entry of harvest.people) {
  const card = parseCard(entry)

  // The results cell prints "Last, First" despite its "Name" heading.
  const displayName = toFirstLast(entry.nameCell)
  const csvRow =
    (card.email ? csvByEmail.get(card.email) : undefined) ?? csvByName.get(nameKey(displayName))

  if (!card.email && !csvRow) {
    warnings.push(`No email and no CSV match for prsnId ${entry.prsnId} — skipped.`)
    continue
  }

  const email = card.email ?? csvRow?.['E-mail Address']?.toLowerCase()
  if (!card.email) {
    warnings.push(`prsnId ${entry.prsnId}: no mailto on the card, matched by name instead.`)
  }

  const firstName = clean(csvRow?.['First Name']) ?? displayName.split(' ')[0] ?? ''
  const lastName =
    clean(csvRow?.['Last Name']) ?? displayName.split(' ').slice(1).join(' ') ?? ''

  const id = makeId(email, displayName)

  const override = overrides.find((o) => o.email?.toLowerCase() === email)
  if (override?.exclude) continue

  // Prefer the CSV's preferred phone — it is the number the person chose.
  const preferred = clean(csvRow?.['Preferred Phone'])
  const csvPhone =
    preferred === 'Mobile Phone'
      ? clean(csvRow?.['Mobile Phone'])
      : preferred === 'Home Phone'
        ? clean(csvRow?.['Home Phone'])
        : clean(csvRow?.['Mobile Phone']) ?? clean(csvRow?.['Home Phone'])

  const person: Person = {
    id,
    firstName,
    lastName,
    displayName: displayName || `${firstName} ${lastName}`.trim(),
    email: email ?? '',
    phone: override?.hidePhone ? undefined : (csvPhone ?? card.phone),
    partner: clean(csvRow?.['Partner']),
    photoId: override?.hidePhoto || !entry.photo ? undefined : id,
    homeRegion: card.homeRegion,
    preMBA: card.preMBA,
    education: card.education,
    professionalInterests: override?.professionalInterests ?? card.professionalInterests,
    birthday: override?.hideBirthday ? undefined : card.birthday,
    startupExperience:
      card.startupExperience ?? (clean(csvRow?.['Start-up Experience']) === 'Yes' || undefined),
    pronouns: override?.pronouns,
    funFact: override?.funFact,
    dietary: override?.dietary,
  }

  // Photos are written to disk only for people who have not opted out, so the
  // suppression holds even if build-photos is run against a stale roster.
  if (person.photoId && entry.photo) {
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(entry.photo)
    if (match) {
      writeFileSync(path.join(photosDir, `${id}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`), Buffer.from(match[2], 'base64'))
      photosWritten++
    }
  }

  people.push(person)
}

const roster: Roster = {
  version: 1,
  generatedAt: new Date().toISOString(),
  section: clean(harvest.people[0]?.sectionCell) ?? 'Section J',
  people: people.sort((a, b) => a.firstName.localeCompare(b.firstName)),
}

writeFileSync(rosterPath, JSON.stringify(roster, null, 2) + '\n')

// --- Report -----------------------------------------------------------------
const count = (predicate: (p: Person) => boolean) => people.filter(predicate).length

console.log(`✓ ${path.relative(process.cwd(), rosterPath)} — ${people.length} people`)
console.log(`✓ ${photosWritten} photos written to photos/`)
console.log('')
console.log('Field coverage (after stripping HBS "None Listed" placeholders):')
const rows: Array<[string, number]> = [
  ['photo', count((p) => Boolean(p.photoId))],
  ['phone', count((p) => Boolean(p.phone))],
  ['home region', count((p) => Boolean(p.homeRegion))],
  ['birthday', count((p) => Boolean(p.birthday))],
  ['pre-MBA role', count((p) => p.preMBA.length > 0)],
  ['inferred industry', count((p) => Boolean(p.preMBA[0]?.industry))],
  ['education', count((p) => p.education.length > 0)],
  ['professional interests', count((p) => p.professionalInterests.length > 0)],
]
for (const [label, n] of rows) {
  const bar = '█'.repeat(Math.round((n / people.length) * 24)).padEnd(24, '·')
  console.log(`  ${label.padEnd(24)} ${bar} ${n}/${people.length}`)
}
/**
 * A keyword table that classifies 100% of people is not classifying anyone — it
 * means some rule is matching incidental words. Print the spread so the industry
 * facet can be judged on the evidence instead of trusted because it is populated.
 */
const industryCounts = new Map<string, number>()
for (const person of people) {
  const industry = person.preMBA[0]?.industry
  industryCounts.set(industry ?? '(unclassified)', (industryCounts.get(industry ?? '(unclassified)') ?? 0) + 1)
}
console.log('')
console.log('Inferred pre-MBA industry (keyword-based, approximate):')
for (const [industry, n] of [...industryCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${industry.padEnd(30)} ${n}`)
}

if (warnings.length > 0) {
  console.log('')
  console.log(`${warnings.length} warning(s):`)
  for (const w of warnings) console.log(`  ! ${w}`)
}
console.log('')
console.log('Next: npm run data:photos && npm run check:leaks')
