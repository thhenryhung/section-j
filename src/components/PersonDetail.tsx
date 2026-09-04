import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PersonPhoto } from './PersonPhoto'
import { useSectionData } from '../gate/SectionData'
import { currentRoleLabel, regionLabel, similarPeople } from '../lib/people'
import type { Person } from '../lib/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-ink-200 pt-4 dark:border-ink-800">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</h3>
      {children}
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

export function PersonDetail({ person, onClose }: { person: Person; onClose: () => void }) {
  const { people } = useSectionData()
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape closes, and focus lands on the close button so the panel is reachable
  // by keyboard the moment it opens.
  useEffect(() => {
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const similar = similarPeople(person, people, 6)

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={person.displayName}>
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />

      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-ink-50 shadow-2xl dark:bg-ink-950">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-ink-50/90 px-4 py-2 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
          <p className="text-xs uppercase tracking-wide text-ink-400">Section J</p>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-500 hover:bg-ink-200 dark:hover:bg-ink-800"
          >
            Close
          </button>
        </div>

        <div className="flex items-start gap-4 p-4">
          <PersonPhoto person={person} className="size-24 shrink-0 rounded-xl text-2xl" />
          <div className="min-w-0 pt-1">
            <h2 className="font-serif text-2xl leading-tight">{person.displayName}</h2>
            {person.pronouns && <p className="text-xs text-ink-400">{person.pronouns}</p>}
            {currentRoleLabel(person) && (
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{currentRoleLabel(person)}</p>
            )}
            {person.birthday && (
              <p className="mt-1 text-xs text-ink-400">
                Birthday {MONTHS[person.birthday.month - 1]} {person.birthday.day}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-8">
          <p className="text-sm text-ink-500">
            <a href={`mailto:${person.email}`} className="underline underline-offset-2">
              {person.email}
            </a>
            {person.phone && <span className="block">{person.phone}</span>}
          </p>

          {(regionLabel(person.homeRegion) || person.currentCity) && (
            <Section title="Where they're from">
              {regionLabel(person.homeRegion) && <p className="text-sm">{regionLabel(person.homeRegion)}</p>}
              {person.currentCity && (
                <p className="text-xs text-ink-400">Currently in {person.currentCity}</p>
              )}
            </Section>
          )}

          {person.preMBA.length > 0 && (
            <Section title="Before HBS">
              <ul className="flex flex-col gap-2.5">
                {person.preMBA.map((role, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{role.company ?? role.title}</span>
                    {role.company && role.title && (
                      <span className="block text-ink-500">{role.title}</span>
                    )}
                    <span className="block text-xs text-ink-400">
                      {[role.location, role.dates].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
              {person.startupExperience && (
                <p className="mt-2 text-xs text-green-700 dark:text-green-400">Has start-up experience</p>
              )}
            </Section>
          )}

          {person.education.length > 0 && (
            <Section title="Education">
              <ul className="flex flex-col gap-2">
                {person.education.map((entry, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{entry.school}</span>
                    <span className="block text-xs text-ink-400">
                      {[entry.degree, entry.gradDate].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {person.professionalInterests.length > 0 && (
            <Section title="Professional interests">
              <Chips items={person.professionalInterests} />
            </Section>
          )}

          {person.funFact && (
            <Section title="Fun fact">
              <p className="text-sm italic text-ink-600 dark:text-ink-300">{person.funFact}</p>
            </Section>
          )}

          {similar.length > 0 && (
            <Section title="People like them">
              <ul className="flex flex-col gap-1">
                {similar.map(({ person: other, shared }) => (
                  <li key={other.id}>
                    <Link
                      to={`/directory/${other.id}`}
                      className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-ink-100 dark:hover:bg-ink-900"
                    >
                      <PersonPhoto person={other} className="size-8 shrink-0 rounded-full text-xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{other.displayName}</span>
                        {shared.length > 0 && (
                          <span className="block truncate text-xs capitalize text-ink-400">
                            {shared.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
