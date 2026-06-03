import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isOffline } from './client'
import { enqueue, isTempId } from '../offline/outbox'
import type { Category } from '../lib/types'

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories/')
      return data
    },
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { data } = await api.post<Category>('/categories/', input)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<Pick<Category, 'name' | 'color'>>
    }) => {
      if (isOffline() || isTempId(id)) {
        await enqueue({ kind: 'category-update', categoryId: id, data })
        return
      }
      await api.patch(`/categories/${id}/`, data)
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['categories'] })
      qc.setQueryData<Category[]>(['categories'], (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...data } : c)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/categories/${id}/`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
