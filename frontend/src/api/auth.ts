import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { User } from '../lib/types'

export function useMe() {
  return useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const { data } = await api.get<User>('/auth/me/')
        return data
      } catch {
        return null
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (creds: { username: string; password: string }) => {
      const { data } = await api.post<User>('/auth/login/', creds)
      return data
    },
    onSuccess: (user) => qc.setQueryData(['me'], user),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (creds: { username: string; email?: string; password: string }) => {
      const { data } = await api.post<User>('/auth/register/', creds)
      return data
    },
    onSuccess: (user) => qc.setQueryData(['me'], user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout/')
    },
    onSuccess: () => {
      qc.setQueryData(['me'], null)
      qc.clear()
    },
  })
}
