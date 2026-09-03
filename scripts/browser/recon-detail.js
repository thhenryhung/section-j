/**
 * Detail-page recon — run this SECOND, on the Section J search results page.
 *
 * The results table gives us names, sections and contact details, but home
 * region, pre-MBA employer, interests, activities and birthdays live on the
 * individual class cards at /classcards/detail.do?prsnId=…
 *
 * Rather than making you navigate, this fetches ONE card using your session and
 * reports its structure with every value redacted — same rules as recon.js, so
 * the output is safe to paste back.
 *
 * It also checks how many people share a photo URL, which tells us whether HBS
 * serves a placeholder image for people without a portrait.
 *
 * HOW TO RUN
 *   1. Stay on the Section J search results page, logged in.
 *   2. DevTools (F12) → Console → paste → Enter.
 *   3. The report is printed and copied to your clipboard.
 */

(async () => {
  const out = []
  const log = (...args) => out.push(args.join(' '))

  const redact = (text) => {
    const value = (text || '').replace(/\s+/g, ' ').trim()
    if (!value) return '(empty)'
    if (/^[\w.+-]+@[\w.-]+$/.test(value)) return `<email:${value.length}>`
    if (/^\+?[\d\s().-]{7,}$/.test(value)) return `<phone:${value.length}>`
    return `<text:${value.length}>`
  }

  const path = (el) => {
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase()
      if (node.id) part += `#${node.id}`
      else if (typeof node.className === 'string' && node.className.trim()) {
        part += '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.')
      }
      parts.unshift(part)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  // ---- How many people share a photo? (placeholder detection) ------------
  const rows = [...document.querySelectorAll('#results tbody tr')]
  const srcCounts = new Map()
  for (const row of rows) {
    const img = row.querySelector('img')
    if (img) srcCounts.set(img.src, (srcCounts.get(img.src) || 0) + 1)
  }
  const shared = [...srcCounts.values()].filter((n) => n > 1)
  log('='.repeat(70))
  log('DETAIL PAGE RECON')
  log('='.repeat(70))
  log(`Result rows: ${rows.length}`)
  log(`Distinct photo URLs: ${srcCounts.size}`)
  log(`Photo URLs used by more than one person: ${shared.length}` + (shared.length ? ` (counts: ${shared.join(', ')}) — likely a placeholder` : ''))

  // ---- Structure of one results row --------------------------------------
  // NB: mailto:/tel: must be special-cased. For those schemes `pathname` is the
  // address itself, so an earlier version printed a classmate's name and email
  // in a report that claimed to be redacted.
  const safeUrl = (raw) => {
    if (!raw) return '?'
    if (/^mailto:/i.test(raw)) return 'mailto:<redacted>'
    if (/^tel:/i.test(raw)) return 'tel:<redacted>'
    try {
      const url = new URL(raw, location.href)
      const keys = [...url.searchParams.keys()]
      return url.pathname + (keys.length ? `?{${keys.join(',')}}` : '')
    } catch { return '?' }
  }

  if (rows[0]) {
    log('')
    log('--- STRUCTURE OF ONE RESULTS ROW ---')
    ;[...rows[0].cells].forEach((cell, i) => {
      const links = [...cell.querySelectorAll('a')].map((a) => safeUrl(a.getAttribute('href')))
      log(`  cell[${i}] tag=${cell.tagName} class="${cell.className}"`)
      log(`     text: ${redact(cell.textContent)}`)
      if (links.length) log(`     links: ${[...new Set(links)].join(' , ')}`)
      if (cell.querySelector('img')) log(`     has <img>`)
      // The contact cell is ~555 chars, so show its inner tag skeleton.
      if (cell.textContent.trim().length > 100) {
        const skeleton = [...cell.querySelectorAll('*')].slice(0, 25)
          .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''))
          .join(' ')
        log(`     inner tags: ${skeleton}`)
      }
    })
  }

  // ---- Fetch one detail page --------------------------------------------
  const link = document.querySelector('a[href*="detail.do?prsnId="]')
  if (!link) {
    log('')
    log('! No detail.do link found — are you on the search results page?')
  } else {
    log('')
    log('--- FETCHING ONE DETAIL PAGE ---')
    const response = await fetch(link.href, { credentials: 'include' })
    log(`HTTP ${response.status} ${response.statusText}`)
    const html = await response.text()
    log(`Response length: ${html.length} chars`)

    const doc = new DOMParser().parseFromString(html, 'text/html')

    // Did we get the card, or bounced to a login page?
    if (/login|sign in|saml|shibboleth/i.test(doc.title || '')) {
      log(`! Looks like a login redirect. Title: ${redact(doc.title)}`)
    }

    log('')
    log('--- DETAIL PAGE TABLES ---')
    const tables = [...doc.querySelectorAll('table')]
    log(`${tables.length} table(s)`)
    tables.slice(0, 8).forEach((table, i) => {
      log(`  table[${i}] ${path(table)} rows=${table.rows.length}`)
      ;[...table.rows].slice(0, 20).forEach((row, r) => {
        // Only <th> is trusted as a field name; the Title-Case heuristic this
        // replaces echoed employer and university names verbatim.
        const cells = [...row.cells].map((cell) =>
          cell.tagName === 'TH' ? `"${cell.textContent.replace(/\s+/g, ' ').trim()}"` : redact(cell.textContent),
        )
        if (cells.some((c) => c !== '(empty)')) log(`    row[${r}]: ${cells.join('  |  ')}`)
      })
    })

    log('')
    log('--- DETAIL PAGE HEADINGS & LABELS ---')
    // On a class card, <h2> and <strong> hold the person's name, university and
    // employer — they are values, not field names. Only panel headers are
    // printed, and only when they match a known section name exactly.
    const PANEL_NAMES = new Set(['education', 'work experience', 'additional information', 'mba classcard'])
    const seen = new Set()
    for (const el of doc.querySelectorAll('h1,h2,h3,h4,h5,th,dt,legend,.card-header,.panel-heading')) {
      const text = el.textContent.replace(/\s+/g, ' ').trim()
      if (!text || text.length > 45 || seen.has(text)) continue
      const isField = el.tagName === 'TH' || el.tagName === 'DT' || PANEL_NAMES.has(text.toLowerCase())
      seen.add(text)
      log(`   <${el.tagName.toLowerCase()}> ${isField ? `"${text}"` : redact(text)}  @ ${path(el)}`)
      if (seen.size > 60) break
    }

    log('')
    log('--- DETAIL PAGE SECTION CONTAINERS ---')
    for (const el of [...doc.querySelectorAll('div.card, div.panel, section, fieldset')].slice(0, 25)) {
      const heading = el.querySelector('h1,h2,h3,h4,h5,.card-header,.panel-heading')
      const headingText = heading ? heading.textContent.replace(/\s+/g, ' ').trim() : ''
      const shown = PANEL_NAMES.has(headingText.toLowerCase()) ? `"${headingText}"` : redact(headingText)
      log(`   ${el.tagName.toLowerCase()}.${(typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0,3).join('.')}  heading=${shown}  textLen=${el.textContent.trim().length}`)
    }
  }

  log('')
  log('='.repeat(70))
  log('END — no classmate values above, only structure and field names.')
  log('='.repeat(70))

  const report = out.join('\n')
  console.log(report)
  try {
    await navigator.clipboard.writeText(report)
    console.log('\n%c✓ Copied to clipboard.', 'color: green; font-weight: bold')
  } catch {
    console.log('\n(Could not auto-copy — select and copy manually.)')
  }
  return `Report: ${report.split('\n').length} lines.`
})()
