# 44 - terser 最高压缩率配置

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题
vite build 默认用 esbuild minify，压缩较保守（保留缩进换行、保留 console.log）。
产物 1769 kB（gzip 422 kB），体积偏大。用户要求尝试最高压缩率。

### 1.2 目标
切换到 terser minify + 最激进的压缩选项，在保证功能正常的前提下最小化产物体积。

## 2. 方案

### 2.1 配置

`vite.config.ts` 新增 `build` 配置：

| 选项 | 值 | 作用 |
|------|-----|------|
| `minify` | `'terser'` | 用 terser 替代 esbuild（压缩更激进） |
| `terserOptions.compress.passes` | `3` | 多轮压缩，提升 dead code 消除 |
| `terserOptions.compress.pure_funcs` | `['console.log','console.debug','console.info']` | 删除日志函数调用（保留 console.error 便于排错） |
| `terserOptions.compress.drop_debugger` | `true` | 删除 debugger 语句 |
| `terserOptions.compress.toplevel` | `true` | 顶层作用域也压缩 |
| `terserOptions.compress.unsafe*` | `true`（全套） | 启用所有 unsafe 压缩（算术/比较/方法/proto 等） |
| `terserOptions.compress.inline` | `2` | 内联常量、折叠变量 |
| `terserOptions.format.comments` | `/^==!?:\|^[#@]\|==\/UserScript==/i` | 保留 userscript 头部注释，删除其余 |
| `terserOptions.mangle.toplevel` | `true` | 顶层变量名也缩短 |
| `terserOptions.mangle.reserved` | 全局名列表 | 保留 unsafeWindow/GM_*/$/jQuery/layer/Tabulator 等外部引用名 |
| `sourcemap` | `false` | 不生成 sourcemap |

### 2.2 保留的全局名

以下全局名被 `mangle.reserved` 保留（不缩短），因为外部代码或 Tampermonkey 需要按名访问：

- GM API：`GM_xmlhttpRequest`/`GM_openInTab`/`GM_setValue`/`GM_getValue`/`GM_addValueChangeListener`/`GM_registerMenuCommand`/`GM_addStyle`
- 第三方库全局：`$`/`jQuery`/`layer`/`Tabulator`/`Toastify`/`localforage`/`Viewer`/`md5`
- 应用运行时全局：`utils`/`gmHttp`/`storageManager`/`clog`/`show`/`loading`/`pluginManager`/`refresh`/`encryptCredential`/`decryptCredential`/`loadGfriends`/`filetreeDb`/`WebDavClient`/`isDetailPage`/`isListPage`/`isFc2Page`

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `vite.config.ts` | 新增 `build` 配置块（terser + 最高压缩选项） |
| `package.json` | 新增 devDependencies：`terser` + `@types/terser` |

### 3.2 验证

- `tsc -b` 类型检查通过
- `node --check` 语法检查通过
- Userscript 头部 metadata 完整（`==UserScript==` 块保留）
- 全局名保留（`unsafeWindow`/`GM_xmlhttpRequest`/`storageManager`/`pluginManager` 等）
- `console.error` 保留，`console.log` 删除（0 处残留）

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```

### 4.2 构建
```bash
$ bunx vite build
✓ built in 10.99s
```

### 4.3 压缩对比

| 指标 | esbuild（原） | terser 最高压缩 | 变化 |
|------|---------------|-----------------|------|
| 产物大小 | 1,769 kB | **1,150 kB** | **-619 kB（-35%）** |
| gzip 大小 | 422 kB | **337 kB** | **-85 kB（-20%）** |
| 行数 | 42,539 | 30 | 几乎全单行 |
| console.log | 保留 | 删除 | pure_funcs 生效 |
| 构建耗时 | ~1s | ~11s | terser 多轮压缩较慢 |

### 4.4 语法验证
```bash
$ node --check dist/monkey-jhs-disassemble.user.js
（无输出，退出码 0）
```

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载压缩后产物，测试核心功能（列表页过滤/详情页按钮/
  评分显示/清单瀑布流/排序/筛选等）正常工作
- **调试注意**：压缩后堆栈变量名为单字母，出错时排查困难。开发调试时可用
  `bunx vite build --minify=esbuild`（快但压缩弱）或 `bunx vite build --minify=false`（不压缩）
- **构建耗时**：terser 11s vs esbuild 1s，CI/正式构建可接受，开发时建议用 esbuild
