# hooks

这个目录只放 **通用 hooks**（与业务无关）。

业务相关的数据请求 / mutation hooks 已迁移到 `src/features/*` 下：
- devices / channels / telemetry / runs / runWindows

这样可以避免 `hooks/` 无限膨胀，便于长期维护。
