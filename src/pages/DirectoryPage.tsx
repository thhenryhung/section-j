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

export function DirectoryPage() {
  const { people } = useSectionData()
  const { personId } = useParams()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<FacetSelection>({})
  const [layout, setLayout] = useState<'table' | 'card'>('table')

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
          { name: 'professionalInterests', weight: 1.5 },
          { name: 'education.school', weight: 1.25 },
          { name: 'education.degree', weight: 0.75 },
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
            {(['table', 'card'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayout(mode)}
                aria-pressed={layout === mode}
                className={`px-3 py-1.5 text-sm capitalize first:rounded-l-lg last:rounded-r-lg ${
                  layout === mode ? 'bg-green-600 text-white' : 'text-ink-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/*
       * One dropdown per facet rather than a wall of chips — a filter with, say,
       * thirty industry values used to print thirty buttons across the page
       * before you could even see a person. `<details>` needs no extra JS state
       * for open/closed and degrades to a plain expandable list if styling ever
       * fails to load.
       */}
      <div className="flex flex-wrap items-center gap-2">
        {FACET_ORDER.map((key) => {
          const values = facets[key]
          if (values.length === 0) return null
          const active = selection[key] ?? []

          return (
            <details key={key} className="group relative">
              <summary
                className={`flex cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition [&::-webkit-details-marker]:hidden ${
                  active.length > 0
                    ? 'border-green-600 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200'
                    : 'border-ink-300 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800'
                }`}
              >
                {FACET_LABELS[key]}
                {active.length > 0 && ` (${active.length})`}
                <span className="text-[10px] transition group-open:rotate-180">▾</span>
              </summary>

              <div className="absolute left-0 z-20 mt-1 max-h-72 w-64 max-w-[90vw] overflow-y-auto rounded-lg border border-ink-200 bg-white p-1.5 shadow-lg dark:border-ink-800 dark:bg-ink-900">
                {values.map(({ value, count }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-ink-100 dark:hover:bg-ink-800"
                  >
                    <input
                      type="checkbox"
                      checked={active.includes(value)}
                      onChange={() => toggleFacet(key, value)}
                      className="accent-green-600"
                    />
                    <span className="min-w-0 flex-1 truncate">{value}</span>
                    <span className="shrink-0 text-xs text-ink-400">{count}</span>
                  </label>
                ))}
              </div>
            </details>
          )
        })}

        {activeCount > 0 && (
          <button
            onClick={() => setSelection({})}
            className="text-xs text-ink-400 underline underline-offset-2 hover:text-green-700 dark:hover:text-green-400"
          >
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-400">
          Nobody matches that. Try a broader search or clear some filters.
        </p>
      ) : layout === 'card' ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((person) => (
            <li key={person.id} className="contents">
              <PersonCard person={person} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="hidden px-2 py-2 font-semibold sm:table-cell">Industry</th>
                  <th className="hidden px-2 py-2 font-semibold md:table-cell">
                    Professional interests
                  </th>
                  <th className="hidden px-2 py-2 font-semibold lg:table-cell">Home region</th>
                </tr>
              </thead>
              <tbody>
                {results.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <PersonDetail person={selected} onClose={() => navigate('/directory')} />}
    </div>
  )
}
