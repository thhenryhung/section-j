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
| `[2]` | `td.sorting_1` — the name, printed **"Last, First"** despite the "Name" heading |
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
**"Last, First"**, the same order as the results cell.

**Both places print "Last, First".** Assuming the results column matched its
"Name" heading is what silently broke every name-based join on the first real
run — see `toFirstLast()` and `nameKey()` in the parser.

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

Seven labels, all present on all 90 cards. Coverage is from the first real parse,
*after* stripping `'None Listed'`:

| Label | Shape | Coverage | In the MVP? |
|---|---|---|---|
| Home Region | comma-separated, 2–4 parts; last is country, first is city | 89 | yes |
| Birthday | `M/D` — **no year is present or stored** | 89 | yes |
| Start-up Experience | `Yes` / `No` | 76 | yes |
| Professional Interests | `<br>`-separated list, up to 11 | 60 | yes |
| Languages | `Language - level`, `<br>`-separated | 68 | **deferred** |
| Interests | comma-separated free text | 34 | **deferred** |
| HBS Activities | comma-separated free text | 19 | **deferred** |

The deferred three are parsed by nothing today. Re-adding one means restoring its
field on `Person`, a `splitList` call in `parseCard`, and a facet entry — the
shapes above are all the information that needs rediscovering.

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

## The socials sheet — deferred, not lost

`section-j-data/socials.csv`, a Google Sheet the section filled in by hand:
`name, instagram, linkedin url, beli`. 40 of 90 people.

**Out of scope for the MVP.** The parser no longer reads it. Notes for whoever
puts it back:

- It has **no email column**, so the only join key is a typed name — and both the
  card and the export print names in an order the sheet does not. Use `nameKey()`,
  which already handles this. A key matching two people must be skipped, not
  guessed: the wrong Instagram account on a classmate is worse than none.
- LinkedIn URLs arrive in three shapes, several carrying `utm_source`/`utm_medium`
  parameters pasted from the mobile app. Those record where the link was copied
  from and should be stripped; normalise to `https://www.linkedin.com/in/<slug>`.
- Instagram values may be `@handle`, `handle`, or a full URL. Store the bare
  handle; validate against `^[A-Za-z0-9._]{1,30}$` so a stray note does not become
  a broken link.
- Print unmatched sheet rows by name — each one is a classmate silently missing
  their links, which is invisible otherwise.
- The `beli` column (10 rows) was never used.

## Photos

Served at **150×177**. `build-photos.ts` therefore uses a 300px *ceiling* with
`withoutEnlargement: true` — an earlier version resized to a 400px target and
would have upscaled every portrait into mush.

## Scope

These snippets read one section's own cards — the same information the class-card
directory already shows you — for a passphrase-gated site with a documented
opt-out. Keep it that way: do not point them at other sections, do not collect
fields the site does not use, and honour every opt-out at build time.
