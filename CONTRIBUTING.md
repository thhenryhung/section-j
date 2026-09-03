# Contributing

This is the section's site. If something about it annoys you, you are allowed to
fix it — that is rather the point.

You do not need to be a programmer to contribute. Adding an event to the calendar
is editing one JSON file, and GitHub will let you do it in the browser.

## The one rule

**Never commit real information about a section member to this repository.**

Not a name, not a phone number, not an email address, not a photograph — not even
as placeholder text in a component while you are testing. This repo is public.

Before you push:

```bash
npm run check:leaks
```

CI runs the same check on every pull request. If it fails, it will tell you which
file and line.

The synthetic roster in `data/roster.sample.json` is ninety invented people. Use
it for everything.

## Setting up

Requires Node 22+, or just open the repo in a **GitHub Codespace** and skip
installing anything.

```bash
npm install
npm run dev
```

Unlock with the passphrase `demo`.

## The easiest contributions

### Add a section event

Edit [`data/events.json`](data/events.json):

```json
{
  "id": "halloween-party",
  "title": "Section J Halloween party",
  "category": "social",
  "date": "2026-10-31",
  "startTime": "20:00",
  "location": "Gallatin Hall",
  "description": "Costumes strongly encouraged."
}
```

`category` is one of `section`, `social` or `deadline`. `id` must be unique and
kebab-case. `startTime` and `endTime` are optional — leave them out for an all-day
event.

### Fix the class schedule

[`data/courses.json`](data/courses.json) currently has placeholder professors,
rooms and times. Replacing them with the real ones is genuinely the most useful
thing anyone could do to this repo right now.

`daysOfWeek` uses 0 for Sunday through 6 for Saturday. `exceptions` is a list of
ISO dates the class does not meet.

## Working on the app

- `src/lib/` holds the logic — crypto, pairing, calendar maths, people helpers —
  and imports no React. Keep it that way, so the pairing algorithm can run in both
  the browser and the CLI.
- `src/pages/` is one file per tab.
- Tailwind v4, configured in `src/index.css` via `@theme`. There is no
  `tailwind.config.js`.
- Every view must survive missing data. Class cards are patchy and the survey is
  voluntary, so assume any optional field is absent and make sure the layout still
  looks deliberate.
- Dark mode is `prefers-color-scheme`, not a toggle. Check both.

## Ideas worth picking up

- Replace the placeholder course times in `data/courses.json` with real ones.
- A "who's free for lunch today" view built on the course schedule.
- Export your dinner group to a calendar invite.
- Group photos on the quiz — "which table is this?"
- Make the directory work offline, as a proper PWA.
- Accessibility passes. The quiz is keyboard-navigable; the rest could be better.

## Pull requests

Branch, commit, open a PR against `main`. CI will type-check, build against sample
data, and run the leak check. A preview deploy is posted to the PR.

Keep PRs small enough to review over a coffee. If you are planning something
large, open an issue first so two people do not build it twice.
