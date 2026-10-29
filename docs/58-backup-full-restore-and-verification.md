# 备份完整恢复与真实落盘校验

> **文档类型**：🧾 变更记录  
> **文档状态**：✅ 已执行  
> **影响范围**：主数据恢复、附加存储恢复、本地/云端导入成功判定  
> **前置文档**：`56-backup-import-format-and-git-large-file.md`、`57-cloud-import-effect-verification.md`  
> **替代文档**：无；保留 doc/57 的 v1.48.7 排查快照  
> **生效版本**：v1.48.8

## 1. 背景

v1.48.7 修复了备份正文读取与格式解码，但 doc/57 的真实 IndexedDB 检查确认：主数据导入的 localforage `iterate` 回调返回写入 Promise，触发提前停止，只复制第一个键，却仍提示成功并立即刷新。

本轮合并修复：全键写回、持久化回读、失败补偿、附加存储错误被吞掉、迁移未完成仍可能成功、成功结果随刷新消失等同链路问题。不改变云端备份位置、加密格式、数据迁移步骤及备份白名单。

## 2. 实现

### 2.1 主数据逐键写入与校验

新增 `src/core/storage/backup-restore.ts`：

1. 读取本次涉及键的原值及是否存在，不清空备份未涉及的键。
2. 按 `Object.entries` 逐个等待写入，不再依赖迭代回调处理异步任务。
3. 全部写入后，从存储重新读取每个键并做 JSON 值深比较；对象键顺序不影响结果，数组顺序与值类型严格保持。
4. 写入、读回或比较失败时，逆序补偿本次尝试修改的键，原来不存在的键删除；补偿后再次检查。补偿本身失败时明确列出键名，不宣称全局原子性。
5. 空主数据拒绝执行，不把空操作当作恢复成功。

`StorageManager.importData` 使用已有 Web Locks 包装器串行化主数据导入，写入尝试后始终使本地缓存失效并广播数据/设置修订。原有迁移步骤仍然执行，最终结构版本未达到当前版本时明确失败。

没有继续使用旧暂存 store；因此不存在把暂存迭代的首个 Promise 误认为全部复制完成的问题。

### 2.2 附加数据不能吞错

- 分离附加数据时先检查容器和持久 namespace 的结构，错误输入在主库写入前被拒绝。
- localStorage 写后读回字符串；GM 写后读回值并深比较，异常或静默丢写均传播给导入入口。
- `PersistentDataStore.verifyNamespaces` 从后端 `loadRecords()` 读回，不能用已更新的内存镜像充当落盘证据。
- 新版 `__persistentData` 优先于旧 `__localStorage` 副本，避免旧访问记录反向覆盖新版数据。
- 旧格式持久数据继续兼容：后端启用时迁入 namespace，否则恢复到原 localStorage；实际失败不再只记 warning 后继续报成功。
- 未授权的 namespace、GM/localStorage 键仍按既有白名单跳过并记录警告，不扩大写入范围。

### 2.3 成功判定与可见结果

本地导入与云端绿色导入按钮，均在主数据、迁移和受支持的附加存储校验完成后调用同一个结果函数：

> 备份恢复并校验成功：N 个主数据键及受支持的附加数据已恢复。点击确定刷新页面。

这里的 N 是主数据**存储键数量**，不是影片数量。结果不自动消失，用户确定后才刷新；写入或校验失败不显示成功结果、不自动刷新。

## 3. 改动文件

| 文件 | 改动 |
| --- | --- |
| `src/types/backup-restore.ts` | 最小存储契约，主库实现与测试替身共用 |
| `src/core/storage/backup-restore.ts` | JSON 比较、全键写入、回读、补偿 |
| `src/core/storage-manager.ts` | 替换有缺陷的暂存迭代，缓存/修订失效与迁移完成门禁 |
| `src/core/backup-extra-storage.ts` | 输入结构检查、附加存储回读、错误传播及新旧副本优先级 |
| `src/core/storage/persistent-data-store.ts` | 后端回读校验 namespace |
| `src/plugins/setting/data-import-export.ts` | 本地入口使用校验完成结果，结果确认后刷新 |
| `src/plugins/setting/webdav-operations.ts` | 云端入口共用结果函数，不再立即刷新 |
| `tests/setting/storage-import.test.ts` | 16 例：全键、单键、空值、失败补偿、校验丢写、缓存与迁移门禁 |
| `tests/setting/backup-extra-restore.test.ts` | 19 例：三种附加存储、白名单、输入结构、后端丢写 |
| `tests/setting/backup-restore.test.ts` | 接线 15→16 例：明确结果、延后刷新、附加恢复失败无成功结果 |
| `tests/browser/backup-restore.ts` | 真实 Chrome/IndexedDB 的入口与落盘验收页 |
| `tests/browser/run-backup-restore.ts` | 构建验收页、临时浏览器配置、CDP 等待、超时与清理 |
| `package.json`、`vite.config.ts` | 添加浏览器验收命令，版本同步为 1.48.8；不新增依赖 |
| `AGENTS.md`、`docs/plugin-catalog.md` | 同步测试入口、目录与模块计数：核心 67→68，存储域 11→12 |
| `CHANGELOG.md`、`docs/README.md`、`docs/57-cloud-import-effect-verification.md` | 版本说明、索引与后续修复关联 |

本轮触及的源码文件均低于 500 行；主恢复逻辑按职责放入存储域，避免继续扩张 `StorageManager`。没有改 DOM 模板或 CSS，没有新增插件。

## 4. 验证矩阵

### 4.1 自动回归

全套 **46 文件 / 505 用例**通过；在原 469 例基础上新增 36 例。新替身保留 localforage“回调返回非 undefined 就提前停止”的语义，避免旧测试遗漏该真实契约。

主数据测试不仅判断 Promise resolved，还检查所有目标键落库、未涉及的键保留、静默丢写被拒绝、失败键也被补偿、补偿失败有明确错误。持久数据测试特意让内存正确而后端丢写，验证校验会失败。

### 4.2 真实 IndexedDB 验收

命令：`bun run verify:restore:browser`。

使用已安装的 Chrome/Chromium；可通过环境变量 `JHS_TEST_BROWSER` 指定可执行文件。命令不安装工具，不连接用户已打开的浏览器，而是创建全新临时配置。页面使用真实本地 localforage 和 IndexedDB，备份提供方、GM API、表格与确认框为受控替身；主导入、解码、附加恢复、实际 FileReader 和事件回调执行真实代码。只有刷新调用在测试构建中替换为计数，不修改仓库源码。

| 场景 | 实际结果 |
| --- | --- |
| 云端明文多键 | 6 个主数据键全部对比通过，三种附加数据核验通过 |
| 云端旧 Caesar 多键 | 6 个主数据键全部对比通过，三种附加数据核验通过 |
| 云端 V2 AES 多键 | 6 个主数据键全部对比通过，三种附加数据核验通过 |
| 本地实际 FileReader 导入 | 6 个主数据键全部对比通过，三种附加数据核验通过 |
| 主库静默丢写 | 报 `blacklist 写入后内容不一致`，补偿后与原主库相同，无成功结果 |
| GM 静默丢写 | 报 `GM 存储恢复校验失败：jdb:list-rating`，无成功结果 |
| 28.4 MB 完整备份 | JSON 精确 **28,445,950 字节**，7 个主数据键逐值相同，三种附加数据核验通过 |

验收页以新的 `IndexedDbBackend` 连接读取访问记录，证明不是只看内存；也检查旧副本未覆盖新版 namespace。成功场景都验证“结果确认前刷新次数为 0，确认后为 1”。7 场景输出 `passed: true`，结束后自动关闭浏览器并删除临时配置。

## 5. 使用与后续建议

1. 安装 `dist/monkey-jhs-disassemble.user.js`，确认版本 **1.48.8**。
2. 保留远端原自动备份副本，恢复时暂停其他标签页的数据修改。
3. 可继续使用原来的云备份绿色导入按钮；只有看到“备份恢复并校验成功”结果才表示本轮支持的数据已通过回读。
4. 先前 1,295 字节的错误下载文件仍不包含备份正文，不能靠本次修复从中恢复记录；应使用正确取回的云端正文或完整备份文件。
5. 如果出现迁移、存储、校验或补偿失败，应保留原备份与错误日志，不要执行云端覆盖备份。

## 6. 执行验证记录

### 执行环境

Windows，Bun 1.4.3，Node v24.22.0，Vitest 4.1.10，Vite 8.2.1，本机 Chrome，localforage 1.10.0。沿用已安装依赖，无新增依赖或工具。

### 验证命令与实际输出

| 命令 | 实际输出 / 结论 |
| --- | --- |
| `bun run test` | `Test Files 46 passed (46)`；`Tests 505 passed (505)` |
| `bun run verify:restore:browser` | `passed: true`，7 场景全通过；`driver: asyncStorage`；大备份 `jsonBytes: 28445950`；`隔离浏览器及临时配置已清理` |
| `bun run lint` | 退出码 0，0 errors / 0 warnings |
| `bun run lint:css` | 退出码 0 |
| `bun run check:structure` | `OK (392 files, 68 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 68 core files)` |
| `bun run check:selectors` | `OK (85 files, 258 literals; 0 file(s) below baseline)` |
| `bun run check:version` | `OK (userscript 1.48.8 = package.json 1.48.8)` |
| `bun run build` | `tsc -b && vite build` 成功；435 modules transformed；产物 1,290.08 kB / gzip 333.17 kB |
| 产物头部检查 | `// @version      1.48.8` |
| `git diff --check` | 无输出，退出码 0 |
| 用户原文件摘要 | 仍为 `8028f84c97812ecae96bc796ae522bd6b84cbf5764a2ca5a740e0981d13cd082`，未修改 |

### 前端或调用方验证

单元/接线和真实浏览器均覆盖云端绿色按钮；真实浏览器还运行本地文件选择与 FileReader 路径。新结果提示需要确认才刷新，失败不进入成功提示。未向用户真实网站执行导入或写入。

### 验证结论

doc/57 的首键假成功缺陷已修复。多键备份、三种编码格式、附加存储、大备份与失败门禁都有实际运行证据，而非仅检查函数被调用。

### 已知限制

- 主库、GM、localStorage、持久数据不是一个跨存储事务。主库恢复后附加存储失败会明确报告失败，但不会自动撤销已完成的其他存储；不宣称整个恢复全局原子性。
- 主库补偿是失败后的尽力恢复，不保证浏览器崩溃、持续配额错误或其他未遵守导入锁的并发写入下完整回滚；失败信息会明确说明补偿未完成。备份未涉及的键保持原样。
- 白名单以外的附加键仍按既有规则跳过；成功结果只承诺受支持的数据，不扩大权限或写入范围。
- 真实浏览器验收使用合成备份及受控 GM API，不代表已经把用户私人远端备份恢复到真实网站；不接触用户真实浏览器配置、凭据或业务数据。
- 构建仍有上游 layer.css 的 10 条 IE hack 容错警告，未改变既有处理，最终构建成功。
- AOCI 工具仍不可用，沿用本会话已确认的跳过维护边界；受管索引需在工具恢复后同步。
