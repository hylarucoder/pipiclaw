# Agent-Readable Repo Guardrails

> 参考：OpenAI《Harness Engineering / 工程技术：在智能体优先的世界中利用 Codex》（2026-02-11）

这份文档不是迁移计划，而是仓库长期守则。

目标只有一个：让 repo 本身成为 agent 和人都能直接读取、直接执行、直接验证的 system of record。

## 1. 黄金原则

### 1.1 Repo 内文档优先

- 关键架构边界、迁移阶段、运行约束必须落在仓库里。
- 不把关键决策只留在聊天记录、脑内记忆、临时口头约定里。

### 1.2 `AGENTS.md` 只做入口

- `AGENTS.md` 负责告诉 agent 去哪里看。
- 深层规则、计划、runbook 放进 `docs/`。

### 1.3 单一真源优先

- 同一份生产逻辑只保留一处真实实现。
- 迁移完成后立即删除 façade、旧路径、兼容桥接，不长期双栈并存。

### 1.4 机械约束优先

- 能用 lint、typecheck、边界检查、guard script 表达的规则，不只写“约定”。
- 文档负责解释为什么，脚本负责阻止回退。

### 1.5 迁移必须带删除项

- 每个迁移 PR 都应该同时回答：
  - 新的真源在哪里
  - 删掉了什么旧路径/旧桥接
  - 如何机械验证没有回流

## 2. 当前仓库的硬约束

### 2.1 WebUI 真源

- `packages/renderer/src/features/webui` 是当前唯一 webui feature 真源。
- `packages/renderer/features/webui` 已删除，不允许重建。
- 旧的 legacy webui 过渡桥接已删除，不允许重建或重新引入 import。

### 2.2 Monorepo 边界

- `packages/shared` 不依赖业务包。
- `packages/agent-core` 只允许依赖 `packages/shared`。
- `packages/renderer` 允许依赖 `packages/shared`、`packages/agent-core`。
- `packages/renderer` 不直接依赖 desktop 壳层。
- `packages/agent-core` 不依赖 React、Electron、DOM globals。

## 3. 读仓顺序

当 agent 或新同学需要建立上下文时，默认按这个顺序读：

1. `AGENTS.md`
2. `docs/PLANS.md`
3. `ARCHITECTURE.md`
4. 与当前任务直接相关的 `docs/exec-plans/active/*` / `docs/runbooks/*`
5. 实际生产代码

如果文档与代码不一致：

- 先以 `docs/exec-plans/active/*` 和实际代码为准
- 再在同一轮改动里把入口文档补齐

## 4. 变更检查清单

涉及架构、目录、运行边界、迁移收口时，提交前至少自查：

1. 有没有明确新的单一真源？
2. 有没有顺手删除旧路径/桥接/兼容层？
3. `AGENTS.md` / `ARCHITECTURE.md` / 相关 plan 是否同步？
4. 有没有把规则变成脚本或 lint，而不是只写文字？
5. 是否还能让 agent 在不猜的情况下读懂？

## 5. 机械守门

当前仓库已经接入的守门命令：

- `pnpm lint`
- `pnpm run check:boundaries`
- `pnpm run guard:webui-source`
- `pnpm run guard:no-legacy-webui`
- `pnpm run typecheck:monorepo`

预期使用方式：

- 日常开发至少跑 `pnpm lint && pnpm typecheck`
- 涉及边界、目录、迁移收口时，额外跑 `pnpm run typecheck:monorepo`

## 6. 何时要主动“垃圾回收”

出现下面任一情况，就不要继续拖：

- 同一逻辑在两个目录各有一份
- 目录名已经过时，但 import 还在沿用
- 文档写的是旧结构，代码已经迁走
- 为了“稳一点”又新增了一层 façade / compatibility shim

原则：

- 先收口，再扩展
- 先删除旧路径，再继续新功能
