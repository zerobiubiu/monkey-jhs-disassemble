# 130 - 存储导入与 JavDB/MissAV 状态一致性

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-22

## 1. 背景

综合审查发现，主库备份、MissAV 独立 IndexedDB 和 GM 跨站状态通道存在几类“失败时
仍可能破坏数据”的路径：

- 旧备份可能包含未知键或附加存储字段，直接导入会覆盖未来插件数据；
- 导入中途失败时恢复整个仓库，可能删除/覆盖本次导入之外的键；
- 未初始化的 `car_list` 或损坏列存被当成权威空快照，会把 MissAV 状态全部删掉；
- 全量/增量写入 cars 成功但 revision 元数据写失败时，旧载荷仍可能重新应用；
- IndexedDB 分批对账、查询异常和跨标签页顺序不明确时，标签可能被误删或数据回退；
- 手动选择错误的 `{}` JSON 曾可能显示“导入 0 条”并清空本地状态。

本次以“宁可跳过，也不猜测权威状态”为原则，所有不完整、不确定或未初始化输入均
不覆盖现有数据。

## 2. 主库备份与缓存

### 2.1 分阶段导入

- `backup-extra-storage.ts` 先校验根对象，剥离 `__meta`、`__localStorage`、
  `__gmStorage`，并仅恢复明确 allowlist 中的 localStorage/GM 键；
- `StorageManager` 对 appData 键和值做 allowlist/schema 校验，空数据、未知键和
  未剥离元字段直接拒绝；
- 主 IndexedDB 成功后才应用附加存储，单键失败转为告警，不制造“整体成功”的假象。

### 2.2 最小覆盖与条件回滚

- 导入只覆盖备份中明确出现的键，缺失键（包括新插件键）原样保留；
- Web Locks 可用时以 `jhs-storage-import` 串行化导入；
- 失败回滚只检查本次尝试写入的键，且只有当前值仍等于导入值才恢复旧值；并发标签页
  已写入的新值不会被回滚覆盖；部分写入后 reject 的键仍可恢复；
- 导入完成、失败和回滚后统一清理运行时缓存；写入方法、迁移和空数组缓存均同步失效。

## 3. JavDB → MissAV 同步协议

### 3.1 载荷与修订

- 增量 GM 键兼容旧单对象，同时使用排序、按番号压缩和单次 500 条上限；日志超过
  256 条先压掉中间状态，压缩后仍超限则保留失败兜底并触发 gzip 全量收敛；生成
  期间若再次变更则补发最新快照；
- 全量载荷带 `revision/mode/ready/count`，未初始化的 `car_list` 不发布空快照，
  明确存在且为空的清单才允许清空 MissAV；
- MissAV IndexedDB 增加 `sync_meta` 修订水位和 Web Lock。同 revision 下增量优先于
  全量，旧载荷不能复活已删除记录；
- `withSyncRevision` 在 cars 写入、revision 写入任一步失败时执行补偿：恢复写前
  cars 快照，并恢复旧 revision，避免“数据已变、水位未变”。增量只快照受影响番号，
  全量复用写前整库快照。

### 3.2 严格快照与 IDB 对账

- 列存校验状态枚举、数组类型/长度、记录数、重复番号、URL 主机和协议；异常快照
  在写入前拒绝；行式导入同样在 normalize 阶段拒绝坏记录；
- 全量对账先批量 upsert、验证写入条数，再删除多余记录；任一阶段失败在单事务中
  恢复之前的原始记录，不使用不可逆的 `clear()`；
- 查询事务失败直接向上抛出，渲染层不会把“读失败”误判为空集合并移除全部标签；
- 手动导入拒绝未知普通对象/空列存；只有结构合法且用户二次确认的空文件才允许
  清除 MissAV 本地状态。

## 4. 详情页及设置交互的关联修复

- 详情页清单可选依赖等待增加上限并提供导航回退，避免同步插件异常阻塞整个面板；
- MissAV 手动同步按钮根据“实际发布成功/跳过/失败”显示不同反馈；
- 设置面板缓存统计使用稳定的插件引用，切换面板不会因 DOM `this` 导致运行时异常。

## 5. 实施文件

| 文件 | 改动 |
|------|------|
| `src/core/backup-extra-storage.ts` | 备份附加字段 allowlist、分阶段导入 |
| `src/core/storage-manager.ts` | schema 校验、最小覆盖、Web Lock、条件回滚、缓存失效与迁移保护 |
| `src/plugins/setting-plugin.tsx` | 安全恢复流程、空 MissAV 导入确认、准确同步反馈 |
| `src/plugins/car-status-sync/car-status-config.ts` | journal/revision/ready/DB meta 协议 |
| `src/plugins/car-status-sync/car-status-columnar.ts` | 列存严格验证、手动导入解析、URL 归一化 |
| `src/plugins/car-status-sync/car-status-db.ts` | IDB 锁、revision 补偿回滚、分批对账和查询错误传播 |
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 初始化保护、journal 压缩、大增量全量兜底 |
| `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | 有序消费、修订门禁、失败补偿和标签刷新 |
| `src/plugins/car-status-sync/missav-renderer.ts` | JavDB 链接校验、空集合与异常状态处理 |
| `src/plugins/detail-page-button-plugin.tsx` | 清单异步等待上限及回退 |
| `doc/129-security-boundary-and-runtime-hardening.md` | 本轮安全边界记录 |
| `doc/README.md`、`changelog/CHANGELOG.md`、`AGENTS.md` | 文档地图、变更日志与架构地图同步 |

本次没有清理用户数据库，也没有向 GM、IndexedDB、JavDB 或 MissAV 写入测试数据；
故障注入仅使用内存假存储。

## 6. 执行验证记录

```text
$ bunx tsc -b --pretty false
通过（无 TypeScript 错误）

$ bun run build
✓ 220 modules transformed
dist/monkey-jhs-disassemble.user.js  2,045.04 kB │ gzip: 472.06 kB
✓ built in 1.22s

$ security-storage-sync-regressions
通过（转义、备份、列存、URL、显式空快照）

$ storage-import-conditional-rollback
通过（并发值保护、部分写入恢复、未触及键保留）
```

## 7. 已知边界与后续建议

1. 不支持 Web Locks 的旧浏览器无法提供跨标签页同步串行；当前实现会安全失败/重试，
   但不能提供强一致顺序，建议现代浏览器作为最低运行环境。
2. 主库条件回滚采用“读取—比较—恢复”，不是跨标签页原子 CAS；极窄的比较与恢复
   间隙仍可能发生最后写入者覆盖，后续可将普通 save 操作也纳入同一锁。
3. `replaceLocalCars` 的失败路径可能重复使用同一快照回滚，影响仅限异常场景的额外
   读取/写入，不影响成功路径；后续可引入 staging store + commit marker 优化。
4. 新增 appData 键时必须同步扩展备份 allowlist 和本文件的 schema 说明；未知键默认
   拒绝是为了防止旧备份误删新功能数据。
