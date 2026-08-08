# 评价状态冲突弹窗：让用户选择以哪一侧为准

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.45.0 → 1.45.1（patch，doc/234 增强）
> **前置文档**：doc/234（评价/收藏/清单与 JavDB 状态自动校验同步）

## 1. 背景

doc/234 的自动校验同步中，方向 3（脚本与服务器双方均有评价状态但不一致，如
脚本已看 2 星 vs 服务器已看 4 星、脚本收藏 vs 服务器已看）原先**跳过并记录日志**。
用户反馈：冲突场景不应静默跳过，应**弹出确认弹窗让用户选择使用谁的数据**。

## 2. 方案

### 2.1 冲突弹窗（新组件 `review-conflict-dialog.tsx`）

`layer.open` type:1 内容弹窗（中标题「评价状态冲突 - 番号」），展示双方状态描述：

- **脚本记录**：⭐ 已收藏（想看）/ 🔍 已看 N 星 / 🚫 已拉黑
- **网站数据**：⭐ 想看 / 🔍 已看 N 星

三个自绘按钮（`data-conflict-choice` 契约，`success` 回调绑定 click）：

| 按钮 | 行为 |
|------|------|
| 使用脚本记录（local） | 推送脚本 → 服务器：favorite → `triggerJavdbWant()`；hasWatch → `triggerJavdbReview(score)`；filter → `triggerJavdbReview(0)`（同 quickBlock 语义） |
| 使用网站数据（server） | 拉取服务器 → 本地：watched → `saveCar(hasWatch + score)`；want → `saveCar(favorite)`，均广播 + 刷新菜单文案 |
| 取消（cancel） | 本次不处理，下次打开页面再校验 |

layer.js 仅原生支持两个按钮回调（`yes`/`cancel`，无 `btn3`），故用内容弹窗 +
success 回调自绘按钮；关闭钮 / ESC（layer 包装自动挂 setupEscClose）/ 遮罩点击
（默认 shadeClose）经 `cancel` 回调统一视为取消，`settled` 防重复结算。

### 2.2 弹窗类别

冲突判断沿用 doc/234 方向 3 的到达条件（双方均有状态且不一致），覆盖
favorite/hasWatch/filter 与服务器 want/watched 的任意矛盾组合；已完全一致的状态
（服务器想看=脚本收藏、服务器已看同分=脚本已看同分）仍早退，不弹窗。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/components/dpb/review-conflict-dialog.tsx` | **新增**：冲突选择弹窗组件（JSX，data-conflict-choice 按钮契约） |
| `src/plugins/detail-page-button/dpb-review-sync.ts` | **重命名 → `.tsx`**（新增 JSX 消费）；方向 3 由「跳过+日志」改为 `confirmReviewConflict` 弹窗 + local/server/cancel 三路处理；头部注释同步 |
| `vite.config.ts` | version 1.45.0 → 1.45.1（patch） |
| `package.json` | version 字段同步 1.45.1（元数据修正） |
| `doc/235-review-conflict-dialog.md` | 本文档 |

## 4. 执行验证记录

### 执行环境

Windows + Bun（构建/静态验证）。

### 验证命令

```text
$ bunx tsc -b
$ bun run lint
$ bun run build
$ bun run test
$ bun run check:structure
```

### 实际输出

```text
$ bunx tsc -b
（零错误）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run build
dist/monkey-jhs-disassemble.user.js  2,212.09 kB │ gzip: 512.50 kB
✓ built in ~1.4s

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK (368 files, 63 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)
```

### 前端或调用方验证

无独立前端；产物 userscript 头部 `@version 1.45.1` 已核对。

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.45.1`。

### 已知限制

- 弹窗需用户浏览器实测确认（构造「脚本已看 2 星 vs 服务器已看 4 星」等冲突场景）。
- 选择「使用脚本记录」覆盖服务器时不会二次确认（弹窗本身即确认动作）。
- 冲突弹窗一次页面最多出现一次（单影片单评价状态），不会叠加。