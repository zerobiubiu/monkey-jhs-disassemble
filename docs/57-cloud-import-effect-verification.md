# 云端导入按钮真实写入效果核验

> **文档类型**：📄 参考说明 / 问题排查  
> **文档状态**：📄 参考（缺陷已复现，尚未修复）  
> **影响范围**：云备份绿色导入按钮、共用的 `StorageManager.importData`  
> **前置文档**：`56-backup-import-format-and-git-large-file.md`  
> **适用版本**：v1.48.7  
> **源码变更**：无；本轮仅核验与记录，不代表完成修复

## 1. 核验结论

**按钮事件会触发、会下载并解析备份、会执行写入；但是多键备份不能完整恢复。即使显示“导入成功”，影片和设置等业务数据也可能完全没恢复。**

在隔离 Chrome 的真实 IndexedDB 中执行当前云端按钮代码：

- 六键备份只调用了一次主库写入，键为 `__jhs_schema_version`。
- `__meta`、`car_list`、`blacklist`、`favorite_actresses`、`setting` 均未恢复。
- 原影片仍为测试旧值 `OLD-001`，没有变成备份中的 `NEW-001`。
- 仍出现 `导入成功!`，并执行刷新请求，没有错误提示。
- 对照组只有一个 `car_list` 键时，能正常恢复到 `NEW-001`。

因此问题不是按钮没绑定或提示看不清，而是主数据遍历复制提前结束，成功分支又没有回读校验。

## 2. 调用链与根因

`src/plugins/setting/webdav-operations.ts` 的绿色 `.a-success` 绑定流程：

1. `layer.confirm`。
2. `provider.getFileContent` 获取正文。
3. `decodeBackup` 解码、`stripBackupExtras` 分离附加数据。
4. `storageManager.importData` 恢复主数据。
5. `applyBackupExtras` 恢复附加数据。
6. `show.ok('导入成功!')`，紧接刷新。

根因位于 `src/core/storage-manager.ts` 的 `importData`：

```ts
await tempInstance.iterate((value: unknown, key: string) => {
    return this.forage.setItem(key, value);
});
```

localforage 1.10.0 的 IndexedDB 驱动在迭代回调返回任何非 `undefined` 值时立即停止遍历。此处第一轮返回写入 Promise，因而只复制首个键；Promise 最终成功后，外层继续清理暂存区并进入“导入成功”。

IndexedDB 按键排序，常规备份的内部元信息键可能排在业务键前面。本次六键场景首键就是 `__jhs_schema_version`。已有主库内容没有被替换，不会自动报出业务数据未恢复。

附加数据是另一条恢复路径；本次主数据失败不代表附加存储一定未恢复，不能把局部恢复当作完整成功。

## 3. 实测方法与边界

使用已安装的 Chrome，独立临时 `--user-data-dir`，不使用用户的浏览器配置或网站数据库。

- Bun 将仓库当前 `StorageManager` 和 `openFileListDialog` 源码打入测试页面。
- 使用真实 localforage 1.10.0 和真实 IndexedDB 驱动，运行结果 `driver: asyncStorage`。
- 表格容器与确认框为测试替身；按钮 HTML 来自真实 formatter，事件绑定和导入函数均执行实际源码。
- 按用户提供的选择器点击测试按钮：`#tabulator-table-body > div:nth-child(1) > div:nth-child(7) > a.a-success`。
- 备份提供方返回合成数据，不读取私人远端或凭据。
- 唯一拦截的生产动作是页面刷新：在临时构建中将刷新调用替换为计数，便于写入后逐键回读；仓库源码未修改。
- 主库预置结构版本 6，真实迁移入口直接返回，避免把迁移写入误计为备份恢复。
- 包装真实 `setItem` 仅记录调用键，不改变写入结果；随后通过真实 `getItem` 检查数据。

### 合成输入

多键场景包含：

```json
{
  "__jhs_schema_version": 6,
  "__meta": { "backupTime": "probe" },
  "car_list": [{ "carNum": "NEW-001", "status": "已读", "score": 5 }],
  "blacklist": [{ "starId": "new-actor" }],
  "favorite_actresses": [{ "starId": "new-favorite" }],
  "setting": { "probeRestored": true }
}
```

对照场景仅包含相同的 `car_list`。每次运行前在隔离库预置旧影片、旧黑名单、旧演员收藏和不同设置。

## 4. 实际结果

| 检查项 | 多键场景 | 单键对照 |
| --- | --- | --- |
| 点击触发确认及导入 | 是 | 是 |
| 实际主库写入键 | `__jhs_schema_version` | `car_list` |
| 影片恢复为 `NEW-001` | 否，仍为 `OLD-001` | 是 |
| 黑名单、演员收藏、设置按备份恢复 | 均否 | 不在该场景输入范围 |
| 显示“导入成功” | 是 | 是 |
| 请求刷新次数 | 1 | 1 |
| 入口错误提示 | 无 | 无 |

六个键中只核对通过一个结构版本键，不是六份业务数据恢复了一份；四个被测业务键全部失败。

## 5. 后续修复必须验证的内容

1. 遍历时不能返回写入 Promise；应确保所有写入任务全部执行、全部等待。
2. 真实 IndexedDB 覆盖多键备份，不能只用不模拟提前退出行为的 FakeForage。
3. 在进入成功分支前重新读取并核对数据，区分主库和附加存储结果。
4. 检查暂存清理、失败恢复与迁移语义；不能只修成功提示。
5. 保留远端原备份与当前数据，修复验证完成前不把“成功”提示当作恢复完成证据。

## 6. 执行记录与限制

- 环境：Windows、Node v24.22.0、Bun 1.4.3、本机 Chrome、localforage 1.10.0。
- 一次性浏览器探针通过 CDP 等待页面结果，进程在 `finally` 中关闭；不是常驻服务器。
- 初次使用 `--dump-dom` 配合虚拟时间预算时，页面在 IndexedDB 就绪前被快进截取，未将该不完整输出作为结论；最终改用真实时间等待并取得上述完整逐键结果。
- 未安装依赖或工具，ego-browser CLI 不可用时改用本机 Chrome。
- 测试 Chrome 配置与数据均在新建临时目录中，完成后清理；未清理或写入用户真实浏览器配置。
- 本轮不修改源码、不递增版本；v1.48.7 的上述缺陷仍然存在。
- 这是当前源码按钮流程的隔离实测，不是对用户已打开网页所安装脚本版本或历史某次导入结果的断言。

## 7. 后续修复

上述 v1.48.7 排查结论保留为历史证据；v1.48.8 已修复全量写入与成功判定，并以真实 IndexedDB 再次验收。实现、验收矩阵与限制见 [`58-backup-full-restore-and-verification.md`](58-backup-full-restore-and-verification.md)。
