# Section J

A section website for **HBS MBA 2028, Section J** — a directory you can actually
search, a meetup allocator that stops you eating dinner with the same six people,
a quiz for learning ninety faces, and a calendar with everyone's birthday on it.

Built by the section, for the section. Pull requests welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## The four tabs

| Tab | What it does |
|---|---|
| **Directory** | Everyone's photo, contact details, home region, pre-MBA background and post-MBA goals. Fuzzy search across all of it, faceted filters, and a "people like them" panel that surfaces classmates with overlapping interests. |
| **Social** | Dinners of six every three weeks, 1:1 coffee chats on the weeks between. Allocation minimises repeat encounters, so you keep meeting new people. Shows your group, and how many of the section you have met. |
| **Know Everyone** | Photo-to-name and name-to-photo drills with spaced repetition, so it keeps testing the faces you actually get wrong. |
| **Calendar** | Section events, class times and birthdays in one month grid, with an `.ics` export you can subscribe to. |

## No personal data lives in this repository

This is a public repo containing ninety people's phone numbers and photographs —
or rather, it very deliberately does not.

- **This repo** holds code, plus a **synthetic roster of ninety invented people**
  that every contributor develops against. Nobody real appears in it.
- **A separate private repo** (`section-j-data`) holds the real roster, photos and
  meetup history. CI checks it out at deploy time, encrypts it, and never commits
  it anywhere.
- The deployed site serves the roster as **AES-256-GCM ciphertext**. Your browser
  decrypts it after you enter the section passphrase. A visitor who does not have
  the passphrase cannot read the data even though they can download the file.
- Pull requests from forks **get no access to the private data or the passphrase**.
  That is GitHub Actions working as designed, and it is the security boundary.

`npm run check:leaks` enforces this, and CI runs it on every pull request. See
[PRIVACY.md](PRIVACY.md) for the full picture, including how to opt out.

## Running it locally

Requires **Node 22+**. If you would rather not install anything, open the repo in
a **GitHub Codespace** — the devcontainer has everything ready.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and unlock with the passphrase `demo`.

You are now looking at ninety fabricated people. That is correct — it is what
every contributor sees, and it is enough to build and test any feature in the app.

## How the data gets in

Class cards are harvested from a logged-in browser into the private repo, merged
with the HBS contact export and the section's own socials sheet, then encrypted at
build time. [`SETUP.md`](SETUP.md) is the runbook;
[`docs/class-cards.md`](docs/class-cards.md) documents the markup and its traps.

Post-MBA goals, pronouns, dietary requirements and fun facts are **not** on class
cards — they come from a short opt-in survey, and every view degrades gracefully
when someone has not filled it in.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server. Encrypts sample data first. |
| `npm run build` | Type-check and build to `dist/`. |
| `npm run data:sample` | Regenerate the synthetic roster. |
| `npm run data:parse` | Real class-card HTML → `roster.json`. Needs the private repo. |
| `npm run data:photos` | Normalise photos to webp (300px ceiling, no upscaling). |
| `npm run data:encrypt` | Encrypt roster, photos and meetup history into `public/data/`. |
| `npm run pair -- --kind dinner --date 2026-09-17` | Generate a meetup round. Add `--dry-run` to preview. |
| `npm run check:leaks` | Scan for personal data before you push. |

## Layout

```
data/            public, non-sensitive: events, courses, synthetic sample roster
scripts/         data pipeline and the pairing CLI
src/gate/        passphrase unlock and decryption
src/lib/         crypto, pairing, calendar, people — the logic, framework-free
src/pages/       one file per tab
src/components/  shared UI
```

`src/lib/` is deliberately free of React imports, so the pairing algorithm can run
identically in the browser and in the CLI.

## Licence

MIT — see [LICENSE](LICENSE). The code is open. The section's data never is.
