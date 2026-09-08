/**
 * Single source of truth for everything that's specific to *this* section, not
 * to the codebase. A section forking this repo should only need to edit this
 * file (plus the ~7 brand hex values in src/index.css, which Tailwind's CSS-only
 * `@theme` block can't import from here — see the comment there) to make the
 * site their own.
 *
 * `wrangler.toml` (KV namespace id, Cloudflare project name) and
 * `.github/workflows/deploy.yml`'s `vars.DATA_REPO`/`vars.CLOUDFLARE_PROJECT`
 * stay hand-edited on fork too — TOML/YAML can't import a TS module.
 */

export const siteConfig = {
  orgName: 'Section J',
  tagline: 'HBS MBA Class of 2028',
  description: 'A private directory and social hub for HBS MBA 2028 Section J.',
  tabs: [
    { to: '/directory', label: 'Jirectory' },
    { to: '/calendar', label: 'Jalendar' },
    { to: '/social', label: 'Jocial' },
    { to: '/know-everyone', label: 'Just for Fun' },
  ],
  github: { owner: 'thhenryhung', repo: 'section-j' },
  cloudflare: { pagesProject: 'section-j' },
} as const

export type SiteConfig = typeof siteConfig
