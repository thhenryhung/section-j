import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Fuse from 'fuse.js'
import { useSectionData } from '../gate/SectionData'
import { PersonCard, PersonRow } from '../components/PersonCard'
import { PersonDetail } from '../components/PersonDetail'
import {
  FACET_LABELS,
  FACET_ORDER,
  collectFacets,
  matchesFacets,
  type FacetKey,
  type FacetSelection,
} from '../lib/people'
import type { Person } from '../lib/types'

/** How many chips to show per facet before "show all". */
const CHIP_LIMIT = 8

export function DirectoryPage() {
  const { people } = useSectionData()
  const { personId } = useParams()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<FacetSelection>({})
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [expanded, setExpanded] = useState<Set<FacetKey>>(new Set())

  const facets = useMemo(() => collectFacets(people), [people])

  /**
   * Searching across nested fields is why this uses Fuse rather than a substring
   * filter: people look each other up by half-remembered employer or a hobby, not
   * just by name. Name is weighted hardest so an exact name search still wins.
   */
  const fuse = useMemo(
    () =>
      new Fuse(people, {
        threshold: 0.34,
        ignoreLocation: true,
        includeScore: true,
        keys: [
          { name: 'displayName', weight: 3 },
          { name: 'firstName', weight: 2 },
          { name: 'lastName', weight: 2 },
          { name: 'preMBA.company', weight: 1.5 },
          { name: 'preMBA.title', weight: 1 },
          { name: 'preMBA.industry', weight: 1 },
          { name: 'preMBA.description', weight: 0.5 },
          { name: 'postMBA.industries', weight: 1.5 },
          { name: 'postMBA.functions', weight: 1 },
          { name: 'postMBA.geographies', weight: 1 },
          { name: 'professionalInterests', weight: 1.5 },
          { name: 'education.school', weight: 1.25 },
          { name: 'education.degree', weight: 0.75 },
          { name: 'languages.name', weight: 1 },
          // Sparse, but when someone has filled these in they are exactly what
          // a person searching for a climbing partner is typing.
          { name: 'interests', weight: 1.5 },
          { name: 'activities', weight: 1.5 },
          { name: 'homeRegion.city', weight: 1 },
          { name: 'homeRegion.country', weight: 1 },
          { name: 'currentCity', weight: 0.5 },
          { name: 'funFact', weight: 0.5 },
          { name: 'email', weight: 0.5 },
        ],
      }),
    [people],
  )

  const results = useMemo(() => {
    const trimmed = query.trim()
    const base: Person[] = trimmed ? fuse.search(trimmed).map((r) => r.item) : people
    return base.filter((person) => matchesFacets(person, selection))
  }, [query, fuse, people, selection])

  const activeCount = Object.values(selection).reduce((n, v) => n + (v?.length ?? 0), 0)

  function toggleFacet(key: FacetKey, value: string) {
    setSelection((prev) => {
      const current = prev[key] ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  const selected = personId ? people.find((p) => p.id === personId) : undefined

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, employer, interest, city…"
            aria-label="Search the directory"
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-base
                       dark:border-ink-700 dark:bg-ink-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm text-ink-500" role="status" aria-live="polite">
            {results.length} of {people.length}
          </p>
          <div className="flex rounded-lg border border-ink-300 dark:border-ink-700">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayout(mode)}
                aria-pressed={layout === mode}
                className={`px-3 py-1.5 text-sm capitalize first:rounded-l-lg last:rounded-r-lg ${
                  layout === mode ? 'bg-crimson-600 text-white' : 'text-ink-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {FACET_ORDER.map((key) => {
          const values = facets[key]
          if (values.length === 0) return null
          const isExpanded = expanded.has(key)
          const shown = isExpanded ? values : values.slice(0, CHIP_LIMIT)
          const active = selection[key] ?? []

          return (
            <div key={key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
              <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-400">
                {FACET_LABELS[key]}
              </span>
              {shown.map(({ value, count }) => {
                const on = active.includes(value)
                return (
                  <button
                    key={value}
                    onClick={() => toggleFacet(key, value)}
                    aria-pressed={on}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${
                      on
                        ? 'bg-crimson-600 text-white'
                        : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'
                    }`}
                  >
                    {value} <span className="opacity-60">{count}</span>
                  </button>
                )
              })}
              {values.length > CHIP_LIMIT && (
                <button
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }
                  className="text-xs text-crimson-600 underline underline-offset-2"
                >
                  {isExpanded ? 'fewer' : `+${values.length - CHIP_LIMIT} more`}
                </button>
              )}
            </div>
          )
        })}

        {activeCount > 0 && (
          <button
            onClick={() => setSelection({})}
            className="self-start text-xs text-ink-400 underline underline-offset-2 hover:text-crimson-600"
          >
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-400">
          Nobody matches that. Try a broader search or clear some filters.
        </p>
      ) : layout === 'grid' ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((person) => (
            <li key={person.id} className="contents">
              <PersonCard person={person} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="card overflow-hidden px-2">
          {results.map((person) => (
            <li key={person.id}>
              <PersonRow person={person} />
            </li>
          ))}
        </ul>
      )}

      {selected && <PersonDetail person={selected} onClose={() => navigate('/directory')} />}
    </div>
  )
}
