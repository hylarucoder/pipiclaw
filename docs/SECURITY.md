# SECURITY

安全约束入口。

当前关键约束：

- renderer 不直接访问 Node API
- 特权能力通过 preload / main 暴露
- 用户本地配置与 notes 路径按本机私有状态处理
