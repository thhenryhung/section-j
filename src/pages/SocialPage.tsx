import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSectionData } from '../gate/SectionData'
import { PersonPhoto } from '../components/PersonPhoto'
import { metWith } from '../lib/pairing'
import { formatLongDate } from '../lib/calendar'
import type { MeetupRound } from '../lib/types'

const ME_KEY = 'section-j.me'

export function SocialPage() {
  const { people, byId, meetups } = useSectionData()
  const [me, setMe] = useState<string>(() => localStorage.getItem(ME_KEY) ?? '')

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
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="flex-1">
          <label htmlFor="me" className="block text-sm font-medium">
            Who are you?
          </label>
          <p className="mb-2 text-xs text-ink-500">
            Kept in this browser only, so the page can highlight your group.
          </p>
          <select
            id="me"
            value={me}
            onChange={(e) => chooseMe(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-ink-300 bg-white px-3 py-2 dark:border-ink-700 dark:bg-ink-900"
          >
            <option value="">Choose your name…</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
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
            Dinners of six run every three weeks, with 1:1 coffee chats on the weeks between. The
            section posts each round on schedule — check back soon, or ask your organiser when
            the next one lands.
          </p>
        </div>
      ) : (
        rounds.map((round) => <RoundView key={round.id} round={round} me={me} />)
      )}

      {me && met.length > 0 && (
        <section>
          <h2 className="mb-2 font-serif text-xl">Who you’ve met</h2>
          <ul className="flex flex-wrap gap-2">
            {met.map(({ id, count }) => {
              const person = byId.get(id)
              if (!person) return null
              return (
                <li key={id}>
                  <Link
                    to={`/directory/${id}`}
                    className="flex items-center gap-2 rounded-full border border-ink-200 py-1 pl-1 pr-3 text-sm hover:border-green-400 dark:border-ink-800"
                  >
                    <PersonPhoto person={person} className="size-7 rounded-full text-[10px]" />
                    {person.firstName}
                    {count > 1 && <span className="text-xs text-ink-400">×{count}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function RoundView({ round, me }: { round: MeetupRound; me: string }) {
  const { byId } = useSectionData()
  const mine = round.groups.find((group) => group.memberIds.includes(me))

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-serif text-xl">
          {round.kind === 'dinner' ? 'Dinners' : '1:1 chats'} · {formatLongDate(round.date)}
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
                  <Link
                    to={`/directory/${id}`}
                    className={`flex w-24 flex-col items-center gap-1 text-center ${
                      id === me ? 'opacity-50' : ''
                    }`}
                  >
                    <PersonPhoto person={person} className="size-16 rounded-full text-lg" />
                    <span className="text-xs leading-tight">{person.displayName}</span>
                    {person.dietary && person.dietary.length > 0 && (
                      <span className="text-[10px] text-ink-400">{person.dietary.join(', ')}</span>
                    )}
                  </Link>
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

