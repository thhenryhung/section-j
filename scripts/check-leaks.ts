/**
 * Personal-data leak check.
 *
 * `.gitignore` expresses intent; this script is the enforcement. It scans every
 * git-tracked file (and `dist/` when it exists) for anything that looks like real
 * section data, and exits non-zero if it finds any.
 *
 * Two layers:
 *
 *  1. Pattern checks, which always run — real HBS email addresses, phone numbers,
 *     and the raw class-card export filename. These work in a fork's CI where no
 *     private data is available.
 *
 *  2. Exact checks against the real roster, when ../section-j-data/roster.json is
 *     present. This catches the case the patterns cannot: a real person's name
 *     pasted into a component as placeholder text.
 *
 * Run before every push:  npm run check:leaks
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Roster } from '../src/lib/types'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const privateRoster = path.resolve(repoRoot, '..', 'section-j-data', 'roster.json')

/** Sample data uses this reserved TLD, so it can never collide with a real address. */
const SAFE_EMAIL_DOMAIN = 'example.invalid'

type Finding = { file: string; line: number; rule: string; excerpt: string }

const PATTERN_RULES: Array<{ name: string; re: RegExp }> = [
  { name: 'HBS email address', re: /[\w.+-]+@(?:\w+\.)*hbs\.edu/gi },
  /**
   * A phone number as a human types one, which always carries a separator or
   * parentheses: "(858) 2323572", "858-232-3572", "+1 617 555 1000".
   *
   * An earlier version allowed the separators to be absent, which made it match
   * any run of ten digits — so it fired on `4294967296` in the RNG and on
   * unrelated constants. It would have failed CI on its first run, and a check
   * that cries wolf gets allowlisted into uselessness.
   */
  {
    name: 'phone number',
    re: new RegExp(
      [
        /\(\d{3}\)\s*\d{3}[\s.-]?\d{4}/.source, // (858) 232-3572
        /\+?\d{0,2}[\s.-]?\d{3}[\s.-]\d{3}[\s.-]\d{4}/.source, // 858-232-3572
        /\+\d{1,3}\s*\d{7,12}/.source, // +1 6175551234
      ].join('|'),
      'g',
    ),
  },
]

/**
 * The raw export must not be committed — but this is a check on the FILE PATH,
 * not on content. Matching the filename inside a file caught every document that
 * merely *documents* the pipeline, which is the opposite of useful.
 */
const FORBIDDEN_PATHS = /ClasscardsDownload|classcards-export|socials\.csv|classcards\.json/i

/**
 * Files that legitimately contain the strings above and must not trip the check.
 *
 * `data/roster.sample.json` is here because synthetic data is supposed to look
 * like a directory — fake +1 617 555 numbers match the phone pattern by design.
 * It stays safe because the exact-match layer still runs against it: if a real
 * person's name or number ever lands in the sample file, that layer catches it.
 */
const ALLOWLIST = [
  'scripts/check-leaks.ts',
  'scripts/make-sample.ts',
  '.gitignore',
  'package-lock.json',
  // CLAUDE.local.md is gitignored, so it is normally never scanned — this only
  // matters on the fallback path used when the working tree is not a git repo.
  'CLAUDE.local.md',
]

/** Checked by the exact-match layer but exempt from the loose pattern rules. */
const PATTERN_EXEMPT = ['data/roster.sample.json', 'data/photos.sample.json']

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.enc', '.zip', '.pdf',
])

function trackedFiles(): string[] {
  try {
    return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
  } catch {
    console.warn('! Not a git repository yet — scanning the working tree instead.')
    return walk(repoRoot).map((f) => path.relative(repoRoot, f).split(path.sep).join('/'))
  }
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

function distFiles(): string[] {
  const dist = path.join(repoRoot, 'dist')
  if (!existsSync(dist)) return []
  return walk(dist).map((f) => path.relative(repoRoot, f).split(path.sep).join('/'))
}

function loadSecrets(): { strings: string[]; source: string } | null {
  if (!existsSync(privateRoster)) return null
  const roster = JSON.parse(readFileSync(privateRoster, 'utf8')) as Roster
  const strings = new Set<string>()
  for (const p of roster.people) {
    if (p.email) strings.add(p.email.toLowerCase())
    if (p.phone) strings.add(p.phone.replace(/\D/g, ''))
    // Last names are distinctive enough to be worth checking; first names are not
    // (too many collide with ordinary words like "Grace" or "Will").
    if (p.lastName && p.lastName.length >= 4) strings.add(p.lastName.toLowerCase())
  }
  return { strings: [...strings].filter(Boolean), source: privateRoster }
}

function scan(): Finding[] {
  const findings: Finding[] = []
  const secrets = loadSecrets()
  const files = [...new Set([...trackedFiles(), ...distFiles()])]

  for (const file of files) {
    // A forbidden path is a leak regardless of what is inside it, and it is not
    // waivable by the allowlist.
    if (FORBIDDEN_PATHS.test(path.basename(file))) {
      findings.push({
        file,
        line: 0,
        rule: 'forbidden file',
        excerpt: 'raw personal-data file — belongs in the private repo only',
      })
      continue
    }

    if (ALLOWLIST.includes(file)) continue
    if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) continue

    const abs = path.join(repoRoot, file)
    if (!existsSync(abs) || statSync(abs).isDirectory()) continue
    if (statSync(abs).size > 5_000_000) continue

    let content: string
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    if (content.includes('\u0000')) continue // binary file despite its extension

    const patternExempt = PATTERN_EXEMPT.includes(file)
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      if (!patternExempt) {
        for (const rule of PATTERN_RULES) {
          rule.re.lastIndex = 0
          const match = rule.re.exec(line)
          if (!match) continue
          // Sample data is allowed to look like a directory, as long as it is fake.
          if (rule.name === 'HBS email address' && line.includes(SAFE_EMAIL_DOMAIN)) continue
          findings.push({ file, line: i + 1, rule: rule.name, excerpt: match[0].slice(0, 60) })
        }
      }

      if (secrets) {
        const haystack = line.toLowerCase()
        const digits = line.replace(/\D/g, '')
        for (const secret of secrets.strings) {
          const hit = /^\d+$/.test(secret)
            ? secret.length >= 7 && digits.includes(secret)
            : haystack.includes(secret)
          if (hit) {
            findings.push({
              file,
              line: i + 1,
              rule: 'real roster value',
              excerpt: '[redacted — matched a value from the private roster]',
            })
            break
          }
        }
      }
    })
  }
  return findings
}

const findings = scan()
const secrets = loadSecrets()

console.log(
  secrets
    ? `Checked against the real roster at ${path.relative(repoRoot, secrets.source)}.`
    : 'No private roster found locally — pattern checks only (this is expected in a fork).',
)

if (findings.length === 0) {
  console.log('✓ No personal data found in tracked files or dist/.')
  process.exit(0)
}

console.error(`\n✗ ${findings.length} possible leak(s) of personal data:\n`)
for (const f of findings.slice(0, 50)) {
  console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.excerpt}`)
}
if (findings.length > 50) console.error(`  … and ${findings.length - 50} more.`)
console.error('\nNothing real about a section member may be committed to this public repo.')
console.error('If a match is a false positive, add the file to ALLOWLIST in this script.\n')
process.exit(1)
