export type CanvasSide = 'top' | 'right' | 'bottom' | 'left'

export type CanvasNodeType = 'text' | 'file' | 'link' | 'group' | 'image' | 'unknown'

export type ParsedCanvasNode = {
  id: string
  type: CanvasNodeType
  x: number
  y: number
  width: number
  height: number
  label: string
  color?: string
  filePath?: string
  url?: string
  image?: string
}

export type ParsedCanvasEdge = {
  id: string
  fromNode: string
  toNode: string
  fromSide?: CanvasSide
  toSide?: CanvasSide
  label?: string
  color?: string
}

export type ParsedCanvasDocument = {
  nodes: ParsedCanvasNode[]
  edges: ParsedCanvasEdge[]
}

const VALID_SIDES = new Set<CanvasSide>(['top', 'right', 'bottom', 'left'])

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeNodeType(value: unknown): CanvasNodeType {
  const type = toString(value).toLowerCase()
  if (
    type === 'text' ||
    type === 'file' ||
    type === 'link' ||
    type === 'group' ||
    type === 'image'
  ) {
    return type
  }
  return 'unknown'
}

function normalizeSide(value: unknown): CanvasSide | undefined {
  if (typeof value !== 'string') return undefined
  return VALID_SIDES.has(value as CanvasSide) ? (value as CanvasSide) : undefined
}

function defaultNodeLabel(type: CanvasNodeType, id: string): string {
  if (type === 'group') return 'Untitled Group'
  if (type === 'file') return 'Untitled File'
  if (type === 'link') return 'Untitled Link'
  if (type === 'image') return 'Untitled Image'
  if (type === 'text') return 'Untitled Text'
  return id || 'Untitled'
}

function normalizePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/')
  const stack: string[] = []

  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (stack.length > 0) stack.pop()
      continue
    }
    stack.push(segment)
  }

  return stack.join('/')
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '' : normalized.slice(0, index)
}

export function resolveCanvasFilePath(canvasPath: string, rawFilePath: string): string {
  const filePath = rawFilePath.trim().replace(/\\/g, '/')
  if (!filePath) return ''

  if (filePath.startsWith('/')) {
    return normalizePath(filePath.slice(1))
  }

  const baseDir = dirname(canvasPath)
  const joined = baseDir ? `${baseDir}/${filePath}` : filePath
  return normalizePath(joined)
}

export function isEmbeddableUrl(value: string): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseCanvasContent(rawContent: string): {
  document: ParsedCanvasDocument | null
  error: string | null
} {
  const content = rawContent.trim()
  if (!content) {
    return {
      document: {
        nodes: [],
        edges: []
      },
      error: null
    }
  }

  let parsed: { nodes?: unknown; edges?: unknown }

  try {
    parsed = JSON.parse(content) as { nodes?: unknown; edges?: unknown }
  } catch {
    return {
      document: null,
      error: 'Canvas 不是有效 JSON，无法预览。'
    }
  }

  if (!Array.isArray(parsed.nodes)) {
    return {
      document: null,
      error: 'Canvas 数据缺少 nodes 数组。'
    }
  }

  const nodes: ParsedCanvasNode[] = []
  for (const rawNode of parsed.nodes) {
    const node = rawNode as Record<string, unknown>
    const id = toString(node.id)
    if (!id) continue

    const type = normalizeNodeType(node.type)
    const text = toString(node.text)
    const filePath = toString(node.file)
    const linkUrl = toString(node.url)
    const imageUrl = toString(node.image)
    const groupLabel = toString(node.label)
    const label =
      text || filePath || linkUrl || imageUrl || groupLabel || defaultNodeLabel(type, id)

    nodes.push({
      id,
      type,
      x: toNumber(node.x, 0),
      y: toNumber(node.y, 0),
      width: Math.max(120, toNumber(node.width, 220)),
      height: Math.max(52, toNumber(node.height, type === 'group' ? 180 : 100)),
      label,
      color: toString(node.color) || undefined,
      filePath: filePath || undefined,
      url: linkUrl || undefined,
      image: imageUrl || undefined
    })
  }

  const nodeIds = new Set(nodes.map((node) => node.id))

  const edgesSource = Array.isArray(parsed.edges) ? parsed.edges : []
  const edges: ParsedCanvasEdge[] = []
  for (let index = 0; index < edgesSource.length; index += 1) {
    const edge = edgesSource[index] as Record<string, unknown>
    const id = toString(edge.id) || `edge-${index + 1}`
    const fromNode = toString(edge.fromNode)
    const toNode = toString(edge.toNode)
    if (!fromNode || !toNode || !nodeIds.has(fromNode) || !nodeIds.has(toNode)) continue

    edges.push({
      id,
      fromNode,
      toNode,
      fromSide: normalizeSide(edge.fromSide),
      toSide: normalizeSide(edge.toSide),
      label: toString(edge.label) || undefined,
      color: toString(edge.color) || undefined
    })
  }

  return {
    document: {
      nodes,
      edges
    },
    error: null
  }
}
