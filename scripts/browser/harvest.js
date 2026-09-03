/**
 * Class-card harvester — run LAST, on the Section J search results page.
 *
 * Deliberately does NOT extract fields. It saves each card's raw HTML and photo,
 * and all parsing happens offline in `npm run data:parse`.
 *
 * That split matters: selectors will be wrong on the first attempt, and a
 * harvester that extracts in-browser would mean re-fetching 90 pages from HBS
 * every time a selector changes. Saving the raw HTML once means the scrape is a
 * single pass and every later fix is a local re-parse.
 *
 * Reads only pages you can already open yourself, using your existing session.
 * Writes nothing back to HBS. One polite request at a time, with a delay.
 *
 * HOW TO RUN
 *   1. Log in, open the Section J advanced search results (all 90 showing).
 *   2. DevTools (F12) → Console → paste → Enter.
 *   3. Wait — roughly a minute. Progress prints as it goes.
 *   4. It downloads ONE file, classcards.json (~5 MB).
 *
 * Then move that file to  section-j-data/raw/classcards.json  and run:
 *   npm run data:parse
 *
 * IF IT STOPS PART-WAY: partial results are kept on window.__harvest, so just
 * paste the snippet again — it resumes and only fetches what is missing.
 */

(async () => {
  const DELAY_MS = 250
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  // Resume support: reuse anything already collected in this tab.
  const store = (window.__harvest = window.__harvest || { people: {}, photos: {} })

  const rows = [...document.querySelectorAll('#results tbody tr')]
  if (rows.length === 0) {
    console.error('No result rows found. Are you on the Section J search results page?')
    return 'aborted'
  }
  console.log(`Found ${rows.length} people.`)

  // ---- Pass 1: everything the results page already gives us ---------------
  const roster = []
  for (const row of rows) {
    const link = row.querySelector('a[href*="detail.do?prsnId="]')
    if (!link) continue
    const prsnId = new URL(link.href, location.href).searchParams.get('prsnId')
    if (!prsnId) continue

    const img = row.querySelector('img')
    roster.push({
      prsnId,
      detailUrl: new URL(link.href, location.href).href,
      // Cell 2 is the name, cell 3 the section, cell 4 the contact block.
      nameCell: (row.cells[2]?.textContent || '').replace(/\s+/g, ' ').trim(),
      sectionCell: (row.cells[3]?.textContent || '').replace(/\s+/g, ' ').trim(),
      // Kept as HTML: the phone is split across span.ctryCode and a sibling,
      // and the email is inside a mailto: anchor. Parsing that is the offline
      // parser's job, not this script's.
      contactHtml: row.cells[4]?.innerHTML || '',
      photoUrl: img ? new URL(img.getAttribute('src'), location.href).href : null,
    })
  }
  console.log(`Collected ${roster.length} roster rows.`)

  const failures = []

  // ---- Pass 2: one detail page each --------------------------------------
  let done = 0
  for (const person of roster) {
    done++
    if (store.people[person.prsnId]) continue // resumed

    try {
      const response = await fetch(person.detailUrl, { credentials: 'include' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const html = await response.text()

      // A session timeout returns 200 with a login page, which would otherwise
      // be saved as if it were a class card and quietly poison the roster.
      if (/<title[^>]*>[^<]*(log ?in|sign ?in)/i.test(html) || html.length < 3000) {
        throw new Error('looks like a login page — session may have expired')
      }

      store.people[person.prsnId] = { ...person, detailHtml: html }
    } catch (error) {
      failures.push({ prsnId: person.prsnId, stage: 'detail', message: String(error.message || error) })
    }

    if (done % 10 === 0) console.log(`  cards: ${done}/${roster.length}`)
    await sleep(DELAY_MS)
  }

  // ---- Pass 3: photos, inlined as data URIs ------------------------------
  let photoCount = 0
  for (const person of roster) {
    if (!person.photoUrl || store.photos[person.prsnId]) continue
    try {
      const response = await fetch(person.photoUrl, { credentials: 'include' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      store.photos[person.prsnId] = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      photoCount++
    } catch (error) {
      failures.push({ prsnId: person.prsnId, stage: 'photo', message: String(error.message || error) })
    }
    if (photoCount % 20 === 0 && photoCount) console.log(`  photos: ${photoCount}`)
    await sleep(DELAY_MS)
  }

  // ---- Bundle ------------------------------------------------------------
  const payload = {
    version: 1,
    harvestedAt: new Date().toISOString(),
    sourceUrl: location.href,
    count: Object.keys(store.people).length,
    people: Object.values(store.people).map((p) => ({
      prsnId: p.prsnId,
      nameCell: p.nameCell,
      sectionCell: p.sectionCell,
      contactHtml: p.contactHtml,
      photoUrl: p.photoUrl,
      photo: store.photos[p.prsnId] || null,
      detailHtml: p.detailHtml,
    })),
    failures,
  }

  const json = JSON.stringify(payload)
  const mb = (json.length / 1024 / 1024).toFixed(1)

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'classcards.json'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)

  console.log('')
  console.log(`%c✓ Downloaded classcards.json — ${payload.count} cards, ${Object.keys(store.photos).length} photos, ${mb} MB`,
    'color: green; font-weight: bold')
  if (failures.length) {
    console.warn(`${failures.length} item(s) failed:`, failures)
    console.warn('Re-run this snippet in the same tab to retry only the failures.')
  }
  console.log('Next: move it to section-j-data/raw/classcards.json, then `npm run data:parse`.')

  return `${payload.count} cards, ${failures.length} failures, ${mb} MB`
})()
