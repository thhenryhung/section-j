/**
 * GET/POST/DELETE /api/admin/events — authed CRUD on section calendar events.
 *
 * Every request independently re-verifies the signed session cookie (see
 * _shared/session.ts) — this endpoint must never trust a client-side "I'm an
 * admin" flag, which is exactly what made the old in-browser AdminPanel
 * (removed in commit 058a06e) unsafe to reintroduce as-is.
 *
 * Writes go to two places: the KV overlay (instant, ephemeral — what
 * /api/events serves) and a commit to data/events.json in the public
 * section-j repo (durable, canonical — what the next full rebuild bakes
 * back into the static import in CalendarPage.tsx).
 */

import { siteConfig } from '../../../src/lib/siteConfig'
import { mergeEvents, type EventOverlayEntry } from '../../../src/lib/events'
import type { SectionEvent } from '../../../src/lib/types'
import { requireAdminSession } from '../../_shared/session'
import { GitHubConflictError, getJSONFile, putJSONFile, triggerWorkflow } from '../../_shared/github'
import rawEvents from '../../../data/events.json'

interface Env {
  EVENTS_KV: KVNamespace
  ADMIN_SESSION_SECRET: string
  GITHUB_ADMIN_TOKEN: string
}

const OVERLAY_KEY = 'events-overlay'
const EVENTS_PATH = 'data/events.json'
const CATEGORIES = new Set(['section', 'social', 'deadline'])
const baseline = rawEvents as SectionEvent[]

function isValidEvent(body: unknown): body is SectionEvent {
  if (typeof body !== 'object' || body === null) return false
  const e = body as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.title === 'string' &&
    e.title.length > 0 &&
    typeof e.category === 'string' &&
    CATEGORIES.has(e.category) &&
    typeof e.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    (e.startTime === undefined || typeof e.startTime === 'string') &&
    (e.endTime === undefined || typeof e.endTime === 'string') &&
    (e.location === undefined || typeof e.location === 'string') &&
    (e.description === undefined || typeof e.description === 'string') &&
    (e.url === undefined || typeof e.url === 'string')
  )
}

async function getOverlay(kv: KVNamespace): Promise<EventOverlayEntry[]> {
  const raw = await kv.get(OVERLAY_KEY)
  return raw ? (JSON.parse(raw) as EventOverlayEntry[]) : []
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const ok = await requireAdminSession(request, env.ADMIN_SESSION_SECRET)
  return ok ? null : json({ error: 'Not authorized.' }, 401)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = await requireAuth(request, env)
  if (unauthorized) return unauthorized
  const overlay = await getOverlay(env.EVENTS_KV)
  return json(mergeEvents(baseline, overlay))
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = await requireAuth(request, env)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  if (!isValidEvent(body)) return json({ error: 'Invalid event.' }, 400)
  const event = body

  const overlay = await getOverlay(env.EVENTS_KV)
  const nextOverlay = [...overlay.filter((e) => e.id !== event.id), event]
  await env.EVENTS_KV.put(OVERLAY_KEY, JSON.stringify(nextOverlay))

  // Best-effort durable commit — a failure here doesn't undo the instant KV
  // write; the admin sees a warning but the change is still live.
  let commitWarning: string | undefined
  try {
    const { owner, repo } = siteConfig.github
    const { data: current, sha } = await getJSONFile<SectionEvent[]>(owner, repo, EVENTS_PATH, env.GITHUB_ADMIN_TOKEN)
    const merged = mergeEvents(current, [event])
    await putJSONFile(owner, repo, EVENTS_PATH, merged, sha, env.GITHUB_ADMIN_TOKEN, `Admin: add/update event "${event.title}"`)
    await triggerWorkflow(owner, repo, 'deploy.yml', 'main', env.GITHUB_ADMIN_TOKEN)
  } catch (caught) {
    commitWarning =
      caught instanceof GitHubConflictError
        ? caught.message
        : 'Change is live, but committing it to GitHub failed — it may be lost on the next rebuild.'
  }

  return json({ events: mergeEvents(baseline, nextOverlay), commitWarning })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = await requireAuth(request, env)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  const id = (body as { id?: unknown } | null)?.id
  if (typeof id !== 'string' || !id) return json({ error: 'Missing event id.' }, 400)

  const overlay = await getOverlay(env.EVENTS_KV)
  const nextOverlay: EventOverlayEntry[] = [...overlay.filter((e) => e.id !== id), { id, deleted: true }]
  await env.EVENTS_KV.put(OVERLAY_KEY, JSON.stringify(nextOverlay))

  let commitWarning: string | undefined
  try {
    const { owner, repo } = siteConfig.github
    const { data: current, sha } = await getJSONFile<SectionEvent[]>(owner, repo, EVENTS_PATH, env.GITHUB_ADMIN_TOKEN)
    const merged = current.filter((e) => e.id !== id)
    await putJSONFile(owner, repo, EVENTS_PATH, merged, sha, env.GITHUB_ADMIN_TOKEN, `Admin: remove event ${id}`)
    await triggerWorkflow(owner, repo, 'deploy.yml', 'main', env.GITHUB_ADMIN_TOKEN)
  } catch (caught) {
    commitWarning =
      caught instanceof GitHubConflictError
        ? caught.message
        : 'Change is live, but committing it to GitHub failed — it may be lost on the next rebuild.'
  }

  return json({ events: mergeEvents(baseline, nextOverlay), commitWarning })
}
