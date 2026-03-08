import {
  NOTES_LIST_FILES_CHANNEL,
  NOTES_READ_FILE_CHANNEL,
  NOTES_WRITE_FILE_CHANNEL,
  notesListFilesInputSchema,
  notesListFilesResultSchema,
  notesReadFileInputSchema,
  notesReadFileResultSchema,
  notesWriteFileInputSchema,
  notesWriteFileResultSchema,
  type NotesListFilesInput,
  type NotesListFilesResult,
  type NotesReadFileInput,
  type NotesReadFileResult,
  type NotesWriteFileInput,
  type NotesWriteFileResult
} from '@pipiclaw/shared/rpc/notes'

type RuntimeWindow = Window &
  Partial<{
    api: {
      notes?: {
        listFiles?: (input?: NotesListFilesInput) => Promise<NotesListFilesResult>
        readFile?: (input: NotesReadFileInput) => Promise<NotesReadFileResult>
        writeFile?: (input: NotesWriteFileInput) => Promise<NotesWriteFileResult>
      }
    }
    electron: {
      ipcRenderer?: {
        invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
      }
    }
  }>

export async function invokeNotesListFiles(
  input?: NotesListFilesInput
): Promise<NotesListFilesResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.notes?.listFiles) {
    return runtimeWindow.api.notes.listFiles(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = notesListFilesInputSchema.parse(input ?? {})
    const result = await runtimeWindow.electron.ipcRenderer.invoke(
      NOTES_LIST_FILES_CHANNEL,
      parsedInput
    )
    return notesListFilesResultSchema.parse(result)
  }

  return {
    rootDir: input?.rootDir ?? '',
    files: [],
    truncated: false,
    error: '预加载 Notes API 未就绪，请重启应用后重试。'
  }
}

export async function invokeNotesReadFile(input: NotesReadFileInput): Promise<NotesReadFileResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.notes?.readFile) {
    return runtimeWindow.api.notes.readFile(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = notesReadFileInputSchema.parse(input)
    const result = await runtimeWindow.electron.ipcRenderer.invoke(
      NOTES_READ_FILE_CHANNEL,
      parsedInput
    )
    return notesReadFileResultSchema.parse(result)
  }

  return {
    rootDir: input.rootDir ?? '',
    relativePath: input.relativePath,
    content: '',
    truncated: false,
    error: '预加载 Notes API 未就绪，请重启应用后重试。'
  }
}

export async function invokeNotesWriteFile(
  input: NotesWriteFileInput
): Promise<NotesWriteFileResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.notes?.writeFile) {
    return runtimeWindow.api.notes.writeFile(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = notesWriteFileInputSchema.parse(input)
    const result = await runtimeWindow.electron.ipcRenderer.invoke(
      NOTES_WRITE_FILE_CHANNEL,
      parsedInput
    )
    return notesWriteFileResultSchema.parse(result)
  }

  return {
    rootDir: input.rootDir ?? '',
    relativePath: input.relativePath,
    error: '预加载 Notes API 未就绪，请重启应用后重试。'
  }
}
