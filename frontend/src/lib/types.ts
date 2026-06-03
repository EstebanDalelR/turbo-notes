export interface User {
  id: number
  username: string
  email: string
}

export interface Category {
  id: number
  name: string
  color: string
  is_default: boolean
  created_at: string
  note_count: number
}

export interface Attachment {
  id: number
  note: number
  url: string
  original_name: string
  content_type: string
  size: number
  created_at: string
}

export interface Note {
  id: number
  title: string
  content: string
  category: number | null
  is_public: boolean
  public_id: string
  created_at: string
  updated_at: string
  client_updated_at: string | null
  deleted_at: string | null
  attachments: Attachment[]
}

export interface PublicNote {
  title: string
  content: string
  public_id: string
  author: string
  created_at: string
  updated_at: string
  attachments: Attachment[]
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error'
