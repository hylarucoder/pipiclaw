# Runbooks

这里存放可重复执行的操作手册，不承担架构决策，也不承担执行计划职责。

## 适合放在这里的内容

- 手工冒烟检查
- vendor 同步步骤
- 发布前检查清单
- 故障排查与恢复流程

## 当前 runbooks

- `docs/runbooks/chat-manual-smoke.md`
  - 聊天主链路手工验证清单
- `docs/runbooks/pi-web-ui-vendor-sync.md`
  - 本地 vendor 的上游同步步骤

## 与其他文档的边界

- 要讲“为什么这样设计”，写到 `ARCHITECTURE.md` 或 `docs/design-docs/*`
- 要讲“接下来怎么做”，写到 `docs/exec-plans/active/*`
- 要讲“已经做完了什么”，沉到 `docs/exec-plans/completed/*`
- 要讲“具体怎么操作”，才写到 `docs/runbooks/*`
