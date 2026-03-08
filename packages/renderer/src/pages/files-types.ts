import type { NotesFileItem } from '@pipiclaw/shared/rpc/notes'

export type FileTreeNode = {
  name: string
  path: string
  kind: 'directory' | 'file'
  children: FileTreeNode[]
  file?: NotesFileItem
}

export type FilePreviewState = {
  content: string
  truncated: boolean
  error: string | null
}

export type FilePreviewMode =
  | 'markdown'
  | 'image'
  | 'pdf'
  | 'canvas'
  | 'excalidraw'
  | 'text'
  | 'unsupported'
