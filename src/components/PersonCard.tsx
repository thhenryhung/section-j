import { Link, useNavigate } from 'react-router-dom'
import { PersonPhoto } from './PersonPhoto'
import { currentRoleLabel, regionLabel } from '../lib/people'
import type { Person } from '../lib/types'

function industriesOf(person: Person): string {
  return [...new Set(person.preMBA.map((role) => role.industry).filter(Boolean))].join(', ')
}

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

/**
 * A row in the table view. Industry, home region and interests progressively
 * appear as the viewport widens rather than all cramming onto a phone screen —
 * name (with photo) is the one column that never hides.
 */
export function PersonRow({ person }: { person: Person }) {
  const navigate = useNavigate()
  const industries = industriesOf(person)
  const home = regionLabel(person.homeRegion)
  const interests = person.professionalInterests.join(', ')

  return (
    <tr
      onClick={() => navigate(`/directory/${person.id}`)}
      className="cursor-pointer border-b border-ink-200 transition last:border-b-0 hover:bg-ink-100 dark:border-ink-800 dark:hover:bg-ink-900"
    >
      <td className="min-w-0 px-2 py-2.5">
        <Link to={`/directory/${person.id}`} className="flex items-center gap-3">
          <PersonPhoto person={person} className="size-9 shrink-0 rounded-full text-sm" />
          <span className="min-w-0 truncate font-medium">{person.displayName}</span>
        </Link>
      </td>
      <td className="hidden max-w-40 truncate px-2 py-2.5 text-sm text-ink-600 dark:text-ink-300 sm:table-cell">
        {industries || <span className="text-ink-300 dark:text-ink-700">—</span>}
      </td>
      <td className="hidden max-w-40 truncate px-2 py-2.5 text-sm text-ink-600 dark:text-ink-300 md:table-cell">
        {home || <span className="text-ink-300 dark:text-ink-700">—</span>}
      </td>
      <td className="hidden max-w-56 truncate px-2 py-2.5 text-sm text-ink-600 dark:text-ink-300 lg:table-cell">
        {interests || <span className="text-ink-300 dark:text-ink-700">—</span>}
      </td>
    </tr>
  )
}
