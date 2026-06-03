import { useState } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  label?: React.ReactNode
}

export function PasswordInput({ value, onChange, label = 'Password' }: Props) {
  const [show, setShow] = useState(false)

  return (
    <label className="block text-sm mb-4">
      {label}
      <div className="relative mt-1">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-3 py-2 pr-12" />
        <button type="button" onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center pr-2">
          <img src={show ? '/closed.png' : '/open.png'} alt=""
            className="h-7 w-7 object-contain" />
        </button>
      </div>
    </label>
  )
}
