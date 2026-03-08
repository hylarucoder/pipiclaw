# WebUI Shadcn 迁移计划

> 日期：2026-03-01  
> 范围：`packages/renderer/src/features/webui`

## 1. 目标与原则
- [ ] 目标：统一 WebUI 组件风格到 shadcn 设计体系（先 Lit 等价，再 React 组件化）
- [ ] 不牺牲功能：消息发送、流式输出、附件、Artifacts、设置、会话管理保持可用
- [ ] 不保留长期双栈兼容：每个模块迁移完成后清理旧实现
- [ ] 优先低风险高收益：先改内容组件与对话框，再碰 runtime 核心

## 2. 现状结论
- [x] 当前 `webui` 技术栈是 `LitElement + @mariozechner/mini-lit`
- [x] 不能直接在 Lit 组件里复用 React 版 `@renderer/components/ui/*`
- [x] 可执行路径：
- 先迁到 mini-lit 的 shadcn 等价组件（`Button/Card/Alert/Textarea/Separator`）
- 再分阶段迁移到 React + shadcn

## 3. 分层策略

### Layer A：Lit 内风格统一（短期落地）
- [x] `components/ConsoleBlock.ts`：手写按钮/容器 -> `Button + Card`
- [x] `components/ExpandableSection.ts`：手写折叠头 -> `Button + Collapsible 风格`
- [x] `components/AttachmentTile.ts`：手写删除按钮/文件卡片 -> `Button + Card/Badge 风格`
- [x] `tools/renderer-registry.ts`：可折叠头按钮统一 `Button` 语义/样式
- [x] `tools/artifacts/Console.ts`：折叠/自动滚动按钮与日志容器统一风格

### Layer B：中等复杂交互（Lit）
- [x] `dialogs/SessionListDialog.ts`：会话项与删除入口改为一致卡片交互
- [x] `dialogs/SettingsDialog.ts`：Tab 导航统一（桌面侧栏 + 移动端页签）
- [x] `components/MessageEditor.ts`：输入框/附件错误提示统一（减少原生 `alert`）
- [x] `tools/artifacts/artifacts.ts`：顶部标签栏改为统一 Tabs 风格

### Layer C：React 化迁移（中长期）
- [ ] `ChatPanel.ts`：Lit 容器 -> React 容器
- [ ] `components/AgentInterface.ts`：会话订阅、滚动、流式渲染迁移
- [ ] `tools/renderer-registry.ts`：迁移到 React renderer registry
- [ ] `tools/artifacts/*`：逐步迁移并保持 sandbox/runtime 行为一致

## 4. 执行顺序（PR 粒度）

### PR-1（低风险快收敛）
- [x] `ConsoleBlock + ExpandableSection + AttachmentTile`
- [x] 验收：`pnpm typecheck` 通过，UI 无明显倒退

### PR-2（列表/导航一致性）
- [x] `SessionListDialog + SettingsDialog`
- [ ] 验收：会话加载、删除、设置切换可用（待手工回归）

### PR-3（输入体验）
- [x] `MessageEditor`（输入区/附件提示/状态反馈）
- [ ] 验收：发送、拖拽、粘贴、文件大小限制流程全可用（待手工回归）

### PR-4（Artifacts 头部与控制区）
- [x] `renderer-registry + tools/artifacts/Console + artifacts tab bar`
- [ ] 验收：工具输出折叠、日志复制、artifact 切换与关闭正常（待手工回归）

### PR-5（核心迁移准备）
- [ ] 输出 React 化设计文档（状态边界、生命周期、事件总线）
- [ ] 明确 `ChatPanel/AgentInterface` 的迁移拆分方案

## 5. 验收标准
- [ ] `webui` 内容组件不再出现明显手写“散装按钮/散装边框”风格
- [ ] 高优先文件中原生 `button/input/textarea` 显著减少（仅保留必要原生输入场景）
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 通过
- [ ] 关键流程回归通过：
- 发送消息（含流式）
- 附件上传/删除/预览
- Artifacts 打开、切换、关闭
- 设置与会话管理

## 6. 风险与回滚
- [ ] 风险：UI 改动分散导致行为回归
- [ ] 约束：每个 PR 只改一类组件，不混改 runtime 逻辑
- [ ] 回滚：按 PR 粒度回滚，不做大面积 revert

## 7. 备注
- [ ] 参考：`docs/exec-plans/active/webui-migrate-md.todo.md`
- [ ] 本计划作为执行看板；每完成一项直接勾选并补充验证记录

## 8. 本轮完成记录（2026-03-01）
- [x] 新增组件化确认对话框：`dialogs/ConfirmDialog.ts`
- [x] 清理 `webui` 中原生 `confirm/alert` 交互，改为组件化确认或内嵌 `Alert`
- [x] 保留必要原生输入控件：`components/MessageEditor.ts`（`textarea` 与隐藏 `file input` 仅为快捷键、粘贴与上传能力）
- [x] 修复 `packages/renderer/src/pages/ChatPage.test.tsx`，将原生 `select` 断言迁移为 `combobox/listbox` 交互断言
- [x] 自动化验证：`pnpm typecheck` 通过；`pnpm test` 通过（14 files / 45 tests）
- [ ] 自动化验证：`pnpm lint` 受仓库历史存量问题阻塞（非本轮单点变更引入）
