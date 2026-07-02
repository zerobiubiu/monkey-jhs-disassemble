# 删除「已下载」常量定义和 storageManager 兼容分支

**文档类型**：🔧开发指导  
**文档状态**：✅已执行  
**修改日期**：2026-07-01  
**修改文件**：`jhs.user.js`  
**前置文档**：`08-remove-hasdown-ui.md`

## 1. 背景

`08-remove-hasdown-ui.md` 删除了「已下载」的所有 UI 和功能代码，但保留了三个常量定义和 storageManager 的 `case g:` 兼容分支。用户指出删除不干净——既然功能已全部移除，常量定义和兼容分支也应一并删除。

## 2. 修改方案

### 2.1 删除常量定义

| 常量 | 原行号 | 值 | 删除原因 |
|------|--------|-----|----------|
| `const g` | 原 L71 | `"hasDown"` | 无任何模块级引用（所有 `const g` 匹配均为方法内局部变量） |
| `const y` | 原 L79 | `"📥️ 已下载"` | 无任何引用（所有 UI 已删除） |
| `const x` | 原 L80 | `"#7bc73b"` | 无任何引用（其他代码直接硬编码 `#7bc73b`，不引用此常量） |

### 2.2 删除 storageManager 兼容分支

**`_saveSingleCar` 方法**：
```js
// 删除前
case h:
    l.status = h;
    break;
case g:          // ← 删除
    l.status = g;// ← 删除
    break;       // ← 删除
case p:

// 删除后
case h:
    l.status = h;
    break;
case p:
```

**`updateCarInfo` 方法**：同上，删除 `case g: l.status = g; break;` 分支。

## 3. 验证记录

```
grep "hasDown|已下载|📥" jhs.user.js
→ No matches found ✓
```

```
grep "const g =|const y =|const x =|#7bc73b" jhs.user.js
→ 无模块级 const g/y/x 定义（所有匹配均为方法内局部变量）
→ #7bc73b 出现在 DmmPreviewVideoResolver 和 OtherSitePlugin（独立硬编码，与已下载无关）✓
```

```
diagnostics jhs.user.js
→ File doesn't have errors or warnings! ✓
```

## 4. 结论

「已下载」状态在 `jhs.user.js` 中**彻底清除**：常量定义、UI 代码、功能方法、storageManager 兼容分支全部删除。grep `hasDown`/`已下载`/`📥` 零匹配。

## 5. 影响范围

- 模块级常量 `g`/`y`/`x` 定义删除
- `_saveSingleCar` 的 `case g:` 分支删除
- `updateCarInfo` 的 `case g:` 分支删除
- 历史已保存的 `status='hasDown'` 数据仍存在于 IndexedDB 中，但不再被任何代码处理（不影响其他状态的功能）
