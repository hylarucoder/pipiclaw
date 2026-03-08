# React Class Components -> Functional Components 迁移计划

> 日期：2026-02-28  
> 范围：`packages/renderer/src/**`（React 渲染层）  
> 目标：React class component 全量迁移为 functional component，并建立长期防回归机制。

## 0. 迁移目标

- [ ] 代码库中不再存在 React class component（`extends React.Component / PureComponent`）。
- [ ] 全部 React UI 组件统一为函数式组件（Hooks 驱动）。
- [ ] CI 对 class component 引入具备硬性拦截能力。

## 1. 基线盘点（已完成）

- [x] 扫描 `packages/renderer/src/**` 中 class component：
  - `rg -n "class\\s+[A-Z][A-Za-z0-9_]*\\s+extends\\s+(React\\.)?(Component|PureComponent)"`
  - `rg -n "React\\.Component|React\\.PureComponent"`
- [x] 结果：当前 **0 个 React class component**。
- [x] 风险说明：`packages/renderer/src/features/webui/**` 下存在大量 `LitElement` class，这些不是 React class component，本计划不覆盖。

## 2. 执行策略

- [ ] 策略 A（当前主路径）：零存量治理 + 防回归。
- [ ] 策略 B（兜底路径）：如果后续发现新增/遗留 class component，按标准迁移手册逐个迁移。

## 3. 防回归改造（优先级 P0）

- [ ] 在 lint 规则中增加禁止 React class component 规则（目标文件：`.oxlintrc.json`）。
- [ ] 增加仓库级检查脚本（建议）：`pnpm run guard:react-class`。
- [ ] CI 接入守门：`lint -> guard:react-class -> typecheck -> test`。
- [ ] 在贡献规范中写明：新增 React 组件必须为 functional component。

建议守门命令（计划实现）：

```bash
rg -n "class\\s+[A-Z][A-Za-z0-9_]*\\s+extends\\s+(React\\.)?(Component|PureComponent)" packages/renderer/src -g"*.tsx" -g"*.ts"
```

退出码非 0 视为通过（未找到）；退出码 0 视为失败（发现 class component）。

## 4. 标准迁移手册（兜底，发现即用）

- [ ] 4.1 组件识别与分级
  - [ ] 简单组件：只含 `render` + props。
  - [ ] 中等组件：含 state / handlers。
  - [ ] 复杂组件：含生命周期、副作用、性能优化、ref、错误边界。

- [ ] 4.2 代码迁移映射
  - [ ] `state` -> `useState` / `useReducer`。
  - [ ] `componentDidMount/WillUnmount` -> `useEffect` cleanup。
  - [ ] `componentDidUpdate` -> `useEffect` + 依赖数组。
  - [ ] `shouldComponentUpdate/PureComponent` -> `React.memo` + `useMemo/useCallback`。
  - [ ] 实例方法 -> 函数内闭包方法。
  - [ ] `createRef` -> `useRef`。

- [ ] 4.3 类型与 API 对齐
  - [ ] props/state/interface 迁移为函数签名与 hooks 类型。
  - [ ] 保持对外 props 契约不破坏。
  - [ ] 避免兼容双实现（不保留 class + function 并存）。

- [ ] 4.4 回归验证
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] 关键页面手工验证（交互、焦点、键盘、性能）。

## 5. 特殊场景约束

- [ ] Error Boundary 例外策略明确：
  - [ ] 如必须用 class Error Boundary，统一收敛到单一基础设施组件并文档化。
  - [ ] 业务组件禁止用 class 承担 Error Boundary 职责。
- [ ] 第三方库若要求 class 包装：
  - [ ] 仅允许在适配层隔离，业务 UI 保持 functional。

## 6. 里程碑与 DoD

### M1：基线冻结

- [x] React class component = 0
- [ ] 防回归规则 PR 合入

### M2：CI 守门上线

- [ ] 本地与 CI 一致执行 `guard:react-class`
- [ ] 新增 class component 能被 CI 拦截

### M3：长期治理完成

- [ ] 文档、脚本、规则全部落地
- [ ] 连续 2 周无新增违规

## 7. 验收标准

- [ ] `packages/renderer/src/**` 不存在 React class component。
- [ ] 新增 React 组件默认使用 functional + hooks。
- [ ] 迁移后无行为回归（类型检查 + 测试 + 关键路径手测通过）。

## 8. 本轮结论

- [x] 当前仓库 React 渲染层已满足“0 React class component”。
- [ ] 下一步重点是“制度化防回归”，而不是批量代码改写。
