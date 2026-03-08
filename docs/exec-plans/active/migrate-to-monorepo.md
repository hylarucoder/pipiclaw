# 迁移到 Monorepo 计划

> 日期：2026-03-09  
> 目标：将 `pipiclaw` 从单包 Electron 应用演进为适合 agent 持续开发的 monorepo  
> 原则：先抽边界，再抽目录；先提升 agent 可读性，再提升包数量

## 1. 为什么现在做这件事

当前仓库虽然还是单一交付物，但已经出现了清晰的多子系统边界：

- `apps/desktop/src/main`：Electron 主进程、平台能力、文件系统、IPC handler
- `apps/desktop/src/preload`：安全桥接层
- `packages/renderer`：页面、交互、状态、视图
- `packages/shared`：协议、schema、共享配置
- `packages/agent-core`：agent runtime 内核
- `packages/renderer/src/features/webui` + `packages/renderer/src/components/PiWebChatPanel.tsx`：已经长出了 agent/webui runtime 的雏形

这说明当前问题已经不是“目录有点乱”，而是：

- [ ] agent runtime、Electron 平台层、React 表现层开始相互渗透
- [ ] 知识和约束还没有完全沉淀到 repo 内，agent 很难低成本获得完整上下文
- [ ] 迁移计划、架构边界、验证方式还没有形成可机械执行的系统
- [ ] 后续若要扩展成桌面壳 + agent 内核 + 多前端/多运行时，当前结构会快速变贵

所以这次迁移的核心目标不是“为了 monorepo 而 monorepo”，而是：

- [ ] 让 `agent` 成为一等公民，而不是页面里的一团逻辑
- [ ] 让仓库知识成为 system of record，而不是散落在对话和脑子里
- [ ] 让架构边界可被 agent 读取、遵守、验证
- [ ] 让后续 PR 可以更小、更快、更容易并行

## 2. 设计原则（吸收 Harness Engineering 的做法，落到本项目）

### 2.1 Agent 可读性优先

- [ ] repo 内文档、schema、计划、约束必须成为 agent 可发现的一手信息
- [ ] 不把关键设计决策只留在聊天、临时口头约定、外部文档里
- [ ] 架构边界优先表达成目录结构、依赖规则、脚本守门，而不是靠“大家记住”

### 2.2 `AGENTS.md` 只做目录，不做百科全书

- [ ] `AGENTS.md` 保持短小，负责告诉 agent “去哪看”
- [ ] 深层规则放进 `docs/`，并可被版本管理
- [ ] monorepo 迁移完成后，`AGENTS.md` 应明确指向架构总览、plans 索引、包边界说明

### 2.3 计划是一等工件

- [ ] 复杂迁移不靠一次性大爆炸
- [ ] 每一阶段都有明确目标、范围、DoD、风险、回滚方式
- [ ] 所有阶段性决策和妥协都要落在 repo 内可追踪

### 2.4 机械约束胜过口头约束

- [ ] 用 workspace 边界、tsconfig references、lint 规则、脚本检查来表达架构
- [ ] 明确哪些包可以依赖哪些包
- [ ] 禁止 renderer 直接依赖 Electron/Node，禁止 agent-core 依赖 React/DOM

### 2.5 小步快跑，允许高吞吐，但不允许高熵

- [ ] PR 要按边界拆小，不做“重构 + 改行为 + 改样式 + 改目录”四合一
- [ ] 每个阶段都要包含“新增什么”与“删除什么”
- [ ] 迁移完成一块，就删除对应桥接层和过渡兼容，不积压垃圾

## 3. 北极星目标（Definition of Done）

- [ ] 仓库升级为 `pnpm workspace` 驱动的 monorepo
- [ ] `agent` 有独立包边界，并成为产品核心 runtime
- [ ] 协议、schema、共享类型从业务层剥离为稳定共享包
- [ ] Electron 壳、renderer、agent runtime、共享协议职责清晰
- [ ] 架构文档、执行计划、依赖边界、验证脚本全部留在 repo 内
- [ ] 能支撑未来的桌面端、CLI/headless agent、Web 端复用，而不必重写核心 runtime

## 4. 目标结构

```text
.
├── AGENTS.md
├── apps/
│   └── desktop/
│       ├── src/main/
│       └── src/preload/
├── packages/
│   ├── shared/
│   │   ├── src/rpc/
│   │   ├── src/config/
│   │   ├── src/events/
│   │   └── src/types/
│   ├── agent-core/
│   │   ├── src/domain/
│   │   ├── src/session/
│   │   ├── src/runtime/
│   │   ├── src/providers/
│   │   ├── src/tools/
│   │   ├── src/ports/
│   │   └── src/adapters/
│   └── renderer/
│       ├── src/components/
│       ├── src/pages/
│       ├── features/
│       ├── src/lib/
│       └── src/store/
└── docs/
    ├── architecture.md
    ├── plans/
    └── ...
```

说明：

- [x] `apps/desktop`、`packages/shared`、`packages/agent-core` 已落成真实生产边界
- [x] `packages/renderer` 已承载真实 renderer 生产代码
- [ ] `packages/ui` 暂不建立，等 renderer 内形成真正稳定的通用组件后再抽

## 5. 包职责与依赖规则

### `apps/desktop`

职责：

- [ ] Electron app 生命周期、窗口、菜单、原生壳
- [ ] `ipcMain`/`contextBridge` 注册
- [ ] 文件系统、notes、shell、watcher、系统能力
- [ ] 将平台能力适配为 `agent-core` 可调用的 ports

不负责：

- [ ] 持有 agent 业务规则
- [ ] 持有通用 schema
- [ ] 持有 React 视图逻辑

### `packages/shared`

职责：

- [ ] `rpc` schema、事件 payload、共享类型
- [ ] 共享配置模型，如 provider/model 元数据
- [ ] 纯函数、纯类型、无运行时副作用的契约层

不负责：

- [ ] Electron
- [ ] React
- [ ] 具体 provider 调用

### `packages/agent-core`

职责：

- [ ] agent session 生命周期
- [ ] turn execution / streaming orchestration
- [ ] provider/model 抽象
- [ ] tool contract、tool registry
- [ ] memory/context assembler
- [ ] artifact/message 领域模型
- [ ] 面向不同 runtime 的 ports/interfaces

不负责：

- [ ] Electron
- [ ] React
- [ ] DOM / `window`
- [ ] 本地文件系统细节

### `packages/renderer`

职责：

- [ ] 页面、组件、交互、store、UI 态
- [ ] 将 `agent-core` 事件渲染为可交互界面
- [ ] 浏览器侧 adapter，例如 browser shim、纯前端工具渲染器

不负责：

- [ ] Node 能力
- [ ] 直接读写系统资源
- [ ] 维护核心 agent 业务规则

### 硬性依赖规则

- [ ] `packages/shared` 不依赖业务包
- [ ] `packages/agent-core` 只允许依赖 `packages/shared`
- [ ] `packages/renderer` 允许依赖 `packages/shared`、`packages/agent-core`
- [ ] `apps/desktop` 允许依赖 `packages/shared`、`packages/agent-core`
- [ ] `packages/renderer` 禁止依赖 `apps/desktop`
- [ ] `packages/agent-core` 禁止依赖 React、Electron、DOM API

## 6. 现有代码映射（第一批迁移对象）

### Phase 1 优先进入 `packages/shared`

- [x] `packages/shared/src/rpc/chat.ts`
- [x] `packages/shared/src/rpc/settings.ts`
- [x] `packages/shared/src/rpc/notes.ts`
- [x] `packages/shared/src/rpc/imagen.ts`
- [x] `packages/shared/src/config/modelProviders.ts`

原则：

- [x] 先“平移 + 改 import”，不先改行为
- [x] 共享层不引入 Electron / React 依赖

### Phase 1.5 优先抽象为 `packages/agent-core`

当前这些文件里混着应进入 agent-core 的职责：

- [x] `packages/renderer/src/components/PiWebChatPanel.tsx`
- [x] `apps/desktop/src/main/chat/ipcHandlers.ts`
- [x] `apps/desktop/src/main/chat/sessionStore.ts`
- [x] `packages/renderer/src/lib/piModelRuntime.ts`
- [x] `packages/renderer/src/lib/piAiBrowserShim.ts`

不是直接搬文件，而是抽出以下能力：

- [x] `chatSession` / `sessionPersistence` / `chatSessionSnapshot`
- [x] `chatStreamClient` / `chatStreamTransport`
- [x] `piModelRuntime`
- [x] `chatIpcHandlers`
- [x] snapshot / session store ports
- [x] 对 `@mariozechner/pi-agent-core` / `@mariozechner/pi-ai` 的第一层 anti-corruption wrapper

### 当前仍不急着继续抽离的部分

- [ ] `apps/desktop/src/main/index.ts` 的窗口和原生壳逻辑
- [ ] `apps/desktop/src/preload/index.ts` 的桥接实现本身
- [ ] `packages/renderer/src/features/webui/tools/artifacts/*`
- [ ] `packages/renderer/src/features/webui/components/SandboxedIframe.ts`
- [ ] 绝大部分 dialogs / views / page 组件

原因：

- [ ] 它们大多属于平台层或表现层
- [ ] 如果在第一阶段一并搬迁，复杂度会陡增
- [ ] monorepo 的第一刀应该切在“协议与 runtime”，不是“样式和组件”

## 7. 分阶段执行方案

### Phase 0：先建立地基（P0）

- [x] 新增 `pnpm-workspace.yaml`
- [x] 建立 `apps/desktop`、`packages/shared`、`packages/agent-core`、`packages/renderer` 目录骨架
- [x] 设计 tsconfig references 与路径别名
- [x] 更新 `ARCHITECTURE.md`，把包层级、依赖规则、运行边界写成一等信息
- [x] 收敛 `AGENTS.md`：只保留总则 + 文档索引 + 架构指针

DoD：

- [x] 仓库能被 workspace 正常识别
- [x] docs 中已经存在 monorepo 目标结构与边界说明
- [x] 新增包结构不破坏现有开发体验

### Phase 1：抽 `shared`（P0）

- [x] 将 `src/shared/**` 迁移到 `packages/shared/src/**`
- [x] 所有 main/preload/renderer import 改为依赖 `packages/shared`
- [x] 验证 schema 和类型在所有入口仍可用

DoD：

- [x] `src/shared/**` 不再承载生产实现
- [x] 共享协议成为单一可信来源
- [x] `pnpm typecheck` 通过

### Phase 2：抽 `agent-core` 骨架（P0）

- [x] 新建 `packages/agent-core`
- [x] 先做 wrapper，不做大重写
- [x] 抽出 `session`、`streaming`、`provider gateway`、`snapshot/store ports`
- [x] 将当前散在 renderer/main 中的 runtime 逻辑重新归位

DoD：

- [x] agent runtime 有清晰独立入口
- [x] `agent-core` 不依赖 React/Electron
- [x] 桌面端仍可运行现有 chat 主链路

### Phase 3：收口 `apps/desktop`（P1）

- [x] 将 `src/main`、`src/preload` 移至 `apps/desktop/src/`
- [x] 将 Electron 壳逻辑与平台 adapter 收口到 app 层
- [x] `apps/desktop` 通过 ports 连接 `agent-core`

DoD：

- [x] app 层只做壳与平台适配
- [x] 不再承载 agent 业务规则

### Phase 4：整理 `renderer`（P1）

- [x] 建立 `packages/renderer`
- [x] 页面、stores、webui 视图、browser-only adapter 已迁入
- [x] `PiWebChatPanel` 已拆出一部分 UI 层 + runtime 绑定层

DoD：

- [x] renderer 不再自己维护 agent 内核逻辑
- [x] UI 层通过 `shared` + `agent-core` 工作

### Phase 5：机械守门与熵治理（P1）

- [x] 增加 lint/script 守门，检查非法跨包依赖
- [ ] 增加文档索引与计划索引
- [ ] 增加 stale docs / legacy path 清理清单
- [ ] 对迁移完成的桥接层做删除，而不是长期并存

DoD：

- [ ] 可以自动发现架构越界
- [ ] 文档不会长期失真
- [ ] 过渡层数量持续下降，而不是持续上升

## 8. 工程与验证要求

### 必备验证

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:e2e` 至少覆盖 chat 主链路冒烟

### Monorepo 迁移额外守门

- [x] `pnpm run check:boundaries`
- [ ] 检查 `packages/agent-core` 中不得出现 `react`、`electron`、`window`
- [ ] 检查 `packages/shared` 中不得出现运行时副作用
- [ ] 检查 renderer 不得直接 import main/preload 文件
- [ ] 检查 `AGENTS.md` 指向的 docs 路径存在且不过时

### 开发体验目标

- [ ] 本地开发命令仍然简单，不能为了拆包显著恶化日常开发
- [ ] agent 可以在 repo 内直接发现包边界、执行计划、验证方法
- [ ] 尽量支持后续 worktree 并行开发与独立验证

## 9. 风险与应对

- [ ] 风险：一上来做大搬家，导致 Electron 构建链路一起炸  
应对：先抽 `shared`，再抽 `agent-core`，最后移动 app 壳与 renderer

- [ ] 风险：`agent-core` 名义独立，实际上继续偷偷依赖 Electron/React  
应对：通过包依赖、lint、搜索脚本机械禁止

- [ ] 风险：迁移过程中桥接层越积越多  
应对：每个 Phase 都要求“新增项 + 删除项”同时存在

- [ ] 风险：文档很快过时，agent 又回到猜测状态  
应对：把架构文档和计划纳入迁移 DoD，并增加文档清理任务

## 10. 当前待办（立即开始）

- [x] 10.1 增加跨包依赖守门，防止 `renderer -> desktop` 或 `agent-core -> react/electron`
- [x] 10.2 清理旧计划目录里的 stale 路径与已过时说明
- [ ] 10.3 继续压缩 `packages/renderer/src/components/webui/legacy/**` 过渡层
- [ ] 10.4 评估是否把稳定 UI 原语再抽为 `packages/ui`
- [ ] 10.5 为后续 `agent` 扩展补齐 session/tool/provider 级别的包内文档

## 11. 完成判定（必须同时满足）

- [ ] 仓库结构层：workspace 与包边界已建立
- [ ] 架构层：agent runtime、平台层、表现层、共享协议层清晰分离
- [ ] 工程层：lint/typecheck/test 通过，关键链路不回退
- [ ] 文档层：计划、架构、约束、验证方式都在 repo 内可发现
- [ ] 维护层：不再需要靠聊天上下文来推断“这个逻辑应该放哪”

## 12. 参考

- [ ] OpenAI, “Harness engineering: leveraging Codex in an agent-first world”  
  https://openai.com/index/harness-engineering/

本文对本项目最值得吸收的不是“照搬他们的目录”，而是以下心法：

- [ ] repo 内知识才算真实存在
- [ ] agent legibility 是第一目标
- [ ] `AGENTS.md` 应是目录，不是百科
- [ ] 架构边界要能被机械验证
- [ ] 计划与清理都要版本化
