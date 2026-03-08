import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'path'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { streamSimple } from '@mariozechner/pi-ai'
import {
  CHAT_STREAM_ABORT_CHANNEL,
  CHAT_SESSION_LOAD_CHANNEL,
  CHAT_SESSION_SAVE_CHANNEL,
  CHAT_STREAM_START_CHANNEL
} from '@pipiclaw/shared/rpc/chat'
import {
  DEFAULT_NOTES_FILE_LIMIT,
  DEFAULT_NOTES_SEARCH_LIMIT,
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
  type NotesFileItem,
  type NotesListFilesResult,
  type NotesReadAssetResult,
  type NotesReadFileResult,
  type NotesWriteFileResult,
  type NotesSearchFilesResult
} from '@pipiclaw/shared/rpc/notes'
import {
  DEFAULT_IMAGEN_BASE_URL,
  DEFAULT_IMAGEN_MODEL_ID,
  SETTINGS_GET_CHANNEL,
  SETTINGS_RESET_CHANNEL,
  SETTINGS_RESOLVE_ACTIVE_MODEL_CHANNEL,
  SETTINGS_UPDATE_CHANNEL,
  appSettingsResolveActiveModelResultSchema,
  appSettingsResultSchema
} from '@pipiclaw/shared/rpc/settings'
import {
  IMAGEN_GENERATE_CHANNEL,
  imagenGenerateInputSchema,
  imagenGenerateResultSchema,
  type ImagenGenerateResult
} from '@pipiclaw/shared/rpc/imagen'
import {
  getAppSettings,
  initSettingsStore,
  onAppSettingsChanged,
  resetAppSettings,
  updateAppSettings
} from './settings/store'
import { resolveActiveModelSummary } from './settings/modelResolver'
import { getChatSessionStorePath, loadChatSession, saveChatSession } from './chat/sessionStore'
import { createChatIpcHandlers } from './chat/ipcHandlers'
import { createMockAssistantStream } from './chat/mockStream'

let notesWatcher: FSWatcher | null = null
let watchedNotesRoot: string | null = null
const execFileAsync = promisify(execFile)
const useMockChatStream =
  process.env.PIPICLAW_MOCK_CHAT_STREAM === '1' || process.env.NODE_ENV === 'test'
const enableImagenDebugLog = process.env.PIPICLAW_IMAGEN_DEBUG === '1'
const defaultGoogleImageModel = DEFAULT_IMAGEN_MODEL_ID
const supportedGoogleImageModels = new Set([
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001',
  'imagen-4.0-fast-generate-001'
])
const googleImageModelAliasMap: Record<string, string> = {
  'gemini-3-pro-image': defaultGoogleImageModel
}

const rendererDevUrl = process.env['PIPICLAW_RENDERER_URL']

type GoogleGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        inlineData?: {
          mimeType?: string
          data?: string
        }
        inline_data?: {
          mime_type?: string
          data?: string
        }
      }>
    }
  }>
}

const chatIpcHandlers = createChatIpcHandlers({
  streamSimple: async (model, context, options) => {
    if (useMockChatStream) {
      return createMockAssistantStream(
        model as { api?: string; provider?: string; id?: string },
        context
      )
    }
    return await streamSimple(model as never, context as never, options as never)
  },
  loadSession: loadChatSession,
  saveSession: saveChatSession
})

function resolveGoogleBearerToken(rawToken: string): string {
  return rawToken.trim()
}

function normalizeGoogleImageModelId(rawModelId: string): string {
  let normalized = rawModelId.trim()
  if (!normalized) return defaultGoogleImageModel

  if (normalized.startsWith('google/')) {
    normalized = normalized.slice('google/'.length)
  }
  if (normalized.startsWith('models/')) {
    normalized = normalized.slice('models/'.length)
  }
  if (normalized.endsWith(':predict')) {
    normalized = normalized.slice(0, -':predict'.length)
  }
  if (normalized.endsWith(':generateContent')) {
    normalized = normalized.slice(0, -':generateContent'.length)
  }

  return googleImageModelAliasMap[normalized] ?? normalized
}

function resolveGoogleImageBaseUrl(rawBaseUrl: string): string {
  const normalizedRaw = rawBaseUrl.trim() || DEFAULT_IMAGEN_BASE_URL
  const withProtocol = normalizedRaw.startsWith('http') ? normalizedRaw : `https://${normalizedRaw}`
  return withProtocol.replace(/\/+$/g, '')
}

function resolveGoogleImageModel(rawModelId: string): string {
  const normalized = normalizeGoogleImageModelId(rawModelId)
  return normalized || defaultGoogleImageModel
}

function resolveImagenSettingsSnapshot(): {
  bearerToken: string
  baseUrl: string
  modelId: string
} {
  const imagenSettings = getAppSettings().imagen
  return {
    bearerToken: resolveGoogleBearerToken(imagenSettings.bearerToken),
    baseUrl: resolveGoogleImageBaseUrl(imagenSettings.baseUrl),
    modelId: resolveGoogleImageModel(imagenSettings.modelId)
  }
}

function buildGoogleGenerateContentUrl(baseUrl: string, modelId: string): string {
  if (baseUrl.endsWith('/v1beta')) {
    return `${baseUrl}/models/${modelId}:generateContent`
  }
  return `${baseUrl}/v1beta/models/${modelId}:generateContent`
}

function extractImagesFromGenerateContentResponse(
  payload: GoogleGenerateContentResponse
): Array<{ mediaType: string; base64: string }> {
  const images: Array<{ mediaType: string; base64: string }> = []

  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const base64 = part.inlineData?.data || part.inline_data?.data
      if (!base64) continue
      images.push({
        mediaType: part.inlineData?.mimeType || part.inline_data?.mime_type || 'image/png',
        base64
      })
    }
  }

  return images
}

function extractImageUrlsFromText(payload: GoogleGenerateContentResponse): string[] {
  const urls: string[] = []
  const markdownImageRegex = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g
  const plainImageRegex = /https?:\/\/[^\s)]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s)]*)?/gi

  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const text = part.text ?? ''
      if (!text) continue

      for (const match of text.matchAll(markdownImageRegex)) {
        if (match[1]) urls.push(match[1])
      }
      for (const match of text.matchAll(plainImageRegex)) {
        if (match[0]) urls.push(match[0])
      }
    }
  }

  return [...new Set(urls)]
}

function resolveMediaTypeFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('.png')) return 'image/png'
  if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return 'image/jpeg'
  if (lowerUrl.includes('.webp')) return 'image/webp'
  if (lowerUrl.includes('.gif')) return 'image/gif'
  return 'image/png'
}

async function fetchRemoteImageAsBase64(
  imageUrl: string
): Promise<{ mediaType: string; base64: string } | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error('[imagen] 拉取文本图片链接失败', {
        imageUrl,
        status: response.status,
        statusText: response.statusText
      })
      return null
    }

    const bytes = await response.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const rawContentType = response.headers.get('content-type') ?? ''
    const mediaTypeFromHeader = rawContentType.split(';')[0]?.trim()
    const mediaType = mediaTypeFromHeader || resolveMediaTypeFromUrl(imageUrl)

    return {
      mediaType,
      base64
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[imagen] 拉取文本图片链接异常', {
      imageUrl,
      error: message
    })
    return null
  }
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, max = 280): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function summarizeGoogleGenerateContentResponse(payload: GoogleGenerateContentResponse): {
  candidates: number
  partsPerCandidate: number[]
  imageParts: number
  imageUrlsInText: number
  imageUrlPreview: string[]
  textPreview: string[]
} {
  const partsPerCandidate: number[] = []
  let imageParts = 0
  const textPreview: string[] = []
  const imageUrlsInText = extractImageUrlsFromText(payload)

  for (const candidate of payload.candidates ?? []) {
    const parts = candidate.content?.parts ?? []
    partsPerCandidate.push(parts.length)

    for (const part of parts) {
      if (part.inlineData?.data || part.inline_data?.data) {
        imageParts += 1
      }
      const maybeText = part.text ? truncate(toSingleLine(part.text), 120) : ''
      if (maybeText) textPreview.push(maybeText)
    }
  }

  return {
    candidates: payload.candidates?.length ?? 0,
    partsPerCandidate,
    imageParts,
    imageUrlsInText: imageUrlsInText.length,
    imageUrlPreview: imageUrlsInText.slice(0, 3),
    textPreview: textPreview.slice(0, 3)
  }
}

async function generateWithGoogleBearer(
  baseUrl: string,
  modelId: string,
  token: string,
  input: { prompt: string; aspectRatio: '1:1' | '16:9' | '9:16'; count: number }
): Promise<Array<{ mediaType: string; base64: string }>> {
  if (!modelId.startsWith('gemini-')) {
    throw new Error('Bearer 模式当前仅支持 Gemini 图片模型（gemini-*）')
  }

  const url = buildGoogleGenerateContentUrl(baseUrl, modelId)
  const images: Array<{ mediaType: string; base64: string }> = []

  for (let index = 0; index < input.count; index += 1) {
    const requestBody = {
      contents: [
        {
          parts: [{ text: input.prompt }]
        }
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio: input.aspectRatio
        }
      }
    }

    if (enableImagenDebugLog) {
      console.info('[imagen] Google Bearer 发起请求', {
        url,
        modelId,
        requestIndex: index + 1,
        requestTotal: input.count,
        aspectRatio: requestBody.generationConfig.imageConfig.aspectRatio,
        responseModalities: requestBody.generationConfig.responseModalities
      })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const details = await response.text()
      console.error('[imagen] Google Bearer 请求失败', {
        status: response.status,
        statusText: response.statusText,
        url,
        modelId,
        aspectRatio: input.aspectRatio,
        promptPreview: truncate(toSingleLine(input.prompt), 120),
        responsePreview: truncate(toSingleLine(details), 400)
      })
      throw new Error(`Google Bearer 请求失败 (${response.status})：${details}`)
    }

    const payload = (await response.json()) as GoogleGenerateContentResponse
    const generatedImages = extractImagesFromGenerateContentResponse(payload)
    if (generatedImages.length === 0) {
      const imageUrlsInText = extractImageUrlsFromText(payload)
      if (imageUrlsInText.length > 0) {
        console.info('[imagen] 从文本中检测到图片链接，尝试拉取', {
          modelId,
          urlCount: imageUrlsInText.length,
          imageUrlPreview: imageUrlsInText.slice(0, 3)
        })
      }

      for (const imageUrl of imageUrlsInText) {
        const fetched = await fetchRemoteImageAsBase64(imageUrl)
        if (fetched) {
          generatedImages.push(fetched)
        }
      }
    }

    if (generatedImages.length === 0) {
      const responseSummary = summarizeGoogleGenerateContentResponse(payload)
      console.error('[imagen] Google Bearer 响应未包含可解析图片', {
        url,
        modelId,
        aspectRatio: input.aspectRatio,
        promptPreview: truncate(toSingleLine(input.prompt), 120),
        responseSummary
      })
      throw new Error('Google Bearer 响应中未返回图片数据')
    }
    images.push(...generatedImages)
  }

  return images.slice(0, input.count)
}

async function handleImagenGenerate(rawInput: unknown): Promise<ImagenGenerateResult> {
  const input = imagenGenerateInputSchema.parse(rawInput)
  const { bearerToken, modelId, baseUrl } = resolveImagenSettingsSnapshot()

  if (!supportedGoogleImageModels.has(modelId)) {
    return imagenGenerateResultSchema.parse({
      modelId,
      images: [],
      error: `仅支持 Google 图片模型：${Array.from(supportedGoogleImageModels).join(', ')}`
    })
  }

  if (!bearerToken) {
    return imagenGenerateResultSchema.parse({
      modelId,
      images: [],
      error: '缺少 Bearer Token，请先在 Imagen 页面配置后重试。'
    })
  }

  try {
    const generatedImages = await generateWithGoogleBearer(baseUrl, modelId, bearerToken, input)
    return imagenGenerateResultSchema.parse({
      modelId,
      images: generatedImages.map((image) => ({
        dataUrl: `data:${image.mediaType};base64,${image.base64}`,
        mediaType: image.mediaType
      }))
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片生成失败'
    return imagenGenerateResultSchema.parse({
      modelId,
      images: [],
      error: message
    })
  }
}

function getCurrentNotesRoot(): string {
  return getAppSettings().workspace.notesRootDir
}

async function listNotesFiles(rootDir: string, limit: number): Promise<NotesFileItem[]> {
  const queue = [rootDir]
  const files: {
    name: string
    relativePath: string
    extension: string
    size: number
    updatedAt: string
  }[] = []

  while (queue.length > 0 && files.length < limit) {
    const currentDir = queue.pop()
    if (!currentDir) break

    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (files.length >= limit) break
      if (entry.name.startsWith('.')) continue

      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        queue.push(fullPath)
        continue
      }
      if (!entry.isFile()) continue

      let fileStat: Awaited<ReturnType<typeof stat>>
      try {
        fileStat = await stat(fullPath)
      } catch {
        continue
      }

      files.push({
        name: entry.name,
        relativePath: relative(rootDir, fullPath),
        extension: extname(entry.name).replace('.', '').toLowerCase() || 'file',
        size: fileStat.size,
        updatedAt: fileStat.mtime.toISOString()
      })
    }
  }

  files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return files
}

async function handleListNotesFiles(rawInput: unknown): Promise<NotesListFilesResult> {
  const input = notesListFilesInputSchema.parse(rawInput ?? {})
  const rootDir = input.rootDir || getCurrentNotesRoot()
  const limit = input.limit ?? DEFAULT_NOTES_FILE_LIMIT

  try {
    const files = await listNotesFiles(rootDir, limit)
    return notesListFilesResultSchema.parse({
      rootDir,
      files,
      truncated: files.length >= limit
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list notes files'
    return notesListFilesResultSchema.parse({
      rootDir,
      files: [],
      truncated: false,
      error: message
    })
  }
}

function resolveSafeNotesPath(rootDir: string, relativePath: string): string {
  const normalizedRoot = resolve(rootDir)
  const resolvedPath = resolve(normalizedRoot, relativePath)
  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error('Invalid relative path')
  }
  return resolvedPath
}

async function handleReadNotesFile(rawInput: unknown): Promise<NotesReadFileResult> {
  const input = notesReadFileInputSchema.parse(rawInput)
  const rootDir = input.rootDir || getCurrentNotesRoot()
  const maxChars = input.maxChars ?? getAppSettings().preview.maxChars

  try {
    const filePath = resolveSafeNotesPath(rootDir, input.relativePath)
    const fullContent = await readFile(filePath, 'utf8')
    const truncated = fullContent.length > maxChars
    const content = truncated ? fullContent.slice(0, maxChars) : fullContent

    return notesReadFileResultSchema.parse({
      rootDir,
      relativePath: input.relativePath,
      content,
      truncated
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read notes file'
    return notesReadFileResultSchema.parse({
      rootDir,
      relativePath: input.relativePath,
      content: '',
      truncated: false,
      error: message
    })
  }
}

async function handleWriteNotesFile(rawInput: unknown): Promise<NotesWriteFileResult> {
  const input = notesWriteFileInputSchema.parse(rawInput)
  const rootDir = input.rootDir || getCurrentNotesRoot()
  let tempPath: string | null = null

  try {
    const filePath = resolveSafeNotesPath(rootDir, input.relativePath)
    await mkdir(dirname(filePath), { recursive: true })
    tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tempPath, input.content, 'utf8')
    await rename(tempPath, filePath)

    return notesWriteFileResultSchema.parse({
      rootDir,
      relativePath: input.relativePath
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to write notes file'
    try {
      if (tempPath) await unlink(tempPath)
    } catch {
      // Ignore temp cleanup errors.
    }
    return notesWriteFileResultSchema.parse({
      rootDir,
      relativePath: input.relativePath,
      error: message
    })
  }
}

function inferMimeTypeFromRelativePath(relativePath: string): string {
  const extension = extname(relativePath).replace('.', '').toLowerCase()
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'svg') return 'image/svg+xml'
  if (extension === 'bmp') return 'image/bmp'
  if (extension === 'avif') return 'image/avif'
  return 'application/octet-stream'
}

async function handleReadNotesAsset(rawInput: unknown): Promise<NotesReadAssetResult> {
  const input = notesReadAssetInputSchema.parse(rawInput)
  const rootDir = input.rootDir || getCurrentNotesRoot()
  const maxBytes = input.maxBytes ?? getAppSettings().preview.maxAssetBytes

  try {
    const filePath = resolveSafeNotesPath(rootDir, input.relativePath)
    const fileBuffer = await readFile(filePath)
    if (fileBuffer.byteLength > maxBytes) {
      return notesReadAssetResultSchema.parse({
        rootDir,
        relativePath: input.relativePath,
        error: `文件过大，超过预览限制 ${Math.floor(maxBytes / (1024 * 1024))}MB。`
      })
    }

    const mimeType = inferMimeTypeFromRelativePath(input.relativePath)
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`
    return notesReadAssetResultSchema.parse({
      rootDir,
      relativePath: input.relativePath,
      dataUrl
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read notes asset'
    return notesReadAssetResultSchema.parse({
      rootDir,
      relativePath: input.relativePath,
      error: message
    })
  }
}

async function searchNotesFilesWithRg(
  rootDir: string,
  query: string,
  limit: number
): Promise<{ files: NotesFileItem[]; truncated: boolean }> {
  const { stdout } = await execFileAsync('rg', ['--files', rootDir], {
    maxBuffer: 20 * 1024 * 1024
  })

  const lowerQuery = query.toLowerCase()
  const allMatches = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase().includes(lowerQuery))

  const truncated = allMatches.length > limit
  const files: Awaited<ReturnType<typeof listNotesFiles>> = []

  for (const line of allMatches.slice(0, limit)) {
    const fullPath = isAbsolute(line) ? line : resolve(rootDir, line)
    let fileStat: Awaited<ReturnType<typeof stat>>
    try {
      fileStat = await stat(fullPath)
    } catch {
      continue
    }
    if (!fileStat.isFile()) continue

    const relativePath = relative(rootDir, fullPath)
    const segments = relativePath.split('/').filter(Boolean)
    const name = segments[segments.length - 1]
    if (!name) continue

    files.push({
      name,
      relativePath,
      extension: extname(name).replace('.', '').toLowerCase() || 'file',
      size: fileStat.size,
      updatedAt: fileStat.mtime.toISOString()
    })
  }

  files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { files, truncated }
}

async function handleSearchNotesFiles(rawInput: unknown): Promise<NotesSearchFilesResult> {
  const input = notesSearchFilesInputSchema.parse(rawInput ?? {})
  const rootDir = input.rootDir || getCurrentNotesRoot()
  const query = input.query.trim()
  const limit = input.limit ?? DEFAULT_NOTES_SEARCH_LIMIT

  if (!query) {
    return notesSearchFilesResultSchema.parse({
      rootDir,
      query,
      files: [],
      truncated: false
    })
  }

  try {
    const { files, truncated } = await searchNotesFilesWithRg(rootDir, query, limit)
    return notesSearchFilesResultSchema.parse({
      rootDir,
      query,
      files,
      truncated
    })
  } catch {
    try {
      const files = await listNotesFiles(rootDir, DEFAULT_NOTES_FILE_LIMIT)
      const lowerQuery = query.toLowerCase()
      const matched = files.filter(
        (file) =>
          file.name.toLowerCase().includes(lowerQuery) ||
          file.relativePath.toLowerCase().includes(lowerQuery)
      )

      return notesSearchFilesResultSchema.parse({
        rootDir,
        query,
        files: matched.slice(0, limit),
        truncated: matched.length > limit
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search notes files'
      return notesSearchFilesResultSchema.parse({
        rootDir,
        query,
        files: [],
        truncated: false,
        error: message
      })
    }
  }
}

function stopNotesWatcher(): void {
  notesWatcher?.close()
  notesWatcher = null
  watchedNotesRoot = null
}

function startNotesWatcher(rootDir: string): void {
  if (notesWatcher && watchedNotesRoot === rootDir) return
  stopNotesWatcher()

  const notifyRenderer = (filename?: string): void => {
    const payload = notesFilesChangedPayloadSchema.parse({
      rootDir,
      filename
    })

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(NOTES_FILES_CHANGED_CHANNEL, payload)
      }
    }
  }

  const createWatcher = (recursive: boolean): FSWatcher => {
    const watcher = watch(rootDir, { recursive }, (_eventType, filename) => {
      notifyRenderer(typeof filename === 'string' ? filename : undefined)
    })

    watcher.on('error', (error) => {
      console.error('Notes watcher error:', error)
    })

    return watcher
  }

  try {
    notesWatcher = createWatcher(true)
    watchedNotesRoot = rootDir
  } catch {
    try {
      notesWatcher = createWatcher(false)
      watchedNotesRoot = rootDir
    } catch (error) {
      console.error('Failed to initialize notes watcher:', error)
    }
  }
}

function createWindow(): void {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f0e8',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay:
      process.platform === 'darwin'
        ? false
        : {
            color: '#f4f0e8',
            symbolColor: '#3c4057',
            height: 36
          },
    ...(process.platform === 'linux' ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (rendererDevUrl) {
    mainWindow.loadURL(rendererDevUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  try {
    await initSettingsStore()
  } catch (error) {
    console.error('Failed to initialize settings store:', error)
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle(SETTINGS_GET_CHANNEL, async () => {
    return appSettingsResultSchema.parse({
      settings: getAppSettings()
    })
  })
  ipcMain.handle(SETTINGS_UPDATE_CHANNEL, async (_event, rawInput) => {
    try {
      const settings = await updateAppSettings(rawInput)
      return appSettingsResultSchema.parse({
        settings
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存设置失败'
      return appSettingsResultSchema.parse({
        settings: getAppSettings(),
        error: message
      })
    }
  })
  ipcMain.handle(SETTINGS_RESET_CHANNEL, async () => {
    try {
      const settings = await resetAppSettings()
      return appSettingsResultSchema.parse({
        settings
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '重置设置失败'
      return appSettingsResultSchema.parse({
        settings: getAppSettings(),
        error: message
      })
    }
  })
  ipcMain.handle(SETTINGS_RESOLVE_ACTIVE_MODEL_CHANNEL, async () => {
    return appSettingsResolveActiveModelResultSchema.parse(
      resolveActiveModelSummary(getAppSettings())
    )
  })

  ipcMain.handle(CHAT_STREAM_START_CHANNEL, chatIpcHandlers.handleStartStream)
  ipcMain.handle(CHAT_STREAM_ABORT_CHANNEL, chatIpcHandlers.handleAbortStream)
  ipcMain.handle(CHAT_SESSION_LOAD_CHANNEL, chatIpcHandlers.handleLoadSession)
  ipcMain.handle(CHAT_SESSION_SAVE_CHANNEL, chatIpcHandlers.handleSaveSession)
  ipcMain.handle(IMAGEN_GENERATE_CHANNEL, async (_event, rawInput) => {
    try {
      return await handleImagenGenerate(rawInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片生成失败'
      const modelId = resolveImagenSettingsSnapshot().modelId
      return imagenGenerateResultSchema.parse({
        modelId,
        images: [],
        error: message
      })
    }
  })

  ipcMain.handle(NOTES_LIST_FILES_CHANNEL, async (_event, rawInput) => {
    try {
      return await handleListNotesFiles(rawInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list notes files'
      return notesListFilesResultSchema.parse({
        rootDir: getCurrentNotesRoot(),
        files: [],
        truncated: false,
        error: message
      })
    }
  })
  ipcMain.handle(NOTES_READ_FILE_CHANNEL, async (_event, rawInput) => {
    try {
      return await handleReadNotesFile(rawInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read notes file'
      const fallback = notesReadFileInputSchema.safeParse(rawInput ?? {})
      return notesReadFileResultSchema.parse({
        rootDir: getCurrentNotesRoot(),
        relativePath: fallback.success ? fallback.data.relativePath : '',
        content: '',
        truncated: false,
        error: message
      })
    }
  })
  ipcMain.handle(NOTES_WRITE_FILE_CHANNEL, async (_event, rawInput) => {
    try {
      return await handleWriteNotesFile(rawInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to write notes file'
      const fallback = notesWriteFileInputSchema.safeParse(rawInput ?? {})
      return notesWriteFileResultSchema.parse({
        rootDir: getCurrentNotesRoot(),
        relativePath: fallback.success ? fallback.data.relativePath : '',
        error: message
      })
    }
  })
  ipcMain.handle(NOTES_READ_ASSET_CHANNEL, async (_event, rawInput) => {
    try {
      return await handleReadNotesAsset(rawInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read notes asset'
      const fallback = notesReadAssetInputSchema.safeParse(rawInput ?? {})
      return notesReadAssetResultSchema.parse({
        rootDir: getCurrentNotesRoot(),
        relativePath: fallback.success ? fallback.data.relativePath : '',
        error: message
      })
    }
  })
  ipcMain.handle(NOTES_SEARCH_FILES_CHANNEL, async (_event, rawInput) => {
    try {
      return await handleSearchNotesFiles(rawInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search notes files'
      const fallback = notesSearchFilesInputSchema.safeParse(rawInput ?? {})
      return notesSearchFilesResultSchema.parse({
        rootDir: getCurrentNotesRoot(),
        query: fallback.success ? fallback.data.query : '',
        files: [],
        truncated: false,
        error: message
      })
    }
  })

  startNotesWatcher(getCurrentNotesRoot())
  try {
    console.info(`Chat sessions store path: ${getChatSessionStorePath()}`)
  } catch {
    // Ignore
  }
  onAppSettingsChanged((next, previous) => {
    if (next.workspace.notesRootDir !== previous.workspace.notesRootDir) {
      startNotesWatcher(next.workspace.notesRootDir)
    }
  })
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  chatIpcHandlers.abortAllStreams()
  stopNotesWatcher()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
