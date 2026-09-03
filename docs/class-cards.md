# HBS class cards: what the markup actually looks like

Reverse-engineered from the real pages in September 2026. `scripts/parse-classcards.ts`
depends on all of it, so if a selector breaks, start here.

Cards live behind SSO at `secure.hbs.edu`, so they are read from a browser that is
already logged in — see `scripts/browser/README.md`. The harvester deliberately
saves **raw HTML** rather than extracting fields, so selector fixes are a local
re-parse instead of another 90 requests to HBS.

## Search results page

`table#results`, one `tbody tr` per person. For Section J that is 90 rows.

| Cell | Contents |
|---|---|
| `[0]` | empty — DataTables control column |
| `[1]` | `<img>` portrait, plus a link to `detail.do?prsnId=…` |
| `[2]` | `td.sorting_1` — display name, "First Last" |
| `[3]` | section |
| `[4]` | contact: `div > span.ctryCode` (country code) then a text node with the number, and a second `div > a[href^=mailto:]` |
| `[5]` | empty |

**`prsnId` is the card key.** Portraits are at `/photos/mba/Ent<id>.jpg`.

Two traps:

- **Only 89 of 90 rows carry a `mailto:`.** Email cannot be the sole join key,
  which is why the parser falls back to matching on a normalised name.
- All 90 portraits are distinct — there is no shared placeholder image. Worth
  re-checking if the quiz ever starts showing one face for several people.

## Detail page

`detail.do?prsnId=<id>`, roughly 29–39 KB. `h2.clearfix` holds the name as
**"Last, First"** (the results cell has it as "First Last").

`#profile-panels` contains three panels:

### `#education` — `table.table.table-striped`
Columns: University | Degree / Major(s) | Grad Date. One to three rows.

### `#work-experience` — `table.table.table-striped`
Columns: Company & Title | Location | Dates. One to six rows, mean 2.4.

The first cell is structured, not flat:
- `p.my-0 > strong` — company
- `p.my-0.text-muted` — title
- `p.my-0 > em` and `span.ml-0` — free text

**That `em` field looks like an industry taxonomy and is not.** It holds 161
distinct values across 216 roles. There is no industry classification anywhere on
the card, which is why `inferIndustry()` is a keyword table over company and
title. It is openly approximate and exists to make the industry facet useful, not
to be authoritative; `overrides.json` always wins.

### Additional Information — `#additional-information`
Repeated `div.row.mb-1`, each holding:
- `div.col-xs-4.text-sm-right.text-muted` — the **label**
- `div.col-xs-8` — the **value**, with `<br>` separating repeated values

Seven labels, all present on all 90 cards:

| Label | Shape | Real coverage |
|---|---|---|
| Home Region | comma-separated, 2–4 parts; last is country, first is city | 90 |
| Birthday | `M/D` — **no year is present or stored** | 90 |
| Start-up Experience | `Yes` / `No` | 76 |
| Languages | `Language - level`, `<br>`-separated | 69 |
| Professional Interests | `<br>`-separated list, up to 11 | 61 |
| Interests | comma-separated free text | 35 |
| HBS Activities | comma-separated free text | 20 |

## `'None Listed'`

**HBS writes the literal string `'None Listed'` into every field a person left
blank.** Counts: 70 HBS Activities, 55 Interests, 29 Professional Interests, 21
Languages, 14 Start-up Experience.

Left in, it becomes the section's most popular activity, a facet chip reading
*None Listed 70*, and a similarity score that matches people for having nothing in
common. Every scraped value goes through `clean()`, which also collapses
`Not Specified`, `N/A`, `None` and bare dashes.

The coverage column above is *after* stripping it, and those numbers are what
decide which fields earn a facet — see `CLAUDE.md`.

## The socials sheet

A Google Sheet the section filled in by hand: `name, instagram, linkedin url, beli`.
40 rows.

It has **no email column**, so the only join key is a typed name. Matching is
exact-normalised first, then last name plus first initial to catch Mike/Michael and
dropped middle names. A key matching two people is poisoned and skipped —
attaching the wrong Instagram account to somebody is worse than attaching none.
Unmatched rows are printed by name at the end of `data:parse`, because each one is
a classmate silently missing their links.

LinkedIn URLs arrive in three shapes and several carry `utm_source`/`utm_medium`
parameters pasted from the mobile app. Those record where the link was copied
from, so they are stripped; everything normalises to
`https://www.linkedin.com/in/<slug>`. Instagram accepts `@handle`, `handle` or a
full URL and stores the bare handle.

The `beli` column (10 rows) is currently ignored.

## Photos

Served at **150×177**. `build-photos.ts` therefore uses a 300px *ceiling* with
`withoutEnlargement: true` — an earlier version resized to a 400px target and
would have upscaled every portrait into mush.

## Scope

These snippets read one section's own cards — the same information the class-card
directory already shows you — for a passphrase-gated site with a documented
opt-out. Keep it that way: do not point them at other sections, do not collect
fields the site does not use, and honour every opt-out at build time.
