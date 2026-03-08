import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  isEmbeddableUrl,
  parseCanvasContent,
  resolveCanvasFilePath,
  type CanvasSide,
  type ParsedCanvasEdge,
  type ParsedCanvasNode
} from '@renderer/lib/canvas'

type CanvasX6PreviewProps = {
  canvasPath: string
  content: string
  onOpenFile?: (path: string) => void
  showSummary?: boolean
  editable?: boolean
  autoFit?: boolean
  onNodeMoved?: (payload: { id: string; x: number; y: number }) => void
}

type CanvasFlowNodeData = {
  nodeType: ParsedCanvasNode['type']
  label: string
  openPath?: string
  url?: string
  image?: string
  embeddable: boolean
  editable: boolean
  theme: {
    fill: string
    stroke: string
    text: string
  }
}

type CanvasFlowNode = Node<CanvasFlowNodeData>
type CanvasFlowEdge = Edge

const FIXED_VIEWPORT_WIDTH = 1280

const OBSIDIAN_COLOR_MAP: Record<string, { fill: string; stroke: string }> = {
  '1': { fill: '#fee2e2', stroke: '#ef4444' },
  '2': { fill: '#ffedd5', stroke: '#f97316' },
  '3': { fill: '#fef9c3', stroke: '#eab308' },
  '4': { fill: '#dcfce7', stroke: '#22c55e' },
  '5': { fill: '#dbeafe', stroke: '#3b82f6' },
  '6': { fill: '#ede9fe', stroke: '#8b5cf6' }
}

const HIDDEN_HANDLE_STYLE = {
  width: 8,
  height: 8,
  opacity: 0,
  border: 'none',
  background: 'transparent'
} as const

function getNodeTheme(node: ParsedCanvasNode): { fill: string; stroke: string; text: string } {
  const palette = (node.color && OBSIDIAN_COLOR_MAP[node.color]) || null

  if (node.type === 'group') {
    return {
      fill: palette?.fill ?? '#f8fafc',
      stroke: palette?.stroke ?? '#94a3b8',
      text: '#1e293b'
    }
  }

  if (node.type === 'file') {
    return {
      fill: palette?.fill ?? '#f8fafc',
      stroke: palette?.stroke ?? '#3b82f6',
      text: '#0f172a'
    }
  }

  if (node.type === 'link') {
    return {
      fill: palette?.fill ?? '#eff6ff',
      stroke: palette?.stroke ?? '#60a5fa',
      text: '#0f172a'
    }
  }

  if (node.type === 'image') {
    return {
      fill: palette?.fill ?? '#f8fafc',
      stroke: palette?.stroke ?? '#38bdf8',
      text: '#0f172a'
    }
  }

  return {
    fill: palette?.fill ?? '#ffffff',
    stroke: palette?.stroke ?? '#cbd5e1',
    text: '#0f172a'
  }
}

function getEdgeStroke(edge: ParsedCanvasEdge): string {
  const palette = edge.color ? OBSIDIAN_COLOR_MAP[edge.color] : null
  return palette?.stroke ?? '#94a3b8'
}

function toSourceHandle(side?: CanvasSide): string {
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') {
    return `source-${side}`
  }
  return 'source-right'
}

function toTargetHandle(side?: CanvasSide): string {
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') {
    return `target-${side}`
  }
  return 'target-left'
}

function CanvasNodeCard({ data }: NodeProps<CanvasFlowNode>): React.JSX.Element {
  const radius = data.nodeType === 'group' ? 12 : 9
  const borderWidth = data.nodeType === 'group' ? 1.4 : 1.1
  const borderStyle = data.nodeType === 'group' ? 'dashed' : 'solid'

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        borderRadius: radius,
        borderWidth,
        borderStyle,
        borderColor: data.theme.stroke,
        background: data.theme.fill,
        color: data.theme.text
      }}
    >
      <Handle id="source-top" type="source" position={Position.Top} style={HIDDEN_HANDLE_STYLE} />
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        style={HIDDEN_HANDLE_STYLE}
      />
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        style={HIDDEN_HANDLE_STYLE}
      />
      <Handle id="source-left" type="source" position={Position.Left} style={HIDDEN_HANDLE_STYLE} />

      <Handle id="target-top" type="target" position={Position.Top} style={HIDDEN_HANDLE_STYLE} />
      <Handle
        id="target-right"
        type="target"
        position={Position.Right}
        style={HIDDEN_HANDLE_STYLE}
      />
      <Handle
        id="target-bottom"
        type="target"
        position={Position.Bottom}
        style={HIDDEN_HANDLE_STYLE}
      />
      <Handle id="target-left" type="target" position={Position.Left} style={HIDDEN_HANDLE_STYLE} />

      {data.nodeType === 'image' ? (
        <>
          {data.image ? (
            <img
              src={data.image}
              alt={data.label || 'image-node'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              暂无图片
            </div>
          )}
          {data.label ? (
            <div className="absolute right-1 bottom-1 max-w-[85%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
              {data.label}
            </div>
          ) : null}
        </>
      ) : data.embeddable ? (
        <>
          <div className="truncate border-b border-slate-300/60 bg-slate-100/75 px-2 py-1 text-xs font-semibold text-slate-900">
            {data.label}
          </div>
          <iframe
            src={data.url || ''}
            title={data.label || 'link-node'}
            className="h-full w-full flex-1 border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{ pointerEvents: data.editable ? 'none' : 'auto' }}
          />
        </>
      ) : (
        <div className="h-full whitespace-pre-wrap break-words px-3 py-2 text-xs leading-5">
          {data.label}
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  canvasNode: CanvasNodeCard
}

function createFlowNodes(
  nodes: ParsedCanvasNode[],
  canvasPath: string,
  editable: boolean
): CanvasFlowNode[] {
  return nodes.map((node) => {
    const resolvedFilePath = node.filePath ? resolveCanvasFilePath(canvasPath, node.filePath) : ''
    const embeddable = node.type === 'link' && isEmbeddableUrl(node.url || '')
    const theme = getNodeTheme(node)

    return {
      id: node.id,
      type: 'canvasNode',
      position: { x: node.x, y: node.y },
      draggable: editable,
      selectable: editable,
      data: {
        nodeType: node.type,
        label: node.label,
        openPath: resolvedFilePath || undefined,
        url: node.url,
        image: node.image,
        embeddable,
        editable,
        theme
      },
      style: {
        width: node.width,
        height: node.height,
        border: 'none',
        background: 'transparent',
        padding: 0
      }
    }
  })
}

function createFlowEdges(edges: ParsedCanvasEdge[]): CanvasFlowEdge[] {
  return edges.map((edge) => {
    const stroke = getEdgeStroke(edge)

    return {
      id: edge.id,
      source: edge.fromNode,
      target: edge.toNode,
      sourceHandle: toSourceHandle(edge.fromSide),
      targetHandle: toTargetHandle(edge.toSide),
      type: 'smoothstep',
      label: edge.label,
      style: {
        stroke,
        strokeWidth: 1.5
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke
      },
      labelStyle: {
        fill: '#334155',
        fontSize: 11
      }
    }
  })
}

export function CanvasX6Preview({
  canvasPath,
  content,
  onOpenFile,
  showSummary = true,
  editable = false,
  autoFit = true,
  onNodeMoved
}: CanvasX6PreviewProps): React.JSX.Element {
  const parsed = useMemo(() => parseCanvasContent(content), [content])
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<CanvasFlowNode>([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<CanvasFlowEdge>([])
  const reactFlowRef = useRef<ReactFlowInstance<CanvasFlowNode, CanvasFlowEdge> | null>(null)
  const hasAutoFittedRef = useRef(false)

  useEffect(() => {
    hasAutoFittedRef.current = false
  }, [canvasPath])

  useEffect(() => {
    const canvasDocument = parsed.document
    if (!canvasDocument) return

    setFlowNodes(createFlowNodes(canvasDocument.nodes, canvasPath, editable))
    setFlowEdges(createFlowEdges(canvasDocument.edges))
  }, [canvasPath, editable, parsed.document, setFlowEdges, setFlowNodes])

  useEffect(() => {
    if (!autoFit || hasAutoFittedRef.current || flowNodes.length === 0) return
    const flow = reactFlowRef.current
    if (!flow) return

    requestAnimationFrame(() => {
      if (hasAutoFittedRef.current || !reactFlowRef.current) return
      reactFlowRef.current.fitView({ padding: 0.2, maxZoom: 1 })
      hasAutoFittedRef.current = true
    })
  }, [autoFit, flowNodes.length])

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: CanvasFlowNode): void => {
      if (!editable || !onNodeMoved) return
      onNodeMoved({ id: node.id, x: Math.round(node.position.x), y: Math.round(node.position.y) })
    },
    [editable, onNodeMoved]
  )

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: CanvasFlowNode): void => {
      if (editable) return

      const openPath = typeof node.data.openPath === 'string' ? node.data.openPath : ''
      if (openPath && onOpenFile) {
        onOpenFile(openPath)
        return
      }

      const url = typeof node.data.url === 'string' ? node.data.url : ''
      if (url && !isEmbeddableUrl(url)) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [editable, onOpenFile]
  )

  if (parsed.error) {
    return (
      <div className="rounded-md border border-border/70 bg-card/70 p-3">
        <p className="text-sm text-destructive">{parsed.error}</p>
        <pre className="mt-2 max-h-[38vh] overflow-auto rounded-md border border-border/60 bg-background/70 p-2 text-xs whitespace-pre-wrap break-words">
          {content || '(空画布)'}
        </pre>
      </div>
    )
  }

  if (!parsed.document || parsed.document.nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">当前 Canvas 为空。</p>
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col gap-2">
      {showSummary ? (
        <p className="text-xs text-muted-foreground">
          节点 {parsed.document.nodes.length} · 连接 {parsed.document.edges.length} · 画布宽度固定{' '}
          {FIXED_VIEWPORT_WIDTH}px · 高度自适应 · 双击文件节点可在左侧继续打开预览 · 滚轮缩放
        </p>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-auto rounded-md border border-border/70 bg-background/70">
        <div
          className="mx-auto"
          style={{ width: FIXED_VIEWPORT_WIDTH, height: '100%', minHeight: '100%' }}
        >
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodeDoubleClick={handleNodeDoubleClick}
            onInit={(instance) => {
              reactFlowRef.current = instance
            }}
            nodeTypes={nodeTypes}
            nodesDraggable={editable}
            nodesConnectable={false}
            elementsSelectable={editable}
            edgesFocusable={false}
            edgesReconnectable={false}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            selectionOnDrag={editable}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(148, 163, 184, 0.22)" gap={20} size={1} />
            {editable ? (
              <MiniMap
                pannable
                zoomable
                style={{
                  width: 220,
                  height: 140,
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: 'rgba(255, 255, 255, 0.9)'
                }}
              />
            ) : null}
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
