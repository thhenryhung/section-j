import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSectionData } from '../gate/SectionData'
import { allocate, type AllocationResult } from '../lib/pairing'
import type { MeetupHistory, MeetupKind, MeetupRound, SectionEvent } from '../lib/types'

/**
 * The admin panel. Deliberately reachable by anyone (the "Admin" link next to
 * Logout is not hidden) — the actual security boundary is server-side: this
 * page shows nothing until POST /api/admin/login accepts a *separate*
 * passphrase from the section-wide one, and every subsequent read/write
 * independently re-verifies the resulting session cookie
 * (functions/_shared/session.ts), never trusting a client-side flag.
 *
 * There is no per-admin identity — every change is attributed to the same
 * shared "Section J Admin" GitHub commit author, which the form says plainly.
 */

type Status = 'checking' | 'prompt' | 'loading-in' | 'authed' | 'error'

const EDITABLE_CATEGORIES: SectionEvent['category'][] = ['section', 'social', 'deadline']

const EMPTY_FORM: SectionEvent = {
  id: '',
  title: '',
  category: 'section',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  description: '',
  url: '',
}

function slugify(title: string, date: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${date}-${base}`.slice(0, 80)
}

/** Strips empty-string optional fields so they come back as `undefined`, not `''`. */
function cleanEvent(event: SectionEvent): SectionEvent {
  const cleaned: SectionEvent = { id: event.id, title: event.title, category: event.category, date: event.date }
  if (event.startTime) cleaned.startTime = event.startTime
  if (event.endTime) cleaned.endTime = event.endTime
  if (event.location) cleaned.location = event.location
  if (event.description) cleaned.description = event.description
  if (event.url) cleaned.url = event.url
  return cleaned
}

const ROUND_LABEL: Record<MeetupKind, string> = {
  dinner: 'Small-group dinners',
  onetoone: 'Coffee chats',
}

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/**
 * Find the round number to use for `kind` on `date` — reuses an existing
 * placeholder event's number if one is already scheduled for that date (so
 * generating a round "activates" the pre-planned Round N rather than minting
 * a duplicate), otherwise the next number after the highest one seen.
 */
function roundNumberFor(events: SectionEvent[], kind: MeetupKind, date: string): number {
  const pattern = new RegExp(`^${kind}-round-(\\d+)$`)
  let highest = 0
  for (const event of events) {
    const match = pattern.exec(event.id)
    if (!match) continue
    const n = Number(match[1])
    if (event.date === date) return n
    if (n > highest) highest = n
  }
  return highest + 1
}

export function AdminPage() {
  const { people, byId, meetups, setMeetups } = useSectionData()
  const [status, setStatus] = useState<Status>('checking')
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<SectionEvent[]>([])
  const [form, setForm] = useState<SectionEvent>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  // ---- Meetup round generation ------------------------------------------
  const [roundKind, setRoundKind] = useState<MeetupKind>('dinner')
  const [roundDate, setRoundDate] = useState('')
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set())
  const [absentSearch, setAbsentSearch] = useState('')
  const [alsoCreateEvent, setAlsoCreateEvent] = useState(true)
  const [preview, setPreview] = useState<AllocationResult | null>(null)
  const [previewSeed, setPreviewSeed] = useState<number | null>(null)
  const [roundSaving, setRoundSaving] = useState(false)
  const [roundNotice, setRoundNotice] = useState<string | null>(null)

  const filteredPeople = useMemo(() => {
    const q = absentSearch.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
  }, [people, absentSearch])

  function toggleAbsent(id: string) {
    setPreview(null)
    setAbsentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function generatePreview(seedOverride?: number) {
    if (!roundDate) return
    const seed = seedOverride ?? Number(roundDate.replace(/-/g, '')) % 65536
    const result = allocate({
      kind: roundKind,
      people,
      history: meetups,
      absentIds: [...absentIds],
      groupSize: 6,
      seed,
    })
    setPreviewSeed(seed)
    setPreview(result)
    setRoundNotice(null)
  }

  async function confirmRound() {
    if (!preview || !roundDate) return
    setRoundSaving(true)
    setRoundNotice(null)

    const round: MeetupRound = {
      id: `${roundKind}-${roundDate}`,
      kind: roundKind,
      date: roundDate,
      groups: preview.groups,
      absentIds: [...absentIds],
      generatedAt: new Date().toISOString(),
    }

    const nextHistory: MeetupHistory = {
      version: 1,
      rounds: [...meetups.rounds.filter((r) => r.id !== round.id), round].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }

    // Deliberately not persisted server-side: this only updates what this
    // browser tab sees (so the Social tab reflects it immediately) and
    // downloads the file for manual review before it's committed to the
    // private data repo — see the comment on setMeetups in SectionData.tsx
    // for why a generated round must never silently become the section's
    // history on its own.
    setMeetups(nextHistory)
    downloadJSON('meetup-history.json', nextHistory)

    let eventWarning: string | undefined
    if (alsoCreateEvent) {
      const roundNumber = roundNumberFor(events, roundKind, roundDate)
      const event: SectionEvent = {
        id: `${roundKind}-round-${roundNumber}`,
        title: `${ROUND_LABEL[roundKind]} — Round ${roundNumber}`,
        category: 'social',
        date: roundDate,
        location: 'Groups assigned on the Social tab',
        description: 'Groups to determine when to meet during the week',
        ...(roundKind === 'dinner' ? { startTime: '19:00' } : {}),
      }
      try {
        const res = await fetch('/api/admin/events', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanEvent(event)),
        })
        if (res.status === 401) {
          setStatus('prompt')
          setRoundSaving(false)
          return
        }
        if (res.ok) {
          const body = (await res.json()) as { events: SectionEvent[]; commitWarning?: string }
          setEvents(body.events)
          eventWarning = body.commitWarning
        } else {
          eventWarning = 'Round saved locally, but creating the calendar event failed.'
        }
      } catch {
        eventWarning = 'Round saved locally, but the admin API was not reachable to create the calendar event.'
      }
    }

    setRoundSaving(false)
    setPreview(null)
    setPreviewSeed(null)
    setAbsentIds(new Set())
    setRoundNotice(
      eventWarning ??
        'Round generated. meetup-history.json downloaded — review it and commit it to the private data repo.',
    )
  }

  async function loadEvents() {
    try {
      const res = await fetch('/api/admin/events', { credentials: 'same-origin' })
      if (res.status === 401) {
        setStatus('prompt')
        return
      }
      if (!res.ok) {
        setStatus('error')
        setError('Could not load admin data.')
        return
      }
      const overlay = (await res.json()) as SectionEvent[]
      setEvents(overlay)
      setStatus('authed')
    } catch {
      // Most likely: no Cloudflare Functions runtime available (plain `npm run
      // dev` doesn't run functions/ — use `npm run functions:dev` for that).
      setStatus('error')
      setError('The admin API is not reachable here. Run `npm run functions:dev` to test it locally.')
    }
  }

  // Re-check auth on mount via the same endpoint the writes use, rather than
  // trusting a client-side "I'm logged in" flag left over from a prior visit.
  useEffect(() => {
    void loadEvents()
  }, [])

  async function onLogin(event: FormEvent) {
    event.preventDefault()
    if (!passphrase.trim()) return
    setStatus('loading-in')
    setError(null)
    let res: Response
    try {
      res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: passphrase.trim() }),
      })
    } catch {
      setStatus('prompt')
      setError('The admin API is not reachable here. Run `npm run functions:dev` to test it locally.')
      return
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setStatus('prompt')
      setError(body.error ?? 'Could not log in.')
      return
    }
    setPassphrase('')
    await loadEvents()
  }

  function startEdit(event: SectionEvent) {
    setEditingId(event.id)
    setForm({ ...EMPTY_FORM, ...event })
  }

  function startNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function onSave(formEvent: FormEvent) {
    formEvent.preventDefault()
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    setWarning(null)
    const id = editingId ?? slugify(form.title, form.date)
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanEvent({ ...form, id })),
    })
    setSaving(false)
    if (res.status === 401) {
      setStatus('prompt')
      return
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Could not save the event.')
      return
    }
    const body = (await res.json()) as { events: SectionEvent[]; commitWarning?: string }
    setEvents(body.events)
    if (body.commitWarning) setWarning(body.commitWarning)
    startNew()
  }

  async function onDelete(id: string) {
    setSaving(true)
    setWarning(null)
    const res = await fetch('/api/admin/events', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSaving(false)
    if (res.status === 401) {
      setStatus('prompt')
      return
    }
    if (!res.ok) return
    const body = (await res.json()) as { events: SectionEvent[]; commitWarning?: string }
    setEvents(body.events)
    if (body.commitWarning) setWarning(body.commitWarning)
    if (editingId === id) startNew()
  }

  if (status === 'checking') {
    return <p className="text-sm text-ink-400">Checking…</p>
  }

  if (status === 'prompt' || status === 'loading-in') {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-1 font-serif text-2xl">Admin</h1>
        <p className="mb-4 text-sm text-ink-500">
          A separate passphrase from the section one. Only a few people have it.
        </p>
        <form onSubmit={onLogin} className="card p-6">
          <label htmlFor="admin-passphrase" className="block text-sm font-medium">
            Admin passphrase
          </label>
          <input
            id="admin-passphrase"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={status === 'loading-in'}
            className="mt-3 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-base
                       disabled:opacity-60 dark:border-ink-700 dark:bg-ink-950"
          />
          <button
            type="submit"
            disabled={status === 'loading-in' || !passphrase.trim()}
            className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white
                       transition hover:bg-green-700 disabled:opacity-50"
          >
            {status === 'loading-in' ? 'Checking…' : 'Enter'}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-crimson-600">
              {error}
            </p>
          )}
        </form>
      </div>
    )
  }

  if (status === 'error') {
    return <p className="text-sm text-crimson-600">{error}</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 font-serif text-2xl">Admin — Calendar events</h1>
      <p className="mb-4 text-xs text-ink-400">
        Changes go live for everyone within seconds and are attributed to the shared admin
        account, not to you individually.
      </p>

      {warning && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {warning}
        </p>
      )}

      <div className="card mb-6 flex flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Generate a meetup round</p>
          <p className="text-xs text-ink-400">
            Runs the same overlap-minimising algorithm as{' '}
            <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">npm run pair</code>, right here.
            Confirming updates what this tab's Social page shows and downloads{' '}
            <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">meetup-history.json</code> for you
            to review and commit to the private data repo — it is never written there automatically.
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={roundKind}
            onChange={(e) => {
              setRoundKind(e.target.value as MeetupKind)
              setPreview(null)
            }}
            className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          >
            <option value="dinner">Small-group dinners</option>
            <option value="onetoone">Coffee chats</option>
          </select>
          <input
            type="date"
            value={roundDate}
            onChange={(e) => {
              setRoundDate(e.target.value)
              setPreview(null)
            }}
            className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-ink-500">
            Opt out ({absentIds.size} selected)
          </p>
          {absentIds.size > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {[...absentIds].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleAbsent(id)}
                  className="rounded-full bg-ink-100 px-2 py-0.5 text-xs hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700"
                >
                  {byId.get(id)?.displayName ?? id} ✕
                </button>
              ))}
            </div>
          )}
          <input
            placeholder="Search people to exclude from this round…"
            value={absentSearch}
            onChange={(e) => setAbsentSearch(e.target.value)}
            className="mb-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          />
          {absentSearch.trim() && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-ink-200 dark:border-ink-800">
              {filteredPeople.slice(0, 50).map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-900"
                >
                  <input
                    type="checkbox"
                    checked={absentIds.has(p.id)}
                    onChange={() => toggleAbsent(p.id)}
                  />
                  {p.displayName}
                </label>
              ))}
              {filteredPeople.length === 0 && (
                <p className="px-3 py-1.5 text-sm text-ink-400">No match.</p>
              )}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-ink-500">
          <input
            type="checkbox"
            checked={alsoCreateEvent}
            onChange={(e) => setAlsoCreateEvent(e.target.checked)}
          />
          Also create/update the matching calendar event
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => generatePreview()}
            disabled={!roundDate}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {preview ? 'Regenerate preview' : 'Generate preview'}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => generatePreview((previewSeed ?? 0) + 1)}
              className="rounded-lg px-4 py-2 text-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              Try a different arrangement
            </button>
          )}
        </div>

        {preview && (
          <div className="rounded-lg border border-ink-200 p-3 dark:border-ink-800">
            <p className="mb-2 text-xs text-ink-500">
              {preview.groups.length} group{preview.groups.length === 1 ? '' : 's'} ·{' '}
              {preview.firstTimeMeetings} first-time pairing{preview.firstTimeMeetings === 1 ? '' : 's'} ·{' '}
              {preview.maxRepeat === 0
                ? 'no repeats'
                : `worst repeat: ${preview.maxRepeat} previous meeting${preview.maxRepeat === 1 ? '' : 's'}`}
            </p>
            <ul className="flex flex-col gap-2">
              {preview.groups.map((group) => (
                <li key={group.label} className="text-sm">
                  <span className="font-medium">{group.label}:</span>{' '}
                  {group.memberIds.map((id) => byId.get(id)?.displayName ?? id).join(', ')}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void confirmRound()}
              disabled={roundSaving}
              className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {roundSaving ? 'Saving…' : 'Confirm round'}
            </button>
          </div>
        )}

        {roundNotice && (
          <p role="status" className="text-sm text-ink-500">
            {roundNotice}
          </p>
        )}
      </div>

      <form onSubmit={onSave} className="card mb-6 flex flex-col gap-3 p-4">
        <p className="text-sm font-medium">{editingId ? 'Edit event' : 'Add event'}</p>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          required
        />
        <div className="flex gap-2">
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SectionEvent['category'] }))}
            className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          >
            {EDITABLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
            required
          />
        </div>
        <div className="flex gap-2">
          <input
            type="time"
            placeholder="Start"
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            className="flex-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          />
          <input
            type="time"
            placeholder="End"
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            className="flex-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          />
        </div>
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
          rows={2}
        />
        <input
          placeholder="URL"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !form.title.trim() || !form.date}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add event'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={startNew}
              className="rounded-lg px-4 py-2 text-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="flex flex-col gap-2">
        {events.length === 0 && <p className="text-sm text-ink-400">No admin-added events yet.</p>}
        {events
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((event) => (
            <li key={event.id} className="card flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{event.title}</p>
                <p className="text-xs text-ink-400">
                  {event.date} · {event.category}
                </p>
                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-green-700 underline underline-offset-2 dark:text-green-400"
                  >
                    {event.url}
                  </a>
                )}
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button
                  onClick={() => startEdit(event)}
                  className="underline underline-offset-2 hover:text-green-700 dark:hover:text-green-400"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(event.id)}
                  className="underline underline-offset-2 text-crimson-600 hover:text-crimson-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
      </ul>
    </div>
  )
}
