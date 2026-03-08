# Kanban Logic Migration TODO

## Context

目标：将 `rantnote` 的任务看板核心逻辑迁移到 `pipiclaw`，让看板内部实体统一为 `Task`，不再混用 `Project` 语义。

源项目路径：`/Users/lucasay/Workspace/Projects/project-short-video/rantnote`

## Source-of-Truth Modules (from rantnote)

- `packages/renderer/src/store/createKanbanStore.ts`
  - 通用看板 store 工厂（scope 隔离、`byId + orderByStatus`、拖拽动作）
- `packages/renderer/src/store/kanbanStore.ts`
  - Task 特化 store（`TaskStatus` + selectors）
- `packages/renderer/src/store/__tests__/kanbanStore.test.ts`
  - 核心行为测试（加载、迁移、列内排序、跨列移动）

## Target Mapping (pipiclaw)

- 状态管理目录：`packages/renderer/src/store/`
- 任务类型定义：`packages/renderer/src/pages/task-types.ts`
- 任务数据 seed：`packages/renderer/src/pages/task-seed.ts`
- 看板页面：`packages/renderer/src/pages/KanbanPage.tsx`

## Migration Plan

### Phase 1 - Task Domain 对齐

- [x] 定义 `TaskStatus`（`backlog/todo/doing/in-review/done/canceled`）
- [x] 定义 `TaskRecord`（标题、摘要、负责人、优先级、截止时间等）
- [x] 提供 `isTaskStatus` 类型守卫

验收：看板页面和 store 的输入输出全部使用 `Task`。

### Phase 2 - Task Store 特化

- [x] 新建 `packages/renderer/src/store/taskKanbanStore.ts`
- [x] 基于 `createKanbanStore<TaskRecord, TaskStatus>` 生成 Task 看板 store
- [x] 暴露 `selectTaskKanbanItems` / `selectTaskKanbanLoading` / `selectTaskKanbanActiveId`

验收：任务卡可在本地状态中完成加载、排序、跨列迁移。

### Phase 3 - 页面语义修正（Project -> Task）

- [x] `KanbanPage` 卡片字段切换到任务语义（`title/priority/projectName`）
- [x] 列定义切换到任务状态流
- [x] 拖拽逻辑切换到 `task` 维度
- [x] 页面标题/文案明确“任务看板”

验收：页面不再出现“项目卡片”语义，拖拽行为以任务为单位。

### Phase 4 - 回归验证

- [x] 新增 `taskKanbanStore` 单测
- [x] 跑通 `typecheck` + `test` + `lint`

验收：新增逻辑可回归，且不破坏既有页面。

## Non-Goals

- 不在本次引入任务持久化到磁盘
- 不在本次引入任务评论/子任务
- 不重做项目仪表盘（`ProjectDashboardPage`）

## Definition of Done

- 看板内部统一为 `Task` 语义
- 拖拽迁移以任务状态流为准
- 相关文档、类型、store、测试均一致
