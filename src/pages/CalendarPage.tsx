import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSectionData } from '../gate/SectionData'
import {
  DAY_NAMES,
  MONTH_NAMES,
  birthdayEntries,
  courseEntries,
  eventEntries,
  formatLongDate,
  fromISODate,
  groupByDate,
  monthGrid,
  sortEntries,
  toICS,
  toISODate,
} from '../lib/calendar'
import type { CalendarEntry, Course, EventCategory, SectionEvent } from '../lib/types'
import rawEvents from '../../data/events.json'
import rawCourses from '../../data/courses.json'

const events = rawEvents as SectionEvent[]
const courses = rawCourses as Course[]

const CATEGORY_STYLE: Record<EventCategory, string> = {
  section: 'bg-crimson-600 text-white',
  social: 'bg-emerald-600 text-white',
  course: 'bg-sky-700 text-white',
  deadline: 'bg-amber-600 text-white',
  birthday: 'bg-purple-600 text-white',
}

const CATEGORY_DOT: Record<EventCategory, string> = {
  section: 'bg-crimson-600',
  social: 'bg-emerald-600',
  course: 'bg-sky-700',
  deadline: 'bg-amber-600',
  birthday: 'bg-purple-600',
}

const ALL_CATEGORIES: EventCategory[] = ['section', 'social', 'course', 'deadline', 'birthday']

export function CalendarPage() {
  const { people } = useSectionData()

  const today = toISODate(new Date())
  const [cursor, setCursor] = useState(() => {
    const now = fromISODate(today)
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
  })
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [hidden, setHidden] = useState<Set<EventCategory>>(new Set(['course']))

  /**
   * Birthdays are generated for the year on screen and the next one, so scrolling
   * from December into January does not fall off the end of the data.
   */
  const allEntries = useMemo(
    () =>
      sortEntries([
        ...eventEntries(events),
        ...courseEntries(courses),
        ...birthdayEntries(people, cursor.year),
        ...birthdayEntries(people, cursor.year + 1),
      ]),
    [people, cursor.year],
  )

  const visible = useMemo(
    () => allEntries.filter((entry) => !hidden.has(entry.category)),
    [allEntries, hidden],
  )

  const byDate = useMemo(() => groupByDate(visible), [visible])
  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  const upcoming = useMemo(
    () => visible.filter((entry) => entry.date >= today).slice(0, 60),
    [visible, today],
  )

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const month = prev.month + delta
      if (month < 1) return { year: prev.year - 1, month: 12 }
      if (month > 12) return { year: prev.year + 1, month: 1 }
      return { ...prev, month }
    })
  }

  function toggleCategory(category: EventCategory) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  /**
   * Generated in the browser rather than published as a static file — birthdays
   * come from the encrypted roster, so an .ics on the CDN would hand out the very
   * thing the passphrase is protecting.
   */
  function downloadICS() {
    const blob = new Blob([toICS(visible)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'section-j.ics'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-200 dark:hover:bg-ink-800"
          >
            ←
          </button>
          <h2 className="min-w-44 text-center font-serif text-xl">
            {MONTH_NAMES[cursor.month - 1]} {cursor.year}
          </h2>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-200 dark:hover:bg-ink-800"
          >
            →
          </button>
        </div>

        <div className="flex rounded-lg border border-ink-300 dark:border-ink-700">
          {(['month', 'agenda'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={`px-3 py-1.5 text-sm capitalize first:rounded-l-lg last:rounded-r-lg ${
                view === mode ? 'bg-crimson-600 text-white' : 'text-ink-500'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          onClick={downloadICS}
          className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm dark:border-ink-700"
        >
          Add to my calendar
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map((category) => {
          const on = !hidden.has(category)
          return (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs capitalize transition ${
                on
                  ? 'bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
                  : 'bg-transparent text-ink-400 line-through'
              }`}
            >
              <span className={`size-2 rounded-full ${CATEGORY_DOT[category]} ${on ? '' : 'opacity-30'}`} />
              {category}
            </button>
          )
        })}
      </div>

      {view === 'month' ? (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-ink-200 dark:border-ink-800">
            {DAY_NAMES.map((day) => (
              <div key={day} className="px-2 py-1.5 text-center text-xs font-semibold text-ink-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((date) => {
              const inMonth = fromISODate(date).getUTCMonth() + 1 === cursor.month
              const entries = byDate.get(date) ?? []
              const isToday = date === today

              return (
                <div
                  key={date}
                  className={`min-h-24 border-b border-r border-ink-200 p-1 last:border-r-0 dark:border-ink-800 ${
                    inMonth ? '' : 'bg-ink-100/60 dark:bg-ink-900/40'
                  }`}
                >
                  <div
                    className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-crimson-600 font-semibold text-white' : 'text-ink-400'
                    }`}
                  >
                    {fromISODate(date).getUTCDate()}
                  </div>

                  <ul className="flex flex-col gap-0.5">
                    {entries.slice(0, 3).map((entry) => (
                      <li key={entry.id}>
                        <EntryChip entry={entry} />
                      </li>
                    ))}
                    {entries.length > 3 && (
                      <li className="px-1 text-[10px] text-ink-400">+{entries.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-ink-200 dark:divide-ink-800">
          {upcoming.length === 0 && (
            <p className="p-8 text-center text-sm text-ink-400">Nothing coming up in the visible categories.</p>
          )}
          {upcoming.map((entry) => (
            <div key={entry.id} className="flex gap-4 p-3">
              <div className="w-28 shrink-0 text-xs text-ink-400">
                {formatLongDate(entry.date)}
                {entry.startTime && <span className="block">{entry.startTime}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <EntryTitle entry={entry} />
                {entry.location && <p className="text-xs text-ink-400">{entry.location}</p>}
                {entry.description && (
                  <p className="mt-0.5 text-xs text-ink-500">{entry.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-400">
        Something missing? Section events live in{' '}
        <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">data/events.json</code> — open a
        pull request and it appears here.
      </p>
    </div>
  )
}

function EntryChip({ entry }: { entry: CalendarEntry }) {
  const className = `block truncate rounded px-1 py-0.5 text-[10px] ${CATEGORY_STYLE[entry.category]}`
  if (entry.personId) {
    return (
      <Link to={`/directory/${entry.personId}`} className={className} title={entry.title}>
        {entry.title}
      </Link>
    )
  }
  return (
    <span className={className} title={entry.title}>
      {entry.title}
    </span>
  )
}

function EntryTitle({ entry }: { entry: CalendarEntry }) {
  const content = (
    <>
      <span className={`mr-2 inline-block size-2 rounded-full align-middle ${CATEGORY_DOT[entry.category]}`} />
      {entry.title}
    </>
  )
  if (entry.personId) {
    return (
      <Link to={`/directory/${entry.personId}`} className="text-sm hover:text-crimson-600">
        {content}
      </Link>
    )
  }
  if (entry.url) {
    return (
      <a href={entry.url} target="_blank" rel="noreferrer" className="text-sm hover:text-crimson-600">
        {content}
      </a>
    )
  }
  return <p className="text-sm">{content}</p>
}
