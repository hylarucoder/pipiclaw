# Use React Hook Form Todo

参考文档: https://ui.shadcn.com/docs/forms/react-hook-form

## 0. 统一规范（先定规矩）
- [ ] 所有新表单统一使用 `react-hook-form + zodResolver`
- [ ] 字段渲染统一采用 `Controller + Field` 模式
- [ ] 错误态统一: `Field` 上加 `data-invalid`，控件上加 `aria-invalid`
- [ ] 提交与重置统一: `handleSubmit` + `form.reset`
- [ ] 默认验证策略统一: `mode: 'onSubmit'`（特殊场景单独说明）

## 1. 基础设施准备
- [ ] 安装依赖: `react-hook-form`、`@hookform/resolvers`
- [ ] 增补 shadcn 表单相关组件（按实际用到优先）:
- [ ] `field`（`Field/FieldLabel/FieldDescription/FieldError/FieldGroup/FieldSet`）
- [ ] `switch`、`radio-group`（当前 `ui` 目录里还没有）
- [ ] 建立表单公共层: `packages/renderer/src/lib/forms/`
- [ ] `createForm` 或 `useZodForm`（封装 resolver/mode 默认值）
- [ ] `form-error-map.ts`（统一错误文案映射，可选）

## 2. 渐进迁移顺序

### Phase A（React 页面先落地）
- [ ] `packages/renderer/src/pages/SettingsPage.tsx` 全量迁移为 RHF
- [ ] 优先覆盖: Workspace、Preview、模型配置等配置表单
- [ ] 把现有 `useState + onChange` 逐段替换为 `form.control`

### Phase B（交互型页面）
- [ ] `packages/renderer/src/pages/KanbanPage.tsx` 的筛选区评估是否纳入 RHF
- [ ] `packages/renderer/src/pages/ProjectDashboardPage.tsx` 的筛选区评估是否纳入 RHF
- [ ] 仅在有校验/提交语义时使用 RHF；纯即时过滤输入可保持轻量

### Phase C（webui）
- [ ] 先完成 `webui` 到 React + shadcn 的组件迁移（见 `webui-migrate-md.todo.md`）
- [ ] 再将 webui 的设置/Provider/API Key/Session 表单接入 RHF
- [ ] 禁止在迁移后继续新增 mini-lit 表单实现

## 3. 字段类型落地清单（按官方范式）
- [ ] `Input`: `...field` + `aria-invalid`
- [ ] `Textarea`: `...field` + `aria-invalid`
- [ ] `Select`: `value={field.value}` + `onValueChange={field.onChange}`
- [ ] `Checkbox`（数组）: 手动处理 `checked` 与数组增删
- [ ] `RadioGroup`: `value/onValueChange` 绑定 `field`
- [ ] `Switch`: `checked/onCheckedChange` 绑定 `field`
- [ ] 动态数组: `useFieldArray` + `append/remove`

## 4. 开发约束
- [ ] schema 与 UI 同文件夹共置，命名统一 `*.schema.ts`
- [ ] 每个表单输出明确类型: `z.infer<typeof schema>`
- [ ] 禁止同一字段同时由 `useState` 和 RHF 控制
- [ ] 表单提交只走 `onSubmit`，不在按钮里散落业务写入逻辑

## 5. 测试与验收
- [ ] 单元测试: schema 校验、submit payload、reset 行为
- [ ] 交互测试: 错误提示出现/消失、禁用态、默认值回填
- [ ] 可访问性检查: `label for`、`aria-invalid`、键盘可达
- [ ] 回归验证: `pnpm typecheck && pnpm lint && pnpm test`

## 6. 完成定义（DoD）
- [ ] 主要配置表单（至少 SettingsPage）完成 RHF 化
- [ ] 新增表单 PR 默认必须遵循本计划规范
- [ ] 代码库内不再新增 `useState` 驱动的“伪表单”提交流
