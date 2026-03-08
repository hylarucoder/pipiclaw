import { decompressFromBase64 } from 'lz-string'

export type ExcalidrawSceneData = {
  elements: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

const COMPRESSED_BLOCK_REGEX = /```compressed-json\s*([\s\S]*?)```/im
const JSON_BLOCK_REGEX = /```json\s*([\s\S]*?)```/im

function parseSceneLike(value: unknown): ExcalidrawSceneData | null {
  if (Array.isArray(value)) {
    return {
      elements: value,
      appState: {},
      files: {}
    }
  }

  if (!value || typeof value !== 'object') return null

  const scene = value as {
    elements?: unknown
    appState?: unknown
    files?: unknown
  }

  if (!Array.isArray(scene.elements)) return null

  return {
    elements: scene.elements,
    appState:
      scene.appState && typeof scene.appState === 'object'
        ? (scene.appState as Record<string, unknown>)
        : {},
    files: scene.files && typeof scene.files === 'object' ? (scene.files as Record<string, unknown>) : {}
  }
}

function parseJsonString(rawJson: string): ExcalidrawSceneData | null {
  try {
    return parseSceneLike(JSON.parse(rawJson))
  } catch {
    return null
  }
}

export function parseExcalidrawContent(rawContent: string): {
  scene: ExcalidrawSceneData | null
  error: string | null
} {
  const content = rawContent.trim()
  if (!content) {
    return { scene: null, error: '内容为空，无法渲染 Excalidraw。' }
  }

  const directScene = parseJsonString(content)
  if (directScene) {
    return { scene: directScene, error: null }
  }

  const compressedMatch = rawContent.match(COMPRESSED_BLOCK_REGEX)
  if (compressedMatch?.[1]) {
    const cleanedBase64 = compressedMatch[1].replace(/[\r\n]+/g, '')
    const decompressed = decompressFromBase64(cleanedBase64)
    if (!decompressed) {
      return { scene: null, error: '检测到 compressed-json，但解压失败。' }
    }

    const compressedScene = parseJsonString(decompressed)
    if (compressedScene) {
      return { scene: compressedScene, error: null }
    }
  }

  const jsonBlockMatch = rawContent.match(JSON_BLOCK_REGEX)
  if (jsonBlockMatch?.[1]) {
    const blockScene = parseJsonString(jsonBlockMatch[1].trim())
    if (blockScene) {
      return { scene: blockScene, error: null }
    }
  }

  return {
    scene: null,
    error: '未识别到可用的 Excalidraw 场景数据（json / compressed-json）。'
  }
}
