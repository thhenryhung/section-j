import { useSectionData } from '../gate/SectionData'
import { initials } from '../lib/people'
import type { Person } from '../lib/types'

/**
 * A person's photo, or a generated initials tile when they have none — either
 * because the class card had no photo or because they opted out.
 *
 * `hidden` forces the fallback regardless, which is how the Know Everyone quiz
 * shows a name-to-face question without giving the answer away.
 */
export function PersonPhoto({
  person,
  className = '',
  hidden = false,
}: {
  person: Person
  className?: string
  hidden?: boolean
}) {
  const { photos } = useSectionData()
  const src = person.photoId ? photos[person.photoId] : undefined

  if (hidden || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-ink-200 font-serif text-ink-500 dark:bg-ink-800 dark:text-ink-400 ${className}`}
        aria-hidden="true"
      >
        {hidden ? '?' : initials(person)}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={person.displayName}
      loading="lazy"
      decoding="async"
      className={`object-cover ${className}`}
    />
  )
}
