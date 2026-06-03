import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { PublicNote } from '../lib/types'

export function usePublicNote(publicId: string | undefined) {
  return useQuery<PublicNote>({
    queryKey: ['public-note', publicId],
    enabled: !!publicId,
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<PublicNote>(`/public/notes/${publicId}/`)
      return data
    },
  })
}
