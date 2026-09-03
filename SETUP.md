# Setting up from scratch

For whoever runs the site — the first time, or after handover. If you just want to
contribute a feature, you want [CONTRIBUTING.md](CONTRIBUTING.md) instead.

Replace `<you>` with your GitHub username or the section's org name throughout.

## 1. Two repositories

| Repo | Visibility | Holds |
|---|---|---|
| `<you>/section-j` | **Public** | This code. Anyone can fork and PR. |
| `<you>/section-j-data` | **Private** | The real roster, photos, meetup history. |

Create both empty on GitHub, then push this code to the public one:

```bash
git remote add origin https://github.com/<you>/section-j.git
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

Locally, check it out as a **sibling** of this repo — the scripts look for
`../section-j-data`:

```
Projects/
  section-j/
  section-j-data/
```

## 2. Choose the section passphrase

One shared secret for the whole section. At least 10 characters; the build refuses
anything shorter, and refuses the string `demo` outright for real data.

Store it in the public repo's Actions secrets, not in any file.

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
| `DATA_REPO` | `<you>/section-j-data` |
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
npm run data:photos     # photos -> 400px webp bundle
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
