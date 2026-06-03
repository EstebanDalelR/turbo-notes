import { useEffect, useState } from 'react'
import { useOnline } from '../hooks/useOnline'
import { pendingCount } from '../offline/outbox'

export function OfflineBanner() {
  const online = useOnline()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    let active = true
    const tick = () => pendingCount().then((n) => active && setPending(n))
    tick()
    const interval = setInterval(tick, 2000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [online])

  if (online && pending === 0) return null

  return (
    <div
      className={`w-full text-center text-sm py-1 px-3 font-display tracking-wide ${
        online
          ? 'bg-sepia-300 text-sepia-900'
          : 'bg-sepia-800 text-sepia-50'
      }`}
    >
      {online
        ? `Syncing ${pending} pending change${pending === 1 ? '' : 's'}…`
        : `Offline — changes are saved locally${pending ? ` (${pending} queued)` : ''} and will sync when you reconnect.`}
    </div>
  )
}
