import type { ProjectRecord } from './project-types'

export const seedProjects: ProjectRecord[] = [
  {
    id: 'project-file-hub',
    name: '文件工作台增强',
    summary: '统一文件树、预览、搜索和打开文件体验，保证高频操作路径顺滑。',
    status: 'active',
    risk: 'medium',
    progress: 68,
    weeklyGoal: '完成 Tab 管理与快捷操作闭环',
    owner: 'Lucas + AI',
    tags: ['Electron', 'UX', 'File Explorer'],
    updatedAt: '2026-02-28T15:40:00+08:00',
    updatedAtLabel: '今天 15:40',
    dueAt: '2026-03-04',
    dueAtLabel: '3 月 4 日',
    milestones: [
      { label: '文件树按目录展示', done: true },
      { label: '多媒体文件预览分流', done: true },
      { label: '多 Tab 打开/关闭管理', done: true },
      { label: '快捷键与右键菜单', done: false }
    ],
    nextActions: ['补齐 Tab 快捷键（Cmd/Ctrl+W）', '增加“关闭其他/关闭右侧”菜单', '优化超长文件名 Tab 展示']
  },
  {
    id: 'project-markdown-pipeline',
    name: 'Markdown 渲染管线迁移',
    summary: '从 rantnote 迁移统一的 markdown 渲染链路，替换 innerHTML 方案。',
    status: 'active',
    risk: 'low',
    progress: 82,
    weeklyGoal: '补完渲染细节和性能预热',
    owner: 'AI',
    tags: ['Markdown', 'Shiki', 'Security'],
    updatedAt: '2026-02-28T14:50:00+08:00',
    updatedAtLabel: '今天 14:50',
    dueAt: '2026-03-03',
    dueAtLabel: '3 月 3 日',
    milestones: [
      { label: '移除 dangerouslySetInnerHTML', done: true },
      { label: '接入 unified + remark + rehype', done: true },
      { label: '主题同步与样式一致性', done: false }
    ],
    nextActions: ['补 markdown anchor 跳转体验', '增加大文档滚动性能监测']
  },
  {
    id: 'project-dashboard-status',
    name: '项目状态仪表盘',
    summary: '搭建以项目追踪为核心的仪表盘，确保每天能看到进度、风险和下一步。',
    status: 'active',
    risk: 'medium',
    progress: 44,
    weeklyGoal: '完成项目列表 MVP 并接入真实数据',
    owner: 'Lucas',
    tags: ['Dashboard', 'Productivity'],
    updatedAt: '2026-02-28T16:05:00+08:00',
    updatedAtLabel: '今天 16:05',
    dueAt: '2026-03-07',
    dueAtLabel: '3 月 7 日',
    milestones: [
      { label: '定义状态模型', done: true },
      { label: '列表筛选和排序', done: false },
      { label: '详情面板与风险卡片', done: false }
    ],
    nextActions: ['对齐状态字段（进度/风险/阻塞）', '接入 Notes 中的决策记录']
  },
  {
    id: 'project-canvas-integration',
    name: 'Canvas 能力整合',
    summary: '打通 canvas 文件预览和 Draw Studio，建立“浏览 - 编辑”闭环。',
    status: 'blocked',
    risk: 'high',
    progress: 31,
    weeklyGoal: '确认 canvas schema 与渲染边界',
    owner: '前端',
    tags: ['Canvas', 'Graph'],
    updatedAt: '2026-02-27T21:10:00+08:00',
    updatedAtLabel: '昨天 21:10',
    dueAt: '2026-03-05',
    dueAtLabel: '3 月 5 日',
    blocker: 'Canvas JSON 结构存在多个历史版本，字段不一致。',
    milestones: [
      { label: '基础节点渲染', done: true },
      { label: '关系线与交互', done: false },
      { label: '编辑回写能力', done: false }
    ],
    nextActions: ['梳理 schema 兼容策略', '定义迁移脚本']
  },
  {
    id: 'project-release-hardening',
    name: '桌面端发布加固',
    summary: '完善 CSP、资源加载策略和构建发布稳定性。',
    status: 'done',
    risk: 'low',
    progress: 100,
    weeklyGoal: '回归验证关键预览链路',
    owner: 'AI',
    tags: ['Release', 'CSP'],
    updatedAt: '2026-02-28T13:20:00+08:00',
    updatedAtLabel: '今天 13:20',
    dueAt: '2026-02-28',
    dueAtLabel: '2 月 28 日',
    milestones: [
      { label: 'CSP 规则补全', done: true },
      { label: '本地资源加载问题修复', done: true },
      { label: '构建验证', done: true }
    ],
    nextActions: ['安排一次 smoke test 清单巡检']
  }
]
