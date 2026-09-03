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
Deploy workflow. The same generator is available in the app under
Social → *Show round generator* if you would rather click than type.

## Handover

Everything above is reproducible from this repo plus the private data repo. To
hand the site to next year's section: add them to both repos, rotate
`SECTION_PASSPHRASE` and `DATA_REPO_TOKEN`, and transfer the Cloudflare project.
