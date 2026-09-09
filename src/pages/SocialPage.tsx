import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { useSectionData } from '../gate/SectionData'
import { PersonPhoto } from '../components/PersonPhoto'
import { PersonDetail } from '../components/PersonDetail'
import { metWith } from '../lib/pairing'
import { formatLongDate } from '../lib/calendar'
import type { MeetupRound, Person } from '../lib/types'

const ME_KEY = 'section-j.me'

export function SocialPage() {
  const { people, byId, meetups } = useSectionData()
  const [me, setMe] = useState<string>(() => localStorage.getItem(ME_KEY) ?? '')
  const [viewingProfile, setViewingProfile] = useState<Person | null>(null)

  // Soonest round first, so the next thing on your calendar is what you see first.
  const rounds = useMemo(
    () => [...meetups.rounds].sort((a, b) => a.date.localeCompare(b.date)),
    [meetups],
  )

  const met = useMemo(() => (me ? metWith(me, meetups) : []), [me, meetups])
  const metCount = met.length
  const remaining = Math.max(0, people.length - 1 - metCount)

  function chooseMe(id: string) {
    setMe(id)
    if (id) localStorage.setItem(ME_KEY, id)
    else localStorage.removeItem(ME_KEY)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-500">
        New dinner groups and pairings are assigned automatically every 3 weeks, alternating between
        small-group dinners and coffee chats. The system avoids repeating a pairing until
        everyone’s been covered once. Can’t make a round? Let us know you’re unavailable and
        we’ll leave you out of that round’s assignment.
      </p>

      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="flex-1">
          <label htmlFor="me" className="block text-sm font-medium">
            Who are you?
          </label>
          <p className="mb-2 text-xs text-ink-500">
            Kept in this browser only, so the page can highlight your group.
          </p>
          <NamePicker id="me" people={people} value={me} onChange={chooseMe} />
        </div>

        {me && (
          <div className="text-right">
            <p className="font-serif text-3xl text-green-700 dark:text-green-400">
              {metCount}
              <span className="text-lg text-ink-400">/{people.length - 1}</span>
            </p>
            <p className="text-xs text-ink-500">
              met so far · {remaining} to go
            </p>
          </div>
        )}
      </div>

      {rounds.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-serif text-xl">No rounds yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Dinners of six run every three weeks, with coffee chats on the weeks between. The
            section posts each round on schedule — check back soon, or ask your organiser when
            the next one lands.
          </p>
        </div>
      ) : (
        rounds.map((round) => (
          <RoundView key={round.id} round={round} me={me} onViewProfile={setViewingProfile} />
        ))
      )}

      {me && met.length > 0 && (
        <section>
          <h2 className="mb-2 font-serif text-xl">Who you’ve met through dinners / coffee</h2>
          <ul className="flex flex-wrap gap-2">
            {met.map(({ id, count }) => {
              const person = byId.get(id)
              if (!person) return null
              return (
                <li key={id}>
                  <button
                    onClick={() => setViewingProfile(person)}
                    className="flex items-center gap-2 rounded-full border border-ink-200 py-1 pl-1 pr-3 text-sm hover:border-green-400 dark:border-ink-800"
                  >
                    <PersonPhoto person={person} className="size-7 rounded-full text-[10px]" />
                    {person.firstName}
                    {count > 1 && <span className="text-xs text-ink-400">×{count}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {viewingProfile && (
        <PersonDetail
          person={viewingProfile}
          onClose={() => setViewingProfile(null)}
          onNavigate={setViewingProfile}
        />
      )}
    </div>
  )
}

function RoundView({
  round,
  me,
  onViewProfile,
}: {
  round: MeetupRound
  me: string
  onViewProfile: (person: Person) => void
}) {
  const { byId } = useSectionData()
  const mine = round.groups.find((group) => group.memberIds.includes(me))

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-serif text-xl">
          {round.kind === 'dinner' ? 'Dinners' : 'Coffee chats'} · {formatLongDate(round.date)}
        </h2>
        <p className="text-xs text-ink-400">{round.groups.length} groups</p>
      </div>

      {mine && (
        <div className="card mb-3 border-green-400 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
            You’re in {mine.label}
          </p>
          <ul className="flex flex-wrap gap-3">
            {mine.memberIds.map((id) => {
              const person = byId.get(id)
              if (!person) return null
              return (
                <li key={id}>
                  <button
                    onClick={() => onViewProfile(person)}
                    className={`flex w-24 flex-col items-center gap-1 text-center ${
                      id === me ? 'opacity-50' : ''
                    }`}
                  >
                    <PersonPhoto person={person} className="size-16 rounded-full text-lg" />
                    <span className="text-xs leading-tight">{person.displayName}</span>
                    {person.dietary && person.dietary.length > 0 && (
                      <span className="text-[10px] text-ink-400">{person.dietary.join(', ')}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <details className="card p-3">
        <summary className="cursor-pointer text-sm text-ink-500">
          All {round.groups.length} groups
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {round.groups.map((group) => (
            <div key={group.label} className="rounded-lg border border-ink-200 p-2 dark:border-ink-800">
              <p className="mb-1 text-xs font-semibold text-ink-400">{group.label}</p>
              <ul className="text-sm">
                {group.memberIds.map((id) => (
                  <li key={id} className={id === me ? 'font-semibold text-green-700 dark:text-green-400' : ''}>
                    {byId.get(id)?.displayName ?? id}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

/**
 * Type-to-filter name picker, so finding yourself doesn't mean scrolling
 * the whole section in a native `<select>` — especially painful if your name
 * is near the end of the alphabet.
 */
function NamePicker({
  id,
  people,
  value,
  onChange,
}: {
  id: string
  people: Person[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  // Reflect the current selection in the box whenever the list isn't open —
  // and start from a blank slate the moment it is, so typing never has to
  // fight the previous choice still sitting in the field.
  useEffect(() => {
    if (open) return
    const selected = people.find((p) => p.id === value)
    setQuery(selected?.displayName ?? '')
  }, [value, open, people])

  const fuse = useMemo(
    () => new Fuse(people, { keys: ['displayName'], threshold: 0.35, ignoreLocation: true }),
    [people],
  )

  const matches = useMemo(() => {
    const trimmed = query.trim()
    const base = trimmed ? fuse.search(trimmed).map((r) => r.item) : people
    return base.slice(0, 8)
  }, [query, fuse, people])

  function select(person: Person) {
    onChange(person.id)
    setOpen(false)
  }

  return (
    <div className="relative max-w-xs">
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        placeholder="Type your name…"
        autoComplete="off"
        className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 dark:border-ink-700 dark:bg-ink-900"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-400">No one matches that</p>
          ) : (
            matches.map((person) => (
              <button
                key={person.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(person)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                {person.displayName}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

