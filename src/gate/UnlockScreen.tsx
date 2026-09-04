import { useState, type FormEvent } from 'react'
import { useSectionData } from './SectionData'
import sectionPhoto from '../assets/section-photo.jpg'
import jBalloon from '../assets/j-balloon.jpg'

/**
 * The gate. Deliberately plain: it explains what the site is, why it is behind a
 * passphrase, and nothing about who is inside it.
 *
 * The background photo is a section group shot, already public on Instagram, so
 * it carries no privacy weight of its own — everything it would need to protect
 * (names, contact details) still lives only behind the passphrase below it.
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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${sectionPhoto})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-ink-950/65" aria-hidden="true" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src={jBalloon}
            alt=""
            className="mx-auto mb-3 size-20 rounded-full border-2 border-green-100 object-cover"
          />
          <h1 className="font-serif text-3xl text-white">Section J</h1>
          <p className="mt-1 text-sm text-ink-200">HBS MBA Class of 2028</p>
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
            className="mt-5 w-full rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white
                       transition hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>

          {error && (
            <p id="unlock-error" role="alert" className="mt-3 text-sm text-crimson-600">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-ink-300">
          Built by the section, for the section.{' '}
          <a
            href="https://github.com/thhenryhung/section-j"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-white"
          >
            Contribute on GitHub
          </a>
        </p>
      </div>
    </main>
  )
}
