import { Paintbrush2, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { NavigationRail } from '@renderer/components/NavigationRail'
import { PiWebChatPanel } from '@renderer/components/PiWebChatPanel'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'

type DrawNode = {
  id: string
  title: string
  summary: string
  x: number
  y: number
  status: 'draft' | 'doing' | 'done'
  owner: string
}

const drawNodes: DrawNode[] = [
  {
    id: 'canvas-1',
    title: '入口概念草图',
    summary: '明确主视觉、信息入口和首屏层级。',
    x: 120,
    y: 110,
    status: 'done',
    owner: '设计'
  },
  {
    id: 'canvas-2',
    title: '功能节点拆解',
    summary: '拆成笔记、日记、画布、设置四块可复用模块。',
    x: 430,
    y: 220,
    status: 'doing',
    owner: '产品'
  },
  {
    id: 'canvas-3',
    title: '交互动效规划',
    summary: '定义拖拽、缩放、吸附、连线 hover 的反馈。',
    x: 760,
    y: 130,
    status: 'draft',
    owner: '前端'
  },
  {
    id: 'canvas-4',
    title: '聊天协作编排',
    summary: '在右侧对话里串联需求、方案、执行动作。',
    x: 770,
    y: 420,
    status: 'doing',
    owner: 'AI'
  },
  {
    id: 'canvas-5',
    title: '交付检查清单',
    summary: '对齐验收点：布局、路由、窗口行为、密度。',
    x: 420,
    y: 500,
    status: 'draft',
    owner: '协作'
  }
]

function drawStatusClass(status: DrawNode['status']): string {
  if (status === 'done') return 'bg-accent/30 text-accent-foreground'
  if (status === 'doing') return 'bg-primary/15 text-primary'
  return 'bg-muted text-muted-foreground'
}

const unifiedHeaderClass = 'border-b border-border/70 bg-card/70 text-foreground'

export function DrawStudioPage(): React.JSX.Element {
  const [chatVisible, setChatVisible] = useState(true)

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="[-webkit-app-region:drag] h-8 shrink-0 border-b border-border/70 bg-card/70 px-2.5">
        <div className="flex h-full items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tracking-wide text-foreground">PiPiClaw Draw Studio</span>
          <span>Canvas + Chat Workspace</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto p-2">
        <div
          className={cn(
            'grid h-full w-full gap-2',
            chatVisible
              ? 'min-w-[1148px] grid-cols-[44px_minmax(0,1fr)_360px]'
              : 'min-w-[900px] grid-cols-[44px_minmax(0,1fr)]'
          )}
        >
          <NavigationRail />

          <Card className="h-full overflow-hidden">
            <CardHeader className={cn(unifiedHeaderClass, 'gap-2')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Paintbrush2 className="size-4" />
                  </span>
                  <div>
                    <CardTitle>项目画布</CardTitle>
                    <CardDescription>可视化拆解节点、关系与交付路径</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatVisible((visible) => !visible)}
                  >
                    {chatVisible ? '隐藏聊天' : '显示聊天'}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Plus className="size-3.5" />
                    新节点
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex h-full min-h-0 flex-col p-0">
              <div className="flex items-center justify-between border-b border-border/70 bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                <span>项目: GUI 改造 /draw</span>
                <span>缩放 100%</span>
              </div>

              <div className="relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(120,130,170,0.24)_1px,transparent_0)] [background-size:18px_18px]">
                <div className="relative h-[820px] min-w-[1080px]">
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    {drawNodes.slice(1).map((node, index) => {
                      const prevNode = drawNodes[index]
                      return (
                        <line
                          key={`${prevNode.id}-${node.id}`}
                          x1={prevNode.x + 210}
                          y1={prevNode.y + 72}
                          x2={node.x + 10}
                          y2={node.y + 72}
                          stroke="rgba(126, 134, 177, 0.55)"
                          strokeWidth="1.5"
                        />
                      )
                    })}
                  </svg>

                  {drawNodes.map((node) => (
                    <article
                      key={node.id}
                      className="absolute w-[220px] rounded-md border border-border/80 bg-card/95 p-2.5 shadow-sm"
                      style={{ left: node.x, top: node.y }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge
                          className={cn('text-[10px] font-medium', drawStatusClass(node.status))}
                        >
                          {node.status === 'done'
                            ? '已完成'
                            : node.status === 'doing'
                              ? '进行中'
                              : '草稿'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{node.owner}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{node.title}</h4>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">
                        {node.summary}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {chatVisible && (
            <Card className="h-full overflow-hidden">
              <CardHeader className={cn(unifiedHeaderClass, 'gap-2')}>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  协作聊天（pi-web-ui）
                </CardTitle>
                <CardDescription>由 badlogic/pi-mono 的 web-ui 组件驱动</CardDescription>
              </CardHeader>
              <CardContent className="h-full min-h-0 p-0">
                <PiWebChatPanel />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
