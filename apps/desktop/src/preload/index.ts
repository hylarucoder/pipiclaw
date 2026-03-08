import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  NOTES_FILES_CHANGED_CHANNEL,
  NOTES_LIST_FILES_CHANNEL,
  NOTES_READ_ASSET_CHANNEL,
  NOTES_READ_FILE_CHANNEL,
  NOTES_WRITE_FILE_CHANNEL,
  NOTES_SEARCH_FILES_CHANNEL,
  notesFilesChangedPayloadSchema,
  notesReadAssetInputSchema,
  notesReadAssetResultSchema,
  notesListFilesInputSchema,
  notesListFilesResultSchema,
  notesReadFileInputSchema,
  notesReadFileResultSchema,
  notesWriteFileInputSchema,
  notesWriteFileResultSchema,
  notesSearchFilesInputSchema,
  notesSearchFilesResultSchema,
  type NotesFilesChangedPayload,
  type NotesListFilesInput,
  type NotesListFilesResult,
  type NotesReadAssetInput,
  type NotesReadAssetResult,
  type NotesReadFileInput,
  type NotesReadFileResult,
  type NotesWriteFileInput,
  type NotesWriteFileResult,
  type NotesSearchFilesInput,
  type NotesSearchFilesResult
} from '@pipiclaw/shared/rpc/notes'
import {
  CHAT_STREAM_ABORT_CHANNEL,
  CHAT_STREAM_EVENT_CHANNEL,
  CHAT_SESSION_LOAD_CHANNEL,
  CHAT_SESSION_SAVE_CHANNEL,
  CHAT_STREAM_START_CHANNEL,
  chatSessionLoadInputSchema,
  chatSessionLoadResultSchema,
  chatSessionSaveInputSchema,
  chatSessionSaveResultSchema,
  chatStreamAbortInputSchema,
  chatStreamEventPayloadSchema,
  chatStreamStartInputSchema,
  chatStreamStartResultSchema,
  type ChatSessionLoadInput,
  type ChatSessionLoadResult,
  type ChatSessionSaveInput,
  type ChatSessionSaveResult,
  type ChatStreamAbortInput,
  type ChatStreamEventPayload,
  type ChatStreamStartInput,
  type ChatStreamStartResult
} from '@pipiclaw/shared/rpc/chat'
import {
  SETTINGS_GET_CHANNEL,
  SETTINGS_RESET_CHANNEL,
  SETTINGS_RESOLVE_ACTIVE_MODEL_CHANNEL,
  SETTINGS_UPDATE_CHANNEL,
  appSettingsResolveActiveModelResultSchema,
  appSettingsResultSchema,
  appSettingsUpdateInputSchema,
  type AppSettingsResolveActiveModelResult,
  type AppSettingsResult,
  type AppSettingsUpdateInput
} from '@pipiclaw/shared/rpc/settings'
import {
  IMAGEN_GENERATE_CHANNEL,
  imagenGenerateInputSchema,
  imagenGenerateResultSchema,
  type ImagenGenerateInput,
  type ImagenGenerateResult
} from '@pipiclaw/shared/rpc/imagen'

// Custom APIs for renderer
const api = {
  notes: {
    listFiles: async (input?: NotesListFilesInput): Promise<NotesListFilesResult> => {
      const parsedInput = notesListFilesInputSchema.parse(input ?? {})
      const result = await ipcRenderer.invoke(NOTES_LIST_FILES_CHANNEL, parsedInput)
      return notesListFilesResultSchema.parse(result)
    },
    readFile: async (input: NotesReadFileInput): Promise<NotesReadFileResult> => {
      const parsedInput = notesReadFileInputSchema.parse(input)
      const result = await ipcRenderer.invoke(NOTES_READ_FILE_CHANNEL, parsedInput)
      return notesReadFileResultSchema.parse(result)
    },
    writeFile: async (input: NotesWriteFileInput): Promise<NotesWriteFileResult> => {
      const parsedInput = notesWriteFileInputSchema.parse(input)
      const result = await ipcRenderer.invoke(NOTES_WRITE_FILE_CHANNEL, parsedInput)
      return notesWriteFileResultSchema.parse(result)
    },
    readAsset: async (input: NotesReadAssetInput): Promise<NotesReadAssetResult> => {
      const parsedInput = notesReadAssetInputSchema.parse(input)
      const result = await ipcRenderer.invoke(NOTES_READ_ASSET_CHANNEL, parsedInput)
      return notesReadAssetResultSchema.parse(result)
    },
    searchFiles: async (input: NotesSearchFilesInput): Promise<NotesSearchFilesResult> => {
      const parsedInput = notesSearchFilesInputSchema.parse(input)
      const result = await ipcRenderer.invoke(NOTES_SEARCH_FILES_CHANNEL, parsedInput)
      return notesSearchFilesResultSchema.parse(result)
    },
    onFilesChanged: (listener: (payload: NotesFilesChangedPayload) => void): (() => void) => {
      const wrapped = (_event: unknown, rawPayload: unknown): void => {
        try {
          const payload = notesFilesChangedPayloadSchema.parse(rawPayload)
          listener(payload)
        } catch (error) {
          console.error('Invalid notes:files-changed payload', error)
        }
      }

      ipcRenderer.on(NOTES_FILES_CHANGED_CHANNEL, wrapped)
      return () => {
        ipcRenderer.removeListener(NOTES_FILES_CHANGED_CHANNEL, wrapped)
      }
    }
  },
  settings: {
    get: async (): Promise<AppSettingsResult> => {
      const result = await ipcRenderer.invoke(SETTINGS_GET_CHANNEL)
      return appSettingsResultSchema.parse(result)
    },
    update: async (input: AppSettingsUpdateInput): Promise<AppSettingsResult> => {
      const parsedInput = appSettingsUpdateInputSchema.parse(input)
      const result = await ipcRenderer.invoke(SETTINGS_UPDATE_CHANNEL, parsedInput)
      return appSettingsResultSchema.parse(result)
    },
    reset: async (): Promise<AppSettingsResult> => {
      const result = await ipcRenderer.invoke(SETTINGS_RESET_CHANNEL)
      return appSettingsResultSchema.parse(result)
    },
    resolveActiveModel: async (): Promise<AppSettingsResolveActiveModelResult> => {
      const result = await ipcRenderer.invoke(SETTINGS_RESOLVE_ACTIVE_MODEL_CHANNEL)
      return appSettingsResolveActiveModelResultSchema.parse(result)
    }
  },
  chat: {
    startStream: async (input: ChatStreamStartInput): Promise<ChatStreamStartResult> => {
      const parsedInput = chatStreamStartInputSchema.parse(input)
      const result = await ipcRenderer.invoke(CHAT_STREAM_START_CHANNEL, parsedInput)
      return chatStreamStartResultSchema.parse(result)
    },
    abortStream: async (input: ChatStreamAbortInput): Promise<void> => {
      const parsedInput = chatStreamAbortInputSchema.parse(input)
      await ipcRenderer.invoke(CHAT_STREAM_ABORT_CHANNEL, parsedInput)
    },
    onStreamEvent: (listener: (payload: ChatStreamEventPayload) => void): (() => void) => {
      const wrapped = (_event: unknown, rawPayload: unknown): void => {
        try {
          const payload = chatStreamEventPayloadSchema.parse(rawPayload)
          listener(payload)
        } catch (error) {
          console.error('Invalid chat:stream:event payload', error)
        }
      }

      ipcRenderer.on(CHAT_STREAM_EVENT_CHANNEL, wrapped)
      return () => {
        ipcRenderer.removeListener(CHAT_STREAM_EVENT_CHANNEL, wrapped)
      }
    },
    loadSession: async (input: ChatSessionLoadInput): Promise<ChatSessionLoadResult> => {
      const parsedInput = chatSessionLoadInputSchema.parse(input)
      const result = await ipcRenderer.invoke(CHAT_SESSION_LOAD_CHANNEL, parsedInput)
      return chatSessionLoadResultSchema.parse(result)
    },
    saveSession: async (input: ChatSessionSaveInput): Promise<ChatSessionSaveResult> => {
      const parsedInput = chatSessionSaveInputSchema.parse(input)
      const result = await ipcRenderer.invoke(CHAT_SESSION_SAVE_CHANNEL, parsedInput)
      return chatSessionSaveResultSchema.parse(result)
    }
  },
  imagen: {
    generate: async (input: ImagenGenerateInput): Promise<ImagenGenerateResult> => {
      const parsedInput = imagenGenerateInputSchema.parse(input)
      const result = await ipcRenderer.invoke(IMAGEN_GENERATE_CHANNEL, parsedInput)
      return imagenGenerateResultSchema.parse(result)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
