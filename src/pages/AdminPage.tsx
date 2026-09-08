import { useEffect, useState, type FormEvent } from 'react'
import type { SectionEvent } from '../lib/types'

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

export function AdminPage() {
  const [status, setStatus] = useState<Status>('checking')
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<SectionEvent[]>([])
  const [form, setForm] = useState<SectionEvent>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

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
