# 79 - 修复 123Av-Fc2 导航双份与识图按钮缺失

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-11

## 1. 背景

升级落地（doc/76/78）后用户反馈：

1. 标题栏 `123Av-Fc2`（`/advanced_search?type=100`）出现**两次**
2. 自定义检索区**识图**按钮未出现

## 2. 根因

### 2.1 123Av-Fc2 双份

`Fc2By123AvPlugin.handle` 使用：

```js
$('.navbar-start').append('...123Av-Fc2...')
```

页面上有两处 `.navbar-start`：

- 站点主导航 `#navbar-menu-hero .navbar-start`
- 脚本注入的 `#search-box .navbar-start`（`NavSearchBox`）

jQuery 对两者都 `append`，故出现两个入口。

原版 `jhs.3.3.6.027` 是：

```js
$("#navbar-menu-hero > div > div:nth-child(1) > div > a:nth-child(4)")
  .after('...123Av-Fc2...')
$('.tabs li:contains("FC2")').after('...')
```

单点插入，不会命中搜索框。

### 2.2 识图按钮缺失

`NavBarPlugin.hookSearch` 误写选择器：

```js
const $searchBox = $('#jhs-search-box'); // 不存在
```

实际检索框 id 为 `#search-box`；且原版把 `#search-img-btn` 直接写在搜索框 HTML 里（进阶检索与检索按钮之间），不是事后 append。

## 3. 方案

1. **Fc2By123AvPlugin**：新增 `injectNavEntry()`  
   - 优先在 `#navbar-menu-hero` 内 FC2 链接后 `after` 插入（`id=navbar-item-123av-fc2`）  
   - 回退仅 `#navbar-menu-hero .navbar-start`（不碰 `#search-box`）  
   - tabs 存在 FC2 时在其后补一项（去重）  
2. **NavSearchBox**：模板内补 `#search-img-btn`「识图」  
3. **NavBarPlugin**：绑定 `#search-img-btn` → `ImageRecognitionPlugin.open`；flag 关则 hide；`hookOldSearch` 同步 rebind 原生 `.search-image`

## 4. 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/fc2-by-123av-plugin.ts` | `injectNavEntry` 单点注入 |
| `src/components/nav-search-box.tsx` | 增加识图按钮 |
| `src/plugins/nav-bar-plugin.tsx` | 绑定识图；旧搜索图入口 |
| `vite.config.ts` | version 1.9.0 → 1.9.1 |

## 5. 执行验证

```
$ bun run build
tsc -b && vite build  ✓
@version 1.9.1
```

## 6. 后续验证建议

1. 任意 javdb 页：主栏 FC2 旁仅 **一个** `123Av-Fc2`；自定义搜索框**无**该链  
2. 宽屏自定义检索：进阶「...」与「检索」之间有 **识图**，点击弹出以图识图  
3. 中等宽度原生搜索：`.search-image` 点击同样打开识图弹窗  
4. `localStorage` 关 `imageRecognitionPlugin` 后「识图」隐藏
