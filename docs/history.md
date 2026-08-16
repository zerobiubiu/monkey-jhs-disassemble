# 变更历史

## 2026-08-16 — v1.46.4 / doc/243

- **修复**：迁移改用批量 IndexedDB 事务，避免逐条事务阻塞首次启动。
- **验证**：TypeScript、188 个测试、ESLint、结构检查和生产构建通过。
- **浏览器验证**：真实 JavDB 标签页的迁移状态为 `complete`，IndexedDB 保存 62,008 条格式正常记录，迁移涉及的旧 localStorage key 均已清理。

## 2026-08-16 — v1.46.3 / doc/243

- **需求摘要**：将 JavDB 大型 localStorage 缓存及恢复日志迁移到独立 IndexedDB，降低配额错误导致清单同步失败的风险。
- **执行结果**：新增 `JAV-JHS-PersistentData`，完成按条目迁移、校验、清理、失败降级、备份导入导出兼容；保留现有 `JAV-JHS/appData`、`MissAV-CarStatus`、GM 跨站数据和未知旧 key。
- **影响范围**：JavDB 缓存/恢复日志/评分缓存/设置备份；MissAV 运行数据不变。
- **验证情况**：188 个测试通过，TypeScript、ESLint、结构门禁、生产构建通过；真实浏览器迁移尚未执行。
- **关联文档**：[`243-indexeddb-persistent-data-migration.md`](243-indexeddb-persistent-data-migration.md)。
