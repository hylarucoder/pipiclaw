import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  NotesFilesChangedPayload,
  NotesListFilesInput,
  NotesListFilesResult,
  NotesReadAssetInput,
  NotesReadAssetResult,
  NotesReadFileInput,
  NotesReadFileResult,
  NotesWriteFileInput,
  NotesWriteFileResult,
  NotesSearchFilesInput,
  NotesSearchFilesResult
} from '@pipiclaw/shared/rpc/notes'
import type {
  ChatSessionLoadInput,
  ChatSessionLoadResult,
  ChatSessionSaveInput,
  ChatSessionSaveResult,
  ChatStreamAbortInput,
  ChatStreamEventPayload,
  ChatStreamStartInput,
  ChatStreamStartResult
} from '@pipiclaw/shared/rpc/chat'
import type {
  AppSettingsResolveActiveModelResult,
  AppSettingsResult,
  AppSettingsUpdateInput
} from '@pipiclaw/shared/rpc/settings'
import type { ImagenGenerateInput, ImagenGenerateResult } from '@pipiclaw/shared/rpc/imagen'

type AppApi = {
  notes: {
    listFiles: (input?: NotesListFilesInput) => Promise<NotesListFilesResult>
    readFile: (input: NotesReadFileInput) => Promise<NotesReadFileResult>
    writeFile: (input: NotesWriteFileInput) => Promise<NotesWriteFileResult>
    readAsset: (input: NotesReadAssetInput) => Promise<NotesReadAssetResult>
    searchFiles: (input: NotesSearchFilesInput) => Promise<NotesSearchFilesResult>
    onFilesChanged: (listener: (payload: NotesFilesChangedPayload) => void) => () => void
  }
  settings: {
    get: () => Promise<AppSettingsResult>
    update: (input: AppSettingsUpdateInput) => Promise<AppSettingsResult>
    reset: () => Promise<AppSettingsResult>
    resolveActiveModel: () => Promise<AppSettingsResolveActiveModelResult>
  }
  chat: {
    startStream: (input: ChatStreamStartInput) => Promise<ChatStreamStartResult>
    abortStream: (input: ChatStreamAbortInput) => Promise<void>
    onStreamEvent: (listener: (payload: ChatStreamEventPayload) => void) => () => void
    loadSession: (input: ChatSessionLoadInput) => Promise<ChatSessionLoadResult>
    saveSession: (input: ChatSessionSaveInput) => Promise<ChatSessionSaveResult>
  }
  imagen: {
    generate: (input: ImagenGenerateInput) => Promise<ImagenGenerateResult>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
