type InputProps = {
  value: string
  onChange: (value: string) => void
  label?: React.ReactNode
  show: boolean
}

export function PasswordInput({ value, onChange, label = 'Password', show }: InputProps) {
  return (
    <label className="block text-sm mb-4">
      {label}
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-3 py-2" />
    </label>
  )
}

type ToggleProps = {
  show: boolean
  onToggle: () => void
}

// The cactus mascot doubles as the show/hide-password control: eyes open while
// the password is hidden, eyes closed (politely looking away) once it's shown.
// Lives under the submit button rather than inside the field.
export function PasswordToggle({ show, onToggle }: ToggleProps) {
  return (
    <button type="button" onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      className="mt-4 mx-auto block transition-transform hover:scale-105">
      <img src={show ? '/closed.png' : '/open.png'} alt=""
        className="h-16 w-16 object-contain" />
    </button>
  )
}
