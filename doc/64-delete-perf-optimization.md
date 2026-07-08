# 64. 删除清单性能优化：乐观 UI + 并行执行

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

用户反馈删除清单操作"慢"——从点击删除到看到清单消失需要等待
较长时间。

### 瓶颈分析

删除流程链路（doc/62 原方案）：

```
点击删除 → 捕获拦截(<1ms) → confirm()等待用户
  → showToast('正在删除') → GM_xmlhttpRequest DELETE(等服务器)
  → VltDb.deleteList(IDB) → 广播 → 移除DOM → toast成功
```

| 步骤 | 耗时 | 说明 |
|------|------|------|
| 捕获拦截 | <1ms | 同步，可忽略 |
| confirm() | 用户交互 | 不计入延迟 |
| GM_xmlhttpRequest DELETE | **数百ms~数秒** | **最大瓶颈**：JavDB 服务器处理删除（清单+关联表+计数），网络往返 |
| VltDb.deleteList | ~50ms | IndexedDB 读写 83KB / 3563 条关联，非瓶颈 |
| 广播+DOM移除 | <5ms | 可忽略 |

**根因**：原方案串行执行——先 `await` 服务器响应，再删 IDB，最后
才移除 DOM。用户必须等服务器返回才能看到清单消失。

实测数据：
- `vlt_movie_inventory`：3563 条关联，JSON 83KB
- `vlt_inventory`：13 条清单，JSON 2KB

## 方案

### 乐观 UI 更新 + 并行执行

```
点击删除 → confirm() → 立即移除DOM + showToast('正在同步')
  → 并行: [GM_xmlhttpRequest DELETE] + [VltDb.deleteList]
  → 都完成 → 广播 → toast最终结果
```

1. **confirm 后立即移除 DOM**：用户即时看到清单消失，不等服务器
2. **网络请求与 IDB 删除并行**（`Promise.all`）：两者互不依赖，
   并行执行节省 IDB 操作的 ~50ms
3. **无论服务器是否成功都广播**：本地数据已清除，其他页面需同步
4. **服务器失败时 toast 警告**：`⚠ 本地数据已清除，服务器响应异常，
   刷新后确认`（不恢复 DOM，因为服务器大概率已删除只是响应慢/超时）

### 失败场景处理

| 场景 | DOM | IDB | 服务器 | toast |
|------|-----|-----|--------|-------|
| 正常 | 立即消失 | 已删 | 已删 | `✓ 清单已删除` |
| 服务器慢/超时 | 立即消失 | 已删 | 可能已删 | `⚠ 本地已清除，服务器响应异常` |
| 网络错误 | 立即消失 | 已删 | 未删 | `⚠ 本地已清除，服务器响应异常` |

网络错误时服务器未删但本地已删→刷新页面后 DOM 清单重新出现（服务器
还在），IDB 无记录→不一致但可自愈（用户可重新删除）。大多数情况下
服务器删除成功只是响应慢，乐观更新是正确选择。

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | 重写 `handleListDeletion`：乐观 UI（立即移除 DOM）+ `Promise.all` 并行（DELETE 请求 + IDB 删除）；提取 `sendDeleteRequest` 辅助函数；服务器失败时 warning toast 而非 error |
| `vite.config.ts` | 版本 1.7.2 → 1.7.3（性能优化，patch 递增） |

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.20s
dist/monkey-jhs-disassemble.user.js  1,842.86 kB │ gzip: 421.66 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 零错误零警告

### 数据量实测

- `vlt_movie_inventory`：3563 条关联，JSON 83KB → IDB get/put 各约 20-30ms
- `vlt_inventory`：13 条清单，JSON 2KB → IDB get/put 各约 5ms
- VltDb.deleteList 总耗时估计：~50ms（2次get + 遍历 + 2次put）
- 瓶颈确认：网络请求（GM_xmlhttpRequest DELETE 等待 JavDB 服务器）

## 后续验证建议

在 `/users/lists` 页面（脚本更新后刷新）：

1. 点击清单「刪除」→ 确认
2. **清单应立即从 DOM 消失**（不等服务器响应）
3. toast 显示「正在同步删除…」
4. 服务器响应后（数百ms~数秒）toast 变为：
   - 成功：`✓ 清单已删除（N 条关联已清除）`
   - 异常：`⚠ 本地数据已清除（N 条关联），服务器响应异常，刷新后确认`
5. 控制台日志：`删除完成: listId=xxx server=true inventory=true associations=N`
