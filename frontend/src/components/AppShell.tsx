import { Link, Outlet } from 'react-router-dom'
import { useMe, useLogout } from '../api/auth'
import { OfflineBanner } from './OfflineBanner'
import { ThemeToggle } from './ThemeToggle'

export function AppShell() {
  const { data: me } = useMe()
  const logout = useLogout()

  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBanner />
      <header className="flex items-center justify-between px-4 py-3 border-b border-sepia-300/60 dark:border-sepia-700/60">
        <Link to="/" className="font-display text-2xl">Turbo</Link>
        <div className="flex items-center gap-3 text-sm">
          {me && <span className="text-sepia-600 dark:text-sepia-300 hidden sm:inline">{me.username}</span>}
          <ThemeToggle />
          <button onClick={() => logout.mutate()}
            className="rounded border border-sepia-400/60 px-2 py-1 hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
