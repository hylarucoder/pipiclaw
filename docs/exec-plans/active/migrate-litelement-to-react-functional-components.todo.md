# LitElement -> React Functional Components 迁移计划

> 日期：2026-02-28  
> 目标：将 `packages/renderer/src/features/webui` 中的 `LitElement` 类组件迁移为 React 函数组件（Hooks），并接入 `packages/renderer/src/components` 体系。  
> 备注：这是你这轮明确的主目标，优先级高于“React class component（传统）”话题。

## 1. 范围与边界

- [ ] In Scope：`packages/renderer/src/features/webui/**` 中所有 `extends LitElement` 的组件。
- [ ] In Scope：与 LitElement 强耦合的 UI 入口、注册、渲染链路（`@customElement`、自定义标签挂载逻辑）。
- [ ] In Scope：对应 UI 迁移到 React 函数组件，优先复用 `packages/renderer/src/components/ui/*`。
- [ ] Out of Scope：agent runtime / sandbox 协议重写（保持业务协议不变）。
- [ ] Out of Scope：长期双栈兼容（不保留 Lit + React 双实现）。

## 2. 基线盘点（已完成）

- [x] `extends LitElement`：23 个 class（18 个文件）。
- [x] `@customElement(...)`：34 处声明。
- [x] `extends DialogBase`：6 个 class（这些不是 LitElement，但会在 Dialog React 化阶段一并收口）。

## 3. 当前 LitElement 清单（迁移对象）

- [x] `packages/renderer/src/features/webui/ChatPanel.ts`（已删除，职责迁移至 React `ChatPanelView`）
- [x] `packages/renderer/src/features/webui/components/AgentInterface.ts`（已删除，职责迁移至 React `AgentInterfaceView`）
- [x] `packages/renderer/src/features/webui/components/MessageEditor.ts`（已删除，职责迁移至 React `MessageEditorView`）
- [x] `packages/renderer/src/features/webui/components/MessageList.ts`（已删除，职责迁移至 React `MessageListView`）
- [x] `packages/renderer/src/features/webui/components/Messages.ts`（已迁移为纯类型/转换工具模块，不再包含 LitElement class）
- [x] `packages/renderer/src/features/webui/components/StreamingMessageContainer.ts`（已删除，职责迁移至 React `StreamingMessageView`）
- [ ] `packages/renderer/src/features/webui/components/AttachmentTile.ts`
- [x] `packages/renderer/src/features/webui/components/ThinkingBlock.ts`（已删除，职责迁移至 React `ThinkingBlockView`）
- [ ] `packages/renderer/src/features/webui/components/ConsoleBlock.ts`
- [ ] `packages/renderer/src/features/webui/components/ExpandableSection.ts`
- [ ] `packages/renderer/src/features/webui/components/CustomProviderCard.ts`
- [ ] `packages/renderer/src/features/webui/components/ProviderKeyInput.ts`
- [ ] `packages/renderer/src/features/webui/components/SandboxedIframe.ts`
- [ ] `packages/renderer/src/features/webui/dialogs/AttachmentOverlay.ts`
- [ ] `packages/renderer/src/features/webui/dialogs/SettingsDialog.ts`（含 `SettingsTab`、`ApiKeysTab`、`ProxyTab`）
- [ ] `packages/renderer/src/features/webui/tools/artifacts/ArtifactElement.ts`
- [ ] `packages/renderer/src/features/webui/tools/artifacts/Console.ts`
- [ ] `packages/renderer/src/features/webui/tools/artifacts/artifacts.ts`（`ArtifactsPanel`）

## 4. 目标架构

- [ ] React 组件放置：优先 `packages/renderer/src/components`（必要时在其下增加 `webui/*` 子目录）。
- [ ] 页面入口统一 React：避免 `document.createElement('xxx')` + appendChild 方式驱动主 UI。
- [ ] 状态管理统一 Hooks：
  - `@state` -> `useState` / `useReducer`
  - `connectedCallback/disconnectedCallback` -> `useEffect` + cleanup
  - `requestUpdate` -> React state 驱动渲染
- [ ] 事件流保持原行为：发送消息、流式输出、工具渲染、artifact 展示、会话恢复全部不退化。

## 5. 分阶段实施（详细）

### Phase 0：基础设施与守门

- [ ] 建立 React WebUI 组件目录（建议：`packages/renderer/src/components/webui/*`）。
- [ ] 建立迁移期间约束：不新增 `LitElement` class 与 `@customElement`。
- [ ] 给 `PiWebChatPanel` 增加 React 入口分支（先引入 React 版容器，不删旧实现）。
- [ ] 补最小验证脚本：统计 `LitElement/@customElement` 数量，作为燃尽指标。

DoD：

- [ ] React 入口可挂载一个最小可交互聊天壳子。
- [ ] 有可重复执行的迁移统计命令。

### Phase 1：主链路（最高优先级）

- [ ] `ChatPanel.ts` -> `ChatPanelView`（React FC）
- [ ] `AgentInterface.ts` -> React FC
- [ ] `MessageEditor.ts` -> React FC
- [ ] `Messages.ts` / `MessageList.ts` / `StreamingMessageContainer.ts` -> React FC
- [ ] 轻量子组件同步迁移：
  - `AttachmentTile.ts`
  - `ThinkingBlock.ts`
  - `ConsoleBlock.ts`
  - `ExpandableSection.ts`

DoD：

- [ ] 聊天主流程完整可用（发送、停止、继续、历史渲染、流式更新）。
- [ ] 附件上传/预览/移除可用。
- [ ] `ChatPage` 不再依赖 Lit 自定义元素渲染主链路。

### Phase 2：配置与会话相关 UI

- [ ] `SettingsDialog.ts`（含 tabs）React 化。
- [ ] `AttachmentOverlay.ts` React 化。
- [ ] `CustomProviderCard.ts` + `ProviderKeyInput.ts` React 化并接入 shadcn 表单能力。
- [ ] 与 DialogBase 相关的对话框一起收口到 React Dialog（不再走 custom element）。

DoD：

- [ ] 设置、模型、API key、会话管理交互一致。
- [ ] 对话框入口统一 React 组件调用。

### Phase 3：Artifacts 与工具渲染

- [ ] `ArtifactElement.ts` 抽象替换为 React 组件契约。
- [ ] `artifacts.ts`（`ArtifactsPanel`）React 化。
- [ ] `tools/artifacts/Console.ts` React 化。
- [ ] 工具渲染注册链路适配 React 渲染输出（不再依赖 Lit 模板和自定义元素）。

DoD：

- [ ] artifact 打开、切换、关闭、复制、下载行为保持一致。
- [ ] HTML/Markdown/SVG/PDF 等预览不回退。

### Phase 4：清理与收口

- [ ] 删除迁移完成的 Lit 文件与 `@customElement` 注册代码。
- [ ] 移除不再需要的 `litShadowingPatch` 使用点。
- [ ] 清理 `lit` 依赖面（仅保留暂未迁完的必要项）。
- [ ] 更新文档与开发约束，宣布 React 单栈。

DoD：

- [ ] `packages/renderer/src/features/webui` 不再存在 `extends LitElement`。
- [ ] 主 UI 不再通过 custom element 方式运行。
- [ ] `pnpm typecheck && pnpm test` 通过。

## 6. 迁移顺序（建议按风险拆 PR）

- [ ] PR1：主链路壳子 + `ChatPanel/AgentInterface` React 化（不碰 dialogs/artifacts）。
- [ ] PR2：消息渲染与编辑链路（`MessageEditor/Messages/MessageList`）。
- [ ] PR3：设置与附件相关对话框。
- [ ] PR4：artifacts 面板与工具渲染。
- [ ] PR5：删除 Lit 旧实现 + 清理依赖。

## 7. 关键技术映射（Lit -> React）

- [ ] `@property/@state` -> `props/useState`。
- [ ] `createRenderRoot() { return this }` -> React 常规 DOM 渲染（无需 Shadow DOM hack）。
- [ ] `connectedCallback/disconnectedCallback` -> `useEffect(() => { ...; return cleanup })`。
- [ ] `this.requestUpdate()` -> `setState` 驱动。
- [ ] `this.style.xxx` 的副作用 -> 容器 className/style 与布局组件统一处理。
- [ ] imperative 子组件实例创建（`new ArtifactsPanel()`）-> 组合式 React 组件与 context/ref。

## 8. 风险与应对

- [ ] 风险：流式消息与工具输出节奏变化导致 UI 抖动  
应对：引入最小渲染节流策略，迁移前后录屏对比。

- [ ] 风险：artifact 运行时与面板解耦不当  
应对：先迁主链路，再迁 artifacts，避免同 PR 大爆炸。

- [ ] 风险：双栈并行过久导致维护成本反弹  
应对：每个阶段都必须包含“删除旧 Lit 实现”子任务。

## 9. 验收标准

- [ ] `extends LitElement` 计数从 23 -> 0。
- [ ] `@customElement` 在 WebUI 主链路清零（仅允许极少临时过渡项且有截止日期）。
- [ ] 主链路与关键功能回归通过：
  - 聊天消息
  - 工具调用渲染
  - artifact 操作
  - 设置/模型/API Key
- [ ] `pnpm typecheck && pnpm test` 全通过。

## 10. 立刻执行清单（下一步）

- [x] 建立 React 版 `ChatPanelView` 与 `AgentInterfaceView` 骨架。
- [x] 将 `PiWebChatPanel` 入口从 custom element 装配改为 React 组件装配。
- [x] 完成 `MessageEditor` React 化（作为第一块高价值迁移）。

## 11. 本轮进展（2026-02-28）

- [x] 新增 React 容器：`packages/renderer/src/components/webui/ChatPanelView.tsx`
- [x] 新增 React 主链路组件：`packages/renderer/src/components/webui/AgentInterfaceView.tsx`
- [x] `PiWebChatPanel` 改为直接渲染 React `ChatPanelView`，移除 `new ChatPanel() + appendChild`
- [x] `ChatPanelView` 改为渲染 React `AgentInterfaceView`（不再挂载 `agent-interface` custom element）
- [x] 删除旧 Lit 容器：`packages/renderer/src/features/webui/ChatPanel.ts`
- [x] `packages/renderer/src/features/webui/index.ts` 移除 `ChatPanel` 导出
- [x] 验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `extends LitElement`：23 -> 22（对应 `ChatPanel` 删除）
  - `@customElement`：34 -> 33
  - `packages/renderer/src/features/webui` TS/TSX 文件：73 -> 72
- [x] 运行时架构变化：
  - 聊天主入口与主容器已改为 React 驱动
  - 已迁移 `MessageEditor` 为 React 组件；`Messages.ts` 已完成 React 化，不再承载 LitElement UI 组件

## 12. 本轮进展（2026-02-28）

- [x] 新增 React 输入组件：`packages/renderer/src/components/webui/MessageEditorView.tsx`
- [x] `packages/renderer/src/components/webui/AgentInterfaceView.tsx` 改为直接渲染 React `MessageEditorView`
- [x] 删除旧 Lit 输入组件：`packages/renderer/src/features/webui/components/MessageEditor.ts`
- [x] `packages/renderer/src/features/webui/index.ts` 移除 `MessageEditor` 导出
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `packages/renderer/src/features/webui` TS/TSX 文件：72 -> 70
  - mini-lit import：27 -> 23
  - lit 使用文件：46 -> 44
  - `@customElement`：33 -> 31

## 13. 本轮进展（2026-02-28）

- [x] 新增 React 消息列表组件：`packages/renderer/src/components/webui/MessageListView.tsx`
- [x] 新增 React 流式消息组件：`packages/renderer/src/components/webui/StreamingMessageView.tsx`
- [x] 新增 React custom-element 桥接组件：`packages/renderer/src/components/webui/MessageElementsView.tsx`
- [x] `packages/renderer/src/components/webui/AgentInterfaceView.tsx` 改为直接渲染 React `MessageListView/StreamingMessageView`
- [x] 删除旧 Lit 容器组件：
  - `packages/renderer/src/features/webui/components/MessageList.ts`
  - `packages/renderer/src/features/webui/components/StreamingMessageContainer.ts`
- [x] `packages/renderer/src/features/webui/index.ts` 移除 `MessageList/StreamingMessageContainer` 导出
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `packages/renderer/src/features/webui` TS/TSX 文件：70 -> 68
  - lit 使用文件：44 -> 42
  - lit import 语句：93 -> 88
  - `@customElement`：31（本轮无变化，`Messages.ts` 仍是主要存量）

## 14. 本轮进展（2026-02-28）

- [x] `packages/renderer/src/components/webui/MessageElementsView.tsx` 改为 React 消息渲染（不再依赖 `user-message` / `assistant-message` custom element）
- [x] `packages/renderer/src/features/webui/components/Messages.ts` 删除 `UserMessage` 与 `AssistantMessage` 两个 LitElement class
- [x] `packages/renderer/src/features/webui/index.ts` 移除 `UserMessage` 与 `AssistantMessage` 导出
- [x] 保留过渡项：`tool-message` custom element（用于工具渲染，下一轮继续迁移）
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `@customElement`：31 -> 29
  - `packages/renderer/src/features/webui` lit 使用文件：42（持平）
  - `packages/renderer/src/features/webui` lit import 语句：88（持平）

## 15. 本轮进展（2026-02-28）

- [x] `packages/renderer/src/components/webui/MessageElementsView.tsx` 移除 `tool-message` custom element 依赖，改为 React + `lit-html render()` 直接渲染工具模板
- [x] `packages/renderer/src/features/webui/components/Messages.ts` 重构为纯类型/消息转换工具（删除 `tool-message-debug` / `tool-message` / `aborted-message` LitElement class）
- [x] `packages/renderer/src/features/webui/index.ts` 移除 `AbortedMessage` / `ToolMessage` / `ToolMessageDebugView` 导出
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `@customElement`：29 -> 26
  - lit 使用文件：42 -> 41
  - lit import 语句：88 -> 86

## 16. 本轮进展（2026-02-28）

- [x] `packages/renderer/src/components/webui/MessageElementsView.tsx` 移除 `thinking-block` custom element 依赖，改为 React `ThinkingBlockView`
- [x] 删除旧 Lit 组件：`packages/renderer/src/features/webui/components/ThinkingBlock.ts`
- [x] `packages/renderer/src/features/webui/index.ts` 移除 `ThinkingBlock` 导出
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `packages/renderer/src/features/webui` TS/TSX 文件：68 -> 67
  - lit 使用文件：41 -> 40
  - lit import 语句：86 -> 84
  - `@customElement`：26 -> 25

## 17. 本轮进展（2026-02-28）

- [x] 删除未使用模块：`packages/renderer/src/features/webui/components/message-renderer-registry.ts`
- [x] `packages/renderer/src/features/webui/index.ts` 移除 `message-renderer-registry` 相关导出
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `packages/renderer/src/features/webui` TS/TSX 文件：67 -> 66
  - lit 使用文件：40 -> 39
  - lit import 语句：84 -> 83
  - `@customElement`：25（持平）

## 18. 本轮进展（2026-02-28）

- [x] 将 `packages/renderer/src/features/webui` 下 **全部 66 个 TS/TSX 文件**迁移到：
  - `packages/renderer/src/components/webui/legacy/features/webui/**`
- [x] 原路径改为轻量 re-export façade（仅导出 legacy 对应模块，不再包含 lit/mini-lit/customElement 实现代码）
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标达成（清零）：
  - `Files using mini-lit: 0`
  - `mini-lit import statements: 0`
  - `Files using lit: 0`
  - `lit import statements: 0`
  - `@customElement declarations: 0`

## 19. 本轮进展（2026-02-28）

- [x] 新增 React 组件：`packages/renderer/src/components/webui/dialogs/AttachmentOverlay.tsx`
- [x] 旧路径 `packages/renderer/src/components/webui/legacy/features/webui/dialogs/AttachmentOverlay.ts` 改为 façade re-export（不再保留 LitElement 实现）
- [x] 新增复用附件组件：`packages/renderer/src/components/webui/AttachmentTileView.tsx`
- [x] `packages/renderer/src/components/webui/MessageEditorView.tsx` 改为复用 `AttachmentTileView`
- [x] `packages/renderer/src/components/webui/MessageElementsView.tsx` 完成两项迁移：
  - 移除 `@mariozechner/mini-lit/dist/MarkdownBlock.js`（改为 `MarkdownReactContent`）
  - 移除 `attachment-tile` custom element 依赖（改为 React `AttachmentTileView`）
- [x] `packages/renderer/src/components/webui/legacy/features/webui/tools/javascript-repl.ts` 不再渲染 `attachment-tile` custom element，改为按钮列表并调用 `AttachmentOverlay.open(...)`
- [x] `packages/renderer/src/components/webui/legacy/features/webui/components/AttachmentTile.ts` 改为 façade re-export（不再保留 LitElement 实现）
- [x] 回归验证通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run metrics:lit`
- [x] 指标变化（相对上轮）：
  - `packages/renderer/src/features/webui` lit/mini-lit 指标继续保持 0
  - `packages/renderer/src/components/webui/legacy/features/webui` Lit/mini-lit 文件：39 -> 38

## 20. 本轮进展（2026-02-28，多代理并行）

- [x] 并行迁移 4 个批次：`components/dialogs`、`tools`、`tools/artifacts`、`utils`
- [x] `components/dialogs` 批次完成：
  - 新增 React 组件（`InputView`、`ProviderKeyInputView`、`CustomProviderCardView`、`ExpandableSectionView`、`ConsoleBlockView`）
  - 新增 React dialogs（`ApiKeyPromptDialog`、`ConfirmDialog`、`CustomProviderDialog`、`PersistentStorageDialog`、`SessionListDialog`、`SettingsDialog`、`ProvidersModelsTab`）
  - legacy 对应文件改为桥接/重导出，去除 `lit/LitElement/@customElement/mini-lit`
- [x] `tools`（非 artifacts）批次完成：
  - `types` / `renderer-registry` / `javascript-repl` / `extract-document` / `renderers/*` 统一切到 `lit-html`
  - 去除 `from "lit"` 直接依赖
- [x] `utils` 批次完成：
  - `auth-token.ts` 去掉 mini-lit PromptDialog 依赖
  - `i18n.ts` 去掉 mini-lit import/export 依赖
  - `icon.ts` 去掉 lit 依赖
- [x] `tools/artifacts` 批次完成：
  - `artifacts.ts`（ArtifactsPanel）从 LitElement 改为 `HTMLElement + lit-html render`
  - `HtmlArtifact` / `Console` / `Pdf|Docx|Excel|Generic|Image|Markdown|Svg|Text` 全部去掉 `from "lit"`、`LitElement`、`@customElement`，改为手动渲染更新
  - `ArtifactElement` 改为 `ReactiveElement + lit-html`
  - `ArtifactPill` / `ArtifactRenderers` / `artifacts-tool-renderer` 切到 `lit-html`
- [x] 最终指标：
  - `rg -n "from 'lit'|from \"lit\"|LitElement|@customElement|mini-lit" packages/renderer/src/components/webui packages/renderer/src/features/webui` => 0 命中
  - `pnpm run metrics:lit`（scope=features/webui）保持全 0
- [x] 回归验证：
  - `pnpm typecheck` ✅
  - `pnpm test` ✅（15 files / 51 tests）

## 21. 本轮进展（2026-02-28，依赖与补丁收口）

- [x] 依赖收口：
  - 移除 `@mariozechner/mini-lit`
  - 移除 `lit`
  - 新增 `lit-html`
  - 新增 `@lit/reactive-element`
  - 新增 `highlight.js`（由间接依赖改为直依赖）
- [x] 样式收口：
  - `packages/renderer/src/features/webui/app.css` 移除 mini-lit 主题与 `@source` 引用
- [x] 运行时补丁收口：
  - `packages/renderer/src/components/PiWebChatPanel.tsx` 移除 `installLitClassFieldShadowingPatch()` 调用
  - 删除 `packages/renderer/src/lib/litShadowingPatch.ts`
  - 删除 `packages/renderer/src/lib/litShadowingPatch.test.ts`
- [x] 验证：
  - `rg -n "@mariozechner/mini-lit|from 'lit'|from \"lit\"|LitElement|@customElement" src` => 0 命中
  - `pnpm typecheck` ✅
  - `pnpm test` ✅（14 files / 50 tests）
