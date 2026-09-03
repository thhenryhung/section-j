/**
 * Skeleton recon — run this THIRD, on the Section J search results page.
 *
 * The previous two snippets kept "label-like" text verbatim on the assumption
 * that headings and <strong> elements are field names. On a class card they are
 * values: the university, the employer, the person's own name. So this snippet
 * takes the only approach that is actually safe by construction —
 *
 *   IT NEVER PRINTS PAGE TEXT. AT ALL.
 *
 * Every node is reported as tag + id + classes + a character count. URLs keep
 * only their path and the *names* of their query parameters. mailto: and tel:
 * links are reported as their scheme alone. There is no allowlist to get wrong
 * and no heuristic to misfire.
 *
 * That is enough to write CSS selectors against, which is the whole job.
 *
 * HOW TO RUN
 *   1. Stay on the Section J search results page, logged in.
 *   2. DevTools (F12) → Console → paste → Enter.
 *   3. Report prints and copies to your clipboard.
 */

(async () => {
  const out = []
  const log = (...args) => out.push(args.join(' '))

  /** Path + parameter NAMES only. Never a value, never a mailto address. */
  const safeUrl = (raw) => {
    if (!raw) return ''
    if (/^mailto:/i.test(raw)) return 'mailto:<redacted>'
    if (/^tel:/i.test(raw)) return 'tel:<redacted>'
    if (/^javascript:/i.test(raw)) return 'javascript:'
    if (/^#/.test(raw)) return '#anchor'
    try {
      const url = new URL(raw, location.href)
      const keys = [...url.searchParams.keys()]
      return url.pathname + (keys.length ? `?{${keys.join(',')}}` : '')
    } catch {
      return '<unparseable>'
    }
  }

  const describe = (el) => {
    let s = el.tagName.toLowerCase()
    if (el.id) s += `#${el.id}`
    if (typeof el.className === 'string' && el.className.trim()) {
      s += '.' + el.className.trim().split(/\s+/).join('.')
    }
    // Own text length only — excludes descendants, so we can see which node
    // actually carries the value.
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
      .join(' ')
      .trim()
    if (ownText) s += ` [len=${ownText.length}]`
    if (el.tagName === 'A') s += ` href=${safeUrl(el.getAttribute('href'))}`
    if (el.tagName === 'IMG') s += ` src=${safeUrl(el.getAttribute('src'))}`
    if (el.tagName === 'INPUT') s += ` type=${el.type} name=${el.name || '-'}`
    if (el.tagName === 'I' || el.tagName === 'SPAN') {
      const title = el.getAttribute('title')
      if (title) s += ` title=[len=${title.length}]`
    }
    return s
  }

  const walk = (el, depth, maxDepth, limit) => {
    if (depth > maxDepth || out.length > limit) return
    log('  '.repeat(depth) + describe(el))
    for (const child of el.children) walk(child, depth + 1, maxDepth, limit)
  }

  log('='.repeat(70))
  log('SKELETON RECON — structure only, zero page text')
  log('='.repeat(70))

  const link = document.querySelector('a[href*="detail.do?prsnId="]')
  if (!link) {
    log('! No detail.do link found. Are you on the search results page?')
  } else {
    const response = await fetch(link.href, { credentials: 'include' })
    log(`Fetched a class card: HTTP ${response.status}`)
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html')

    // Which panels exist, and what are their ids?
    log('')
    log('--- PANEL IDS UNDER #profile-panels ---')
    const panels = [...doc.querySelectorAll('#profile-panels > div, #profile-panels > section')]
    panels.forEach((p, i) => {
      const inner = [...p.children].map((c) => describe(c)).join('  ||  ')
      log(`  panel[${i}] ${describe(p)}`)
      log(`     children: ${inner}`)
    })

    // The header block: name, photo, and (probably) home region + contact.
    log('')
    log('--- #profile-view HEADER BLOCK (depth 6) ---')
    const header = doc.querySelector('#profile-view > .card-block')
    if (header) {
      const firstRow = header.querySelector(':scope > .row')
      walk(firstRow || header, 0, 6, 400)
    } else {
      log('  (#profile-view > .card-block not found)')
    }

    // Additional Information had 2205 chars and no table — this is where home
    // region, interests, activities and birthday most likely live.
    log('')
    log('--- "ADDITIONAL INFORMATION" PANEL (depth 8) ---')
    const additional = panels.find((p) => {
      const header = p.querySelector('.card-header')
      return header && /additional/i.test(header.textContent || '')
    })
    if (additional) walk(additional, 0, 8, 900)
    else log('  (not found — check the panel ids listed above)')

    log('')
    log('--- EDUCATION PANEL (depth 7) ---')
    const education = doc.querySelector('#education')
    if (education) walk(education, 0, 7, 1100)

    log('')
    log('--- WORK EXPERIENCE PANEL, first row only (depth 8) ---')
    const work = doc.querySelector('#work-experience tbody tr')
    if (work) walk(work, 0, 8, 1300)

    log('')
    log('--- DETAIL PAGE PHOTO ---')
    const photos = [...doc.querySelectorAll('img')].filter((i) => /\/photos\//.test(i.getAttribute('src') || ''))
    photos.slice(0, 3).forEach((p) => log(`  ${describe(p)}`))
    if (photos.length === 0) log('  (no /photos/ image on the detail page)')
  }

  log('')
  log('--- RESULTS ROW, one row (depth 5) ---')
  const row = document.querySelector('#results tbody tr')
  if (row) walk(row, 0, 5, 1600)

  log('')
  log('='.repeat(70))
  log('END — this report contains no page text by construction.')
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
