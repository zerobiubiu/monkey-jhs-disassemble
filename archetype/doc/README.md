# jhs.user.js 文档

## 文档清单

| 文件 | 类型 | 状态 | 说明 |
|------|------|------|------|
| `01-trim-aliyun-task-tip.md` | 🔧开发指导 | ✅已执行 | 删除阿里云盘备份、定时任务、打赏作者三大块功能，保留 WebDav 备份 |
| `02-remove-cover-button-plugin.md` | 🔧开发指导 | ✅已执行 | 删除列表页封面快捷按钮功能（CoverButtonPlugin）及 5 个开关配置项 |
| `03-simplify-to-javdb-only.md` | 🔧开发指导 | ✅已执行 | 精简为 javdb 专用脚本，删除 17 个非 javdb 插件类及相关引用 |
| `04-rating-api-direct.md` | 🔧开发指导 | ✅已执行 | 评分按钮改用 javdb API 直连（修复 DOM form 误提交 + execRailsJs + Promise 链串行化） |
| `05-star-rating-and-list-panel.md` | 🔧开发指导 | ✅已执行 | 星星评分组件替代按钮 + 清单平铺到 #otherSiteBox 下方 + 隐藏原生评价元素 |
| `06-jhsRatingDisplay-refresh-fix.md` | 🔧开发指导 | ✅已执行 | jhsRatingDisplay 刷新机制修复（_invalidateCards 遍历匹配 + watchedMap 实时更新 + 跨标签页精确刷新） |
| `07-remove-setting-site-btn.md` | 🔧开发指导 | ✅已执行 | 删除 OtherSitePlugin 的 settingSiteBtn 设置按钮和 settingsArea 区域 |
| `08-remove-hasdown-ui.md` | 🔧开发指导 | ✅已执行 | 删除「已下载」(hasDown) 状态的全部 UI 和功能代码（38 处修改） |
| `09-remove-hasdown-constants.md` | 🔧开发指导 | ✅已执行 | 删除「已下载」常量定义（const g/y/x）和 storageManager 兼容分支（case g:） |

## 类型图例

- 📋 接口契约：前后端对接的 API 规格
- 🔧 开发指导：待执行/已执行的技术修改方案
- 📄 参考说明：调试记录、设计规格、备忘信息
- 🚀 部署运维：部署步骤、环境配置、密钥管理

## 状态图例

- ✅ 已执行：历史定稿，永不可改
- 🔧 待执行：尚未实施
- 📄 参考：仅供参考
- ⚠️ 已过期：不再适用

## 阅读顺序

1. `01-trim-aliyun-task-tip.md` — 了解 2026-07 精简改动（阿里云盘/定时任务/打赏）
2. `02-remove-cover-button-plugin.md` — 了解 2026-07 删除封面快捷按钮功能
3. `03-simplify-to-javdb-only.md` — 了解 2026-07 精简为 javdb 专用脚本
4. `04-rating-api-direct.md` — 了解 2026-07 评分按钮改 API 直连（3 个 bug 修复）
5. `05-star-rating-and-list-panel.md` — 了解 2026-07 星星评分组件 + 清单平铺 + 隐藏原生元素
6. `06-jhsRatingDisplay-refresh-fix.md` — 了解 2026-07 jhsRatingDisplay 刷新机制修复（4 个 bug 修复）
7. `07-remove-setting-site-btn.md` — 了解 2026-07 删除 settingSiteBtn 设置按钮
8. `08-remove-hasdown-ui.md` — 了解 2026-07 删除「已下载」状态标签
9. `09-remove-hasdown-constants.md` — 了解 2026-07 删除「已下载」常量定义和兼容分支

## 相关文件

- 脚本：`archetype/jhs.user.js`
