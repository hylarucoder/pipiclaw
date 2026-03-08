# WebUI 只做 React 迁移 TODO

> 日期：2026-03-01  
> 目标：`webui` 全量迁移到 React（不是“lit 指标清零”，而是运行时与实现层都不再依赖 legacy/custom element）。

## 1. 北极星目标（Definition of Done）

- [x] `packages/renderer/features/webui/**` 已删除，不再作为 legacy façade 中转层。
- [x] `packages/renderer/src/components/webui/legacy/**` 已从主仓删除，不再承载生产实现。
- [ ] 聊天主链路与 artifacts 渲染链路均为 React 组件驱动，不再 `document.createElement('...')` 挂载 custom element。
- [x] 运行时不再依赖 `legacy/features/webui` 路径导入。
- [ ] `pnpm typecheck && pnpm test` 通过；`pnpm lint` 至少不新增错误。

## 2. 现状基线（2026-03-09）

- [x] 2026-03-09：`packages/renderer/features/webui/**` 纯 façade 副本已删除，`packages/renderer/src/features/webui/**` 成为唯一 webui feature 真源。
- [x] 2026-03-09：`packages/renderer/src/components/webui/legacy/**` 已删除，生产代码中无 `legacy/features/webui` 导入。
- [x] `metrics:lit` 在 `src/features/webui` 维度是 0（仅说明 feature 目录干净，不代表迁移完成）。
- [x] 2026-03-09：旧的 `new -> façade -> legacy` 回跳链已从当前代码与入口文档中清除。

## 3. 范围与边界

- [ ] In Scope：`webui` 的 UI/渲染/runtime 迁移与目录收口。
- [ ] In Scope：`tools/renderer-registry`、`tools/artifacts/*`、`storage/*`、`utils/*`、`sandbox/*` 的 React 化与去 legacy 化。
- [ ] Out of Scope：协议层重写（agent/sandbox 通信协议保持不变）。
- [ ] Out of Scope：为了兼容旧代码长期保留双栈。

## 4. 架构原则（强约束）

- [ ] 单一实现源：生产代码只保留 React 主实现，不保留“同功能双实现”。
- [ ] 单向依赖：`App/Page -> components/webui/* -> services/store`，禁止再回跳 `features -> legacy -> components`。
- [ ] 迁移即清理：每完成一块就删除对应 legacy/桥接代码，不积压技术债。
- [ ] 可观测迁移：每个 PR 带上“替换了什么 + 删除了什么 + 还剩什么”。

## 5. 分阶段执行

### Phase A：先切断回跳链（P0）

- [x] `PiWebChatPanel` 与 `ChatPanelView/AgentInterfaceView` 直接依赖 React 实现模块，不再经过已删除 façade。
- [ ] 已 React 化的 dialogs/input 统一从 `packages/renderer/src/components/webui/**` 直连引用。
- [x] 新增 lint/脚本守门：禁止重新引入已删除的 webui legacy/façade 路径。

DoD：
- [x] 主入口 import 图中不再出现 `features/webui -> legacy` 回跳。

### Phase B：工具渲染主链 React 化（P0）

- [ ] `tools/renderer-registry.ts` 重构为 React renderer registry（返回 ReactNode/组件，而非 lit template）。
- [ ] `tools/artifacts/artifacts.ts`（ArtifactsPanel）迁移为 React 容器。
- [ ] `tools/artifacts/*`（Console/Html/Markdown/Svg/Pdf/Image/Docx/Excel/Generic/Text）迁移为 React 组件。
- [ ] 替换 custom element 事件桥接为 React state + context + callback。

DoD：
- [ ] 不再通过 `customElements.define(...)` + `document.createElement(...)` 驱动 artifacts。
- [ ] 打开/切换/关闭/复制/下载行为与当前一致。

### Phase C：状态与基础设施收口（P0）

- [ ] `storage/*` 从 legacy 迁到 React 侧主实现目录（可放 `components/webui/state` 或 `features/webui/state`，但只能有一套）。
- [ ] `utils/model-discovery.ts`、`utils/proxy-utils.ts`、`utils/attachment-utils.ts` 去 legacy 化。
- [ ] `components/sandbox/*` 与 `SandboxedIframe` 去 custom element 驱动，改为 React 生命周期管理。

DoD：
- [ ] 会话/设置/provider key/custom providers 行为一致且不依赖 legacy 导出。

### Phase D：删除 façade 与 legacy（P0 收口）

- [x] 删除 `packages/renderer/features/webui/**` 中纯 re-export façade 文件。
- [x] 删除 `packages/renderer/src/components/webui/legacy/**`。
- [ ] 清理兼容别名 API（如 backward compatibility methods）。
- [ ] 全仓搜索确认无 legacy 引用残留。

DoD：
- [x] `rg -n "legacy/features/webui|@renderer/components/webui/legacy" packages apps scripts` 返回 0。

## 6. PR 拆分建议（避免大爆炸）

- [ ] PR-1：切断主入口回跳依赖 + import 收口（只改引用，不改行为）。
- [ ] PR-2：`renderer-registry` React 化。
- [ ] PR-3：`artifacts` React 化（先容器，再各 artifact renderer）。
- [ ] PR-4：`storage/utils/sandbox` 去 legacy 化。
- [ ] PR-5：删除 façade + legacy + 兼容别名，补最终迁移报告。

## 7. 验证与门禁

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm run test:e2e`（至少 chat/artifacts 冒烟）
- [ ] `pnpm run metrics:lit`（仅作辅助指标，不作为完成迁移的唯一依据）
- [x] `pnpm run guard:no-legacy-webui`（硬门禁）

## 8. 风险与应对

- [ ] 风险：artifacts 渲染链复杂，迁移中容易出现功能回退。  
应对：先保留数据模型与事件协议，只替换视图层实现；每个 artifact 各自回归。

- [ ] 风险：回跳链剪断后暴露隐藏耦合。  
应对：先做“只改 import 不改逻辑”的 PR，稳定后再推进运行时替换。

- [ ] 风险：双栈并存时间过长。  
应对：每个 PR 强制包含“删除项”，不接受只新增不清理。

## 9. 当前待办（立即开始）

- [ ] 9.1 输出当前 legacy 依赖清单（按入口/模块分组）。
- [x] 9.2 落 PR-1：主入口去 façade 回跳（第一轮：`renderer/src/components/**` 的 `features/webui/*.js` 引用已改为直连 `@renderer/components/webui/legacy/features/webui/*.js`）。
- [ ] 9.3 落 PR-2：`renderer-registry` React 化。
- [ ] 9.4 落 PR-3：`ArtifactsPanel` React 化并移除 custom element 挂载。
- [x] 9.5 同步更新执行计划文档里已过时的 webui 路径描述，收敛到 `packages/renderer/src/features/webui`。
- [x] 9.6 删除已过时的 legacy 目录叙述，并补上 `guard:no-legacy-webui` 守门。

## 10. 完成判定（必须同时满足）

- [ ] 代码层：无 legacy 导入、无 custom element 主链挂载、无 façade 中转。
- [ ] 业务层：聊天/流式/工具/artifacts/设置/会话管理全可用。
- [ ] 工程层：类型与测试通过，lint 不新增问题。
- [ ] 文档层：迁移完成报告落地，剩余债务明确为 0（或写清楚延后项与截止日期）。
