/**
 * Derived views over a Person — labels, facets, and similarity.
 *
 * Which fields are facets is driven by measured coverage in the real section,
 * not by what class cards happen to offer. From 90 harvested cards:
 *
 *   home region  90    education      90    pre-MBA role  90
 *   languages    69    prof. interests 61
 *   interests    35    HBS activities 20
 *
 * Interests and activities are kept on the person and shown on their profile,
 * but they are deliberately NOT facets: a filter that can only ever match 20
 * people is worse than no filter, because it looks authoritative and quietly
 * hides the other 70.
 */

import type { Language, Person, Region } from './types'

export function regionLabel(region?: Region): string | undefined {
  if (!region) return undefined
  const parts = [region.city, region.state, region.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : undefined
}

export function currentRoleLabel(person: Person): string | undefined {
  const role = person.preMBA[0]
  if (!role) return undefined
  if (role.title && role.company) return `${role.title}, ${role.company}`
  return role.title ?? role.company
}

export function schoolLabel(person: Person): string | undefined {
  return person.education[0]?.school
}

export function languageLabel(language: Language): string {
  return language.level ? `${language.name} (${language.level})` : language.name
}

export function initials(person: Person): string {
  return `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase()
}

export function telHref(phone?: string): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/[^\d+]/g, '')
  return digits.length >= 7 ? `tel:${digits}` : undefined
}

export function whatsappHref(phone?: string): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 ? `https://wa.me/${digits}` : undefined
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export type FacetKey =
  | 'professionalInterest'
  | 'postMBAIndustry'
  | 'preMBAIndustry'
  | 'region'
  | 'language'
  | 'school'

export const FACET_LABELS: Record<FacetKey, string> = {
  professionalInterest: 'Professional interest',
  postMBAIndustry: 'Post-MBA goal',
  preMBAIndustry: 'Pre-MBA industry',
  region: 'Home region',
  language: 'Language',
  school: 'University',
}

/** Ordered by how much data actually backs each one. */
export const FACET_ORDER: FacetKey[] = [
  'professionalInterest',
  'postMBAIndustry',
  'preMBAIndustry',
  'region',
  'language',
  'school',
]

export function facetsOf(person: Person): Record<FacetKey, string[]> {
  return {
    professionalInterest: person.professionalInterests,
    postMBAIndustry: person.postMBA?.industries ?? [],
    preMBAIndustry: person.preMBA
      .map((role) => role.industry)
      .filter((v): v is string => Boolean(v)),
    region: [person.homeRegion?.country].filter((v): v is string => Boolean(v)),
    // Level is dropped for faceting: "Spanish" should match whether someone
    // marked themselves fluent or conversational.
    language: person.languages.map((l) => l.name),
    school: person.education
      .map((e) => e.school)
      .filter((v): v is string => Boolean(v)),
  }
}

export function collectFacets(
  people: Person[],
): Record<FacetKey, Array<{ value: string; count: number }>> {
  const tallies = Object.fromEntries(
    FACET_ORDER.map((k) => [k, new Map<string, number>()]),
  ) as Record<FacetKey, Map<string, number>>

  for (const person of people) {
    const facets = facetsOf(person)
    for (const key of FACET_ORDER) {
      for (const value of new Set(facets[key])) {
        tallies[key].set(value, (tallies[key].get(value) ?? 0) + 1)
      }
    }
  }

  return Object.fromEntries(
    FACET_ORDER.map((key) => [
      key,
      [...tallies[key].entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    ]),
  ) as Record<FacetKey, Array<{ value: string; count: number }>>
}

export type FacetSelection = Partial<Record<FacetKey, string[]>>

/**
 * OR within a facet, AND across facets. Picking two languages widens the result;
 * picking a language and a region narrows it. It is the only combination that
 * makes "speaks Portuguese or Spanish, from Brazil" expressible.
 */
export function matchesFacets(person: Person, selection: FacetSelection): boolean {
  const facets = facetsOf(person)
  for (const [key, wanted] of Object.entries(selection) as Array<[FacetKey, string[]]>) {
    if (!wanted || wanted.length === 0) continue
    const has = new Set(facets[key].map((v) => v.toLowerCase()))
    if (!wanted.some((value) => has.has(value.toLowerCase()))) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Similarity — "people like me"
// ---------------------------------------------------------------------------

export function tagsOf(person: Person): Set<string> {
  const tags = new Set<string>()
  const facets = facetsOf(person)
  for (const key of FACET_ORDER) {
    for (const value of facets[key]) tags.add(`${key}:${value.toLowerCase()}`)
  }
  // Interests and activities are poor facets but good similarity signal: if two
  // people both wrote "rock climbing", that is a strong match even though only
  // 35 people filled the field in at all.
  for (const value of person.interests) tags.add(`interest:${value.toLowerCase()}`)
  for (const value of person.activities) tags.add(`activity:${value.toLowerCase()}`)
  return tags
}

/**
 * Plain Jaccard is a poor fit: sharing a home country says far less about
 * whether two people should get coffee than sharing a professional interest.
 * So the intersection and union are both weighted by what the tag is.
 */
const TAG_WEIGHTS: Record<string, number> = {
  interest: 4,
  professionalInterest: 3,
  postMBAIndustry: 3,
  activity: 2.5,
  school: 2,
  preMBAIndustry: 1.5,
  language: 1.5,
  region: 1,
}

function weightOf(tag: string): number {
  return TAG_WEIGHTS[tag.slice(0, tag.indexOf(':'))] ?? 1
}

export function similarity(a: Person, b: Person): number {
  const tagsA = tagsOf(a)
  const tagsB = tagsOf(b)
  if (tagsA.size === 0 || tagsB.size === 0) return 0

  let intersection = 0
  let union = 0

  for (const tag of tagsA) {
    union += weightOf(tag)
    if (tagsB.has(tag)) intersection += weightOf(tag)
  }
  for (const tag of tagsB) {
    if (!tagsA.has(tag)) union += weightOf(tag)
  }

  return union === 0 ? 0 : intersection / union
}

/**
 * The `limit` people most similar to `person`.
 *
 * `shared` returns the original casing rather than the lowercased tag, so the UI
 * can print "Rock climbing" instead of "rock climbing".
 */
export function similarPeople(
  person: Person,
  people: Person[],
  limit = 6,
): Array<{ person: Person; score: number; shared: string[] }> {
  const mine = tagsOf(person)

  return people
    .filter((other) => other.id !== person.id)
    .map((other) => {
      const shared: string[] = []
      const facets = facetsOf(other)
      const candidates = [
        ...FACET_ORDER.flatMap((key) => facets[key].map((v) => [`${key}:${v.toLowerCase()}`, v] as const)),
        ...other.interests.map((v) => [`interest:${v.toLowerCase()}`, v] as const),
        ...other.activities.map((v) => [`activity:${v.toLowerCase()}`, v] as const),
      ]
      for (const [tag, original] of candidates) {
        if (mine.has(tag) && !shared.includes(original)) shared.push(original)
      }
      return { person: other, score: similarity(person, other), shared }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.person.firstName.localeCompare(b.person.firstName))
    .slice(0, limit)
}
