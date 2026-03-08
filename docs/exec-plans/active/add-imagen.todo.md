# 绘图页面（画布 + Nano Banana 生图）TODO

> 日期：2026-03-01
> 目标：新增一个“绘图”页面，左侧是画布，右侧连接 Nano Banana 进行生图
> 原则：Renderer 不直接触达 Node/密钥，统一走 `preload -> main` IPC

## 1. 背景与问题定义

- [ ] 当前 `/draw` 页面右侧是聊天面板（`PiWebChatPanel`），没有专门“生图工作台”
- [ ] 缺少“画布上下文 -> Prompt -> 生图结果”的闭环
- [ ] 缺少稳定的生图任务状态、失败重试、结果资产落盘能力

## 2. 本次目标（V1）

- [ ] 新增“绘图”页面（独立路由），布局为 `左画布 + 右生图面板`
- [ ] 右侧支持连接 Nano Banana（先固定单模型，不做多模型兼容）
- [ ] 支持基础生图参数：Prompt、宽高比、数量
- [ ] 支持展示任务状态：`idle / running / success / error`
- [ ] 支持结果预览与下载（本地文件路径）

## 3. 范围边界

### In Scope

- [ ] 新页面与导航入口
- [ ] 生图 IPC 协议（shared/preload/main）
- [ ] Nano Banana 主进程调用适配层
- [ ] 基础任务状态与错误提示
- [ ] 结果文件保存与展示

### Out of Scope（本轮不做）

- [ ] 多模型切换（如 OpenAI/Google/DashScope 并列）
- [ ] 批量并发任务编排
- [ ] 复杂画布编辑器（先复用现有画布壳，不重写绘图引擎）
- [ ] 历史版本管理与云端同步

## 4. 信息架构与交互

### 页面结构

- [ ] 左侧画布区
  - [ ] 顶栏：页面标题、当前缩放、导入/清空入口
  - [ ] 主区：画布容器（先用现有 Draw 视觉壳）
- [ ] 右侧生图区
  - [ ] Prompt 输入（必填）
  - [ ] 预设参数：`aspectRatio`、`count`
  - [ ] 操作按钮：`生成`、`重试`
  - [ ] 任务状态条：运行中/失败原因/完成耗时
  - [ ] 结果区：缩略图列表 + 下载按钮

### 关键交互

- [ ] 点击“生成”后禁用重复提交，进入 `running`
- [ ] 失败时显示可读错误，并保留上次参数一键重试
- [ ] 成功后自动滚动到结果区并高亮最新图片

## 5. 技术方案（架构）

### A. 路由与页面骨架（Renderer）

- [ ] 新增页面组件：`packages/renderer/src/pages/ImagenPage.tsx`
- [ ] `packages/renderer/src/App.tsx` 增加路由（建议：`/imagen`，标题显示“绘图”）
- [ ] `packages/renderer/src/components/NavigationRail.tsx` 增加入口
- [ ] i18n 增加文案键（中英）

### B. 生图协议（Shared + Preload）

- [ ] 新增共享协议：`packages/shared/src/rpc/imageGen.ts`
  - [ ] `IMAGE_GEN_GENERATE_CHANNEL`
  - [ ] 输入：`prompt`, `aspectRatio`, `count`, `referenceImagePath?`
  - [ ] 输出：`images[]`, `elapsedMs`, `provider`, `model`
- [ ] `apps/desktop/src/preload/index.ts` 暴露 `api.imageGen.generate(...)`
- [ ] Renderer 新增调用封装：`packages/renderer/src/lib/imageGen.ts`

### C. 主进程服务（Main）

- [ ] 新增 `apps/desktop/src/main/services/imageGen/nanoBananaService.ts`
- [ ] 在 `apps/desktop/src/main/index.ts` 注册 IPC handler
- [ ] 读取密钥与配置（仅主进程环境变量）
  - [ ] `REPLICATE_API_TOKEN`（或你最终指定的 Nano Banana 网关密钥）
  - [ ] `NANO_BANANA_MODEL`（默认 `google/nano-banana-pro`）
- [ ] 统一错误码：鉴权失败、参数非法、上游超时、生成失败

### D. 文件落盘与资源读取

- [ ] 输出目录：`app.getPath('userData')/imagen/<yyyy-mm-dd>/`
- [ ] 文件命名：`imagen-<timestamp>-<index>.png`
- [ ] 复用现有资产读取链路（若不足则补 `notesReadAsset` 等效读取）

## 6. 分阶段实施清单

### Phase 1：页面骨架与路由

- [ ] 新建 `ImagenPage` 基础两栏布局
- [ ] 接入导航与路由
- [ ] 保证桌面窗口下可滚动、可收缩

### Phase 2：右侧生图面板（纯前端态）

- [ ] 表单状态管理（`prompt/aspect/count`）
- [ ] 任务状态机（`idle/running/success/error`）
- [ ] 结果列表 UI（先 mock 数据）

### Phase 3：打通 IPC 到 Nano Banana

- [ ] shared/preload/main 协议贯通
- [ ] 接入真实上游调用
- [ ] 完成错误映射与前端提示

### Phase 4：落盘、预览、下载

- [ ] 图片文件写入用户目录
- [ ] 返回可展示路径并渲染缩略图
- [ ] 下载/打开所在目录

### Phase 5：测试与验收

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 手工验收脚本执行一次（见下方验收标准）

## 7. 验收标准（DoD）

- [ ] 导航栏可进入“绘图”页面，布局为左画布右生图
- [ ] 输入 Prompt 后可成功生成至少 1 张图
- [ ] 失败场景可见明确报错并支持重试
- [ ] 生成结果可预览、可下载
- [ ] 不在 Renderer 暴露任何密钥或 Node 能力

## 8. 风险与应对

- [ ] 风险：上游模型/接口波动  
应对：主进程统一适配层，前端不耦合供应商细节
- [ ] 风险：大图生成耗时导致用户误判卡死  
应对：明确 `running` 状态与耗时提示
- [ ] 风险：文件体积大导致磁盘压力  
应对：后续加入“自动清理策略”（V2）

## 9. 当前待办（立即开始）

- [ ] 先确认路由命名：`/imagen`（页面标题“绘图”）
- [ ] 创建 `ImagenPage.tsx` 两栏骨架
- [ ] 建立 `imageGen` IPC 协议骨架（先返回 mock）
