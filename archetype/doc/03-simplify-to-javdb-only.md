# 03 - 精简为 javdb 专用脚本

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 问题描述

### 现象
`jhs.user.js` 当前支持 javdb、javbus、javtrailers、subtitlecat、123av、jable、avgle、115 网盘等多个站点，代码量达 15205 行，臃肿且维护困难。

### 根因
历史遗留的多站点支持代码，实际只用 javdb。

### 影响
- 文件体积大，加载慢
- 维护成本高
- 非 javdb 站点的代码可能因目标站点改版而失效，但无人维护

## 2. 修改方案

### 2.1 删除的类（17 个）

| 类名 | 原行号 | 说明 |
|------|--------|------|
| `JavTrailersPlugin` | L3982-4098 | javtrailers.com 站点支持 |
| `SubTitleCatPlugin` | L4099-4126 | subtitlecat.com 字幕搜索 |
| `Fc2Plugin` | L4127-4404 | FC2 番号详情弹窗 |
| `BusDetailPagePlugin` | L5710-5786 | javbus 详情页 |
| `BusPreviewVideoPlugin` | L11384-11536 | javbus 预览视频 |
| `SearchByImagePlugin` | L11537-11775 | 以图识图 |
| `BusNavBarPlugin` | L11776-11788 | javbus 导航栏 |
| `RelatedPlugin` | L11789-11908 | 相关清单 |
| `Fc2By123AvPlugin` | L12020-12493 | 123av FC2 支持 |
| `MagnetHubPlugin` | L12494-12771 | 磁力搜索聚合 |
| `ScreenShotPlugin` | L12772-12972 | 截图搜索 |
| `WangPan115TaskPlugin` | L12985-13178 | 115 网盘离线任务 |
| `WangPan115Plugin` | L13179-13458 | 115 网盘登录页 |
| `WangPan115MatchPlugin` | L13459-13760 | 115 网盘匹配 |
| `BusImgPlugin` | L13930-13996 | javbus 图片处理 |
| `TranslatePlugin` | L13997-14052 | 翻译插件（独立插件，非 ListPagePlugin.translate） |
| `LocalPlugin` | L14654-15062 | 本地 127.0.0.1 服务 |

### 2.2 删除的常量

| 常量 | 原行号 | 说明 |
|------|--------|------|
| `const Ke` | L12973-12980 | 115 网盘 downpath API，仅 WangPan115TaskPlugin 用 |
| `const We` | L12981-12984 | 115 网盘搜索 API，仅 WangPan115MatchPlugin 用 |

### 2.3 保留的常量（虽被删插件引用，但保留插件也用）

| 常量 | 原行号 | 保留原因 |
|------|--------|----------|
| `const _e` | L8945 | ListPagePlugin.translate 使用 |
| `const me` | L4944 | Top250Plugin 使用 |
| `const tt/nt/at/it/st/ot/rt/lt/ct/dt/ht/gt` | L14053-14222 | NewVideoPlugin 使用 |
| `const Le/Me/Ne` | L11362-11382 | SettingPlugin 使用 |

### 2.4 注册代码精简（`vt` 对象）

- `if (r)` 块：删除 10 个被删插件的注册
- `if (l)` 块：整块删除（javbus 永远 false + 全是 bus 插件）
- `if (t.includes("javtrailers"))` 块：删除
- `if (t.includes("subtitlecat"))` 块：删除
- `if (t.includes("115.com"))` 块：删除

### 2.5 脚本头精简

- `@match`/`@include`：只保留 `https://javdb.com/*` 和 `https://javdb*.com/*`
- `@exclude`：删除 javbus/javsee/seejav 相关
- `@connect`：删除不再使用的域名，保留 javdb、missav、supjav、127.0.0.1、xunlei(详情页字幕用)

### 2.6 OtherSitePlugin 精简

- `siteConfigs` 数组：只保留 `missAvBtn` 和 `supJavBtn`，删除 javTrailersBtn/123AvBtn/jableBtn/avgleBtn/javDbBtn/javBusBtn/fanzaBtn
- 删除方法：`getjableUrl`、`getAvgleUrl`、`getJavTrailersUrl`、`getAv123Url`、`getJavBusUrl`
- **保留 `getJavDbUrl`**：被 NewVideoPlugin 使用（任务描述误删，实际必须保留）
- 删除 `#javTrailersBtn` 点击事件处理

### 2.7 SettingPlugin 精简

- `domain-panel` 模板：只保留 MissAv 和 SupJav 域名输入框
- `loadForm`：只读写 missAvUrl 和 supJavUrl
- `saveForm`：只保存 missAvUrl 和 supJavUrl

### 2.8 BasePlugin.getSelector 精简

- 删除 `javbus` 选择器配置
- 保留 `javdb` 选择器配置

### 2.9 交叉引用安全处理

| 调用方 | 被引用插件 | 处理方式 |
|--------|-----------|----------|
| NavBarPlugin.hookSearch (3处) | SearchByImagePlugin | 删除图片粘贴搜索代码块、`#search-img-btn` 按钮、`.search-image` 绑定 |
| DetailPageButtonPlugin.createMenuBtn | MagnetHubPlugin | 删除 `#magnetSearchBtn` 按钮创建和绑定 |
| HistoryPlugin.handleClickDetail (2处) | Fc2Plugin | 改为可选链 `?.openFc2Dialog/openFc2Page` |
| ReviewPlugin.handle | WangPan115TaskPlugin | 删除 try-catch 块 |
| ReviewPlugin.handle | RelatedPlugin | 删除调用块 |
| ListPageButtonPlugin.openWaitCheck | Fc2Plugin | 改为可选链 |
| ListPageButtonPlugin.openFavorite | Fc2Plugin | 改为可选链 |
| ListPagePlugin.doFilter | WangPan115MatchPlugin | 删除调用 |
| ListPagePlugin.doFilter | BusImgPlugin | 删除调用 |
| ListPagePlugin.bindClick (2处) | Fc2Plugin | 改为可选链 |
| SettingPlugin.initSimpleSettingForm | TranslatePlugin | 删除调用 |
| SettingPlugin.initSimpleSettingForm | ScreenShotPlugin | 删除调用 |
| SettingPlugin.initSimpleSettingForm | WangPan115MatchPlugin | 删除调用 |
| SettingPlugin.applyImageMode | BusImgPlugin | 删除调用 |

### 2.10 保留的按钮

- `#xunLeiSubtitleBtn`：调用 DetailPageButtonPlugin.searchXunLeiSubtitle（自身方法），不依赖被删插件，保留
- `#search-subtitle-btn`：调用 utils.openPage 打开 subtitlecat.com（不依赖 SubTitleCatPlugin 类），保留

## 3. 验证命令

```bash
# 语法检查
node -c jhs.user.js
# 输出: 语法检查通过

# 确认无残留引用（所有 Fc2Plugin 引用都用了可选链）
grep -n 'getBean("Fc2Plugin")\|getBean("WangPan115\|getBean("BusImgPlugin")\|getBean("SearchByImagePlugin")\|getBean("MagnetHubPlugin")\|getBean("ScreenShotPlugin")\|getBean("TranslatePlugin")\|getBean("LocalPlugin")\|getBean("RelatedPlugin")\|getBean("JavTrailersPlugin")\|getBean("SubTitleCatPlugin")\|getBean("Fc2By123AvPlugin")\|getBean("WangPan115TaskPlugin")\|getBean("WangPan115MatchPlugin")\|getBean("BusNavBarPlugin")\|getBean("BusDetailPagePlugin")\|getBean("BusPreviewVideoPlugin")' jhs.user.js
# 输出: 6 处 getBean("Fc2Plugin")?. 均使用可选链

# 确认被删类名无残留
grep -n 'class JavTrailersPlugin\|class SubTitleCatPlugin\|class Fc2Plugin\|class BusDetailPagePlugin\|class BusPreviewVideoPlugin\|class SearchByImagePlugin\|class BusNavBarPlugin\|class RelatedPlugin\|class Fc2By123AvPlugin\|class MagnetHubPlugin\|class ScreenShotPlugin\|class WangPan115TaskPlugin\|class WangPan115Plugin\|const WangPan115MatchPlugin\|class BusImgPlugin\|class TranslatePlugin\|class LocalPlugin' jhs.user.js
# 输出: No matches found

# 诊断检查
# 输出: File doesn't have errors or warnings!

# 文件行数
wc -l jhs.user.js
# 输出: 11658（原 15205，减少 3547 行）
```

## 4. 执行验证记录

- 语法检查通过（`node -c`）
- LSP 诊断无错误无警告
- 17 个被删类名无残留
- 6 处 `getBean("Fc2Plugin")` 全部改为可选链 `?.`
- 其他被删插件的 `getBean` 引用全部删除
- `domain-panel` 只保留 MissAv 和 SupJav
- `siteConfigs` 只保留 missAvBtn 和 supJavBtn
- 脚本头 `@match`/`@include` 只保留 javdb
- `@connect` 只保留 xunlei/missav/javdb/supjav/127.0.0.1/*
- `getJavDbUrl` 方法保留（NewVideoPlugin 依赖）
- `#xunLeiSubtitleBtn` 和 `#search-subtitle-btn` 按钮保留（不依赖被删插件）
