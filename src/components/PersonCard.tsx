import { Link } from 'react-router-dom'
import { PersonPhoto } from './PersonPhoto'
import { currentRoleLabel, regionLabel } from '../lib/people'
import type { Person } from '../lib/types'

export function PersonCard({ person }: { person: Person }) {
  const role = currentRoleLabel(person)
  const home = regionLabel(person.homeRegion)

  return (
    <Link
      to={`/directory/${person.id}`}
      className="card group flex flex-col overflow-hidden transition hover:border-green-400 hover:shadow-md"
    >
      <PersonPhoto person={person} className="aspect-square w-full text-4xl" />

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="font-serif text-base leading-tight group-hover:text-green-700 dark:group-hover:text-green-400">
          {person.displayName}
        </p>
        {role && <p className="line-clamp-2 text-xs text-ink-500">{role}</p>}
        {home && <p className="mt-auto pt-1 text-xs text-ink-400">{home}</p>}
      </div>
    </Link>
  )
}

export function PersonRow({ person }: { person: Person }) {
  const role = currentRoleLabel(person)
  const home = regionLabel(person.homeRegion)

  return (
    <Link
      to={`/directory/${person.id}`}
      className="flex items-center gap-3 border-b border-ink-200 px-2 py-2.5 transition hover:bg-ink-100 dark:border-ink-800 dark:hover:bg-ink-900"
    >
      <PersonPhoto person={person} className="size-10 shrink-0 rounded-full text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{person.displayName}</p>
        {role && <p className="truncate text-xs text-ink-500">{role}</p>}
      </div>
      {home && <p className="hidden shrink-0 text-xs text-ink-400 sm:block">{home}</p>}
    </Link>
  )
}
