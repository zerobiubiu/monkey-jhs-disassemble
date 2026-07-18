# 123 - 恢复导航栏搜索框粘贴自动跳转搜索

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-18

## 1. 背景

用户反馈：页面导航栏自定义搜索框（`#search-keyword`）的快捷功能失效，
例如粘贴文本后不再自动跳转搜索。

### 破坏时机

| 项目 | 内容 |
|------|------|
| 提交 | `3611d81`（2026-07-11） |
| 主题 | 集成 jhs 3.3.6.027 可插拔升级 |
| 文档 | doc/76、doc/78 §⑩ |
| 机制 | `featureFlags.navBarNoPaste` 默认 `true`，跳过 paste 绑定 |

升级对照 `archetype/jhs.3.3.6.027.user.js` 时，新版导航栏已无粘贴自动搜索，
为「避免粘贴图片误触发搜索」引入 `navBarNoPaste: true`。

### 原版行为（`archetype/jhs.user.js` L4993–5004）

粘贴时已做图片检测：剪贴板含 `image/*` 则直接 return，**仅文本粘贴**才
`setTimeout` 点击 `#search-btn`。因此「禁 paste」对图片本无必要，却误伤了
番号/关键词粘贴即搜的常用快捷。

回车搜索、点击检索按钮逻辑未受影响，仅 paste 被 flag 关掉。

## 2. 方案

将 `navBarNoPaste` 默认值改回 `false`，恢复 paste 绑定。

既有逻辑不变：

```ts
$keyword.on('paste', (event) => {
  // 剪贴板含图片 → 不自动搜
  // 纯文本 → 自动点检索
});
```

仍可通过控制台回退到升级后行为：

```js
localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ navBarNoPaste: true }));
```

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/core/feature-flags.ts` | `navBarNoPaste: true` → `false` |
| `vite.config.ts` | version `1.19.4` → `1.19.5` |

`nav-bar-plugin.tsx` 的 paste 分支无需改代码，flag 关时原逻辑即生效。

## 4. 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 219 modules transformed
dist/monkey-jhs-disassemble.user.js  1,922.49 kB │ gzip: 443.13 kB
✓ built in 1.41s
```

lightningcss IE hack 警告为既有 layer.css，非本次引入。

## 5. 后续验证建议

1. 宽屏（>1600px）显示自定义 `#search-box` 时：
   - 粘贴番号/文本 → 自动打开/跳转 `/search?q=...`
   - 粘贴图片 → 不自动搜索（input 内无图内容或保持原状）
2. 回车、点击「檢索」仍正常
3. 可选：`navBarNoPaste: true` 后粘贴不再自动搜
