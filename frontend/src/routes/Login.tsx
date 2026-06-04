import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLogin } from '../api/auth'
import { ThemeToggle } from '../components/ThemeToggle'
import { PasswordInput, PasswordToggle } from '../components/PasswordInput'

export function Login() {
  const navigate = useNavigate()
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login.mutateAsync({ username, password })
      navigate('/')
    } catch {
      setError('Invalid username or password.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <form onSubmit={submit} className="w-full max-w-sm bg-sepia-50 dark:bg-sepia-900 rounded-lg shadow-paper p-6 border border-sepia-300/60 dark:border-sepia-700/60">
        <h1 className="font-display text-3xl mb-1">Turbo</h1>
        <p className="text-sepia-600 dark:text-sepia-300 mb-6 text-sm">Sign in to your notes.</p>
        <label className="block text-sm mb-3">
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
            className="mt-1 w-full rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-3 py-2" />
        </label>
        <PasswordInput value={password} onChange={setPassword} show={showPassword} />
        {error && <p className="text-red-700 dark:text-red-400 text-sm mb-3">{error}</p>}
        <button type="submit" disabled={login.isPending}
          className="w-full rounded bg-sepia-600 text-sepia-50 py-2 font-display tracking-wide hover:bg-sepia-700 disabled:opacity-60">
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        <PasswordToggle show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
        <p className="text-sm mt-4 text-center">
          No account? <Link to="/register" className="underline">Create one</Link>
        </p>
      </form>
    </div>
  )
}
