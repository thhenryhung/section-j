# Browser snippets

> **A correction worth reading before you trust these.** The first two snippets
> originally claimed their output was safe to share, and it was not. Two bugs:
> `new URL(href).pathname` on a `mailto:` link returns the whole email address,
> and "looks like a field label" was guessed from Title Case — which matches
> employer and university names too. Both are fixed, and `recon-skeleton.js`
> exists because the only reliable fix is not to print page text at all. If you
> ran an earlier version, its output contained one classmate's name, email,
> university and employer.

HBS class cards live behind SSO, so the only way to read them is from a browser
that is already logged in. These two snippets run in your own DevTools console —
nothing is automated, no credentials are handled by any tool, and every request
uses your existing session.

Run them in order.

## 1. `recon.js` — inspect the markup

Reports the page's **structure** and redacts every value: text becomes
`<text:24>`, emails become `<email:31>`, URLs keep only their path and parameter
names. Field labels are kept verbatim, because a label is a field name, not
personal data.

The output is therefore safe to paste into a chat or a GitHub issue.

1. Log in to `secure.hbs.edu` and open the Section J advanced search results.
2. DevTools (F12) → Console.
3. Paste the whole file, press Enter. The report is copied to your clipboard.
4. Open **one** individual class card and run it again — it detects which kind of
   page it is on.

Chrome may require you to type `allow pasting` in the console once before it
accepts pasted code. That is a Chrome safety prompt, and it is a good one.

## 2. `recon-detail.js` — the detail page

Fetches one class card using your session and reports its table structure, so the
parser can be written against real markup. Same redaction rules.

## 3. `recon-skeleton.js` — structure with no text at all

The safe-by-construction version: it prints tag names, ids, classes, URL paths
and character counts, and **never prints page text**. There is no allowlist to
get wrong and no heuristic to misfire. Prefer this one when sharing output.

## 4. `harvest.js` — collect the data

Written *after* recon, against the real markup. It walks the section's search
results, fetches each class card in turn with a polite delay, extracts the fields
the site needs, and downloads a single `classcards.json` plus the photos.

It reads only pages you can already open yourself, and writes nothing back to
HBS.

Move the downloaded files into the private data repo:

```
section-j-data/raw/classcards.json
section-j-data/photos/<personId>.jpg
```

Then, in the project:

```bash
npm run data:parse
npm run data:photos
npm run check:leaks
```

## A note on scope

These snippets read your own section's cards — the same information the class card
directory already shows you — for a directory only that section can open, behind a
passphrase, with a documented opt-out. Keep it that way: do not point them at
other sections, do not collect fields the site does not use, and honour every
opt-out at build time.
