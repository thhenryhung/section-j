/**
 * Class-card recon — run this FIRST, before the harvester.
 *
 * HBS class cards are a legacy server-rendered app, so the only way to write
 * reliable selectors is to look at the real markup. This snippet reports the page
 * *structure* — tag names, classes, field labels, link and image URL shapes — and
 * redacts every value it finds, replacing text with a type and a character count.
 *
 * That means you can paste its output into a chat or an issue without disclosing
 * anything about a single classmate.
 *
 * HOW TO RUN
 *   1. Log in to secure.hbs.edu and open the Section J advanced search results.
 *   2. Open DevTools (F12) → Console.
 *   3. Paste this whole file, press Enter.
 *   4. The report is printed and copied to your clipboard.
 *
 * Then open ONE individual class card and run it again — it detects which kind of
 * page it is on and reports accordingly.
 */

(async () => {
  const out = []
  const log = (...args) => out.push(args.join(' '))

  /** Replace any real value with a shape description. */
  const redact = (text) => {
    const value = (text || '').trim()
    if (!value) return '(empty)'
    if (/^[\w.+-]+@[\w.-]+$/.test(value)) return `<email:${value.length}>`
    if (/^\+?[\d\s().-]{7,}$/.test(value)) return `<phone:${value.length}>`
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return '<date>'
    if (/^\d+$/.test(value)) return `<number:${value.length}>`
    if (value.length > 60) return `<text:${value.length}>`
    return `<text:${value.length}>`
  }

  /**
   * Keep the shape of a URL, drop anything identifying.
   *
   * mailto: and tel: are special-cased because for those schemes `pathname` IS
   * the address — an earlier version of this leaked a classmate's name and email
   * straight into its "redacted" report.
   */
  const urlShape = (url) => {
    if (!url) return '(none)'
    if (/^mailto:/i.test(url)) return 'mailto:<redacted>'
    if (/^tel:/i.test(url)) return 'tel:<redacted>'
    if (/^javascript:/i.test(url)) return 'javascript:'
    try {
      const parsed = new URL(url, location.href)
      const params = [...parsed.searchParams.keys()].join(',')
      return `${parsed.pathname}${params ? `?{${params}}` : ''}`
    } catch {
      return '(unparseable)'
    }
  }

  const path = (el) => {
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = node.tagName.toLowerCase()
      if (node.id) part += `#${node.id}`
      else if (node.className && typeof node.className === 'string') {
        const classes = node.className.trim().split(/\s+/).slice(0, 2).join('.')
        if (classes) part += `.${classes}`
      }
      parts.unshift(part)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  log('='.repeat(70))
  log('CLASS CARD RECON')
  log('URL shape:', urlShape(location.href))
  log('Title:', redact(document.title))
  log('='.repeat(70))

  // ---- Is this a results page or a single card? -------------------------
  const links = [...document.querySelectorAll('a[href]')]
  const cardLinks = links.filter((a) => /classcard|studentdetail|detail\.do|person/i.test(a.href))
  const images = [...document.querySelectorAll('img')]
  const photoish = images.filter(
    (img) => img.naturalWidth > 60 && img.naturalHeight > 60 && !/logo|icon|spacer/i.test(img.src),
  )

  log('')
  log(`Anchors total: ${links.length}   card-like: ${cardLinks.length}`)
  log(`Images total: ${images.length}   photo-sized: ${photoish.length}`)

  if (cardLinks.length > 3) {
    log('')
    log('--- LOOKS LIKE A RESULTS PAGE ---')
    log('Distinct card-link URL shapes:')
    const shapes = new Map()
    for (const a of cardLinks) {
      const shape = urlShape(a.href)
      shapes.set(shape, (shapes.get(shape) || 0) + 1)
    }
    for (const [shape, count] of shapes) log(`   ${count}×  ${shape}`)
    log('First card link DOM path:')
    log(`   ${path(cardLinks[0])}`)
  }

  if (photoish.length > 0) {
    log('')
    log('--- PHOTOS ---')
    const shapes = new Map()
    for (const img of photoish) {
      const shape = urlShape(img.src)
      shapes.set(shape, (shapes.get(shape) || 0) + 1)
    }
    for (const [shape, count] of shapes) log(`   ${count}×  ${shape}`)
    log(`   natural size of first: ${photoish[0].naturalWidth}x${photoish[0].naturalHeight}`)
    log(`   DOM path: ${path(photoish[0])}`)
    log(`   alt attr: ${redact(photoish[0].alt)}`)
  }

  // ---- Field structure: tables, definition lists, label/value pairs -----
  log('')
  log('--- TABLES ---')
  const tables = [...document.querySelectorAll('table')]
  log(`${tables.length} table(s)`)
  tables.slice(0, 6).forEach((table, i) => {
    const rows = [...table.rows]
    log(`  table[${i}] ${path(table)}  rows=${rows.length}`)
    rows.slice(0, 14).forEach((row, r) => {
      const cells = [...row.cells].map((cell) => {
        const text = cell.textContent.trim()
        // Only a <th> is trusted as a field name. The earlier "looks like a
        // label" heuristic — Title Case, or ending in a colon — matched values
        // too: "Lockheed Martin" and "Rensselaer Polytechnic Institute" are
        // Title Case, and printing them defeated the point of the whole script.
        return cell.tagName === 'TH' ? `"${text}"` : redact(text)
      })
      if (cells.some((c) => c !== '(empty)')) log(`    row[${r}]: ${cells.join('  |  ')}`)
    })
  })

  log('')
  log('--- DEFINITION LISTS ---')
  const dls = [...document.querySelectorAll('dl')]
  log(`${dls.length} dl(s)`)
  dls.slice(0, 4).forEach((dl, i) => {
    log(`  dl[${i}] ${path(dl)}`)
    ;[...dl.children].slice(0, 20).forEach((child) => {
      log(
        `    <${child.tagName.toLowerCase()}> ${
          child.tagName === 'DT' ? `"${child.textContent.trim()}"` : redact(child.textContent)
        }`,
      )
    })
  })

  // ---- Any element whose text looks like a field label ------------------
  log('')
  log('--- FIELD-NAME STRINGS ON PAGE ---')
  // Strictly an allowlist of known field names. A string is printed only if it
  // matches one of these *in full* (ignoring a trailing colon) — so a value can
  // never be echoed just because it happens to contain the word "Company".
  const FIELD_NAMES = new Set(
    [
      'name', 'section', 'phone', 'email', 'e-mail', 'phone & email', 'mobile', 'home phone',
      'partner', 'spouse', 'home region', 'hometown', 'current address', 'birthday', 'birth date',
      'interests', 'activities', 'education', 'university', 'degree', 'degree / major(s)',
      'grad date', 'work experience', 'company', 'company & title', 'title', 'location', 'dates',
      'additional information', 'languages', 'industry', 'clubs',
    ].map((s) => s.toLowerCase()),
  )
  const seen = new Set()
  for (const el of document.querySelectorAll('td, th, dt, label, strong, b, span, div')) {
    if (el.children.length > 0) continue
    const text = el.textContent.replace(/\s+/g, ' ').trim()
    const key = text.replace(/[:：]\s*$/, '').toLowerCase()
    if (!FIELD_NAMES.has(key)) continue
    if (seen.has(text)) continue
    seen.add(text)
    log(`   "${text}"   @ ${path(el)}`)
    if (seen.size > 45) break
  }

  log('')
  log('='.repeat(70))
  log('END OF REPORT — no classmate values are included above.')
  log('='.repeat(70))

  const report = out.join('\n')
  console.log(report)
  try {
    await navigator.clipboard.writeText(report)
    console.log('\n%c✓ Copied to clipboard.', 'color: green; font-weight: bold')
  } catch {
    console.log('\n(Could not auto-copy — select the output above and copy it manually.)')
  }
  return `Report: ${report.split('\n').length} lines, copied to clipboard.`
})()
