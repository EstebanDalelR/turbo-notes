import { Navigate, Route, Routes } from 'react-router-dom'
import { useMe } from './api/auth'
import { AppShell } from './components/AppShell'
import { Dashboard } from './routes/Dashboard'
import { Editor } from './routes/Editor'
import { Login } from './routes/Login'
import { PublicNote } from './routes/PublicNote'
import { Register } from './routes/Register'
import { Trash } from './routes/Trash'

export default function App() {
  const { data: me, isLoading } = useMe()

  return (
    <Routes>
      {/* Public, no auth required. */}
      <Route path="/n/:publicId" element={<PublicNote />} />

      {!me ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="*"
            element={isLoading ? <Splash /> : <Navigate to="/login" replace />}
          />
        </>
      ) : (
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/note/:id" element={<Editor />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="font-display text-2xl text-sepia-500">Turbo…</span>
    </div>
  )
}
