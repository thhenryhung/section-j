# Setting up from scratch

For whoever runs the site — the first time, or after handover. If you just want to
contribute a feature, you want [CONTRIBUTING.md](CONTRIBUTING.md) instead.

Paths below use `thhenryhung` as the repo owner. If the section moves these to a
GitHub organisation later, that owner is the one thing to change throughout.

## 1. Two repositories

| Repo | Visibility | Holds |
|---|---|---|
| `thhenryhung/section-j` | **Public** | This code. Anyone can fork and PR. |
| `thhenryhung/section-j-data` | **Private** | The real roster, photos, meetup history. |

Create both empty on GitHub, then push this code to the public one:

```bash
git remote add origin https://github.com/thhenryhung/section-j.git
git push -u origin main
```

The private repo's layout — nothing here is ever committed to the public repo:

```
section-j-data/
  classcards-export.csv    the HBS contact export, converted to CSV
  raw/                     saved class-card HTML, one file per person
  photos/<personId>.jpg    original photos
  roster.json              merged output of `npm run data:parse`
  overrides.json           survey answers and opt-outs
  meetup-history.json      who has met whom
```

Check it out as a **sibling** of this repo — the scripts resolve
`../section-j-data`:

```
Projects/                  /workspaces/          (in a Codespace)
  section-j/                 section-j/
  section-j-data/            section-j-data/
```

In a Codespace, `.devcontainer/devcontainer.json` requests read access to the data
repo, so you are prompted to authorise it when the Codespace is created. If the
clone is still refused — an existing Codespace created before that was added — grant
the token access once:

```bash
gh auth refresh -h github.com -s repo
```

Contributors never need this: everything builds against the synthetic sample
roster without the private repo present.

## 2. Choose the section passphrase

One shared secret for the whole section. At least 10 characters; the build refuses
anything shorter, and refuses the string `demo` outright for real data. A few
unrelated words work well — memorable, and easy to read out.

Store it in GitHub's secrets, never in a file. **It goes in two separate places,
and they are genuinely different stores:**

| Where | Tab | Who reads it |
|---|---|---|
| Repo settings → Secrets and variables | **Actions** | the Deploy workflow, building the real site |
| Repo settings → Secrets and variables | **Codespaces** | your Codespace, for local work on real data |

Setting only the Actions one is the usual mistake: the deploy works, but a
Codespace still builds with the `demo` fallback, and the passphrase you type
won't unlock it.

**A Codespace only picks up a new secret on a fresh start.** After adding it,
stop and restart the Codespace, or run *Codespaces: Rebuild Container* from the
command palette. Then confirm:

```bash
echo ${SECTION_PASSPHRASE:+set (${#SECTION_PASSPHRASE} chars)}
```

The passphrase that unlocks a build is whatever `npm run data:encrypt` saw when
it produced `public/data/*.enc` — so re-encrypt after changing it, and note that
the deployed site and your local dev build are encrypted independently.

For a one-off run without storing anything:

```bash
SECTION_PASSPHRASE='your words here' npm run dev
```

## 3. Cloudflare Pages

Create a Pages project (any name — you'll reference it below). No build command is
needed in Cloudflare's own settings: GitHub Actions builds and uploads the result.

## 4. Repository configuration

In the **public** repo → Settings → Secrets and variables → Actions:

**Secrets**

| Name | Value |
|---|---|
| `SECTION_PASSPHRASE` | The passphrase from step 2 |
| `DATA_REPO_TOKEN` | Fine-grained PAT with **read-only Contents** on `section-j-data`, and nothing else |
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with the *Cloudflare Pages: Edit* permission |
| `CLOUDFLARE_ACCOUNT_ID` | From your Cloudflare dashboard URL |

**Variables**

| Name | Value |
|---|---|
| `DATA_REPO` | `thhenryhung/section-j-data` |
| `CLOUDFLARE_PROJECT` | The Pages project name from step 3 |

Scope the PAT to that one repo and to Contents:read only. It is the key to the
section's personal data, and a token that can only read one repo is a much smaller
problem if it ever leaks.

## 5. Populate the data

```bash
# Convert the HBS contact export (once)
#   Excel → Save As → CSV UTF-8 → section-j-data/classcards-export.csv

# Harvest the class cards — see scripts/browser/README.md
#   produces section-j-data/raw/ and section-j-data/photos/

npm run data:parse      # raw HTML + CSV + overrides -> roster.json
npm run data:photos     # photos -> webp bundle (300px ceiling, no upscaling)
npm run check:leaks     # confirm nothing real reached the public repo
```

Commit `roster.json`, `photos/` and `overrides.json` to the **private** repo.

## 6. Before you announce it

- [ ] Tell the section the site exists, what is on it, and how to opt out.
      [PRIVACY.md](PRIVACY.md) is written to be forwarded as-is.
- [ ] Send the survey and give people a few days before the first deploy.
- [ ] Apply any opt-outs to `overrides.json` and rebuild.
- [ ] Confirm the deployed site returns a passphrase prompt in a private window.
- [ ] Confirm `https://<site>/robots.txt` disallows everything.
- [ ] Share the passphrase over a channel only the section can read.

## 7. Running each meetup round

```bash
npm run pair -- --kind dinner   --date 2026-09-17 --dry-run   # preview
npm run pair -- --kind dinner   --date 2026-09-17             # write
npm run pair -- --kind onetoone --date 2026-10-08
```

Commit the updated `meetup-history.json` to the private repo, then re-run the
Deploy workflow. This CLI is the only generator now — the in-app one on the
Social tab was removed so regular section members can't trigger a new round
themselves.

## 8. Admin panel (live calendar events)

A small "Admin" link next to Logout lets a handful of trusted admins add/edit/
remove calendar events without a PR — changes are live for every visitor
within seconds. It's a separate credential and a separate piece of
infrastructure from everything above: a Cloudflare Pages Function
(`functions/api/admin/*`), a KV namespace, and its own passphrase. See
`CLAUDE.md`'s Architecture section for how it fits together; this is just the
one-time setup.

**One-time setup:**

1. Create the KV namespace and wire it into `wrangler.toml`:
   ```bash
   npx wrangler kv namespace create EVENTS_KV
   npx wrangler kv namespace create EVENTS_KV --preview
   ```
   Paste the two returned ids into `wrangler.toml`'s `id`/`preview_id`.
2. Generate the admin passphrase hash (pick your own passphrase, at least 10
   characters — the plain passphrase itself is never stored anywhere):
   ```bash
   ADMIN_PASSPHRASE='your words here' npm run admin:hash-passphrase
   ```
3. In the Cloudflare Pages dashboard → your project → Settings →
   Environment variables, add these as **secrets** (not GitHub Actions
   secrets — these are read by the Function at request time):

   | Name | Value |
   |---|---|
   | `ADMIN_PASSPHRASE_HASH` | output of step 2 |
   | `ADMIN_SESSION_SECRET` | any long random string — signs the admin session cookie |
   | `GITHUB_ADMIN_TOKEN` | fine-grained PAT, **Contents:write on this repo only** |

4. Share the admin passphrase with admins over a channel only they can read —
   same care as `SECTION_PASSPHRASE`, but don't reuse it; the two must stay
   independent secrets.

**Local testing:** `npm run functions:dev` runs the Function locally against a
local, on-disk KV emulation via `wrangler pages dev` (separate from the fast
`npm run dev` Vite loop, which doesn't run Functions at all — the Calendar
page falls back to the static `data/events.json` import in that case). Put
test-only versions of the three secrets above in a local `.dev.vars` file
(gitignored, never commit it).

**Fork note:** `wrangler.toml`'s `name` and KV namespace ids are TOML, so they
stay hand-edited on fork, the same way `DATA_REPO`/`CLOUDFLARE_PROJECT` in
`.github/workflows/deploy.yml` already do — see `src/lib/siteConfig.ts` for
everything else that's config-driven instead.

**Not built yet:** roster opt-outs and pairing-round control are still
PR/CLI-only (see `CLAUDE.md`'s admin forward-looking note) — only calendar
events go through the admin panel today.

## Handover

Everything above is reproducible from this repo plus the private data repo. To
hand the site to next year's section: add them to both repos, rotate
`SECTION_PASSPHRASE`, `DATA_REPO_TOKEN`, `ADMIN_PASSPHRASE_HASH`, and
`GITHUB_ADMIN_TOKEN`, and transfer the Cloudflare project.
