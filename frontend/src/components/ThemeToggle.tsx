import { useTheme } from '../store/theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
      className="rounded border border-sepia-400/60 px-2 py-1 text-sm hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60"
    >
      {theme === 'light' ? '☾ dark' : '☀ light'}
    </button>
  )
}
