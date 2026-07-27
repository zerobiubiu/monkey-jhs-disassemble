# 201 - 清单页跨影片回填（组内压实）可行性调查

> **文档类型**：📄 参考说明
> **文档状态**：📄 参考

## 1. 背景

doc/200 的详情页「序号清单合并」只能管**新片往哪放**（前向填充）。详情页接口
`/users/simple_lists?vid=` 仅返回当前影片的清单归属，无法获知其他影片在各清单的分布，
故**跨影片回填**（把高位清单的影片挪到低位清单空位，恢复「低序号先填满」不变式）须放在
**清单页**实现。本文是 doc/200 §3.5/§6 预留的「期0 只读调查」结论，**不含任何代码变更**。

## 2. 调查发现（关键：端点风险已消解）

原以为最大变数是「加入/移除端点未知，需逆向」。调查发现项目**早已封装好成熟可复用的
增删管线**，无需逆向：

### 2.1 加入/移除端点（已封装）

`src/plugins/video-lists-tag/server/vlt-server-api.ts` `postJavdbListMutation`（L98-133）：

```
POST /users/save_video_to_list
Content-Type: application/json
X-CSRF-Token: getCsrfToken()          // meta[name=csrf-token]，全站可用
body: { video_id, checked, list_id }  // checked:true 加入 / false 移除
credentials: 'same-origin'            // 页面内原生 fetch
→ { success: boolean, message: string }
返回：{ kind: 'confirmed' | 'rejected' | 'unknown', message }
```

- 用**页面内原生 `fetch`（same-origin）**，继承浏览器已有 Cloudflare 通行态——比
  `GM_xmlhttpRequest`（doc/199 还需补导航头）安全得多，批量请求被拦风险显著降低。
- 原生 checkbox 的 `data-action="change->list#listCheckboxChanged"`（`vlt-server.ts` L181）
  即对应此端点；注释（L166）明确「等待 `/users/save_video_to_list` 明确成功」。

### 2.2 权威状态校验（已封装）

`fetchAuthoritativeCheckboxState(videoId, listId)`（同文件 L136-170）：分页读取
`/users/simple_lists?vid=`，返回 `{ checked, count, name }`，可在每次增删后复核真实结果。

### 2.3 既有健壮管线（可参照）

`vlt-server.ts` `performServerCheckboxMutation`（L44-144）已实现：串行队列
（`enqueueAssociationTask`）+ 恢复日志（`createPendingJournal`/localStorage）+ 增删后
权威校验 + 失败回滚。清单页批量执行的「中止/续传/复核」可直接借鉴这套模式。

### 2.4 组发现（可行）

`/users/lists` 页列出用户全部清单，每条为 `a[href*="/lists/{id}"]`，文本形如「清单名 (数量)」
（`vlt-create-list-api.ts` `fetchListIdByName` L380-401 已用此解析，并 `replace(/\s*\(\d+\)\s*$/,'')`
去数量后缀）。分页用全站通用 `a.pagination-next`（`list-waterfall/lw-fetch.ts` `findNextUrl`
已验证可翻 `/users/lists`）。拿到全部清单后，复用 doc/200 `parseListName` 按 base+num 归组，
即得某清单的编号兄弟集合及各自数量。

### 2.5 清单内影片枚举（可行）

`/lists/{id}` 是标准 javdb 视频网格页：
- 选择器（`base-plugin.ts` `getSelector` L211-217）：容器 `.movie-list`、条目
  `.movie-list .item`、下一页 `.pagination-next`。
- 影片 ID：条目内 `a[href*="/v/"]` → `/v/([^/?#]+)`（项目各处通用正则）。
- 抓取：逐页 `GET /lists/{id}?page=N`（原生 fetch 或 GM GET，list-waterfall 的 `gmGet`
  已证明 GM GET 翻页可用），`DOMParser` 解析，跟随 `.pagination-next` 至无。
- `@match: https://javdb.com/*` 覆盖 `/lists/{id}`；`connect` 含 `javdb.com`。

### 2.6 CSRF

`getCsrfToken()` 读 `meta[name=csrf-token]`（Rails 全站 meta），清单页同样存在。

## 3. 可行性结论

**可行，且端点/校验/组发现/枚举均有现成基础，无需逆向。** 主要工作量在「批量执行引擎的
安全性」（预演/中止/续传/限速）与「枚举开销」，而非协议未知。

### 3.1 功能设计草案（组内压实）

给定编号组 `等待更新1..N`，把已有影片重排为「低序号先填满 501 才往后」：

```
压实前：等待更新1=401  等待更新2=501  等待更新3=120  （共 1022）
目标：  等待更新1=501  等待更新2=501  等待更新3=20
计划：  2→1 搬 100；3→2 搬 100（填 2 刚空出的位）
```

算法（纯逻辑，可单测）：
1. 枚举组内各清单影片（保序），全组去重得有序影片流。
2. 按 501 容量依次分配：前 501→清单1，次 501→清单2……得目标归属。
3. diff 现态/目标 → 搬运列表 `(videoId, fromListId, toListId)`。
4. **排序执行：先移除后加入**，避免目标清单满 501 拒绝加入。

### 3.2 复用清单

| 需要 | 复用 |
|------|------|
| 加入/移除 | `postJavdbListMutation` |
| 增删后复核 | `fetchAuthoritativeCheckboxState` |
| 序号解析/归组 | doc/200 `dpb-list-merge` `parseListName`/`groupEntries` |
| `/users/lists` 抓取/翻页 | `fetchListIdByName` 模式 + `lw-fetch.findNextUrl` |
| 串行/恢复日志模式 | `vlt-server.ts` 管线 |
| 分页/影片选择器 | `base-plugin.getSelector` |
| GM 请求头（若用 GM） | doc/199 `buildBrowserNavHeaders` |

### 3.3 新增模块（预估）

`ListReflowPlugin`（list 页 + `/lists/` 守卫）、组发现、影片枚举、压实规划器（纯逻辑）、
执行引擎（限速/中止/续传）、预演 UI、设置项；配套单测与文档。

## 4. 风险与约束（如实）

1. **开销大**：枚举一个 3 清单组约需数十次翻页抓取；压实数百部影片 = 数百次增+移 POST。
   必须限速（建议可调间隔），大组耗时以分钟计。
2. **破坏性**：规划/执行 bug 可能批量误删。必须「只读预演 → 明确确认 → 小批量 → 可中止 →
   可续传（恢复日志）→ 增删后权威复核」。
3. **语义需用户拍板**：清单内影片顺序是否保留；一部片若被手动放入多个编号清单，压实干会
   收敛到一个——是否符合预期。
4. **满员时序**：必须先移除腾位再加入，否则目标清单满 501 会拒绝。
5. **Cloudflare/限流**：原生 same-origin fetch 风险较低，但短时间大量请求仍可能触发限流，
   须限速 + 失败退避。

## 5. 工期估算（相对 doc/200）

端点已就绪，主要复杂度在执行引擎安全性。整体约为 doc/200（详情页合并）的 **2–3 倍**工作量，
集中于：枚举模块、压实规划器、执行引擎（限速/中止/续传/复核）、预演 UI。

## 6. 建议分期

- **期1（只读，几乎零风险）**：清单页注入「本编号组状态」面板（1..N 各自数量/满员，复用
  doc/200 展开明细样式）+ 生成压实计划**预览**（将移动 N 部：A→B…），**不执行任何写入**。
- **期2（写入，高风险）**：预演确认后才执行，带限速/中止/续传/权威复核。建议以期1试用反馈
  再决定期2细节（顺序策略、多归属策略、批量大小）。

## 7. 验证方式（本文调查依据）

均为只读代码 survey，无网络请求、无数据写入：
- `src/plugins/video-lists-tag/server/vlt-server-api.ts`（端点 + 校验）
- `src/plugins/video-lists-tag/vlt-server.ts`（data-action + 健壮管线）
- `src/plugins/video-lists-tag/vlt-create-list-api.ts`（/users/lists 解析）
- `src/plugins/list-waterfall/lw-fetch.ts`（/users/lists 翻页）
- `src/plugins/base-plugin.ts`（视频网格选择器）
- `vite.config.ts`（@match / connect 覆盖）
