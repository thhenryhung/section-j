import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useSectionData } from './gate/SectionData'
import { UnlockScreen } from './gate/UnlockScreen'
import { DirectoryPage } from './pages/DirectoryPage'
import { CalendarPage } from './pages/CalendarPage'
import { SocialPage } from './pages/SocialPage'
import { KnowEveryonePage } from './pages/KnowEveryonePage'

const TABS = [
  { to: '/directory', label: 'Directory' },
  { to: '/social', label: 'Social' },
  { to: '/know-everyone', label: 'Know Everyone' },
  { to: '/calendar', label: 'Calendar' },
]

export function App() {
  const { status, lock, isSampleBuild } = useSectionData()

  if (status !== 'unlocked') return <UnlockScreen />

  return (
    <div className="min-h-dvh">
      {isSampleBuild && (
        <p className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
          Sample build — every person shown here is invented. No real section data is loaded.
        </p>
      )}

      <header className="sticky top-0 z-20 border-b border-ink-200 bg-ink-50/85 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <NavLink to="/directory" className="font-serif text-xl text-crimson-600">
            Section J
          </NavLink>

          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Sections">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'bg-crimson-600 text-white'
                      : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={lock}
            className="whitespace-nowrap text-xs text-ink-400 underline underline-offset-2 hover:text-crimson-600"
          >
            Lock
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/directory" replace />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/directory/:personId" element={<DirectoryPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/know-everyone" element={<KnowEveryonePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="*" element={<Navigate to="/directory" replace />} />
        </Routes>
      </main>
    </div>
  )
}
