/**
 * Derived views over a Person — labels, facets, and similarity.
 *
 * Kept separate from the components so the same logic backs the directory, the
 * quiz distractor picker, and the dinner allocator's diversity nudges.
 */

import type { Person, Region } from './types'

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

export function initials(person: Person): string {
  return `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase()
}

/** Digits only, for a `tel:` href. */
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

export type FacetKey = 'region' | 'preMBAIndustry' | 'postMBAIndustry' | 'interest' | 'activity'

export const FACET_LABELS: Record<FacetKey, string> = {
  region: 'Home region',
  preMBAIndustry: 'Pre-MBA industry',
  postMBAIndustry: 'Post-MBA goal',
  interest: 'Interest',
  activity: 'Club or activity',
}

/** The values a single person contributes to each facet. */
export function facetsOf(person: Person): Record<FacetKey, string[]> {
  return {
    region: [person.homeRegion?.country].filter((v): v is string => Boolean(v)),
    preMBAIndustry: person.preMBA
      .map((r) => r.industry)
      .filter((v): v is string => Boolean(v)),
    postMBAIndustry: person.postMBA?.industries ?? [],
    interest: person.interests,
    activity: person.activities,
  }
}

/** Every facet value present in the section, with counts, most common first. */
export function collectFacets(people: Person[]): Record<FacetKey, Array<{ value: string; count: number }>> {
  const keys: FacetKey[] = ['region', 'preMBAIndustry', 'postMBAIndustry', 'interest', 'activity']
  const tallies = Object.fromEntries(keys.map((k) => [k, new Map<string, number>()])) as Record<
    FacetKey,
    Map<string, number>
  >

  for (const person of people) {
    const facets = facetsOf(person)
    for (const key of keys) {
      for (const value of new Set(facets[key])) {
        tallies[key].set(value, (tallies[key].get(value) ?? 0) + 1)
      }
    }
  }

  return Object.fromEntries(
    keys.map((key) => [
      key,
      [...tallies[key].entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    ]),
  ) as Record<FacetKey, Array<{ value: string; count: number }>>
}

export type FacetSelection = Partial<Record<FacetKey, string[]>>

/**
 * Filter semantics: OR within a facet, AND across facets. Picking two interests
 * widens the result; picking an interest and a region narrows it. That is what
 * people expect from faceted search, and it is the only combination that makes
 * "rock climbing OR sailing, based in Brazil" expressible.
 */
export function matchesFacets(person: Person, selection: FacetSelection): boolean {
  const facets = facetsOf(person)
  for (const [key, wanted] of Object.entries(selection) as Array<[FacetKey, string[]]>) {
    if (!wanted || wanted.length === 0) continue
    const has = new Set(facets[key])
    if (!wanted.some((value) => has.has(value))) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Similarity — "people like me"
// ---------------------------------------------------------------------------

/**
 * A person's tag set, namespaced so an interest called "Consulting" can never
 * collide with an industry called "Consulting".
 */
export function tagsOf(person: Person): Set<string> {
  const tags = new Set<string>()
  const facets = facetsOf(person)
  for (const [key, values] of Object.entries(facets)) {
    for (const value of values) tags.add(`${key}:${value.toLowerCase()}`)
  }
  return tags
}

/**
 * Weighted overlap. Shared interests and post-MBA goals say far more about
 * whether two people should get coffee than a shared home country does, so plain
 * Jaccard is a poor fit — a weighted intersection over the union is closer to
 * what someone means by "similar to me".
 */
const TAG_WEIGHTS: Record<FacetKey, number> = {
  interest: 3,
  postMBAIndustry: 3,
  activity: 2,
  preMBAIndustry: 1.5,
  region: 1,
}

function weightOf(tag: string): number {
  const key = tag.slice(0, tag.indexOf(':')) as FacetKey
  return TAG_WEIGHTS[key] ?? 1
}

export function similarity(a: Person, b: Person): number {
  const tagsA = tagsOf(a)
  const tagsB = tagsOf(b)
  if (tagsA.size === 0 || tagsB.size === 0) return 0

  let intersection = 0
  let union = 0
  const seen = new Set<string>()

  for (const tag of tagsA) {
    seen.add(tag)
    union += weightOf(tag)
    if (tagsB.has(tag)) intersection += weightOf(tag)
  }
  for (const tag of tagsB) {
    if (!seen.has(tag)) union += weightOf(tag)
  }

  return union === 0 ? 0 : intersection / union
}

/** The `limit` people most similar to `person`, excluding themselves. */
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
      for (const tag of tagsOf(other)) {
        if (mine.has(tag)) shared.push(tag.slice(tag.indexOf(':') + 1))
      }
      return { person: other, score: similarity(person, other), shared }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.person.firstName.localeCompare(b.person.firstName))
    .slice(0, limit)
}
