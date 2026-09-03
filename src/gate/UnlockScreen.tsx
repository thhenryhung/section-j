import { useState, type FormEvent } from 'react'
import { useSectionData } from './SectionData'

/**
 * The gate. Deliberately plain: it explains what the site is, why it is behind a
 * passphrase, and nothing about who is inside it.
 */
export function UnlockScreen() {
  const { unlock, status, error } = useSectionData()
  const [passphrase, setPassphrase] = useState('')
  const [remember, setRemember] = useState(false)

  const busy = status === 'unlocking'

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!passphrase.trim() || busy) return
    void unlock(passphrase.trim(), remember)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-serif text-6xl text-crimson-600">J</p>
          <h1 className="mt-2 font-serif text-3xl">Section J</h1>
          <p className="mt-1 text-sm text-ink-500">HBS MBA Class of 2028</p>
        </div>

        <form onSubmit={onSubmit} className="card p-6">
          <label htmlFor="passphrase" className="block text-sm font-medium">
            Section passphrase
          </label>
          <p className="mt-1 text-xs text-ink-500">
            Shared with the section. This page holds classmates’ contact details, so it stays
            behind the passphrase.
          </p>

          <input
            id="passphrase"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={busy}
            className="mt-3 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-base
                       disabled:opacity-60 dark:border-ink-700 dark:bg-ink-950"
            aria-describedby={error ? 'unlock-error' : undefined}
            aria-invalid={Boolean(error)}
          />

          <label className="mt-3 flex items-start gap-2 text-xs text-ink-500">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Remember on this device. Faster to open, but it stores the directory unencrypted
              in this browser — leave it off on a shared computer.
            </span>
          </label>

          <button
            type="submit"
            disabled={busy || !passphrase.trim()}
            className="mt-5 w-full rounded-lg bg-crimson-600 px-4 py-2.5 font-medium text-white
                       transition hover:bg-crimson-700 disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>

          {error && (
            <p id="unlock-error" role="alert" className="mt-3 text-sm text-crimson-600">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-ink-400">
          Built by the section, for the section.{' '}
          <a
            href="https://github.com/thhenryhung/section-j"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-crimson-600"
          >
            Contribute on GitHub
          </a>
        </p>
      </div>
    </main>
  )
}
