# Working on Section J

A private directory, meetup allocator, face quiz and calendar for HBS MBA 2028
Section J. Static site, no backend, no database. 90 people.

## The one hard rule

**This is a public repository handling 90 classmates' photos, mobile numbers and
email addresses. No real personal data may ever be committed here.**

```bash
npm run check:leaks
```

Run it before every push. CI runs it on every PR. It is not ceremony — it has
already caught two genuine mistakes: a synthetic surname list that collided with a
real Section J surname, and a real classmate's email local part used as an example
in a code comment. **Never invent plausible-looking names, emails or IDs**, not
even in comments or test fixtures. Use `aexample`, `rpatel`, `example.invalid`.

Everything real lives in a separate **private** repo, `section-j-data`, cloned as a
sibling directory (`../section-j-data`). CI reads it with a read-only token.

## Architecture

- **Vite + React 19 + TypeScript + Tailwind v4**, deployed to Cloudflare Pages.
  Not Next.js: with client-side decryption everything is a client component, so
  Next would add complexity for nothing.
- The roster ships as **AES-256-GCM ciphertext**. The browser derives a key from a
  shared section passphrase (PBKDF2-SHA256, 600k iterations) and decrypts in
  memory. `src/lib/crypto.ts` is imported by *both* the build script and the
  browser, so the two halves cannot drift apart.
- `src/lib/` imports no React, so `pairing.ts` runs identically in the browser
  admin page and in the `npm run pair` CLI.
- Fork PRs get no secrets from GitHub Actions and build against a synthetic
  roster. That is the security boundary working, not an obstacle to route around.

```
data/          public, non-sensitive: events, courses, synthetic sample roster
scripts/       data pipeline + pairing CLI
scripts/browser/  DevTools snippets for harvesting HBS class cards
src/gate/      passphrase unlock and decryption
src/lib/       crypto, pairing, calendar, people — framework-free
src/pages/     one file per tab
```

## Commands

| Command | Notes |
|---|---|
| `npm run dev` | Regenerates + encrypts sample data first. Unlock with `demo`. |
| `npm run typecheck` | Strict mode, `noUnusedLocals` on — unused imports fail the build. |
| `npm run data:parse` | Real class cards → `roster.json`. Needs `../section-j-data`. |
| `npm run data:photos` | Photos → webp bundle. |
| `npm run data:encrypt` | Reports passphrase length and source, never the value. |
| `npm run pair -- --kind dinner --date 2026-09-17` | Add `--dry-run` to preview. |
| `npm run check:leaks` | Before every push. |

## Non-obvious things

Learned the hard way. Ignoring these reintroduces real bugs.

- **HBS writes the literal string `'None Listed'` into empty class-card fields** —
  70 of 90 for activities, 55 for interests. Unfiltered it becomes the section's
  most popular interest and a facet chip reading *None Listed 70*. Everything
  scraped goes through `clean()` in `scripts/parse-classcards.ts`.
- **Which fields get a facet is decided by measured coverage, not by what exists.**
  Home region / education / pre-MBA role 90, languages 69, professional interests
  61, interests 35, activities 20. Interests and activities are deliberately *not*
  facets — a filter that can only match 20 people looks authoritative while
  hiding the other 70 — but they carry the heaviest **similarity** weight, because
  two people who both wrote "rock climbing" really are a match.
- **`data/courses.json` contains placeholder professors, rooms and times.** The
  calendar currently shows fiction. Replacing it with the real schedule is the
  most useful small contribution available.
- **The passphrase that unlocks a build is whatever `data:encrypt` saw** when it
  wrote `public/data/*.enc`. Change the secret and you must re-encrypt. The
  deployed site and a local dev build are encrypted independently and can drift.
- **Actions secrets and Codespaces secrets are separate stores.** Setting only the
  Actions one means deploys work but a Codespace silently builds with `demo`.
- Sample data mirrors real sparsity, so empty states are genuinely exercised.
  Always check a person with no photo, no professional interests, no activities.
- Opt-outs are applied at **build time** — a suppressed field is never encrypted or
  shipped, not merely hidden in the UI. Keep it that way.

See `docs/class-cards.md` for the HBS markup specifics: selectors, join keys, and
why pre-MBA industry is inferred rather than read.

## Status

Built and pushed. `main` is current. Both repos in sync.

- Harvest complete: 90/90 cards, 90 photos, zero failures.
- Socials sheet merged (LinkedIn + Instagram for 40 of 90), joined by name.
- **`scripts/parse-classcards.ts` has never been executed.** No `roster.json`
  exists yet. Expect to iterate on cheerio selectors; its coverage report is the
  acceptance test.
- `SECTION_PASSPHRASE` is not set in either secret store.
- Post-MBA goals, pronouns, dietary requirements and fun facts need a survey —
  they are not on class cards. The fields exist and every view degrades
  gracefully when empty, so this drops in later with no code changes.
- The repo is currently **private**; it is intended to be public once the section
  has been told the site exists and given the opt-out in `PRIVACY.md`.

## Other docs

`SETUP.md` operational runbook · `PRIVACY.md` written to forward to the section
as-is · `CONTRIBUTING.md` contributor on-ramp · `scripts/browser/README.md`
harvesting · `CLAUDE.local.md` local machine constraints, if present.
