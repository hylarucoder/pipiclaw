import { z } from 'zod'

export const NOTES_LIST_FILES_CHANNEL = 'notes:list-files'
export const NOTES_READ_FILE_CHANNEL = 'notes:read-file'
export const NOTES_WRITE_FILE_CHANNEL = 'notes:write-file'
export const NOTES_READ_ASSET_CHANNEL = 'notes:read-asset'
export const NOTES_FILES_CHANGED_CHANNEL = 'notes:files-changed'
export const NOTES_SEARCH_FILES_CHANNEL = 'notes:search-files'
export const DEFAULT_NOTES_FILE_LIMIT = 5000
export const DEFAULT_NOTES_PREVIEW_CHAR_LIMIT = 20000
export const DEFAULT_NOTES_SEARCH_LIMIT = 2000
export const DEFAULT_NOTES_ASSET_PREVIEW_MAX_BYTES = 25 * 1024 * 1024

export const notesListFilesInputSchema = z.object({
  rootDir: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(DEFAULT_NOTES_FILE_LIMIT).optional()
})

export const notesFileItemSchema = z.object({
  name: z.string(),
  relativePath: z.string(),
  extension: z.string(),
  size: z.number().int().nonnegative(),
  updatedAt: z.string()
})

export const notesListFilesResultSchema = z.object({
  rootDir: z.string(),
  files: z.array(notesFileItemSchema),
  truncated: z.boolean(),
  error: z.string().optional()
})

export const notesReadFileInputSchema = z.object({
  rootDir: z.string().min(1).optional(),
  relativePath: z.string().min(1),
  maxChars: z.number().int().min(200).max(200000).optional()
})

export const notesReadFileResultSchema = z.object({
  rootDir: z.string(),
  relativePath: z.string(),
  content: z.string(),
  truncated: z.boolean(),
  error: z.string().optional()
})

export const notesWriteFileInputSchema = z.object({
  rootDir: z.string().min(1).optional(),
  relativePath: z.string().min(1),
  content: z.string()
})

export const notesWriteFileResultSchema = z.object({
  rootDir: z.string(),
  relativePath: z.string(),
  error: z.string().optional()
})

export const notesReadAssetInputSchema = z.object({
  rootDir: z.string().min(1).optional(),
  relativePath: z.string().min(1),
  maxBytes: z.number().int().min(1024).max(100 * 1024 * 1024).optional()
})

export const notesReadAssetResultSchema = z.object({
  rootDir: z.string(),
  relativePath: z.string(),
  dataUrl: z.string().optional(),
  error: z.string().optional()
})

export const notesSearchFilesInputSchema = z.object({
  rootDir: z.string().min(1).optional(),
  query: z.string().min(1),
  limit: z.number().int().min(1).max(DEFAULT_NOTES_SEARCH_LIMIT).optional()
})

export const notesSearchFilesResultSchema = z.object({
  rootDir: z.string(),
  query: z.string(),
  files: z.array(notesFileItemSchema),
  truncated: z.boolean(),
  error: z.string().optional()
})

export const notesFilesChangedPayloadSchema = z.object({
  rootDir: z.string(),
  filename: z.string().optional()
})

export type NotesListFilesInput = z.infer<typeof notesListFilesInputSchema>
export type NotesFileItem = z.infer<typeof notesFileItemSchema>
export type NotesListFilesResult = z.infer<typeof notesListFilesResultSchema>
export type NotesReadFileInput = z.infer<typeof notesReadFileInputSchema>
export type NotesReadFileResult = z.infer<typeof notesReadFileResultSchema>
export type NotesWriteFileInput = z.infer<typeof notesWriteFileInputSchema>
export type NotesWriteFileResult = z.infer<typeof notesWriteFileResultSchema>
export type NotesReadAssetInput = z.infer<typeof notesReadAssetInputSchema>
export type NotesReadAssetResult = z.infer<typeof notesReadAssetResultSchema>
export type NotesSearchFilesInput = z.infer<typeof notesSearchFilesInputSchema>
export type NotesSearchFilesResult = z.infer<typeof notesSearchFilesResultSchema>
export type NotesFilesChangedPayload = z.infer<typeof notesFilesChangedPayloadSchema>
