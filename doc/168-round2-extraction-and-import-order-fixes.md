# doc/168 — 二轮内联 HTML 提取 + 导入顺序修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/167 一轮提取后，全量残留扫描发现 fc2-plugin.tsx 和 fc2-by-123av-plugin.tsx 各有 2 处 HIGH 级别动态内容模板仍为内联 HTML（一轮仅提取了弹窗骨架）。同时深度结构审计发现 5 处 §9.1 导入顺序违规 + 1 处 void YES 死代码 hack。

## 二轮提取清单

| # | 源文件 | 新组件 | 说明 |
|---|--------|--------|------|
| 1 | fc2-plugin.tsx L247-270 | fc2-movie-detail.tsx | FC2 影片详情信息（标题/元数据/演员/剧照） |
| 2 | fc2-plugin.tsx L321-342 | fc2-magnet-item.tsx | FC2 磁链列表项 |
| 3 | fc2-by-123av-plugin.tsx L236-253 | fc2-123av-detail-dialog.tsx | 123Av 详情弹窗骨架 |
| 4 | fc2-by-123av-plugin.tsx L316-323 | fc2-123av-movie-info.tsx | 123Av 影片信息块 |

## 导入顺序修复（§9.1 六组）

| 文件 | 违规 | 修复 |
|------|------|------|
| fc2-plugin.tsx | group5 在 group4 前 | 重排 |
| fc2-by-123av-plugin.tsx | group5 在 group4 前 + core 断裂 | 重排 |
| magnet-hub-plugin.tsx | group5 在 group4 前 | 重排 |
| vlt-sync.tsx | group4 在 group3 前 | 重排 |
| plugin-diagnostics.tsx | group4 在 group3 前 | 重排 |

## 死代码清理

- fc2-by-123av-plugin.tsx：删除 `void YES;` hack + 未使用的 `YES` 导入

## 实施清单

| 文件 | 操作 |
|------|------|
| src/components/fc2-movie-detail.tsx | 新增 |
| src/components/fc2-magnet-item.tsx | 新增 |
| src/components/fc2-123av-detail-dialog.tsx | 新增 |
| src/components/fc2-123av-movie-info.tsx | 新增 |
| src/plugins/fc2-plugin.tsx | 修改（二轮提取 + 导入重排） |
| src/plugins/fc2-by-123av-plugin.tsx | 修改（二轮提取 + 导入重排 + void YES 删除） |
| src/plugins/magnet-hub-plugin.tsx | 修改（导入重排） |
| src/plugins/video-lists-tag/vlt-sync.tsx | 修改（导入重排） |
| src/core/plugin-diagnostics.tsx | 修改（导入重排） |

## 验证记录

- bun run build：✅
- bun run test：✅ 28/28
- bun run lint：✅ 0 errors
- 残留 HIGH 内联 HTML：4 → 0
- 组件总数：97 → 101
