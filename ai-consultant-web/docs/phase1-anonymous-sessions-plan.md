# 阶段一细化改造方案：匿名身份 + 会话列表

不接登录，先打通「匿名主体 → 会话列表 → 单会话」的数据对应关系。

---

## 一、目标与范围

| 目标 | 说明 |
|-----|------|
| 数据主体 | 用 `anonymousId` 标识「谁」，同一浏览器固定（localStorage），所有会话归属该 ID |
| 会话列表 | 新增 GET `/api/sessions`，按 `anonymousId` 返回该主体的会话列表，支持对话历史入口 |
| 单会话 | 保持 GET/POST `/api/chat`，创建/更新 Session 时写入 `anonymousId`，GET 可选做归属校验 |
| 不涉及 | 登录、User 表写入、会话迁移 |

---

## 二、数据模型变更

### 2.1 Prisma Schema

**文件**：`prisma/schema.prisma`

在 `Session` 模型中增加字段并建索引：

```prisma
model Session {
  id             String    @id @default(uuid())
  userId         String?
  user           User?     @relation(fields: [userId], references: [id])
  anonymousId    String?   // 阶段一：匿名身份，与 userId 二选一或并存
  agentId        String
  title          String?
  currentCanvasData Json?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  messages       Message[]
  reports        Report[]

  @@index([anonymousId, updatedAt(sort: Desc)])
  @@index([userId, updatedAt(sort: Desc)])
}
```

**约束（应用层保证）**：创建 Session 时至少填写 `anonymousId` 或 `userId` 其一；阶段一仅使用 `anonymousId`。

### 2.2 迁移

- 执行 `npx prisma migrate dev --name add_anonymous_id_to_session` 生成并应用迁移。
- 存量 Session 的 `anonymousId` 为 null，不影响现有按 `sessionId` 的 GET；新创建的会话必须带 `anonymousId`。

---

## 三、API 规格

### 3.1 POST `/api/chat`（现有，行为调整）

**请求体**：在现有 `messages`、`agentId`、`sessionId` 基础上增加：

- `anonymousId`（string，必填）：前端从 store/localStorage 读取的匿名身份 ID。

**逻辑变更**：

1. 若未传 `anonymousId`，返回 400 或仍允许创建但不写 `anonymousId`（产品决策：建议阶段一要求必传，便于列表查询）。
2. `upsert` Session 时：
   - `create` 分支：增加 `anonymousId: body.anonymousId`。
   - `update` 分支：可选 `update: { anonymousId: body.anonymousId, updatedAt: new Date() }`（若希望后续支持「绑定到新设备」可更新 anonymousId，否则仅 update updatedAt）。

**涉及文件**：`src/app/api/chat/route.ts`（解析 body.anonymousId，写入 Session 的 create/update）。

### 3.2 GET `/api/chat?sessionId=xxx`（现有，可选增强）

- 保持：根据 `sessionId` 查 Session + messages，返回 `messages`、`canvasData`、`agentId`。
- 可选：增加 query `anonymousId`，校验 `session.anonymousId === anonymousId`，不一致则 403，防止越权查看他人会话。

**涉及文件**：`src/app/api/chat/route.ts`（GET 分支）。

### 3.3 新增 GET `/api/sessions`

**Query**：

- `anonymousId`（string，必填）
- `agentId`（string，可选）：筛选某 agent
- `limit`（number，可选，默认 20）
- `cursor`（string，可选）：上一页最后一条的 `updatedAt` 或 `id`，用于分页

**响应**（JSON）：

```json
{
  "sessions": [
    {
      "id": "uuid",
      "agentId": "gxx",
      "title": "会话标题",
      "updatedAt": "ISO8601",
      "createdAt": "ISO8601"
    }
  ],
  "nextCursor": "optional-next-cursor-or-null"
}
```

**实现要点**：

- `where: { anonymousId }`（及可选的 `agentId`），`orderBy: { updatedAt: 'desc' }`，`take: limit + 1`，若有下一页则返回 `nextCursor`（如最后一条的 id 或 updatedAt）。
- 只返回列表字段，不包含 messages、currentCanvasData。

**涉及文件**：新建 `src/app/api/sessions/route.ts`。

---

## 四、前端改造

### 4.1 匿名身份 ID

- **存储**：与现有 Zustand 持久化一致，使用 localStorage；key 可与 store 同源或单独 key（如 `ai-consultant-anonymous-id`）。
- **生成**：首次访问生成 UUID（与现有 sessionId 一样用 `uuid` 包），写入 localStorage 并写入 store。
- **使用**：所有请求 `/api/chat`、`/api/sessions` 时带上该 ID。

**方案 A（推荐）**：在 store 中增加 `anonymousId`，与 `sessionId` 类似，在 `store.ts` 的 `partialize` 中持久化；应用启动时若没有则 `uuidv4()` 并 `setAnonymousId`。

**方案 B**：单独工具函数 `getOrCreateAnonymousId()`：读 localStorage，无则生成并写入，返回 string；不在 store 里存，每次请求前调用。

建议采用方案 A，与现有 sessionId 模式一致，便于在 UI 中统一「当前身份」。

**涉及文件**：

- `src/lib/store.ts`：增加 `anonymousId: string | null`、`setAnonymousId`，初始化时若为空则 set 为 `uuidv4()`，并在 `partialize` 中持久化。
- 或新建 `src/lib/anonymousId.ts` 提供 `getOrCreateAnonymousId()`，由调用方在请求前使用。

### 4.2 请求体携带 anonymousId

- **POST /api/chat**：在 `sendMessage` 的 `body` 中增加 `anonymousId: anonymousId`（从 store 或 `getOrCreateAnonymousId()` 取）。
- **GET /api/chat**：若实现归属校验，则在 query 中增加 `anonymousId=xxx`。
- **GET /api/sessions**：请求 `GET /api/sessions?anonymousId=xxx`（及可选的 agentId、limit、cursor）。

**涉及文件**：`src/features/chat/ChatInterface.tsx`（useEffect 中 sessionId 旁可初始化 anonymousId；handleSend 的 body 增加 anonymousId；若 GET 做校验则 fetch 时加 query）。

### 4.3 会话列表 UI（最小可用）

- 在合适位置（如侧边栏、顶部下拉、或独立「历史」页）增加「会话列表」入口。
- 调用 `GET /api/sessions?anonymousId=...`，展示 `sessions[]`（标题、时间、agentId）。
- 点击某项：`setSessionId(item.id)`，并触发当前 ChatInterface 的 hydrate（现有 GET `/api/chat?sessionId=` 逻辑），即可恢复该会话。

**涉及文件**：新建组件如 `src/features/sessions/SessionList.tsx`（或放在 `features/chat/` 下），在布局或 ChatInterface 旁引入；列表项点击时更新 store 的 sessionId 并可选导航/刷新以触发 hydrate。

### 4.4 新建会话

- 当前逻辑：前端生成新 `sessionId`（或由服务端在首次消息时创建，见下）。
- 保持「新建会话」= 生成新 sessionId + `setSessionId(newId)` + 清空当前 messages（或重置为 welcome）；下次发消息时 POST 会 upsert 该 session 并带上当前 `anonymousId`。

可选增强：首次发消息时若不传 `sessionId`，由服务端 `prisma.session.create` 生成 id，并在响应中返回（如 stream 的 custom header 或首 chunk 的 meta），前端用该 id 作为 sessionId；这样会话完全由服务端创建，避免客户端 UUID 冲突。此为非必须，可放在阶段一收尾或后续迭代。

---

## 五、实施顺序（推荐）

1. **Schema + 迁移**  
   - 在 `Session` 上增加 `anonymousId` 与索引，执行 `prisma migrate dev`。

2. **后端 POST /api/chat**  
   - 从 body 读取 `anonymousId`，在 Session 的 `create`（及可选 `update`）中写入；若要求必传则无 `anonymousId` 时返回 400。

3. **前端 anonymousId**  
   - 在 store 中增加 `anonymousId` / `setAnonymousId`，初始化时生成并持久化；或实现 `getOrCreateAnonymousId()` 并在请求前使用。

4. **前端 POST body**  
   - ChatInterface 发消息时在 body 中加上 `anonymousId`。

5. **后端 GET /api/sessions**  
   - 新建 `src/app/api/sessions/route.ts`，按 `anonymousId`（及可选 agentId、分页）查询并返回列表。

6. **前端 GET /api/chat 归属校验（可选）**  
   - GET 时传 `anonymousId`，服务端校验 `session.anonymousId === query.anonymousId`，否则 403。

7. **前端会话列表 UI**  
   - 实现 SessionList 组件，调用 GET /api/sessions，点击切换 sessionId 并触发 hydrate。

8. **（可选）服务端创建 sessionId**  
   - 首次消息无 sessionId 时服务端 create Session 并返回 id，前端使用该 id。

---

## 六、验收要点

- 新产生的 Session 均带有 `anonymousId`。
- 同一浏览器内访问 GET `/api/sessions?anonymousId=<本机 anonymousId>` 能看到该设备下所有会话列表。
- 点击列表项可切换并恢复对应会话（消息 + 画布）。
- 数据对应关系明确：匿名身份 → 多条 Session → 每条 Session 下 Message + Report + currentCanvasData。

---

## 七、涉及文件清单

| 类型 | 文件 | 变更说明 |
|-----|------|----------|
| Schema | `prisma/schema.prisma` | Session 增加 `anonymousId` 与索引 |
| API | `src/app/api/chat/route.ts` | POST 写 Session.anonymousId；GET 可选校验 anonymousId |
| API | `src/app/api/sessions/route.ts` | 新建，GET 会话列表 |
| Store | `src/lib/store.ts` | 增加 anonymousId 及持久化、初始化 |
| Chat | `src/features/chat/ChatInterface.tsx` | body 带 anonymousId；可选 GET 带 anonymousId |
| UI | `src/features/sessions/SessionList.tsx`（或等价） | 新建，会话列表 + 切换会话 |

以上为阶段一「匿名身份 + 会话列表」的完整细化方案，可直接按实施顺序开发与联调。
