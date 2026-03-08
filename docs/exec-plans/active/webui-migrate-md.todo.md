# WebUI Migrate To Shadcn Todo

## 0. 目标与边界
- [ ] 目标: `packages/renderer/src/features/webui` 统一到 React + shadcn 组件体系
- [ ] 保持现有能力不回退: 对话、附件、Artifacts、设置、会话管理
- [ ] 不做兼容双栈长期保留; 迁移完成后删除 mini-lit 旧实现

## 1. 现状盘点
- [x] 生成组件清单: 列出所有 `webui` 组件及依赖关系
- [x] 标记非 shadcn 入口: `button/input/textarea/select/dialog` 的使用点
- [x] 标记高风险点: 自定义元素生命周期、runtime provider、tool renderer
- [x] 标记可先迁移低风险页面: 设置弹窗、会话列表、静态展示组件

### 1.1 本次盘点结果（2026-03-01）
- `webui` 当前为 `LitElement + mini-lit` 技术栈，不能直接复用 React 版 `@renderer/components/ui/*`。
- 实际可执行路径：先迁到 `@mariozechner/mini-lit` 的 shadcn 等价组件（`Button/Card/Alert/Textarea/Separator`），再做 React 化迁移。

#### 可优先迁移（低风险，内容组件优先）
- `components/ConsoleBlock.ts`：头部/容器仍是手写 `button + border`，可迁 `Button + Card`。
- `components/ExpandableSection.ts`：可迁 `Button + Collapsible` 风格。
- `components/AttachmentTile.ts`：删除按钮与缩略卡片可迁 `Button + Card/Badge` 风格。
- `tools/renderer-registry.ts`：可折叠头部按钮可统一为 shadcn 风格按钮。
- `tools/artifacts/Console.ts`：展开/自动滚动按钮可迁 `Button`，日志容器可迁 `Card/ScrollArea` 风格。

#### 次优先迁移（中风险，交互较多）
- `components/MessageEditor.ts`：编辑区仍是原生 `textarea/input`，并含拖拽上传、粘贴、大小限制校验。
- `dialogs/SessionListDialog.ts`：会话项与删除按钮仍是手写结构，适合迁 `Card/Button`。
- `dialogs/SettingsDialog.ts`：Tab 导航按钮是手写样式，可迁 `Tabs/Button` 风格。
- `tools/artifacts/artifacts.ts`：顶部 artifact 标签栏是手写按钮状态，适合迁 `Tabs` 风格。

#### 高风险（最后迁）
- `ChatPanel.ts`：主容器生命周期和面板布局耦合较深。
- `components/AgentInterface.ts`：会话订阅、流式渲染、滚动同步、工具生命周期集中在这里。
- `tools/artifacts/*` runtime 相关组件：涉及沙箱和运行时 provider，不建议先动。

## 2. 基础设施准备
- [ ] 在 `packages/renderer/src/components/ui` 补齐 webui 需要的 shadcn 组件
- [ ] 统一样式令牌: 间距、字号、边框、圆角、hover/active/focus
- [ ] 定义 WebUI 组件规范: 命名、目录、props、事件约定
- [ ] 增加 UI 快照/回归基线（至少关键流程截图）

## 3. 分阶段迁移

### Phase A: 低风险组件
- [ ] `dialogs/SettingsDialog.ts` -> React + shadcn `Dialog/Tabs/Input/Switch`
- [ ] `dialogs/SessionListDialog.ts` -> React + shadcn `Dialog/List/Button`
- [ ] `components/ExpandableSection.ts` -> `Collapsible/Accordion`
- [ ] `components/Input.ts` -> 使用 `@renderer/components/ui/input`

### Phase B: 中风险组件
- [ ] `components/AttachmentTile.ts` -> shadcn `Card/Button/Badge`
- [ ] `components/ConsoleBlock.ts` -> shadcn `Card/ScrollArea`
- [ ] `components/MessageEditor.ts` -> shadcn `Textarea/Input/Button`
- [ ] `dialogs/AttachmentOverlay.ts` -> shadcn `Dialog` + 统一预览样式

### Phase C: 高风险核心
- [ ] `ChatPanel.ts` 从 LitElement 迁移为 React 容器组件
- [ ] `components/AgentInterface.ts` 迁移并保持 session/tool 生命周期正确
- [ ] `tools/renderer-registry.ts` 迁移到 React renderer registry
- [ ] `tools/artifacts/*` 迁移并保留运行时隔离与交互行为

## 4. 清理与收口
- [ ] 删除 `@mariozechner/mini-lit` 相关直接依赖（确认无引用后）
- [ ] 删除遗留 CSS/样式 hacks（只保留必要主题变量）
- [ ] 删除废弃组件与中间适配层
- [ ] 更新开发文档: WebUI 架构图、组件规范、扩展方式

## 5. 验收标准
- [ ] `webui` 目录内不再出现 `@mariozechner/mini-lit` 引用
- [ ] `webui` 目录内 UI 组件优先使用 `@renderer/components/ui/*`
- [ ] 关键路径通过: 发送消息、工具调用、附件上传、Artifacts 打开与关闭
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全通过
- [ ] 手工回归通过（桌面端主要分辨率）

## 6. 风险与回滚
- [ ] 任何一次 PR 只迁移一类组件, 避免大爆炸合并
- [ ] 高风险阶段保留 feature flag（仅短期）
- [ ] 出现核心回归时可快速回滚到上一个 phase tag

## 7. 建议执行顺序
- [ ] 第 1 周: 盘点 + Phase A
- [ ] 第 2 周: Phase B
- [ ] 第 3 周: Phase C
- [ ] 第 4 周: 清理、文档、验收
