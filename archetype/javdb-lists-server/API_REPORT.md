# JavDB Lists Server — 接口报告

> 生成日期：2026-06-10  
> 运行环境：Cloudflare Workers + Hyperdrive → Neon PostgreSQL  
> 框架：Hono + Drizzle ORM + Postgres.js

---

## 目录

1. [数据库表结构](#1-数据库表结构)
2. [接口总览](#2-接口总览)
3. [接口详情](#3-接口详情)
   - [3.1 POST /api/movies_lists](#31-post-apimovies_lists)
   - [3.2 POST /api/check/movies_lists](#32-post-apicheckmovies_lists)
   - [3.3 POST /api/sync/movies_lists](#33-post-apisyncmovies_lists) 🆕
   - [3.4 POST /api/creation/movie](#34-post-apicreationmovie)
   - [3.5 POST /api/creation/list](#35-post-apicreationlist)
   - [3.6 POST /api/creation/movies_lists](#36-post-apicreationmovies_lists)
   - [3.7 POST /api/delete/movies_lists](#37-post-apideletemovies_lists)
4. [聚合端点设计说明](#4-聚合端点设计说明)
5. [错误码速查](#5-错误码速查)
6. [前端集成指南](#6-前端集成指南)
7. [安全性](#7-安全性)
8. [已知注意点](#8-已知注意点)

---

## 1. 数据库表结构

### movies（影片主表）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `designation` | VARCHAR | **PK** | 影片唯一标识（如 `ALDN-594`） |
| `href` | VARCHAR | NOT NULL, UNIQUE | 影片详情页 URL |
| `title` | VARCHAR | | 影片标题 |
| `cover_src` | VARCHAR | | 封面图片 URL |
| `score` | DOUBLE PRECISION | | 评分 |
| `release_date` | DATE | | 发行日期 |
| `created_at` | TIMESTAMP | | 入库时间 |
| `series` | VARCHAR | | 系列名 |
| `code` | VARCHAR | | 番号后缀 |

### inventory（清单表）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `list_id` | VARCHAR | **PK** | 清单唯一标识（如 `Azm8DM`） |
| `name` | VARCHAR | NOT NULL, UNIQUE | 清单名称 |
| `url` | VARCHAR | UNIQUE | 清单页面 URL |
| `count` | INTEGER | DEFAULT 0 | 条目数（触发器自动维护） |
| `style` | JSONB | | Bootstrap 风格配色（新建时随机选取） |

### movie_inventory（影片-清单关联表）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `designation` | VARCHAR | **PK**, FK → movies (CASCADE) | 影片标识 |
| `list_id` | VARCHAR | **PK**, FK → inventory (CASCADE) | 清单标识 |

**复合主键**：`(designation, list_id)` — 天然防重复，无需额外唯一索引。

---

## 2. 接口总览

| # | 端点 | 方法 | 用途 | 状态码 |
|---|---|---|---|---|
| 1 | `/api/movies_lists` | POST | 按 designation 批量查询所属清单 | 200 |
| 2 | `/api/check/movies_lists` | POST | 检查影片/清单/关联是否存在 | 200 / 500 |
| 3 | `/api/sync/movies_lists` | **POST** | **🆕 聚合同步** | 200 / 400 / 500 |
| 4 | `/api/creation/movie` | POST | 创建影片 | 201 / 400 / 409 / 500 |
| 5 | `/api/creation/list` | POST | 创建清单 | 201 / 400 / 409 / 500 |
| 6 | `/api/creation/movies_lists` | POST | 创建关联 | 201 / 400 / 404 / 409 / 422 / 500 |
| 7 | `/api/delete/movies_lists` | POST | 删除关联 | 200 / 400 / 404 / 500 |

---

## 3. 接口详情

### 3.1 POST /api/movies_lists

批量查询指定影片所属的清单列表。

**Request**

```json
{
  "lists": ["ALDN-594", "SSIS-001"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `lists` | `string[]` | ✅ | 影片 designation 数组 |

**Response** `200`

```json
{
  "ALDN-594": [
    {
      "name": "等待更新",
      "url": "https://javdb.com/lists/Azm8DM",
      "style": { "name": "primary", "bg": "#0d6efd", "text": "#fff" }
    },
    {
      "name": "本月新片",
      "url": null,
      "style": { "name": "warning", "bg": "#ffc107", "text": "#212529" }
    }
  ],
  "SSIS-001": []
}
```

返回一个以 designation 为 key 的对象，value 是包含 `name`、`url` 和 `style` 的清单数组。`style` 为 Bootstrap 风格配色 JSON 对象（`name`/`bg`/`text`），新建清单时从预定义配色池随机选取。未关联任何清单的 designation 对应空数组。

---

### 3.2 POST /api/check/movies_lists

检查影片、清单及关联关系是否已存在。一次查询返回三者的布尔值。

**Request**

```json
{
  "designation": "ALDN-594",
  "list_id": "Azm8DM"
}
```

**Response** `200`

```json
{
  "movie": true,
  "inventory": true,
  "movieInventory": false
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `movie` | `boolean` | 影片是否存在 |
| `inventory` | `boolean` | 清单是否存在 |
| `movieInventory` | `boolean` | 关联是否已存在 |

**错误**

| 状态码 | body |
|---|---|
| 500 | `{ "error": "Check movies/lists failed", "detail": "..." }` |

---

### 3.3 POST /api/sync/movies_lists 🆕

> **聚合端点** — 单次请求完成：影片 upsert → 清单 upsert → 关联 add/remove。  
> 替代原来的 `check` → `ensureMovie` → `ensureList` → `createRelation` / `deleteRelation` 多次 HTTP 往返。

**Request**

```json
{
  "designation": "ALDN-594",
  "list_id": "Azm8DM",
  "movie": {
    "href": "https://javdb.com/v/xxx",
    "title": "ガクガクにされた女 花撫あや",
    "cover_src": "https://c0.jdbstatic.com/covers/0e/0e28d0.jpg",
    "score": 4.67,
    "release_date": "2026-01-01",
    "series": "ALDN",
    "code": "594"
  },
  "list": {
    "url": "https://javdb.com/lists/Azm8DM",
    "name": "等待更新"
  },
  "action": "add"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `designation` | `string` | ✅ | 影片唯一标识 |
| `list_id` | `string` | ✅ | 清单唯一标识 |
| `action` | `"add"` \| `"remove"` | ✅ | 操作类型 |
| `movie.href` | `string` | ✅ | 影片详情页 URL |
| `movie.title` | `string` | | 影片标题 |
| `movie.cover_src` | `string` | | 封面图片 URL |
| `movie.score` | `number` | | 评分 |
| `movie.release_date` | `string` | | 发行日期（`YYYY-MM-DD`） |
| `movie.series` | `string` | | 系列名 |
| `movie.code` | `string` | | 番号后缀 |
| `list.name` | `string` | ✅ | 清单名称 |
| `list.url` | `string` | | 清单页面 URL |

**Response** `200`

```json
{
  "movie": "created",
  "list": "existed",
  "association": "created"
}
```

**状态枚举**

##### movie / list

| 值 | 含义 |
|---|---|
| `"created"` | 本次请求新创建 |
| `"existed"` | 数据库中已存在 |

##### association

| 值 | 含义 | 等价拆分接口返回 |
|---|---|---|
| `"created"` | 关联已创建 | `/api/creation/movies_lists` → 201 |
| `"existed"` | 关联已存在，无需操作 | `/api/creation/movies_lists` → 409 |
| `"deleted"` | 关联已删除 | `/api/delete/movies_lists` → 200 |
| `"unchanged"` | 关联本就不存在 | `/api/delete/movies_lists` → 404 |
| `"limit_exceeded"` | 清单条目数已达上限（501） | `/api/creation/movies_lists` → 422 |

**错误**

| 状态码 | body | 触发条件 |
|---|---|---|
| 400 | `{ "error": "designation, list_id, and action are required" }` | 缺少必填字段 |
| 400 | `{ "error": "action must be \"add\" or \"remove\"" }` | action 值非法 |
| 400 | `{ "error": "movie.href is required" }` | 缺少 movie.href |
| 400 | `{ "error": "list.name is required" }` | 缺少 list.name |
| 500 | `{ "error": "Sync movies_lists failed", "detail": "..." }` | 数据库异常 |

**服务端行为**

```
1. 影片 upsert
   INSERT INTO movies (...) VALUES (...)
   ON CONFLICT (designation) DO UPDATE SET
     title, cover_src, score, href, release_date, series, code
   （created_at 仅在首次插入时设置，更新时保留原值）

2. 清单 upsert
   INSERT INTO inventory (...) VALUES (...)
   ON CONFLICT (list_id) DO NOTHING
   （已存在的清单不更新 url/name）

3. 关联同步
   action = "add":
     INSERT INTO movie_inventory
     WHERE inventory.count < 501        -- 上限检查（最多501条）
       AND 关联不存在
     ON CONFLICT DO NOTHING

   action = "remove":
     DELETE FROM movie_inventory
     WHERE designation = ? AND list_id = ?
```

> 三步操作在 **单条 PostgreSQL CTE 语句** 中原子完成，数据修改 CTE 按书写顺序依次执行，后续 CTE 可见前序修改结果。

---

### 3.4 POST /api/creation/movie

创建新影片。

**Request**

```json
{
  "designation": "ALDN-594",
  "info": {
    "href": "https://javdb.com/v/xxx",
    "title": "ガクガクにされた女 花撫あや",
    "cover_src": "https://c0.jdbstatic.com/covers/0e/0e28d0.jpg",
    "score": "4.67",
    "release_date": "2026-01-01",
    "series": "ALDN",
    "code": "594"
  }
}
```

> **注意**：此接口 `info.score` 为 `string` 类型（历史原因）。聚合端点 `/api/sync/movies_lists` 的 `movie.score` 为 `number`。

**Response** `201`

```json
{
  "movie": {
    "designation": "ALDN-594",
    "href": "https://javdb.com/v/xxx",
    "title": "ガクガクにされた女 花撫あや",
    "coverSrc": "https://c0.jdbstatic.com/covers/0e/0e28d0.jpg",
    "score": 4.67,
    "releaseDate": "2026-01-01",
    "createdAt": "2026-06-10T...",
    "series": "ALDN",
    "code": "594"
  }
}
```

**错误**

| 状态码 | body | 条件 |
|---|---|---|
| 400 | `{ "error": "designation and info.href are required" }` | 缺少必填字段 |
| 409 | `{ "error": "Movie already exists" }` | designation 或 href 重复 |
| 500 | `{ "error": "Creation movie failed", "detail": "..." }` | 数据库异常 |

---

### 3.5 POST /api/creation/list

创建新清单。

**Request**

```json
{
  "list_id": "Azm8DM",
  "info": {
    "url": "https://javdb.com/lists/Azm8DM",
    "name": "等待更新"
  }
}
```

**Response** `201`

```json
{
  "list": {
    "listId": "Azm8DM",
    "name": "等待更新",
    "url": "https://javdb.com/lists/Azm8DM",
    "count": 0
  }
}
```

**错误**

| 状态码 | body | 条件 |
|---|---|---|
| 400 | `{ "error": "list_id and info.name are required" }` | 缺少必填字段 |
| 409 | `{ "error": "List already exists" }` | list_id 或 name 重复 |
| 500 | `{ "error": "Creation list failed", "detail": "..." }` | 数据库异常 |

---

### 3.6 POST /api/creation/movies_lists

创建影片与清单的关联。**包含清单条目上限检查（< 501，即最多 501 条，数据库 CHECK 约束兜底）。**

**Request**

```json
{
  "designation": "ALDN-594",
  "list_id": "Azm8DM"
}
```

**Response** `201`

```json
{
  "relation": {
    "designation": "ALDN-594",
    "listId": "Azm8DM"
  }
}
```

**错误**

| 状态码 | body | 条件 |
|---|---|---|
| 400 | `{ "error": "designation and list_id are required" }` | 缺少必填字段 |
| 404 | `{ "error": "Movie or list not found" }` | 影片或清单不存在 |
| 404 | `{ "error": "Movie not found" }` | FK 约束违反（影片不存在） |
| 409 | `{ "error": "Relation already exists" }` | 关联已存在 |
| 422 | `{ "error": "清单条目数已达上限（501）" }` | 清单条目数超过上限 |
| 500 | `{ "error": "Creation movies_lists failed", "detail": "..." }` | 数据库异常 |

---

### 3.7 POST /api/delete/movies_lists

删除影片与清单的关联。

**Request**

```json
{
  "designation": "ALDN-594",
  "list_id": "Azm8DM"
}
```

**Response** `200`

```json
{
  "success": true
}
```

**错误**

| 状态码 | body | 条件 |
|---|---|---|
| 400 | `{ "error": "designation and list_id are required" }` | 缺少必填字段 |
| 404 | `{ "error": "Relation not found" }` | 关联不存在 |
| 500 | `{ "error": "Delete movies_lists failed", "detail": "..." }` | 数据库异常 |

---

## 4. 聚合端点设计说明

### 4.1 动机

原有前端流程（勾选/取消 checkbox）最坏需要 **4 次 HTTP 往返**：

```
checkExistence ─→ ensureMovie ─→ ensureList ─→ createRelation / deleteRelation
     ↓                ↓              ↓                  ↓
  POST check       POST movie     POST list         POST relation
```

每次往返包含 TLS 握手 + Hyperdrive 连接 + SQL 执行，用户感知延迟大。

### 4.2 方案

`POST /api/sync/movies_lists` 将全部操作合并为 **1 次 HTTP 请求**，服务端使用 **单条 PostgreSQL CTE 语句** 原子完成三步操作：

| 步骤 | 操作 | SQL |
|---|---|---|
| 1 | 影片 upsert | `INSERT ... ON CONFLICT DO UPDATE` |
| 2 | 清单 upsert | `INSERT ... ON CONFLICT DO NOTHING` |
| 3 | 关联同步 | `INSERT ... ON CONFLICT DO NOTHING` 或 `DELETE` |

### 4.3 返回状态设计

三个字段各自独立返回操作结果，前端可按需映射 Toast 文案：

```typescript
const toastMap = {
  movie:    { created: "影片已创建",   existed: "影片已存在" },
  list:     { created: "清单已创建",   existed: "清单已存在" },
  association: {
    created:        "已添加到清单",
    existed:        "已在清单中",
    deleted:        "已移出清单",
    unchanged:      "关联不存在",
    limit_exceeded: "清单已达上限（501）",
  },
};
```

### 4.4 旧接口保留

以下接口 **不作废弃**，仍可用于单步操作场景：

- `POST /api/check/movies_lists`
- `POST /api/creation/movie`
- `POST /api/creation/list`
- `POST /api/creation/movies_lists`
- `POST /api/delete/movies_lists`

---

## 5. 错误码速查

| HTTP 状态码 | 含义 | 出现场景 |
|---|---|---|
| **200** | 成功 | 查询、同步、删除 |
| **201** | 创建成功 | 新建影片/清单/关联 |
| **400** | 请求参数错误 | 缺少必填字段、action 值非法 |
| **404** | 资源不存在 | 影片/清单/关联未找到 |
| **409** | 冲突 | 唯一键重复（已存在） |
| **422** | 业务规则限制 | 清单条目数超上限 |
| **500** | 服务器内部错误 | 数据库连接/查询异常 |

---

## 6. 前端集成指南

### 6.1 checkbox 勾选/取消流程（推荐）

```typescript
async function handleCheckboxChange(designation: string, listId: string, checked: boolean) {
  const movieInfo = getMovieInfo(designation);  // 从页面提取
  const listInfo  = getListInfo(listId);         // 从页面提取

  const res = await fetch("/api/sync/movies_lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      designation,
      list_id: listId,
      movie: movieInfo,
      list: listInfo,
      action: checked ? "add" : "remove",
    }),
  });

  const { movie, list, association } = await res.json();

  // 按需显示 toast（通常只关心 association）
  showToast(toastMap.association[association]);
}
```

### 6.2 可删除的前端函数

迁移到聚合端点后，以下 5 个函数可移除：

- `checkExistence(designation, listId)`
- `ensureMovie(designation, movieInfo)`
- `ensureList(listId, listInfo)`
- `createRelation(designation, listId)`
- `deleteRelation(designation, listId)`

---

## 7. 安全性

| 项目 | 实现 |
|---|---|
| SQL 注入防护 | 全部使用 Drizzle `sql` 模板标签参数化查询，无字符串拼接 |
| 输入校验 | TypeScript 编译时类型 + 运行时必填/白名单检查 |
| 错误信息 | 生产环境仅返回 `error` + `detail` 摘要，不暴露数据库堆栈 |
| 连接管理 | 每次请求新建 Postgres 客户端（`postgres()`），避免 Workers 冻结/解冻导致连接失效 |

---

## 8. 已知注意点

### 8.1 inventory.count 依赖数据库触发器

`inventory.count` 列由 PostgreSQL 触发器自动维护（INSERT/DELETE on `movie_inventory` 时 ±1）。Drizzle ORM 不支持触发器定义，需确保数据库中已部署该触发器。数据库已添加 CHECK 约束 `count <= 501`，即使触发器缺失导致 count 恒为 0，也不会有安全风险（只是上限检查始终通过）。

### 8.2 并发竞态（可接受）

两请求同时 add 同一 designation+list_id、count=500 时，可能同时通过应用层上限检查。但由于数据库 CHECK 约束 `count <= 501`，后执行的请求会因触发器尝试将 count 设为 502 而违反约束，事务回滚。并发安全性由数据库层面保障。

### 8.4 清单 style 自动生成

新建清单时，`style` 字段会从以下 Bootstrap 配色池中随机选取一个写入：

| name | bg | text |
|---|---|---|
| primary | `#0d6efd` | `#fff` |
| secondary | `#6c757d` | `#fff` |
| success | `#198754` | `#fff` |
| danger | `#dc3545` | `#fff` |
| warning | `#ffc107` | `#212529` |
| info | `#0dcaf0` | `#212529` |
| dark | `#212529` | `#fff` |

已存在的清单其 `style` 不会被更新（`ON CONFLICT DO NOTHING`）。

### 8.5 清单 upsert 不更新已有数据

`ON CONFLICT (list_id) DO NOTHING` — 若清单已存在，其 `url`、`name` 和 `style` **不会被更新**。如需更新清单信息，请使用其他方式。

### 8.4 created_at 仅在首次创建时写入

影片 upsert 的 `ON CONFLICT DO UPDATE` 子句中**不包含 `created_at`**，确保该字段始终记录首次入库时间。
