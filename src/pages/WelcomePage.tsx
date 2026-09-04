import { cloneElement, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import sectionPhoto from '../assets/section-photo.jpg'

type Feature = {
  to: string
  name: string
  description: string
  icon: ReactElement
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const FEATURES: Feature[] = [
  {
    to: '/directory',
    name: 'Jirectory',
    description:
      'Search and browse everyone in the section — by name, industry, interests, or home region',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M6 16c0-1.7 1.3-3 3-3s3 1.3 3 3" />
        <path d="M14 9h4M14 13h4" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    name: 'Jalendar',
    description: 'Section events, dinners, and birthdays, all in one place',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
        <path d="M7.5 13h2M11.5 13h2M15.5 13h2M7.5 17h2M11.5 17h2" />
      </svg>
    ),
  },
  {
    to: '/social',
    name: 'Jocial',
    description: 'Your dinner table and 1:1 coffee pairing — new ones announced every 3 weeks',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        <path d="M13.5 15.2c2.3.3 4 2.2 4 4.8" />
      </svg>
    ),
  },
  {
    to: '/know-everyone',
    name: 'Just for Fun',
    description: 'A quick photo quiz to learn all ninety names and faces',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M9 4h4v2a1.5 1.5 0 0 0 3 0V4h1a2 2 0 0 1 2 2v1h-2a1.5 1.5 0 0 0 0 3h2v1a2 2 0 0 1-2 2h-1v2a1.5 1.5 0 0 1-3 0v-2H9v2a1.5 1.5 0 0 1-3 0v-2H5a2 2 0 0 1-2-2v-1h2a1.5 1.5 0 0 0 0-3H3V6a2 2 0 0 1 2-2h1v2a1.5 1.5 0 0 0 3 0z" />
      </svg>
    ),
  },
]

/** The first thing anyone sees after unlocking — an orientation, not the directory. */
export function WelcomePage() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-cover bg-center"
      style={{ backgroundImage: `url(${sectionPhoto})` }}
    >
      <div className="absolute inset-0 bg-ink-950/60" aria-hidden="true" />

      <div className="relative px-5 py-10 sm:px-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-white">Welcome to Section J</h1>
          <p className="mt-1 text-sm text-ink-200">Ninety classmates, one place to find them</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Link
              key={feature.to}
              to={feature.to}
              className="card group flex flex-col gap-2 p-5 transition hover:border-green-400 hover:shadow-md"
            >
              <div className="text-green-600 dark:text-green-400">
                {cloneElement(feature.icon, { width: 26, height: 26 })}
              </div>
              <p className="font-serif text-lg text-ink-900 group-hover:text-green-700 dark:text-ink-50 dark:group-hover:text-green-400">
                {feature.name}
              </p>
              <p className="text-sm text-ink-500 dark:text-ink-400">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
