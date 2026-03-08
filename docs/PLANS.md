# PLANS

这里是执行计划总入口，只负责告诉你“现在该看哪”，不承载具体实施细节。

## How To Read

阅读顺序建议如下：

1. 当前主线先看 `docs/exec-plans/active/migrate-to-monorepo.md`
2. 涉及 WebUI 架构迁移，再看 `docs/exec-plans/active/just-migrate-react.todo.md`
3. 涉及某个具体主题时，再进入对应 active plan
4. 只想了解历史决策或已完成工作，再看 `docs/exec-plans/completed/*`

## Directory Rules

- `docs/exec-plans/active/`：仍在推进、仍会指导当前代码改动的执行计划
- `docs/exec-plans/completed/`：已经完成，或主要价值已转为历史记录/验收记录的计划
- `docs/exec-plans/tech-debt-tracker.md`：跨计划、暂不单独立项但需要长期跟踪的债务
- `docs/runbooks/`：操作手册，不是执行计划；用于手工验证、同步流程、日常维护

判断一个计划是否还该放在 `active/`，用这三个问题：

- 它是否仍直接指导今天的代码改动？
- 它是否还有明确未完成的 DoD，而不是只剩零散尾项？
- 它是否代表未来路线，而不只是过去工作记录？

只要上面三问大多是否定，就应迁入 `completed/`。

## Active

当前优先级从高到低大致如下：

- `docs/exec-plans/active/migrate-to-monorepo.md`
- `docs/exec-plans/active/just-migrate-react.todo.md`
- `docs/exec-plans/active/add-imagen.todo.md`
- `docs/exec-plans/active/use-react-hook-form.todo.md`
- `docs/exec-plans/active/pi-web-ui-vendor.todo.md`
- `docs/exec-plans/active/webui-migrate-md.todo.md`
- `docs/exec-plans/active/migrate-shadcn.todo.md`
- `docs/exec-plans/active/migrate-lit-to-shadcn.md`
- `docs/exec-plans/active/migrate-litelement-to-react-functional-components.todo.md`
- `docs/exec-plans/active/migrate-class-component-to-functional-components.todo.md`

## Completed

- `docs/exec-plans/completed/README.md`
- `docs/exec-plans/completed/board.todo.md`
- `docs/exec-plans/completed/kanban.todo.md`

## Tech Debt

- `docs/exec-plans/tech-debt-tracker.md`

## Runbooks

- `docs/runbooks/README.md`
