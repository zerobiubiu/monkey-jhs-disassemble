# doc/136 — 安全边界加固

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户实施计划批次 1「安全与数据正确性热修复」的渲染与权限边界部分。
存储正确性部分已在 doc/135 完成（版本化迁移 + 冻结修复 + 缓存失效）。

## 方案

### 1. unsafeWindow 权限收窄

原 main.tsx 将 12 个对象同时挂载到 `window` 和 `unsafeWindow`：

```typescript
unsafeWindow.utils = window.utils = new CommonUtil();
unsafeWindow.gmHttp = window.gmHttp = new GmHttp();
unsafeWindow.storageManager = window.storageManager = new StorageManager();
// ... 等
```

`unsafeWindow` 是页面 JS 可访问的全局对象。暴露 `gmHttp`（HTTP 客户端）、
`storageManager`（IndexedDB 管理器）、`encryptCredential`/`decryptCredential`
（加密函数）、`pluginManager`（插件管理器）给页面脚本是安全风险。

**修改**：仅保留页面功能必需的 3 个对象在 `unsafeWindow` 上：
- `utils`（页面可能调用 `utils.openPage` 等）
- `loadGfriends`（GFriends 数据加载）
- `filetreeDb`（文件树数据库）

其余 6 个敏感对象仅在沙箱 `window` 上：
- `gmHttp`、`storageManager`、`WebDavClient`、`encryptCredential`、
  `decryptCredential`、`pluginManager`

### 2. 站点匹配精确化

```typescript
// 之前：宽泛 include 匹配所有子域名
include: ['https://javdb*.com/*', 'https://missav*.ws/*', 'https://missav*.live/*'],

// 之后：仅官方域名精确匹配 + 禁止 iframe
match: ['https://javdb.com/*', 'https://missav.ws/*', 'https://missav.live/*'],
noframes: true,
```

### 3. 密码输入隐藏

WebDAV 密码输入框从 `<input id="webDavPassword" />` 改为
`<input id="webDavPassword" type="password" />` + 👁 切换按钮。

### 4. 备份导入原子性

原 `importData` 流程：`clear()` → 写入 → 失败时数据已丢失。

改为三阶段：
1. **验证**：检查备份数据格式（对象、非 null、非数组）
2. **暂存**：写入临时 localforage 实例（`appData_import_staging`）
3. **切换**：清空主实例 → 复制暂存数据 → 删除临时实例

失败时清理临时实例，主实例不变。成功后调用 `runMigrations()` 迁移老备份。

### 5. 附加存储白名单

`applyBackupExtras` 新增白名单验证：
- `ALLOWED_LOCALSTORAGE_KEYS`（17 键，从 `BACKUP_LOCAL_STORAGE_KEYS` 派生）
- `ALLOWED_GM_KEYS`（7 键，从 `BACKUP_GM_KEYS` 派生）

拆分为 `stripBackupExtras`（导入前剥离 `__localStorage`/`__gmStorage`）+
`applyBackupExtras`（导入成功后按白名单写回）。

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `vite.config.ts` | 修改：删 include + noframes |
| `src/main.tsx` | 修改：unsafeWindow 权限收窄 |
| `src/components/setting-dialog.tsx` | 修改：密码 type=password + 切换按钮 |
| `src/plugins/setting-plugin.tsx` | 修改：密码切换绑定 + strip/apply 调用 |
| `src/core/storage-manager.ts` | 修改：importData 原子性 |
| `src/core/backup-extra-storage.ts` | 修改：白名单 + strip/apply 分离 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 222 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,002.18 kB │ gzip: 461.94 kB
✓ built in 1.18s
```

tsc 零错误。

## 代码一致性审计结论

6 维度审计结果：
- ✅ 命名一致性（插件类名/组件名/CSS 文件名）
- ✅ 导出风格（100% named export）
- ✅ 注释风格（中文 JSDoc）
- ⚠️ 错误处理（catch 变量名/类型标注不统一，建议后续统一为 `catch (err: unknown)`）
- ⚠️ 导入风格（3 处 inline type 混用，建议统一独立 `import type`）
- ⚠️ 异步模式（4-5 处非 fire-and-forget .then() 链，建议重构为 async/await）
