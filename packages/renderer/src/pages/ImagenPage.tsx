import { Download, LoaderCircle, WandSparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CanvasX6Preview } from '@renderer/components/CanvasX6Preview'
import { NavigationRail } from '@renderer/components/NavigationRail'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { parseCanvasContent, type CanvasNodeType, type CanvasSide } from '@renderer/lib/canvas'
import { invokeImagenGenerate } from '@renderer/lib/imagen'
import { invokeNotesReadFile, invokeNotesWriteFile } from '@renderer/lib/notes'
import { invokeSettingsGet, invokeSettingsUpdate } from '@renderer/lib/settings'
import { cn } from '@renderer/lib/utils'

type AspectRatio = '1:1' | '16:9' | '9:16'

type GeneratedImageItem = {
  id: string
  prompt: string
  aspectRatio: AspectRatio
  previewUrl: string
  mediaType: string
  createdAt: string
}

type ImagenCanvasNode = {
  id: string
  type: CanvasNodeType
  x: number
  y: number
  width: number
  height: number
  text?: string
  color?: string
  image?: string
  url?: string
  file?: string
}

type ImagenCanvasEdge = {
  id: string
  fromNode: string
  toNode: string
  fromSide?: CanvasSide
  toSide?: CanvasSide
  label?: string
  color?: string
}

type ImagenCanvasDocument = {
  nodes: ImagenCanvasNode[]
  edges: ImagenCanvasEdge[]
}

type ImagenRuntimeConfig = {
  bearerToken: string
  baseUrl: string
  modelId: string
}

const aspectRatioOptions: Array<{ value: AspectRatio; label: string }> = [
  { value: '1:1', label: '1:1（方图）' },
  { value: '16:9', label: '16:9（横图）' },
  { value: '9:16', label: '9:16（竖图）' }
]

const canvasNodes = [
  { id: 'topic', title: '主题', summary: '确定要表达的信息焦点。', x: 88, y: 96, color: '4' },
  { id: 'style', title: '风格', summary: '选择视觉语言与色调。', x: 356, y: 228, color: '5' },
  { id: 'copy', title: '文案', summary: '提炼关键词和标题文案。', x: 622, y: 116, color: '3' },
  { id: 'prompt', title: 'Prompt', summary: '组合结构化提示词。', x: 622, y: 402, color: '2' },
  { id: 'output', title: '输出', summary: '生成并筛选最终图片。', x: 356, y: 534, color: '6' }
] as const

const unifiedHeaderClass = 'border-b border-border/70 bg-card/70 text-foreground'
const googleProviderName = 'Google Gemini API'
const defaultGoogleImageModel = 'gemini-3-pro-image-preview'
const defaultGoogleBaseUrl = 'https://generativelanguage.googleapis.com'
const imagenCanvasRelativePath = 'imagen/board.canvas'

function createBaseCanvasDocument(): ImagenCanvasDocument {
  const workflowNodes: ImagenCanvasNode[] = canvasNodes.map((node) => ({
    id: node.id,
    type: 'text',
    text: `${node.title}\n${node.summary}`,
    x: node.x,
    y: node.y,
    width: 232,
    height: 112,
    color: node.color
  }))

  const workflowEdges: ImagenCanvasEdge[] = canvasNodes.slice(1).map((node, index) => {
    const previousNode = canvasNodes[index]
    return {
      id: `${previousNode.id}-${node.id}`,
      fromNode: previousNode.id,
      toNode: node.id,
      toSide: 'left',
      color: '5'
    }
  })

  return {
    nodes: workflowNodes,
    edges: workflowEdges
  }
}

function getCanvasResultPosition(index: number): { left: number; top: number } {
  const column = index % 2
  const row = Math.floor(index / 2)
  return {
    left: 900 + column * 300,
    top: 120 + row * 230
  }
}

function stringifyCanvasDocument(document: ImagenCanvasDocument): string {
  return JSON.stringify(document, null, 2)
}

function parseStoredCanvasDocument(content: string): ImagenCanvasDocument | null {
  const parsed = parseCanvasContent(content)
  if (parsed.error || !parsed.document) return null

  return {
    nodes: parsed.document.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      text: node.label,
      color: node.color,
      image: node.image,
      url: node.url,
      file: node.filePath
    })),
    edges: parsed.document.edges.map((edge) => ({
      id: edge.id,
      fromNode: edge.fromNode,
      toNode: edge.toNode,
      fromSide: edge.fromSide,
      toSide: edge.toSide,
      label: edge.label,
      color: edge.color
    }))
  }
}

function statusBadgeClass(isGenerating: boolean, hasResults: boolean): string {
  if (isGenerating) return 'bg-primary/12 text-primary'
  if (hasResults) return 'bg-accent/35 text-accent-foreground'
  return 'bg-muted text-muted-foreground'
}

function getFileExtensionFromMediaType(mediaType: string): string {
  if (mediaType === 'image/png') return 'png'
  if (mediaType === 'image/jpeg') return 'jpg'
  if (mediaType === 'image/webp') return 'webp'
  const fallback = mediaType.split('/')[1]
  return fallback || 'png'
}

export function ImagenPage(): React.JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [count, setCount] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<GeneratedImageItem[]>([])
  const [runtimeModelId, setRuntimeModelId] = useState(defaultGoogleImageModel)
  const [imagenConfig, setImagenConfig] = useState<ImagenRuntimeConfig>({
    bearerToken: '',
    baseUrl: defaultGoogleBaseUrl,
    modelId: defaultGoogleImageModel
  })
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMessage, setConfigMessage] = useState<string | null>(null)
  const [configMessageType, setConfigMessageType] = useState<'success' | 'error' | null>(null)
  const [canvasDocument, setCanvasDocument] = useState<ImagenCanvasDocument>(() =>
    createBaseCanvasDocument()
  )
  const [hasLoadedCanvas, setHasLoadedCanvas] = useState(false)
  const persistTimerRef = useRef<number | null>(null)

  const generationStatus = useMemo(() => {
    if (isGenerating) return '生成中'
    if (results.length > 0) return '已生成'
    return '待生成'
  }, [isGenerating, results.length])
  const canvasContent = useMemo(() => stringifyCanvasDocument(canvasDocument), [canvasDocument])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const result = await invokeSettingsGet()
        if (cancelled) return

        const nextConfig: ImagenRuntimeConfig = {
          bearerToken: result.settings.imagen.bearerToken,
          baseUrl: result.settings.imagen.baseUrl,
          modelId: result.settings.imagen.modelId
        }
        setImagenConfig(nextConfig)
        setRuntimeModelId(nextConfig.modelId || defaultGoogleImageModel)
      } catch (cause) {
        if (cancelled) return
        setConfigMessageType('error')
        setConfigMessage(cause instanceof Error ? cause.message : '加载 Imagen 配置失败')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const readResult = await invokeNotesReadFile({
        relativePath: imagenCanvasRelativePath,
        maxChars: 200000
      })
      if (cancelled) return

      if (!readResult.error) {
        const storedDocument = parseStoredCanvasDocument(readResult.content)
        if (storedDocument) {
          setCanvasDocument(storedDocument)
        }
      }

      setHasLoadedCanvas(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedCanvas) return

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
    }

    persistTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const writeResult = await invokeNotesWriteFile({
          relativePath: imagenCanvasRelativePath,
          content: stringifyCanvasDocument(canvasDocument)
        })

        if (writeResult.error) {
          console.error('保存 Imagen canvas 失败:', writeResult.error)
        }
      })()
    }, 250)

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [canvasDocument, hasLoadedCanvas])

  const handleSaveConfig = useCallback(async (): Promise<void> => {
    const normalizedConfig: ImagenRuntimeConfig = {
      bearerToken: imagenConfig.bearerToken.trim(),
      baseUrl: imagenConfig.baseUrl.trim() || defaultGoogleBaseUrl,
      modelId: imagenConfig.modelId.trim() || defaultGoogleImageModel
    }

    setSavingConfig(true)
    setConfigMessage(null)
    setConfigMessageType(null)
    try {
      const updateResult = await invokeSettingsUpdate({
        imagen: normalizedConfig
      })

      const persistedConfig: ImagenRuntimeConfig = {
        bearerToken: updateResult.settings.imagen.bearerToken,
        baseUrl: updateResult.settings.imagen.baseUrl,
        modelId: updateResult.settings.imagen.modelId
      }
      setImagenConfig(persistedConfig)
      setRuntimeModelId(persistedConfig.modelId || defaultGoogleImageModel)

      if (updateResult.error) {
        setConfigMessageType('error')
        setConfigMessage(updateResult.error)
      } else {
        setConfigMessageType('success')
        setConfigMessage('Imagen 配置已保存')
      }
    } catch (cause) {
      setConfigMessageType('error')
      setConfigMessage(cause instanceof Error ? cause.message : '保存 Imagen 配置失败')
    } finally {
      setSavingConfig(false)
    }
  }, [imagenConfig])

  const handleGenerate = useCallback(async (): Promise<void> => {
    const normalizedPrompt = prompt.trim()
    const normalizedCount = Math.max(1, Math.min(4, Math.floor(count || 1)))

    if (!normalizedPrompt) {
      setError('请先输入 Prompt，再执行生成。')
      return
    }

    setError(null)
    setIsGenerating(true)
    try {
      const generationResult = await invokeImagenGenerate({
        prompt: normalizedPrompt,
        aspectRatio,
        count: normalizedCount
      })
      if (generationResult.error) {
        throw new Error(generationResult.error)
      }

      const now = Date.now()
      const createdItems = generationResult.images.map((image, index) => ({
        id: `${now}-${index + 1}`,
        prompt: normalizedPrompt,
        aspectRatio,
        previewUrl: image.dataUrl,
        mediaType: image.mediaType,
        createdAt: new Date(now + index).toLocaleTimeString('zh-CN', { hour12: false })
      }))
      if (createdItems.length === 0) {
        throw new Error('图片生成服务未返回结果，请稍后重试。')
      }

      setRuntimeModelId(generationResult.modelId || defaultGoogleImageModel)

      setResults((previous) => [...createdItems, ...previous].slice(0, 16))
      setCanvasDocument((previous) => {
        const existingImageCount = previous.nodes.filter((node) => node.type === 'image').length
        const generatedNodes: ImagenCanvasNode[] = createdItems.map((item, index) => {
          const position = getCanvasResultPosition(existingImageCount + index)
          const promptPreview =
            item.prompt.length > 40 ? `${item.prompt.slice(0, 40)}...` : item.prompt

          return {
            id: `image-${item.id}`,
            type: 'image',
            text: `图像 ${existingImageCount + index + 1} · ${item.aspectRatio}\n${promptPreview}`,
            x: position.left,
            y: position.top,
            width: 264,
            height: 188,
            color: '1',
            image: item.previewUrl
          }
        })

        return {
          nodes: [...previous.nodes, ...generatedNodes],
          edges: previous.edges
        }
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '生成失败，请稍后重试。')
    } finally {
      setIsGenerating(false)
    }
  }, [aspectRatio, count, prompt])

  const handleNodeMoved = useCallback((payload: { id: string; x: number; y: number }): void => {
    setCanvasDocument((previous) => {
      let hasChanged = false
      const nextX = Math.round(payload.x)
      const nextY = Math.round(payload.y)
      const nodes = previous.nodes.map((node) => {
        if (node.id !== payload.id) return node
        if (node.x === nextX && node.y === nextY) return node
        hasChanged = true
        return { ...node, x: nextX, y: nextY }
      })

      if (!hasChanged) return previous
      return {
        nodes,
        edges: previous.edges
      }
    })
  }, [])

  const handleDownload = useCallback((item: GeneratedImageItem): void => {
    const extension = getFileExtensionFromMediaType(item.mediaType)
    const anchor = document.createElement('a')
    anchor.href = item.previewUrl
    anchor.download = `imagen-${item.id}.${extension}`
    anchor.click()
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="[-webkit-app-region:drag] h-8 shrink-0 border-b border-border/70 bg-card/70 px-2.5">
        <div className="flex h-full items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tracking-wide text-foreground">PiPiClaw 绘图工作台</span>
          <span>Canvas + Gemini</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto p-2">
        <div className="grid h-full w-full min-w-[1180px] grid-cols-[44px_minmax(0,1fr)_360px] gap-2">
          <NavigationRail />

          <Card className="h-full overflow-hidden">
            <div className="h-full overflow-auto bg-card p-2">
              <CanvasX6Preview
                canvasPath={imagenCanvasRelativePath}
                content={canvasContent}
                showSummary={false}
                editable
                autoFit={false}
                onNodeMoved={handleNodeMoved}
              />
            </div>
          </Card>

          <Card className="h-full overflow-hidden">
            <CardHeader className={cn(unifiedHeaderClass, 'gap-2')}>
              <CardTitle className="text-base">当前对话</CardTitle>
            </CardHeader>

            <CardContent className="flex h-full min-h-0 flex-col gap-3 p-3">
              <div className="rounded-md border border-border/80 bg-card/70 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Provider</span>
                  <Badge variant="outline">{googleProviderName}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  模型：<span className="font-medium text-foreground">{runtimeModelId}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  状态：
                  <span
                    className={cn(
                      'ml-1 rounded px-1.5 py-0.5 text-[11px]',
                      statusBadgeClass(isGenerating, results.length > 0)
                    )}
                  >
                    {generationStatus}
                  </span>
                </p>
              </div>

              <div className="space-y-2 rounded-md border border-border/80 bg-card/70 p-2.5">
                <p className="text-xs font-medium text-foreground">连接配置（Bearer）</p>
                <div className="space-y-1">
                  <Label htmlFor="imagen-base-url">Base URL</Label>
                  <Input
                    id="imagen-base-url"
                    value={imagenConfig.baseUrl}
                    onChange={(event) =>
                      setImagenConfig((prev) => ({ ...prev, baseUrl: event.target.value }))
                    }
                    placeholder={defaultGoogleBaseUrl}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imagen-model-id">Model ID</Label>
                  <Input
                    id="imagen-model-id"
                    value={imagenConfig.modelId}
                    onChange={(event) =>
                      setImagenConfig((prev) => ({ ...prev, modelId: event.target.value }))
                    }
                    placeholder={defaultGoogleImageModel}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imagen-bearer-token">Bearer Token</Label>
                  <Input
                    id="imagen-bearer-token"
                    type="password"
                    value={imagenConfig.bearerToken}
                    onChange={(event) =>
                      setImagenConfig((prev) => ({ ...prev, bearerToken: event.target.value }))
                    }
                    placeholder="sk-***"
                  />
                </div>
                {configMessage ? (
                  <p
                    className={cn(
                      'text-xs',
                      configMessageType === 'error' ? 'text-destructive' : 'text-emerald-600'
                    )}
                  >
                    {configMessage}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleSaveConfig()}
                  disabled={savingConfig}
                >
                  {savingConfig ? '保存中...' : '保存配置'}
                </Button>
              </div>

              <div className="space-y-1">
                <Label htmlFor="imagen-prompt">Prompt</Label>
                <Textarea
                  id="imagen-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="例如：一张科技感信息图，主题是 AI 工作流，蓝橙配色，层级清晰。"
                  className="min-h-28"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="imagen-aspect">比例</Label>
                  <select
                    id="imagen-aspect"
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}
                    className="border-input bg-input/20 focus-visible:border-ring focus-visible:ring-ring/30 flex h-8 w-full rounded-md border px-2 text-xs outline-none focus-visible:ring-2"
                  >
                    {aspectRatioOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="imagen-count">数量</Label>
                  <Input
                    id="imagen-count"
                    type="number"
                    min={1}
                    max={4}
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                  />
                </div>
              </div>

              {error ? <p className="text-xs text-destructive">{error}</p> : null}

              <Button
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="gap-1.5"
              >
                {isGenerating ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <WandSparkles className="size-4" />
                )}
                {isGenerating ? '生成中...' : '开始生成'}
              </Button>

              <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded-md border border-border/70 bg-card/40 p-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>生成结果</span>
                  <span>{results.length} 张</span>
                </div>

                {results.length === 0 ? (
                  <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    暂无结果，先在上方输入 Prompt。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {results.map((item) => (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-md border border-border/80 bg-card/70"
                      >
                        <img
                          src={item.previewUrl}
                          alt={item.prompt}
                          className="h-32 w-full object-cover"
                        />
                        <div className="space-y-1 p-2">
                          <p className="line-clamp-2 text-xs text-foreground">{item.prompt}</p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>
                              {item.aspectRatio} · {item.createdAt}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => handleDownload(item)}
                            >
                              <Download className="size-3" />
                              下载
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
