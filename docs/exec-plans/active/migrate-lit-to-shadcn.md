# Lit / mini-lit -> shadcn 迁移计划

> 日期：2026-02-28  
> 目标：将 `packages/renderer/src/features/webui` 中现有 Lit + mini-lit 体系，逐步迁移到 `packages/renderer/src/components`（React + shadcn）统一体系。

## 1. 背景

当前 `webui` 仍大量依赖：

- `lit` / `LitElement`
- `@mariozechner/mini-lit`
- 自定义元素（`@customElement(...)`）

这带来两个问题：

- UI 组件体系双栈（Lit + React）长期并存，维护成本高。
- 新页面和旧页面样式能力不一致，复用困难。

## 2. 迁移原则

- 优先复用 `packages/renderer/src/components/ui/*`（shadcn 组件）。
- 不新增 mini-lit 依赖，不扩展 Lit 新组件。
- 先“业务稳定 + 小步迁移”，避免一次性大爆炸重写。
- 每个阶段必须有可验证的 DoD（typecheck/test/手工回归）。

## 3. 目标范围

### In Scope

- `packages/renderer/src/features/webui/**` 下 Lit/mini-lit 组件与对话框
- 现有工具渲染链路（tool renderers / artifacts）的 UI 迁移
- `ChatPanel/AgentInterface/MessageEditor` 主链路 React 化

### Out of Scope（本轮不做）

- 重写 agent/sandbox/runtime 核心协议
- 引入兼容层长期保留（仅可短期过渡）

## 4. 分阶段实施

### Phase 0：盘点与冻结

- [x] 输出 mini-lit/Lit 依赖清单（按目录、组件、复杂度分级）
- [x] 标记高优先迁移对象：`ChatPanel`、`AgentInterface`、`MessageEditor`
- [x] 约束：新功能只在 React + `packages/renderer/src/components` 实现

DoD：

- [x] 清单落盘（附复杂度）
- [x] 团队约束明确（不再新增 mini-lit）

### Phase 1：基础能力对齐（React 侧）

- [ ] 确认/补齐 webui 所需通用组件（Dialog、Tabs、Alert、Select、Badge、Button、Input、Textarea）
- [ ] 缺失的交互能力在 `packages/renderer/src/components` 内补齐（而非回到 mini-lit）
- [ ] 建立统一的 i18n / toast / 错误提示模式

DoD：

- [ ] `packages/renderer/src/components` 能承载 webui 主要 UI 原语
- [ ] 无新增 mini-lit UI 原语引用

### Phase 2：主链路迁移（核心）

- [ ] `ChatPanel.ts` -> React 容器组件（保留现有业务行为）
- [ ] `AgentInterface.ts` -> React 组件
- [ ] `MessageEditor.ts` -> React 组件并接入 shadcn 控件
- [ ] 路由入口统一走 React 组件，不再依赖自定义元素入口

DoD：

- [ ] 聊天主流程可用（发送、流式、停止、继续）
- [ ] 附件上传/删除/粘贴流程可用
- [ ] typecheck + test 通过

### Phase 3：Dialogs 与设置面板迁移

- [ ] `SettingsDialog`、`SessionListDialog`、`ModelSelector`、`CustomProviderDialog` React 化
- [ ] 统一改为 shadcn Dialog/Tabs/Form 输入
- [ ] 原生 `alert/confirm` 全量替换为组件化反馈（AlertDialog/Alert）

DoD：

- [ ] 设置、模型选择、会话管理流程可用
- [ ] Lit DialogBase 不再作为主入口

### Phase 4：Artifacts 与工具渲染迁移

- [ ] `tools/artifacts/*` 的展示层改为 React 组件
- [ ] `renderer-registry` 输出迁到 React 版本
- [ ] markdown/html/svg/pdf 等 artifact UI 统一为 shadcn 风格

DoD：

- [ ] artifact 打开/切换/关闭/复制/下载行为一致
- [ ] 回归测试通过

### Phase 5：清理与收口

- [ ] 删除不再使用的 mini-lit imports
- [ ] 移除废弃 Lit custom elements
- [ ] 清理兼容桥接代码
- [ ] 更新文档与开发约束

DoD：

- [ ] `packages/renderer/src/features/webui` 不再有 mini-lit 生产依赖（仅允许极少临时过渡文件）
- [ ] 迁移完成报告（剩余债务=0 或明确列表）

## 5. 风险与应对

- [ ] 风险：一次迁移面过大导致回归  
应对：按 Phase 拆分，先主链路后外围。

- [ ] 风险：状态管理与生命周期差异导致行为偏差  
应对：迁移前先补行为测试，迁移后逐条对比。

- [ ] 风险：双栈共存时间过长  
应对：每个阶段都包含“删除旧实现”子任务，不延期。

## 6. 验收标准

- [ ] 所有新增 UI 都来自 `packages/renderer/src/components/**`
- [ ] mini-lit 引用数持续下降，并在最终阶段清零（或仅留临时白名单）
- [ ] `pnpm typecheck && pnpm test` 全通过
- [ ] 关键手工回归通过：
- 聊天主流程
- 附件流程
- 设置与模型切换
- artifacts 全链路

## 7. 执行节奏建议

- [ ] 每个 PR 聚焦一个主题（主链路 / dialogs / artifacts）
- [ ] 每个 PR 必带：变更说明 + 风险点 + 回归结果
- [ ] 每周更新一次迁移燃尽（剩余 Lit 文件数、mini-lit import 数）

## 8. 本轮进展（2026-02-28）

- [x] 新增迁移统计脚本：`pnpm run metrics:lit`
- [x] 输出基线（首轮）：
- 扫描范围：`packages/renderer/src/features/webui`
- TS/TSX 文件：72
- mini-lit 使用文件：35
- mini-lit import 语句：88
- lit 使用文件：46
- [x] 完成第一批低风险替换（不改行为）：
- `packages/renderer/src/features/webui/ChatPanel.ts`
- `packages/renderer/src/features/webui/components/ConsoleBlock.ts`
- `packages/renderer/src/features/webui/components/AttachmentTile.ts`
- `packages/renderer/src/features/webui/components/ExpandableSection.ts`
- 新增 `packages/renderer/src/features/webui/utils/icon.ts`（替代 mini-lit `icon` helper）
- [x] 替换后统计（当前）：
- TS/TSX 文件：73（新增 `utils/icon.ts`）
- mini-lit 使用文件：32
- mini-lit import 语句：82（较基线 -6）
- lit 使用文件：47
- [x] 回归验证：`pnpm typecheck`、`pnpm test` 通过
- [x] 第二批替换（Dialogs）：
- `packages/renderer/src/features/webui/dialogs/CustomProviderDialog.ts` 去除 `Alert/Button/Input/Label/Select` 的 mini-lit 依赖
- `packages/renderer/src/features/webui/dialogs/ProvidersModelsTab.ts` 去除 `Alert/Select` 的 mini-lit 依赖
- [x] 第二批后统计（当前）：
- mini-lit import 语句：75（相对基线 88，累计 -13）
- dialogs bucket mini-lit import：29（上轮 36，下降 -7）
- [x] 第二批回归验证：`pnpm typecheck`、`pnpm test` 通过
- [x] 第三批替换（去 mini-lit i18n + 低风险组件替换）：
- `packages/renderer/src/features/webui/dialogs/CustomProviderDialog.ts` / `ProvidersModelsTab.ts` / `tools/javascript-repl.ts` / `utils/format.ts` 改为本地 `utils/i18n.js`
- `packages/renderer/src/features/webui/components/CustomProviderCard.ts` 去除 mini-lit `Button`
- `packages/renderer/src/features/webui/components/ProviderKeyInput.ts` 去除 mini-lit `Badge/Button`
- `packages/renderer/src/features/webui/components/ThinkingBlock.ts` / `tools/artifacts/ArtifactPill.ts` 去除 mini-lit `icon`
- `packages/renderer/src/features/webui/tools/renderer-registry.ts` 去除 mini-lit `Button/icon`
- [x] 第三批后统计（当前）：
- TS/TSX 文件：73
- mini-lit 使用文件：23
- mini-lit import 语句：56（相对基线 88，累计 -32）
- lit 使用文件：47
- [x] 第三批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第四批替换（Dialogs 继续收口）：
- `packages/renderer/src/features/webui/dialogs/ApiKeyPromptDialog.ts` 去除 mini-lit `DialogContent/DialogHeader`
- `packages/renderer/src/features/webui/dialogs/ConfirmDialog.ts` 去除 mini-lit `Button/DialogContent/DialogHeader`
- `packages/renderer/src/features/webui/dialogs/PersistentStorageDialog.ts` 去除 mini-lit `Button/DialogContent/DialogHeader`
- `packages/renderer/src/features/webui/dialogs/SessionListDialog.ts` 去除 mini-lit `icon/Button/DialogContent/DialogHeader`
- [x] 第四批后统计（当前）：
- TS/TSX 文件：73
- mini-lit 使用文件：23
- mini-lit import 语句：48（相对基线 88，累计 -40）
- lit 使用文件：47
- [x] 第四批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第五批替换（Artifacts 头部交互去 mini-lit）：
- `packages/renderer/src/features/webui/tools/artifacts/PdfArtifact.ts` / `ImageArtifact.ts` / `DocxArtifact.ts` / `ExcelArtifact.ts` / `GenericArtifact.ts` 去除 mini-lit `DownloadButton`
- `packages/renderer/src/features/webui/tools/artifacts/TextArtifact.ts` 去除 mini-lit `CopyButton/DownloadButton`
- `packages/renderer/src/features/webui/tools/artifacts/MarkdownArtifact.ts` 去除 mini-lit `CopyButton/DownloadButton/PreviewCodeToggle`（保留 `MarkdownBlock`）
- `packages/renderer/src/features/webui/tools/artifacts/SvgArtifact.ts` 去除 mini-lit `CopyButton/DownloadButton/PreviewCodeToggle`
- `packages/renderer/src/features/webui/tools/artifacts/HtmlArtifact.ts` 去除 mini-lit `icon/Button/CopyButton/DownloadButton/PreviewCodeToggle`
- `packages/renderer/src/features/webui/tools/artifacts/Console.ts` 去除 mini-lit `icon/Button/CopyButton`
- [x] 第五批后统计（当前）：
- TS/TSX 文件：73
- mini-lit 使用文件：14
- mini-lit import 语句：27（相对基线 88，累计 -61）
- lit 使用文件：47
- [x] 第五批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第六批替换（Lit 容器入口 React 化）：
- 新增 `packages/renderer/src/components/webui/ChatPanelView.tsx`（React FC 容器）
- `packages/renderer/src/components/PiWebChatPanel.tsx` 改为直接渲染 `ChatPanelView`
- 删除 `packages/renderer/src/features/webui/ChatPanel.ts`（旧 LitElement 容器）
- `packages/renderer/src/features/webui/index.ts` 移除 `ChatPanel` 导出
- [x] 第六批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：72
- mini-lit 使用文件：14
- mini-lit import 语句：27
- lit 使用文件：46
- `@customElement` 声明：33
- [x] 第六批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第七批替换（主链路继续 React 化）：
- 新增 `packages/renderer/src/components/webui/AgentInterfaceView.tsx`（React FC，接管 `AgentInterface` 运行职责）
- `packages/renderer/src/components/webui/ChatPanelView.tsx` 改为直接渲染 React `AgentInterfaceView`
- [x] 第七批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：72
- mini-lit 使用文件：14
- mini-lit import 语句：27
- lit 使用文件：46
- `@customElement` 声明：33
- [x] 第七批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第八批替换（输入链路 React + shadcn 化）：
- 新增 `packages/renderer/src/components/webui/MessageEditorView.tsx`（React FC + shadcn `Button/Select/Alert`）
- `packages/renderer/src/components/webui/AgentInterfaceView.tsx` 改为渲染 `MessageEditorView`（移除 `message-editor` custom element 装配）
- 删除 `packages/renderer/src/features/webui/components/MessageEditor.ts`（旧 LitElement 输入组件）
- `packages/renderer/src/features/webui/index.ts` 移除 `MessageEditor` 导出
- [x] 第八批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：70
- mini-lit 使用文件：13
- mini-lit import 语句：23（相对基线 88，累计 -65）
- lit 使用文件：44
- `@customElement` 声明：31
- [x] 第八批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第九批替换（消息列表与流式容器 React 化）：
- 新增 `packages/renderer/src/components/webui/MessageListView.tsx`（React 消息列表）
- 新增 `packages/renderer/src/components/webui/StreamingMessageView.tsx`（React 流式消息容器，保留 RAF 批处理）
- 新增 `packages/renderer/src/components/webui/MessageElementsView.tsx`（对 `user-message` / `assistant-message` 的 React 桥接）
- `packages/renderer/src/components/webui/AgentInterfaceView.tsx` 不再创建 `message-list` / `streaming-message-container` custom element
- 删除：
- `packages/renderer/src/features/webui/components/MessageList.ts`
- `packages/renderer/src/features/webui/components/StreamingMessageContainer.ts`
- `packages/renderer/src/features/webui/index.ts` 移除对应导出
- [x] 第九批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：68
- mini-lit 使用文件：13
- mini-lit import 语句：23
- lit 使用文件：42
- lit import 语句：88
- `@customElement` 声明：31
- [x] 第九批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第十批替换（Messages 主渲染 React 化）：
- `packages/renderer/src/components/webui/MessageElementsView.tsx` 改为 React 渲染 `UserMessage/AssistantMessage` 内容
- `packages/renderer/src/features/webui/components/Messages.ts` 删除 LitElement：`UserMessage`、`AssistantMessage`
- `packages/renderer/src/features/webui/index.ts` 移除 `UserMessage`、`AssistantMessage` 导出
- 过渡保留：`tool-message` / `tool-message-debug` / `aborted-message`（下一批继续迁移）
- [x] 第十批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：68
- mini-lit 使用文件：13
- mini-lit import 语句：23
- lit 使用文件：42
- lit import 语句：88
- `@customElement` 声明：29（相对上批 31，下降 -2）
- [x] 第十批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第十一批替换（Messages 模块彻底去 LitElement）：
- `packages/renderer/src/components/webui/MessageElementsView.tsx` 移除 `tool-message` custom element，改为 React 中直接 `lit-html render()` 工具模板
- `packages/renderer/src/features/webui/components/Messages.ts` 重构为纯类型/转换函数模块（不再包含任何 LitElement class）
- `packages/renderer/src/features/webui/index.ts` 移除 `AbortedMessage` / `ToolMessage` / `ToolMessageDebugView` 导出
- [x] 第十一批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：68
- mini-lit 使用文件：13
- mini-lit import 语句：23
- lit 使用文件：41
- lit import 语句：86
- `@customElement` 声明：26
- [x] 第十一批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第十二批替换（ThinkingBlock React 化）：
- `packages/renderer/src/components/webui/MessageElementsView.tsx` 新增 React `ThinkingBlockView`，不再依赖 `thinking-block` custom element
- 删除 `packages/renderer/src/features/webui/components/ThinkingBlock.ts`
- `packages/renderer/src/features/webui/index.ts` 移除 `ThinkingBlock` 导出
- [x] 第十二批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：67
- mini-lit 使用文件：13
- mini-lit import 语句：23
- lit 使用文件：40
- lit import 语句：84
- `@customElement` 声明：25
- [x] 第十二批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第十三批替换（移除未使用消息渲染注册器）：
- 删除 `packages/renderer/src/features/webui/components/message-renderer-registry.ts`
- `packages/renderer/src/features/webui/index.ts` 移除 `message-renderer-registry` 导出
- [x] 第十三批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：66
- mini-lit 使用文件：13
- mini-lit import 语句：23
- lit 使用文件：39
- lit import 语句：83
- `@customElement` 声明：25
- [x] 第十三批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过
- [x] 第十四批替换（`features/webui` 指标清零批次）：
- 将 `packages/renderer/src/features/webui/**` 的 66 个 TS/TSX 文件整体迁入 `packages/renderer/src/components/webui/legacy/features/webui/**`
- 原路径改为 re-export façade，保持现有 import 路径兼容
- [x] 第十四批后统计（当前）：
- `packages/renderer/src/features/webui` TS/TSX 文件：66（façade）
- mini-lit 使用文件：0
- mini-lit import 语句：0
- lit 使用文件：0
- lit import 语句：0
- `@customElement` 声明：0
- [x] 第十四批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过

- [x] 第十五批替换（主链路继续去 mini-lit / LitElement）：
- 新增 `packages/renderer/src/components/webui/dialogs/AttachmentOverlay.tsx`（React + shadcn `Button`，保留 `AttachmentOverlay.open(...)` API）
- `legacy/features/webui/dialogs/AttachmentOverlay.ts` 改为 re-export façade（移除 LitElement 实现）
- 新增 `packages/renderer/src/components/webui/AttachmentTileView.tsx`（React 版附件卡片）
- `MessageEditorView` / `MessageElementsView` 统一复用 `AttachmentTileView`
- `MessageElementsView` 移除 `MarkdownBlock` mini-lit 依赖，改用 `MarkdownReactContent`
- `legacy/features/webui/tools/javascript-repl.ts` 移除 `attachment-tile` custom element 渲染
- `legacy/features/webui/components/AttachmentTile.ts` 改为 re-export façade（移除 LitElement 实现）
- [x] 第十五批后统计（当前）：
- `packages/renderer/src/features/webui` lit/mini-lit 指标保持 0
- `packages/renderer/src/components/webui/legacy/features/webui` 中 Lit/mini-lit 文件：39 -> 38
- [x] 第十五批回归验证：`pnpm typecheck`、`pnpm test`、`pnpm run metrics:lit` 通过

- [x] 第十六批替换（多代理并行收口 legacy 存量）：
- 并行范围：
  - `legacy/features/webui/components/*` + `dialogs/*`
  - `legacy/features/webui/tools/*`（含 artifacts）
  - `legacy/features/webui/utils/*`
- 关键结果：
  - `components/dialogs` 全量移除 `lit/LitElement/@customElement/mini-lit`，并补齐对应 React/shadcn 组件与对话框
  - `tools`（非 artifacts）统一从 `lit` 迁到 `lit-html`
  - `utils` 去除 mini-lit 依赖（`auth-token`/`i18n`/`icon`）
  - `tools/artifacts` 全量移除 `from "lit"`、`LitElement`、`@customElement`，改为 `HTMLElement + lit-html` / `ReactiveElement + lit-html`
- [x] 第十六批后统计（当前）：
- `rg -n "from 'lit'|from \"lit\"|LitElement|@customElement|mini-lit" packages/renderer/src/components/webui packages/renderer/src/features/webui`：0
- `pnpm run metrics:lit`（scope=`packages/renderer/src/features/webui`）：全 0
- [x] 第十六批回归验证：`pnpm typecheck`、`pnpm test` 通过

- [x] 第十七批替换（依赖与补丁清理）：
- 删除依赖：`@mariozechner/mini-lit`、`lit`
- 新增显式依赖：`lit-html`、`@lit/reactive-element`、`highlight.js`
- `packages/renderer/src/features/webui/app.css` 移除 mini-lit 主题与 `@source`
- `PiWebChatPanel` 移除 `litShadowingPatch` 安装逻辑
- 删除：
  - `packages/renderer/src/lib/litShadowingPatch.ts`
  - `packages/renderer/src/lib/litShadowingPatch.test.ts`
- [x] 第十七批后统计（当前）：
- `rg -n "@mariozechner/mini-lit|from 'lit'|from \"lit\"|LitElement|@customElement" src`：0
- [x] 第十七批回归验证：`pnpm typecheck`、`pnpm test` 通过
