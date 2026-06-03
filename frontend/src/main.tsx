import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './index.css'
import App from './App'
import { installSync } from './offline/sync'
import { useTheme } from './store/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data around so reads work offline; the SW + persister back this up.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'turbo-query-cache',
})

function Root() {
  useEffect(() => {
    useTheme.getState().apply()
    return installSync(queryClient)
  }, [])

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        // Don't persist the public-note query or transient errors.
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
    >
      <Root />
    </PersistQueryClientProvider>
  </StrictMode>,
)
