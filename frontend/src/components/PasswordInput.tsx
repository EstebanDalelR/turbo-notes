type InputProps = {
  value: string
  onChange: (value: string) => void
  label?: React.ReactNode
  show: boolean
  onToggle: () => void
}

// Lucide-style eye / eye-off glyphs (open while the password is hidden).
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      {off ? (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

export function PasswordInput({ value, onChange, label = 'Password', show, onToggle }: InputProps) {
  return (
    <label className="block text-sm mb-4">
      {label}
      <div className="relative mt-1">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-3 py-2 pr-10" />
        <button type="button" onClick={onToggle}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-sepia-500 hover:text-sepia-700 dark:hover:text-sepia-300">
          <EyeIcon off={show} />
        </button>
      </div>
    </label>
  )
}

type ToggleProps = {
  show: boolean
  onToggle: () => void
}

// The cactus mascot also doubles as a show/hide control: eyes open while the
// password is hidden, eyes closed (politely looking away) once it's shown.
// Lives under the submit button as a friendly mascot.
export function PasswordToggle({ show, onToggle }: ToggleProps) {
  return (
    <button type="button" onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      className="mt-4 mx-auto block transition-transform hover:scale-105">
      <img src={show ? '/cactus-closed.png' : '/cactus-open.png'} alt=""
        className="h-20 w-20 object-contain" />
    </button>
  )
}
