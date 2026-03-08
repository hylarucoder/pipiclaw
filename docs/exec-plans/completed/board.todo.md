# 任务看板拖拽持久化 TODO

> 日期：2026-02-28  
> 范围：`packages/renderer/src/pages/KanbanPage.tsx` + `notes` IPC 读写链路  
> 目标：任务卡拖拽（跨列/列内）后，刷新页面仍保持结果，不再丢失

## 1. 背景与问题定义

- [x] 当前看板拖拽只改了内存态（zustand store）
- [x] 页面初始数据来自 Notes markdown 扫描 + frontmatter 解析
- [x] 未写回 markdown，刷新后会被文件内容覆盖，导致拖拽结果丢失（已修复）

## 2. 本次目标（V1）

- [x] 拖拽跨列后持久化 `status` 到对应任务 markdown frontmatter
- [x] 卡片按钮迁移（如“开始执行/标记完成”）同样持久化
- [x] 写入失败时可见错误提示，并回滚本地状态
- [x] 完成后刷新页面，状态与拖拽结果一致

## 3. 范围边界

### In Scope
- [x] `status/state` 字段写回（统一写为 `status`）
- [x] Notes IPC 增加安全写文件能力
- [x] 看板页面接入“乐观更新 + 持久化 + 失败回滚”

### Out of Scope（本轮不做）
- [ ] 列内排序顺序持久化（V2 再做，可考虑 `kanbanOrder`）
- [ ] 批量拖拽/撤销重做
- [ ] 非 markdown 任务源

## 4. 设计决策

- [x] 单条任务作为持久化最小单元：一次拖拽只写一个任务文件
- [x] 以 `TaskRecord.id = notes-task:<relativePath>` 反解目标文件路径
- [x] 保留原文主体内容，仅更新 frontmatter 的 `status`（若无 frontmatter 则补一个最小 frontmatter）
- [x] 采用“先本地更新、后异步落盘”策略，失败则回滚并提示

## 5. 实施清单

### A. 扩展 Notes 写入 RPC（主进程/预加载/共享协议）
- [x] `packages/shared/src/rpc/notes.ts`
- 新增 `NOTES_WRITE_FILE_CHANNEL`
- 新增 `notesWriteFileInputSchema / notesWriteFileResultSchema`
- 输入包含 `relativePath`、`content`（可选 `rootDir`）
- [x] `apps/desktop/src/main/index.ts`
- 增加 `handleWriteNotesFile`
- 复用 `resolveSafeNotesPath` 防路径穿越
- 使用原子写（建议 `write temp -> rename`）
- [x] `apps/desktop/src/preload/index.ts`
- 暴露 `api.notes.writeFile(...)`
- [x] `packages/renderer/src/lib/notes.ts`
- 新增 `invokeNotesWriteFile(...)`

### B. 看板持久化工具层
- [x] 新建 `packages/renderer/src/pages/kanban-persistence.ts`
- `taskId -> relativePath` 解析函数
- `updateTaskStatusInMarkdown(content, status)`：只改 frontmatter，正文保持不变
- 统一状态映射（`in-review`、`canceled` 等）
- [x] 单元测试：`packages/renderer/src/pages/kanban-persistence.test.ts`
- 覆盖“有 frontmatter / 无 frontmatter / status 已存在 / state 兼容键”场景

### C. KanbanPage 接入
- [x] `packages/renderer/src/pages/KanbanPage.tsx`
- 在 `handleDragEnd` 与按钮 `onMoveStatus` 中接入 `persistTaskStatus`
- 维护 `pendingByTaskId`，避免同一任务并发写冲突
- 持久化失败时：回滚到变更前状态 + 显示错误文案
- 成功后：更新任务 `updatedAt`（可选）

### D. 交互与可观测性
- [x] 页面增加轻量反馈（例如 header 文本或 toast）：`保存中... / 保存失败`
- [x] 控制台日志带 `taskId + relativePath + targetStatus` 方便排错

## 6. 验收标准

- [ ] 手动拖拽 `todo -> doing -> done` 后刷新页面，状态保持一致
- [ ] 卡片按钮迁移状态后刷新页面，状态保持一致
- [ ] 人为制造写入失败（只读文件/非法路径）时，UI 回滚且有错误提示
- [x] `pnpm typecheck && pnpm test` 通过

## 7. 风险与应对

- [ ] 风险：frontmatter 解析/回写破坏原文格式  
应对：只做最小变更；写入函数单测覆盖多种文档形态
- [ ] 风险：快速连续拖拽导致后写覆盖前写  
应对：按 `taskId` 串行写入，后一次写基于最新状态
- [ ] 风险：文件监听回流导致 UI 抖动  
应对：写入成功后仅做必要状态同步，避免全量强刷

## 8. 里程碑

- [x] M1：RPC 写入链路打通（可从 renderer 写任意 notes 文件）
- [x] M2：单任务 `status` 可持久化且失败可回滚
- [x] M3：拖拽与按钮入口全部接入 + 回归通过
