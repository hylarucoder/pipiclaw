import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import {
  DEFAULT_NOTES_ROOT_DIR,
  appSettingsUpdateInputSchema,
  createDefaultAppSettings,
  mergeAppSettings,
  type AppSettings,
  type AppSettingsUpdateInput
} from '@pipiclaw/shared/rpc/settings'

const SETTINGS_FILE_NAME = 'settings.json'
const CANONICAL_USER_DATA_DIR = 'pipiclaw'
const LEGACY_ELECTRON_USER_DATA_DIR = 'Electron'

type SettingsListener = (next: AppSettings, previous: AppSettings) => void

let currentSettings: AppSettings | null = null
const listeners = new Set<SettingsListener>()

function resolveDefaultSettings(): AppSettings {
  return createDefaultAppSettings(process.env.PKM_NOTES_ROOT || DEFAULT_NOTES_ROOT_DIR)
}

function resolveCanonicalUserDataPath(): string {
  return join(app.getPath('appData'), CANONICAL_USER_DATA_DIR)
}

function ensureCanonicalUserDataPath(): void {
  const current = app.getPath('userData')
  const canonical = resolveCanonicalUserDataPath()
  if (current === canonical) return
  app.setPath('userData', canonical)
}

function getSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE_NAME)
}

function getLegacyElectronSettingsFilePath(): string | null {
  const legacyPath = join(app.getPath('appData'), LEGACY_ELECTRON_USER_DATA_DIR, SETTINGS_FILE_NAME)
  if (legacyPath === getSettingsFilePath()) return null
  return legacyPath
}

async function writeSettingsToDisk(settings: AppSettings): Promise<void> {
  const filePath = getSettingsFilePath()
  const directory = dirname(filePath)
  await mkdir(directory, { recursive: true })

  const tempPath = `${filePath}.tmp`
  const content = `${JSON.stringify(settings, null, 2)}\n`
  await writeFile(tempPath, content, 'utf8')
  await rename(tempPath, filePath)
}

async function readSettingsFromDisk(
  defaults: AppSettings
): Promise<{ settings: AppSettings; shouldRewrite: boolean }> {
  const filePath = getSettingsFilePath()
  const legacyPath = getLegacyElectronSettingsFilePath()
  let usedLegacySource = false

  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch {
    if (legacyPath) {
      try {
        raw = await readFile(legacyPath, 'utf8')
        usedLegacySource = true
      } catch {
        return { settings: defaults, shouldRewrite: true }
      }
    } else {
      return { settings: defaults, shouldRewrite: true }
    }
  }

  if (legacyPath && !usedLegacySource) {
    try {
      const [primaryStat, legacyStat] = await Promise.all([stat(filePath), stat(legacyPath)])
      if (legacyStat.mtimeMs > primaryStat.mtimeMs + 1000) {
        raw = await readFile(legacyPath, 'utf8')
        usedLegacySource = true
      }
    } catch {
      // ignore legacy override checks when either side is missing or unreadable
    }
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { settings: defaults, shouldRewrite: true }
  }

  const patchResult = appSettingsUpdateInputSchema.safeParse(data)
  if (!patchResult.success) {
    return { settings: defaults, shouldRewrite: true }
  }

  try {
    const merged = mergeAppSettings(defaults, patchResult.data)
    return { settings: merged, shouldRewrite: usedLegacySource }
  } catch {
    return { settings: defaults, shouldRewrite: true }
  }
}

function emitChange(next: AppSettings, previous: AppSettings): void {
  for (const listener of listeners) {
    listener(next, previous)
  }
}

export async function initSettingsStore(): Promise<AppSettings> {
  ensureCanonicalUserDataPath()
  const defaults = resolveDefaultSettings()
  const { settings, shouldRewrite } = await readSettingsFromDisk(defaults)

  currentSettings = settings

  if (shouldRewrite) {
    await writeSettingsToDisk(settings)
  }

  return settings
}

export function getAppSettings(): AppSettings {
  if (currentSettings) return currentSettings
  return resolveDefaultSettings()
}

export async function updateAppSettings(rawPatch: unknown): Promise<AppSettings> {
  const patch = appSettingsUpdateInputSchema.parse(rawPatch) as AppSettingsUpdateInput
  const previous = getAppSettings()
  const next = mergeAppSettings(previous, patch)
  await writeSettingsToDisk(next)
  currentSettings = next
  emitChange(next, previous)
  return next
}

export async function resetAppSettings(): Promise<AppSettings> {
  const previous = getAppSettings()
  const next = resolveDefaultSettings()
  await writeSettingsToDisk(next)
  currentSettings = next
  emitChange(next, previous)
  return next
}

export function onAppSettingsChanged(listener: SettingsListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
