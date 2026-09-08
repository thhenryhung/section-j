/**
 * GET /api/events — public, no auth. This is what makes a plain visitor's
 * calendar update live: events are already public/non-sensitive (git-tracked
 * in data/events.json today), so this endpoint sits outside the
 * SECTION_PASSPHRASE gate entirely, same trust level as the existing static
 * import it's replacing.
 */

import { mergeEvents, type EventOverlayEntry } from '../../src/lib/events'
import type { SectionEvent } from '../../src/lib/types'
import rawEvents from '../../data/events.json'

interface Env {
  EVENTS_KV: KVNamespace
}

const OVERLAY_KEY = 'events-overlay'
const baseline = rawEvents as SectionEvent[]

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.EVENTS_KV.get(OVERLAY_KEY)
  const overlay = raw ? (JSON.parse(raw) as EventOverlayEntry[]) : []
  const merged = mergeEvents(baseline, overlay)

  return new Response(JSON.stringify(merged), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  })
}
