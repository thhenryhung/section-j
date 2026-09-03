import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSectionData } from '../gate/SectionData'
import { PersonPhoto } from '../components/PersonPhoto'
import { allocate, metWith } from '../lib/pairing'
import { formatLongDate } from '../lib/calendar'
import type { MeetupHistory, MeetupKind, MeetupRound } from '../lib/types'

const ME_KEY = 'section-j.me'

export function SocialPage() {
  const { people, byId, meetups, setMeetups } = useSectionData()
  const [me, setMe] = useState<string>(() => localStorage.getItem(ME_KEY) ?? '')
  const [showAdmin, setShowAdmin] = useState(false)

  const rounds = useMemo(
    () => [...meetups.rounds].sort((a, b) => b.date.localeCompare(a.date)),
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
            <p className="font-serif text-3xl text-crimson-600">
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
            Dinners of six run every three weeks, with 1:1 coffee chats on the weeks between.
            Once the first round is generated it will appear here, along with everyone you have
            already met.
          </p>
          <button
            onClick={() => setShowAdmin(true)}
            className="mt-4 rounded-lg bg-crimson-600 px-4 py-2 text-sm text-white hover:bg-crimson-700"
          >
            Generate the first round
          </button>
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
                    className="flex items-center gap-2 rounded-full border border-ink-200 py-1 pl-1 pr-3 text-sm hover:border-crimson-400 dark:border-ink-800"
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

      <div>
        <button
          onClick={() => setShowAdmin((v) => !v)}
          className="text-xs text-ink-400 underline underline-offset-2 hover:text-crimson-600"
        >
          {showAdmin ? 'Hide' : 'Show'} round generator
        </button>
        {showAdmin && <AdminPanel history={meetups} onGenerated={setMeetups} />}
      </div>
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
        <div className="card mb-3 border-crimson-400 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-crimson-600">
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
                  <li key={id} className={id === me ? 'font-semibold text-crimson-600' : ''}>
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
 * The generator runs entirely in the browser, then hands back a JSON file.
 *
 * It deliberately does not write anywhere: the organiser downloads the updated
 * history, eyeballs it, and commits it to the private repo. That keeps a
 * reviewable record of every round and makes a bad allocation trivial to undo.
 */
function AdminPanel({
  history,
  onGenerated,
}: {
  history: MeetupHistory
  onGenerated: (next: MeetupHistory) => void
}) {
  const { people } = useSectionData()
  const [kind, setKind] = useState<MeetupKind>('dinner')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [groupSize, setGroupSize] = useState(6)
  const [absent, setAbsent] = useState<string[]>([])
  const [result, setResult] = useState<{ history: MeetupHistory; stats: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function generate() {
    setBusy(true)
    // Yield a frame so the button can show its busy state before the search runs.
    setTimeout(() => {
      const outcome = allocate({
        kind,
        people,
        history,
        absentIds: absent,
        groupSize,
        seed: Date.now() & 0xffff,
      })

      const round: MeetupRound = {
        id: `${kind}-${date}`,
        kind,
        date,
        groups: outcome.groups,
        absentIds: absent,
        generatedAt: new Date().toISOString(),
      }

      const next: MeetupHistory = {
        version: 1,
        rounds: [...history.rounds.filter((r) => r.id !== round.id), round],
      }

      setResult({
        history: next,
        stats: `${outcome.groups.length} groups · ${outcome.firstTimeMeetings} first-time pairings · worst repeat: ${outcome.maxRepeat}`,
      })
      onGenerated(next)
      setBusy(false)
    }, 0)
  }

  function download() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result.history, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'meetup-history.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card mt-3 flex flex-col gap-4 p-4">
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          <span className="block text-xs text-ink-400">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MeetupKind)}
            className="mt-1 rounded-lg border border-ink-300 bg-white px-2 py-1.5 dark:border-ink-700 dark:bg-ink-900"
          >
            <option value="dinner">Dinner</option>
            <option value="onetoone">1:1</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-xs text-ink-400">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-lg border border-ink-300 bg-white px-2 py-1.5 dark:border-ink-700 dark:bg-ink-900"
          />
        </label>

        {kind === 'dinner' && (
          <label className="text-sm">
            <span className="block text-xs text-ink-400">Group size</span>
            <input
              type="number"
              min={3}
              max={12}
              value={groupSize}
              onChange={(e) => setGroupSize(Number(e.target.value))}
              className="mt-1 w-20 rounded-lg border border-ink-300 bg-white px-2 py-1.5 dark:border-ink-700 dark:bg-ink-900"
            />
          </label>
        )}
      </div>

      <details>
        <summary className="cursor-pointer text-xs text-ink-400">
          Not attending ({absent.length})
        </summary>
        <div className="mt-2 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
          {people.map((person) => (
            <label key={person.id} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={absent.includes(person.id)}
                onChange={(e) =>
                  setAbsent((prev) =>
                    e.target.checked ? [...prev, person.id] : prev.filter((id) => id !== person.id),
                  )
                }
              />
              <span className="truncate">{person.displayName}</span>
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-crimson-600 px-4 py-2 text-sm text-white hover:bg-crimson-700 disabled:opacity-50"
        >
          {busy ? 'Allocating…' : 'Generate round'}
        </button>
        {result && (
          <button
            onClick={download}
            className="rounded-lg border border-ink-300 px-4 py-2 text-sm dark:border-ink-700"
          >
            Download meetup-history.json
          </button>
        )}
      </div>

      {result && (
        <p className="text-xs text-ink-500">
          {result.stats}. Commit the downloaded file to the private data repo, then redeploy —
          this preview is not saved anywhere.
        </p>
      )}
    </div>
  )
}
