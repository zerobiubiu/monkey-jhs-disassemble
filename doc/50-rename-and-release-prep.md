# 50 - 项目重命名与公开发布准备

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题

项目准备公开发布，但存在以下问题：

1. **userscript 名称含"test"**：`name: '鉴黄师（test）'`，不适合公开发布
2. **缺少 README**：项目根目录无面向用户的详细说明文档
3. **插件计数过时**：AGENTS.md 记载 35 插件，实际 36 个（doc/49 新增 MissavQuickCopyPlugin 未同步）
4. **userscript 描述过时**：仍为旧的简短描述，未反映双站 36 插件的完整功能

### 1.2 目标

- 项目重新命名（对外名称）
- 撰写面向用户的详细 README + 功能支持清单
- 同步更新 userscript 元数据（name/description/version）
- 同步 AGENTS.md / doc/README.md 的插件计数

## 2. 方案

### 2.1 项目命名

| 项目 | 旧值 | 新值 |
|------|------|------|
| 对外名称 | 鉴黄师（test） | **JavDB Power Tools** |
| userscript name | `鉴黄师（test）` | `JavDB Power Tools` |
| userscript description | 旧简短描述 | `JavDB/MissAV 双站增强工具箱：收藏管理、状态标签、屏蔽过滤、跨站同步、热播/Top250榜单、新作品检测、预告片、字幕搜索、WebDav云备份、演员信息、清单管理、快捷键等 36 个功能插件` |
| 内部目录名 | `monkey-jhs-disassemble` | 不改（历史命名，改动影响 git 历史） |

### 2.2 README 结构

面向用户/开发者的详细说明文档，包含：

1. **功能总览** — 按 6 大类别（列表页/详情页/榜单/清单/跨站同步/数据管理）列出 36 个功能
2. **安装** — Tampermonkey 安装 + 源码构建两种方式
3. **配置** — 设置面板各分区说明
4. **支持站点** — JavDB + MissAV 域名清单
5. **技术架构** — 构建工具/语言/UI 框架/插件系统
6. **隐私说明** — 本地存储/跨站同步/WebDav/远程 API/无埋点
7. **开发** — 目录结构 + 文档指引

### 2.3 版本号递增

`1.1.0` → `1.2.0`（minor 递增：项目重命名 + README 重写 + userscript 元数据更新，属较大功能变更）

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `README.md` | 全新重写：功能总览（6 类 36 功能）+ 安装 + 配置 + 支持站点 + 技术架构 + 隐私说明 + 开发 |
| `vite.config.ts` | userscript name/description/version 更新 |
| `AGENTS.md` | 对外名称 + 插件计数 35→36（javdb 34 + missav 2） |
| `src/main.tsx` | 注册注释 33→36 |
| `doc/README.md` | 标题 + 概述更新 |

### 3.2 不修改的文件

- `vite.config.ts` 的 `namespace`/`author`/`license`/`homepageURL`/`icon`/`match`/`grant` 等不变
- 内部目录名 `monkey-jhs-disassemble` 不改（避免 git 历史断裂）

## 4. 执行验证记录

### 4.1 类型检查

```bash
$ npx tsc -b
（无输出，退出码 0）
```

### 4.2 构建

```bash
$ npx vite build
dist/monkey-jhs-disassemble.user.js  1,815.46 kB │ gzip: 415.25 kB
✓ built in 1.24s
```

### 4.3 userscript metadata 验证

```
// @name         JavDB Power Tools
// @version      1.2.0
// @description  JavDB/MissAV 双站增强工具箱：收藏管理、状态标签、屏蔽过滤、跨站同步、热播/Top250榜单、新作品检测、预告片、字幕搜索、WebDav云备份、演员信息、清单管理、快捷键等 36 个功能插件
```

## 5. 后续

### 关于 API 域名与签名（已确认无隐私风险）

- **`jdforrepam.com`**：JavDB 官方 API 域名（非私人服务器），用于评论/相关清单/Top250 数据拉取。公开发布无隐私风险
- **`SIGNATURE_SALT`**：JavDB 官方 API 的签名鉴权盐值，随脚本公开无安全风险
- **WebDav 凭据混淆**：`webdav-crypto.ts` 用固定 salt 做码点位移（非强加密），README 隐私说明中已告知用户
