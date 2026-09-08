/**
 * Merge logic shared between the admin-write Function, the public-read
 * Function, and (indirectly, since the read Function ships the merged
 * result) the browser — one module, following the same
 * imported-by-both-runtimes pattern `src/lib/crypto.ts` already establishes
 * between `scripts/encrypt-data.ts` (Node) and `src/gate/` (browser).
 *
 * An admin edit lives in two places until the next full rebuild reconciles
 * them: a KV overlay (instant, ephemeral) and a commit to data/events.json
 * (durable, canonical). This function is what lets a reader treat both as
 * one list without caring which source a given event came from.
 */

import type { SectionEvent } from './types'

export type EventOverlayEntry = SectionEvent | { id: string; deleted: true }

/**
 * Baseline events (static data/events.json) merged with a KV overlay, by id.
 * An overlay entry with `deleted: true` suppresses a baseline event with the
 * same id; any other overlay entry with a matching id replaces the baseline
 * entry; overlay entries with unmatched ids are appended.
 */
export function mergeEvents(baseline: SectionEvent[], overlay: EventOverlayEntry[]): SectionEvent[] {
  const overlayIds = new Set(overlay.map((e) => e.id))
  const kept = baseline.filter((e) => !overlayIds.has(e.id))
  const added = overlay.filter((e): e is SectionEvent => !('deleted' in e && e.deleted))
  return [...kept, ...added]
}
