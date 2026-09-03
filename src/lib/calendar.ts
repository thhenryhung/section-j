/**
 * Calendar assembly.
 *
 * Three sources feed one stream of entries:
 *   - data/events.json   one-off section events (public, the main PR surface)
 *   - data/courses.json  recurring classes (public)
 *   - the roster         birthdays (private, only after unlock)
 *
 * All dates are handled as plain YYYY-MM-DD strings in UTC. Section life happens
 * on calendar days, not instants, so anchoring to UTC avoids the classic bug
 * where an event drifts to the previous day for anyone west of Greenwich.
 */

import type { CalendarEntry, Course, Person, SectionEvent } from './types'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toISODate(date)
}

export function formatLongDate(iso: string): string {
  const date = fromISODate(iso)
  return `${DAY_NAMES[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`
}

// ---------------------------------------------------------------------------
// Source expansion
// ---------------------------------------------------------------------------

export function eventEntries(events: SectionEvent[]): CalendarEntry[] {
  return events.map((event) => ({ ...event, category: event.category }))
}

/** Expand each course into one entry per meeting day within its date range. */
export function courseEntries(courses: Course[]): CalendarEntry[] {
  const entries: CalendarEntry[] = []

  for (const course of courses) {
    const exceptions = new Set(course.exceptions ?? [])
    let cursor = course.startDate
    let guard = 0

    while (cursor <= course.endDate && guard++ < 400) {
      const weekday = fromISODate(cursor).getUTCDay()
      if (course.daysOfWeek.includes(weekday) && !exceptions.has(cursor)) {
        entries.push({
          id: `${course.id}-${cursor}`,
          title: course.name,
          category: 'course',
          date: cursor,
          startTime: course.startTime,
          endTime: course.endTime,
          location: course.room,
          description: course.professor ? `with ${course.professor}` : undefined,
        })
      }
      cursor = addDays(cursor, 1)
    }
  }

  return entries
}

/**
 * Birthdays for a given calendar year. Only month and day are ever stored, so no
 * age is implied or displayed. 29 February falls back to the 28th in common years.
 */
export function birthdayEntries(people: Person[], year: number): CalendarEntry[] {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

  return people
    .filter((person) => person.birthday)
    .map((person) => {
      const { month, day } = person.birthday!
      const safeDay = month === 2 && day === 29 && !isLeap ? 28 : day
      const date = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
      return {
        id: `birthday-${person.id}-${year}`,
        title: `${person.displayName}’s birthday`,
        category: 'birthday' as const,
        date,
        personId: person.id,
      }
    })
}

export function sortEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') ||
      a.title.localeCompare(b.title),
  )
}

export function groupByDate(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>()
  for (const entry of entries) {
    const list = map.get(entry.date)
    if (list) list.push(entry)
    else map.set(entry.date, [entry])
  }
  return map
}

// ---------------------------------------------------------------------------
// Month grid
// ---------------------------------------------------------------------------

/** Six weeks of dates covering `month`, padded so the grid is always rectangular. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const start = new Date(first)
  start.setUTCDate(first.getUTCDate() - first.getUTCDay())

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + i)
    return toISODate(day)
  })
}

// ---------------------------------------------------------------------------
// ICS export
// ---------------------------------------------------------------------------

function escapeICS(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** RFC 5545 caps lines at 75 octets; long titles must be folded or clients choke. */
function fold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length > 73) {
    parts.push(' ' + rest.slice(0, 73))
    rest = rest.slice(73)
  }
  if (rest) parts.push(' ' + rest)
  return parts.join('\r\n')
}

/**
 * Build a subscribable .ics. Timed entries become local-time events; everything
 * else (birthdays, all-day socials) becomes a proper all-day event, which is what
 * stops fifteen birthdays from eating the top of someone's Tuesday.
 */
export function toICS(entries: CalendarEntry[], calendarName = 'Section J'): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Section J//Section Site//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
  ]

  for (const entry of entries) {
    const compact = entry.date.replace(/-/g, '')
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${entry.id}@section-j`)
    lines.push(`DTSTAMP:${stamp}`)

    if (entry.startTime) {
      const end = entry.endTime ?? entry.startTime
      lines.push(`DTSTART:${compact}T${entry.startTime.replace(':', '')}00`)
      lines.push(`DTEND:${compact}T${end.replace(':', '')}00`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact}`)
      lines.push(`DTEND;VALUE=DATE:${addDays(entry.date, 1).replace(/-/g, '')}`)
    }

    lines.push(fold(`SUMMARY:${escapeICS(entry.title)}`))
    if (entry.location) lines.push(fold(`LOCATION:${escapeICS(entry.location)}`))
    if (entry.description) lines.push(fold(`DESCRIPTION:${escapeICS(entry.description)}`))
    lines.push(`CATEGORIES:${entry.category.toUpperCase()}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
