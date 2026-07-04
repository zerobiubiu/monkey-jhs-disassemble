# 29 - 迁移 Fc2Plugin 修复 FC2 列表项点击失效

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题
用户报告 `https://javdb.com/search?q=fc2-ppv-4802496&f=all` 页面列表项点击失效
（"点不开了"）。

### 1.2 根因
项目的 `archetype/jhs.user.js` 是**删减版**，移除了 `Fc2Plugin` 及
`MagnetHubPlugin`/`TranslatePlugin`/`ScreenShotPlugin`/`WangPan115TaskPlugin`/
`Fc2By123AvPlugin` 等插件，但 `list-page-plugin`/`history-plugin`/
`list-page-button-plugin` 仍以 `getBean('Fc2Plugin')?.openFc2Dialog(...)` 调用之。

`bindClick` 的 `.item img` 点击处理开头有 `event.preventDefault()` 阻止了 `<a>`
默认跳转，随后 `getBean('Fc2Plugin')` 返回 `undefined`，可选链 `?.` 静默失败——
既不跳转也不开弹窗，表现为"点不开"。

**非 javbus 清理导致**：FC2 点击逻辑与删减版原脚本逐行一致（archetype L8639-8656），
清理 javbus 时未动。

### 1.3 修复依据
用户提供了未删减版 `jhs.user.js`（根目录），其中含完整 `class Fc2Plugin`
（L4162-4439）及注册（L15513）。从未删减版迁移 Fc2Plugin 主体并注册，恢复功能。

## 2. 迁移内容

### 2.1 新增文件

| 文件 | 说明 |
|------|------|
| `src/plugins/fc2-plugin.ts` | Fc2Plugin 类（extends BasePlugin），含 getName/initCss/handle/openFc2Dialog/loadData/handleMovieDetail/handleLongImg/handleMagnets/openFc2Page |
| `src/styles/fc2-plugin.css` | initCss 的 CSS（弹层/容器/电影信息/演员/图片/错误样式） |

### 2.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/constants/status.ts` | 加回 hasDown 常量：`HAS_DOWN_ACTION`/`HAS_DOWN_TEXT`/`HAS_DOWN_COLOR`（删减版已移除，Fc2Plugin 依赖） |
| `src/main.tsx` | import Fc2Plugin + 注册（`manager.register(Fc2Plugin)`，24 插件） |

### 2.3 依赖映射（未删减版单字母 → 项目模块）

| 未删减版 | 项目 | 说明 |
|----------|------|------|
| `o` | `currentHref` | constants/site |
| `V(e)` | `fetchMovieDetail` | constants/api（已存在，签名一致） |
| `U` | `API_BASE` | constants/api |
| `O()` | `reBuildSignature` | constants/api |
| `d/h/g/p` | `FILTER_ACTION/FAVORITE_ACTION/HAS_DOWN_ACTION/HAS_WATCH_ACTION` | constants/status |
| `f/m/w/v/x/y/k/S` | `BLOCK_COLOR/BLOCK_TEXT/FAVORITE_COLOR/FAVORITE_TEXT/HAS_DOWN_COLOR/HAS_DOWN_TEXT/WATCHED_TEXT/WATCHED_COLOR` | constants/status |

全局依赖（`globals.d.ts` 已声明）：`$`/`layer`/`utils`/`storageManager`/`gmHttp`/`show`/`loading`/`window.refresh`。

### 2.4 缺失插件依赖处理（`?.` 静默失败）

Fc2Plugin 依赖 5 个项目未迁移的插件，均改为可选链，缺失时静默失败不报错：

| 调用点 | 缺失插件 | 失效功能 | 处理 |
|--------|----------|----------|------|
| openFc2Dialog 磁力搜索按钮 | MagnetHubPlugin | 磁力搜索弹窗 | `if (!magnetHub) return;` |
| handleMovieDetail | TranslatePlugin | 标题翻译 | `?.translate()?.then()` |
| handleLongImg | ScreenShotPlugin | 缩略图截图 | `if (!screenShot) return;` |
| handleMagnets 115 按钮 | WangPan115TaskPlugin | 115离线下载 | `?.handleAddTask()` |
| openFc2Dialog 123av 分支 | Fc2By123AvPlugin | 123av 弹窗 | `if (fc2By123Av) {...} else 回退普通弹窗` |

其余依赖（ReviewPlugin/RelatedPlugin/OtherSitePlugin/DetailPageButtonPlugin）项目均已注册，正常工作。

## 3. 验证记录

- `tsc -b`：退出码 0
- `vite build`：191 modules，产物 `dist/monkey-jhs-disassemble.user.js` **1222.54 kB（gzip 315.09 kB）**，较 doc/28 后 1206.48 kB **+16.06 kB**（Fc2Plugin ~300 行 + CSS）
- Fc2Plugin 已注册（main.tsx 24 插件之一），`getBean('Fc2Plugin')` 返回实例，`openFc2Dialog` 可正常调用

## 4. 待运行时验证

tsc + build 仅保证编译期正确，以下需 Tampermonkey 实际加载验证：
- javdb 搜索 fc2 番号，点击列表项图片/标题 → 打开 FC2 详情弹窗
- 弹窗内电影信息/磁力列表/评论/相关正常加载
- 收藏/屏蔽/已看/已下载按钮正常写入
- 字幕按钮（SubTitleCat/迅雷）正常
- 磁力搜索/翻译/截图/115离线/123av 弹窗 → 预期静默失败（依赖插件未迁移）

## 5. 遗留：Beyond60Plugin 未定义

`auto-page-plugin.ts:169` 和 `blacklist-plugin.tsx:688` 调用
`getBean('Beyond60Plugin')`，未删减版亦只有调用、无类定义、未注册。属长期静默失败，
非本次迁移范围，待后续处理。
