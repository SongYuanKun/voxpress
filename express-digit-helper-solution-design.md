# 智能多模态快递数字化助手

## 方案设计文档

| 项目信息     |                                                  |
| ------------ | ------------------------------------------------ |
| **项目名称** | Express-Digit-Helper（智能多模态快递数字化助手） |
| **文档版本** | v1.0                                             |
| **编写日期** | 2026-05-21                                       |
| **目标平台** | 移动端 H5 网页（iOS / Android 手机浏览器）       |
| **文档状态** | 已定稿                                           |

---

## 目录

1. [项目背景与目标](#1-项目背景与目标)
2. [技术方案选型](#2-技术方案选型)
3. [系统架构设计](#3-系统架构设计)
4. [功能模块设计](#4-功能模块设计)
5. [数据库设计](#5-数据库设计)
6. [API 接口设计](#6-api-接口设计)
7. [关键流程设计](#7-关键流程设计)
8. [项目结构](#8-项目结构)
9. [技术风险与应对](#9-技术风险与应对)
10. [部署方案](#10-部署方案)
11. [实施计划](#11-实施计划)

---

## 1. 项目背景与目标

### 1.1 痛点分析

| 痛点               | 现状                       | 影响                           |
| ------------------ | -------------------------- | ------------------------------ |
| **单号录入效率低** | 手动输入12-20位快递单号    | 单条耗时15-30秒，易出错        |
| **商品录入繁琐**   | 快递内物品繁杂，需逐项记录 | 仓储入库效率低下               |
| **数据修改无追溯** | 修改后丢失原始记录         | 无法审计，纠纷难举证           |
| **查询不便**       | 纸质/Excel记录，检索困难   | 无法快速回答"今天入了几张相纸" |

### 1.2 核心目标

通过手机端实现 **"镜头扫码 + 口述录入 + AI结构化"** 的一站式快递入库数字化方案：

1. **单号识别**：摄像头自动扫描条码/二维码，0.5秒内提取单号
2. **语音录入**：口述快递内容，AI秒级转为结构化数据
3. **双轨存储**：原始数据只读锁定 + 定制数据可编辑，审计无忧
4. **对话查询**：语音/文字提问，AI从数据库中检索并语音播报
5. **断网容错**：离线缓存 + 自动重试，仓库弱网环境不丢数据

### 1.3 目标用户画像

- 电商卖家（日处理50-200件快递）
- 手作工作室（寄出商品品类杂、数量不固定）
- 小型仓储（需要快速入库记录）

---

## 2. 技术方案选型

### 2.1 技术栈总览

| 层级           | 技术选型                | 版本       | 选型理由                                |
| -------------- | ----------------------- | ---------- | --------------------------------------- |
| **前端框架**   | Vue 3                   | ^3.4       | Composition API，复杂交互逻辑管理能力强 |
| **移动端UI**   | Vant 4                  | ^4.8       | 轻量级移动端组件库，按需引入体积小      |
| **构建工具**   | Vite                    | ^5.4       | 快速HMR，原生ESM，Vue 3官方推荐         |
| **状态管理**   | Pinia                   | ^2.1       | Vue 3官方推荐，TypeScript友好           |
| **HTTP客户端** | Axios                   | ^1.7       | 拦截器机制适合统一错误处理              |
| **CSS方案**    | Tailwind CSS            | ^3.4       | 原子化CSS，快速构建移动端布局           |
| **后端运行时** | Node.js                 | ^18 LTS    | 事件驱动，I/O密集型场景性能优           |
| **后端框架**   | Express                 | ^4.21      | 成熟稳定，中间件生态丰富                |
| **数据库**     | SQLite (better-sqlite3) | ^11.0      | 零配置文件型数据库，同步API高性能       |
| **LLM接口**    | OpenAI SDK (兼容格式)   | ^4.52      | DeepSeek/Qwen均兼容，统一调用方式       |
| **语音识别**   | Web Speech API          | 浏览器原生 | 零成本零延迟，现代移动浏览器均支持      |
| **语音合成**   | window.speechSynthesis  | 浏览器原生 | 前端本地播报，无需后端                  |
| **条码解析**   | html5-qrcode            | ^2.3.9     | 前端本地解析条形码+二维码               |
| **定时备份**   | node-cron               | ^3.0       | 标准cron表达式，轻量调度                |

### 2.2 架构模式

采用 **前后端分离 + 三层后端架构**：

```
前端: Component → Store → API (数据单向流动)
后端: Router(Middleware) → Service(Business Logic) → Repository(Data Access)
```

**选型核心决策**：

| 决策点   | 方案A              | 方案B                | 最终选择             | 理由                                |
| -------- | ------------------ | -------------------- | -------------------- | ----------------------------------- |
| LLM接入  | 直接HTTP调用       | OpenAI SDK           | **OpenAI SDK**       | DeepSeek/Qwen均兼容，切换只需改配置 |
| 语音方案 | 云端ASR(讯飞/百度) | 浏览器原生Web Speech | **Web Speech API**   | 零成本零延迟，仓库场景够用          |
| 条码解析 | 后端ZBar           | 前端html5-qrcode     | **前端html5-qrcode** | 无需后端处理，响应更快              |
| 数据库   | MySQL/PostgreSQL   | SQLite               | **SQLite**           | 单机部署零配置，数据量级够用        |
| 备份方案 | 云数据库           | 本地Cron+文件复制    | **Cron+文件复制**    | 简单可靠，SQLite文件级备份          |

---

## 3. 系统架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                   移动端 H5 (Vue 3 + Vant)               │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │  扫码模块   │  │  语音模块   │  │   AI对话模块     │  │
│  │ (html5-    │  │ (Web Speech│  │  (聊天界面 +     │  │
│  │  qrcode)   │  │   API)     │  │   TTS播报)       │  │
│  └──────┬─────┘  └──────┬─────┘  └────────┬─────────┘  │
│         │               │                  │            │
│  ┌──────┴───────────────┴──────────────────┴─────────┐  │
│  │            Pinia Store (状态管理层)                 │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ Axios                         │
└─────────────────────────┼───────────────────────────────┘
                          │ HTTPS (必须)
┌─────────────────────────┼───────────────────────────────┐
│                 Node.js + Express                        │
│                                                         │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │            Router / Middleware Layer               │  │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────────┐      │  │
│  │  │ /parse  │  │ /chat   │  │ /list, /:id  │      │  │
│  │  └────┬────┘  └────┬────┘  └──────┬───────┘      │  │
│  └───────┼────────────┼───────────────┼───────────────┘  │
│          │            │               │                  │
│  ┌───────┴────────────┴───────────────┴───────────────┐  │
│  │           Service Layer (业务逻辑)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │  │
│  │  │ ParseSvc │  │ ChatSvc  │  │  RecordSvc    │   │  │
│  │  └────┬─────┘  └────┬─────┘  └──────┬────────┘   │  │
│  └───────┼──────────────┼───────────────┼─────────────┘  │
│          │              │               │                │
│  ┌───────┴──────┐  ┌────┴─────┐  ┌─────┴──────────┐   │
│  │ LLM Service  │  │  SQLite  │  │  Backup Svc    │   │
│  │ (OpenAI SDK) │  │ (better- │  │  (node-cron)   │   │
│  │ DeepSeek/Qwen│  │ sqlite3) │  │                │   │
│  └──────────────┘  └──────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 数据流概览

```
用户操作 → 前端组件 → Pinia Store → Axios API → Express Router
    → Service → Repository(SQLite) / LLM Service(DeepSeek/Qwen)
    → 响应回传 → Store更新 → 界面渲染 + TTS播报
```

---

## 4. 功能模块设计

### 4.1 视觉模块 — 快递单号抓取

| 设计项       | 说明                                                 |
| ------------ | ---------------------------------------------------- |
| **触发方式** | 进入页面自动请求摄像头权限，或点击按钮手动触发       |
| **扫描能力** | 支持一维条形码(Barcode) + 二维码(QR Code)            |
| **解析位置** | 前端本地解析（html5-qrcode），不经后端               |
| **成功反馈** | 短震动(100ms) + TTS播报"单号已识别" + 自动填充输入框 |
| **失败处理** | 提示"请允许摄像头权限" / "未识别到条码，请调整角度"  |

### 4.2 语音模块 — 口述录入

| 设计项       | 说明                                                |
| ------------ | --------------------------------------------------- |
| **交互方式** | 大面积"按住说话"按钮，长按录音、松开结束            |
| **识别引擎** | 浏览器原生 Web Speech API (webkitSpeechRecognition) |
| **语言设置** | 中文 (zh-CN)                                        |
| **输出展示** | 录音结束后立即展示识别出的原始语音文本              |
| **重录支持** | 可重新按住录音，覆盖上次结果                        |

### 4.3 AI 智能体模块 — 多模态结构化

| 设计项         | 说明                                                         |
| -------------- | ------------------------------------------------------------ |
| **输入**       | 快递单号 + 原始语音文本                                      |
| **处理**       | 后端调用LLM，强制JSON输出 (`response_format: { type: "json_object" }`) |
| **输出格式**   | `{"物品名": 数量}` — value必须为整型                         |
| **修改意图**   | 识别"把相纸改成5个"等表述，输出 `{"action": "update", "target": "相纸", "value": 5}` |
| **校验逻辑**   | 后端JSON Schema校验，非法则返回错误码1003                    |
| **Prompt策略** | System Prompt定义规则 + 示例，User Prompt传入原始文本        |

**解析Prompt模板**：

```
你是一个快递物品信息结构化解析助手。
用户会提供一段语音转文字的描述，你需要提取其中的物品名称和数量。

规则：
1. 输出必须为合法JSON对象，格式 {"物品名": 数量}
2. key为物品名称（去掉量词），value为数量（整数）
3. 如果用户表达修改意图（如"把相纸改成8张"），输出 {"action": "update", "target": "相纸", "value": 8}
4. 忽略无法识别的内容
5. 数量默认为1（如果用户没有明确说明）
```

### 4.4 交互模块 — 对话与语音播报

#### TTS 语音播报

| 触发场景       | 播报内容示例                                     |
| -------------- | ------------------------------------------------ |
| 单号识别成功   | "单号已识别，请说话记录内容。"                   |
| AI解析入库成功 | "录入成功。单号 SF1234，包含相纸10张，胸针3个。" |
| 系统报错       | "抱歉，网络异常，数据已离线保存。"               |

#### 智能对话查询

| 设计项       | 说明                                                         |
| ------------ | ------------------------------------------------------------ |
| **入口**     | 页面底部对话框，支持文字输入 + 语音输入                      |
| **上下文**   | 自动加载对话历史 + 当前数据库schema                          |
| **查询流程** | 用户提问 → LLM生成回复 → 前端展示 + TTS播报                  |
| **数据修改** | 若用户通过对话要求修改数据，AI识别意图后直接更新custom_json  |
| **示例**     | "今天一共录入了多少张相纸？" → "根据记录，今天共录入相纸 45 张。" |

### 4.5 存储模块 — 双轨数据防丢

#### 核心设计原则

```
原始数据 (Original)  ←  LLM首次解析结果，全只读，作为审计凭证
        │
        └── 初始同步 ──→  定制数据 (Custom)  ←  允许用户修改
                              │
                              ├── 修改数量
                              ├── 删除误报物品
                              ├── 添加备注
                              └── "恢复初始数据" → 从原始数据重置
```

#### 页面呈现规则

| 特性         | 说明                                                     |
| ------------ | -------------------------------------------------------- |
| **列表展示** | 响应式表格，支持日期筛选、关键词搜索、分页加载           |
| **展开详情** | 每行可展开，查看原始语音文本 + 原始AI解析JSON            |
| **修改标识** | custom_json ≠ original_json 时显示"已修改"标签           |
| **重置操作** | "恢复初始数据"按钮，一键将custom_json重置为original_json |
| **删除机制** | 软删除（status=0），列表默认不显示已删除记录             |

---

## 5. 数据库设计

### 5.1 ER 关系图

```
┌──────────────────┐       ┌──────────────────┐
│  express_records  │  1 ──→│  chat_messages   │
│                  │       │                  │
│  id (PK)         │       │  id (PK)         │
│  tracking_number │       │  session_id (FK) │
│  raw_audio_text  │       │  role            │
│  original_json   │       │  content         │
│  custom_json     │       │  created_at      │
│  status          │       └──────────────────┘
│  created_at      │
│  updated_at      │       ┌──────────────────┐
└──────────────────┘ ←··· │  backup_logs     │
                          │                  │
                          │  id (PK)         │
                          │  file_path       │
                          │  record_count    │
                          │  file_size       │
                          │  status          │
                          │  created_at      │
                          └──────────────────┘
```

### 5.2 完整 Schema

```sql
-- 快递记录表
CREATE TABLE express_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT NOT NULL,                   -- 快递单号
    raw_audio_text  TEXT NOT NULL,                   -- ASR识别的原始口述文本
    original_json   TEXT NOT NULL,                   -- LLM首次解析结果（只读审计）
    custom_json     TEXT NOT NULL,                   -- 用户可修改的定制数据
    status          INTEGER DEFAULT 1,               -- 1=正常 0=已删除
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tracking_number ON express_records(tracking_number);
CREATE INDEX idx_status_created ON express_records(status, created_at DESC);

-- 对话记录表
CREATE TABLE chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,                       -- 会话标识(UUID)
    role        TEXT NOT NULL,                       -- 'user' | 'assistant'
    content     TEXT NOT NULL,                       -- 消息内容
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_id ON chat_messages(session_id);

-- 数据备份日志表
CREATE TABLE backup_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path    TEXT NOT NULL,                      -- 备份文件路径
    record_count INTEGER DEFAULT 0,                  -- 备份时的记录数
    file_size    TEXT DEFAULT '0B',                  -- 备份文件大小
    status       INTEGER DEFAULT 1,                  -- 1=成功 0=失败
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 自动更新 updated_at 触发器
CREATE TRIGGER update_express_timestamp
AFTER UPDATE ON express_records
BEGIN
    UPDATE express_records SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
```

---

## 6. API 接口设计

### 6.1 统一响应格式

```json
// 成功
{ "code": 0, "data": <T>, "message": "success" }

// 失败
{ "code": <错误码>, "data": null, "message": "<错误描述>" }
```

### 6.2 错误码定义

| 错误码 | 含义           | HTTP状态码 |
| ------ | -------------- | ---------- |
| 0      | 成功           | 200        |
| 1001   | 参数校验失败   | 400        |
| 1002   | 记录不存在     | 404        |
| 1003   | LLM解析失败    | 500        |
| 1004   | LLM调用超时    | 504        |
| 1005   | 数据库操作失败 | 500        |
| 1006   | 对话生成失败   | 500        |
| 1007   | 备份失败       | 500        |

### 6.3 接口列表

#### 6.3.1 提交解析

```
POST /api/express/parse
```

**请求体**：

```json
{
  "tracking_number": "SF1234567890",
  "raw_audio_text": "5张相纸，2个手机壳，一盒胶带"
}
```

**成功响应** (200)：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "tracking_number": "SF1234567890",
    "parsed_json": { "相纸": 5, "手机壳": 2, "胶带": 1 }
  },
  "message": "success"
}
```

**处理流程**：参数校验 → LLM解析 → JSON校验 → 写库(original_json = custom_json) → 返回结果

---

#### 6.3.2 更新定制数据

```
PUT /api/express/update/:id
```

**请求体**：

```json
{
  "custom_json": { "相纸": 6, "手机壳": 2, "胶带": 1, "充电线": 3 }
}
```

**成功响应** (200)：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "tracking_number": "SF1234567890",
    "custom_json": { "相纸": 6, "手机壳": 2, "胶带": 1, "充电线": 3 },
    "updated_at": "2026-05-21T15:00:00.000Z"
  },
  "message": "success"
}
```

---

#### 6.3.3 获取记录列表

```
GET /api/express/list?page=1&page_size=20&date_from=2026-05-01&date_to=2026-05-21&keyword=SF
```

**查询参数**：

| 参数      | 类型   | 必填 | 说明                 |
| --------- | ------ | ---- | -------------------- |
| page      | number | 否   | 页码，默认1          |
| page_size | number | 否   | 每页条数，默认20     |
| date_from | string | 否   | 起始日期(YYYY-MM-DD) |
| date_to   | string | 否   | 结束日期(YYYY-MM-DD) |
| keyword   | string | 否   | 单号/物品名模糊搜索  |

**成功响应** (200)：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "tracking_number": "SF1234567890",
        "raw_audio_text": "5张相纸，2个手机壳",
        "original_json": { "相纸": 5, "手机壳": 2 },
        "custom_json": { "相纸": 6, "手机壳": 2 },
        "status": 1,
        "is_modified": true,
        "created_at": "2026-05-21T14:00:00.000Z",
        "updated_at": "2026-05-21T15:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "page_size": 20
  },
  "message": "success"
}
```

---

#### 6.3.4 获取单条记录

```
GET /api/express/:id
```

**成功响应** (200)：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "tracking_number": "SF1234567890",
    "raw_audio_text": "5张相纸，2个手机壳",
    "original_json": { "相纸": 5, "手机壳": 2 },
    "custom_json": { "相纸": 6, "手机壳": 2 },
    "status": 1,
    "is_modified": true,
    "created_at": "2026-05-21T14:00:00.000Z",
    "updated_at": "2026-05-21T15:00:00.000Z"
  },
  "message": "success"
}
```

---

#### 6.3.5 软删除记录

```
DELETE /api/express/:id
```

**成功响应** (200)：

```json
{ "code": 0, "data": { "id": 1, "status": 0 }, "message": "success" }
```

---

#### 6.3.6 智能对话

```
POST /api/express/chat
```

**请求体**：

```json
{
  "session_id": "uuid-xxxx",
  "message": "今天一共录入了多少张相纸？",
  "context": {
    "tracking_number": "SF1234567890",
    "current_data": { "相纸": 6, "手机壳": 2 }
  }
}
```

**成功响应** (200)：

```json
{
  "code": 0,
  "data": {
    "session_id": "uuid-xxxx",
    "reply": "根据记录SF1234567890，当前清单中相纸数量为6张。",
    "data": null
  },
  "message": "success"
}
```

**对话触发数据修改时**：

```json
{
  "code": 0,
  "data": {
    "session_id": "uuid-xxxx",
    "reply": "已将相纸数量修改为8张。",
    "data": { "相纸": 8, "手机壳": 2, "胶带": 1 }
  },
  "message": "success"
}
```

---

#### 6.3.7 恢复初始数据

```
POST /api/express/reset/:id
```

**成功响应** (200)：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "custom_json": { "相纸": 5, "手机壳": 2 },
    "original_json": { "相纸": 5, "手机壳": 2 },
    "updated_at": "2026-05-21T15:30:00.000Z"
  },
  "message": "success"
}
```

---

## 7. 关键流程设计

### 7.1 扫码录入完整流程

```
用户                    前端                      后端                    LLM
 │                       │                        │                       │
 │── 点击"扫码录入" ──→  │                        │                       │
 │                       │── 请求摄像头权限 ──→    │                       │
 │                       │←── 权限授予 ──────────  │                       │
 │                       │                        │                       │
 │                       │── 开启后置摄像头        │                       │
 │                       │── 持续扫描条码/二维码   │                       │
 │                       │                        │                       │
 │   [对准快递面单]       │                        │                       │
 │                       │←── 识别成功: SF1234 ──  │                       │
 │                       │                        │                       │
 │                       │── 震动反馈(100ms)       │                       │
 │                       │── TTS: "单号已识别"     │                       │
 │←── 显示单号 ─────────  │                        │                       │
 │                       │                        │                       │
 │── 按住"语音录入" ──→  │                        │                       │
 │   "5张相纸2个手机壳"  │── Web Speech API STT    │                       │
 │                       │←── "5张相纸2个手机壳"── │                       │
 │←── 显示识别文本 ────  │                        │                       │
 │                       │                        │                       │
 │   [自动提交]           │── POST /api/express/parse ──→  │               │
 │                       │                        │── LLM解析 ──────────→ │
 │                       │                        │←── {"相纸":5,"手机壳":2}
 │                       │                        │── 写库 ──→            │
 │                       │←── 200 {parsed_json} ──│                       │
 │                       │                        │                       │
 │←── TTS: "录入成功" ── │                        │                       │
 │←── 显示结果卡片 ────  │                        │                       │
```

### 7.2 智能对话查询流程

```
用户                    前端                      后端                    LLM
 │                       │                        │                       │
 │── 打开对话面板 ──→    │                        │                       │
 │                       │── GET /api/express/list→│                       │
 │                       │←── 记录列表 ──────────  │                       │
 │                       │                        │                       │
 │── 输入/语音 ────────→ │                        │                       │
 │  "SF123里相纸有几张?" │── POST /api/express/chat ──→                   │
 │                       │                        │── 加载对话历史          │
 │                       │                        │── 构造Prompt(历史+Schema+数据) ──→
 │                       │                        │←── "SF123中相纸数量为5张" │
 │                       │                        │── 保存对话记录          │
 │                       │←── {reply, data} ─────│                       │
 │                       │                        │                       │
 │←── 显示AI回复 ──────  │                        │                       │
 │←── TTS播报回复 ─────  │                        │                       │
```

### 7.3 断网容错流程

```
正常流程:  扫码 → 语音 → POST /parse → LLM → 入库 → 播报

断网分支:  扫码 → 语音 → POST /parse 失败
                ↓
          自动存入 localStorage 待提交队列
                ↓
          提示 "网络延迟，已离线保存"
                ↓
          [网络恢复] → 监听 online 事件
                ↓
          自动重试队列中的所有待提交数据
                ↓
          清空队列 + 提示 "已同步 N 条离线记录"
```

---

## 8. 项目结构

```
express-digit-helper/
├── client/                              # 前端项目 (Vue 3 + Vant + Vite)
│   ├── index.html                       # HTML入口
│   ├── vite.config.js                   # Vite配置(HTTPS/代理/按需引入)
│   ├── tailwind.config.js               # Tailwind CSS配置
│   ├── postcss.config.js                # PostCSS配置
│   ├── package.json                     # 前端依赖声明
│   ├── tsconfig.json                    # TypeScript配置
│   ├── tsconfig.node.json               # Node端TS配置
│   ├── env.d.ts                         # 环境变量类型声明
│   └── src/
│       ├── main.ts                      # 应用入口
│       ├── App.vue                      # 根组件(底部TabBar)
│       ├── router/
│       │   └── index.ts                 # 路由配置
│       ├── stores/
│       │   ├── express.ts               # 快递记录Store
│       │   ├── chat.ts                  # 对话Store
│       │   └── app.ts                   # 全局状态Store
│       ├── api/
│       │   ├── request.ts               # Axios实例+拦截器
│       │   └── express.ts               # API封装
│       ├── composables/
│       │   ├── useScanner.ts            # 扫码逻辑
│       │   ├── useSpeech.ts             # 语音识别/合成
│       │   ├── useVibrate.ts            # 震动反馈
│       │   └── useOffline.ts            # 断网缓存
│       ├── components/
│       │   ├── ScannerView.vue          # 扫码组件
│       │   ├── VoiceInput.vue           # 语音录入组件
│       │   ├── RecordCard.vue           # 记录卡片
│       │   ├── RecordList.vue           # 记录列表
│       │   ├── ChatPanel.vue            # 对话面板
│       │   ├── ChatBubble.vue           # 对话气泡
│       │   ├── StatusTag.vue            # 状态标签
│       │   └── EmptyState.vue           # 空状态
│       ├── views/
│       │   ├── HomeView.vue             # 首页(扫码+录入)
│       │   ├── ListView.vue             # 记录列表页
│       │   ├── DetailView.vue           # 记录详情页
│       │   └── ChatView.vue             # 智能对话页
│       ├── utils/
│       │   ├── format.ts                # 格式化工具
│       │   └── storage.ts               # localStorage工具
│       └── styles/
│           └── main.css                 # 全局样式
│
├── server/                              # 后端项目 (Node.js + Express)
│   ├── package.json                     # 后端依赖声明
│   ├── tsconfig.json                    # TypeScript配置
│   ├── .env                             # 环境变量(不入库)
│   ├── src/
│   │   ├── index.ts                     # 服务器入口
│   │   ├── config/
│   │   │   └── index.ts                 # 环境变量配置
│   │   ├── routes/
│   │   │   └── express.ts              # 路由定义
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts          # 全局错误处理
│   │   │   └── validator.ts             # 参数校验
│   │   ├── services/
│   │   │   ├── llmService.ts            # LLM调用封装
│   │   │   ├── expressService.ts        # 业务逻辑
│   │   │   └── backupService.ts         # 定时备份
│   │   ├── repository/
│   │   │   └── expressRepo.ts           # 数据库CRUD
│   │   ├── prompts/
│   │   │   ├── parsePrompt.ts           # 解析Prompt
│   │   │   └── chatPrompt.ts            # 对话Prompt
│   │   ├── types/
│   │   │   └── index.ts                 # 类型定义
│   │   └── utils/
│   │       └── logger.ts                # 日志工具
│   └── data/
│       └── express.db                   # SQLite数据库(运行时生成)
│
├── .gitignore
└── README.md
```

---

## 9. 技术风险与应对

| 风险                 | 等级 | 影响                         | 应对措施                                                    |
| -------------------- | ---- | ---------------------------- | ----------------------------------------------------------- |
| **HTTPS未部署**      | P0   | 摄像头/麦克风API被浏览器禁用 | Vite dev server启用https选项；生产环境Nginx + Let's Encrypt |
| **LLM API不稳定**    | P1   | 解析/对话功能不可用          | 配置超时30s + 重试1次 + localStorage缓存原始数据            |
| **Web Speech兼容性** | P1   | 部分安卓浏览器不支持         | 提供文字输入降级方案；长期考虑Edge TTS备选                  |
| **localStorage溢出** | P2   | 离线缓存丢失                 | 设置队列上限50条；超限提示用户联网                          |
| **SQLite并发写入**   | P2   | 多窗口同时写入冲突           | better-sqlite3同步API天然串行，无此风险                     |
| **移动端内存不足**   | P2   | 摄像头+语音同时运行卡顿      | 扫码完成后释放摄像头资源再启动语音                          |

---

## 10. 部署方案

### 10.1 开发环境

```bash
# 前端 (端口5173, HTTPS)
cd client && npm install && npm run dev

# 后端 (端口3000)
cd server && npm install && npm run dev
```

- Vite配置API代理：`/api` → `http://localhost:3000`
- 启用HTTPS：Vite `server.https: true` + 自签名证书

### 10.2 生产环境

```
用户手机 → HTTPS → Nginx反向代理
                      ├── / → 前端静态文件 (dist/)
                      └── /api → Node.js后端 (端口3000)
                                  └── SQLite (express.db)
```

- **Nginx**：HTTPS终止 + 静态文件服务 + API反向代理
- **进程管理**：PM2 守护 Node.js 进程
- **HTTPS证书**：Let's Encrypt (certbot自动续期)
- **定时备份**：node-cron 每日凌晨2点复制db文件到备份目录

### 10.3 环境变量

```env
# server/.env
PORT=3000
LLM_API_BASE=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
LLM_MODEL=deepseek-chat
DB_PATH=./data/express.db
BACKUP_CRON=0 2 * * *
BACKUP_DIR=./backups
```

---

## 11. 实施计划

### 11.1 里程碑规划

| 阶段             | 内容                           | 交付物                       | 工期    |
| ---------------- | ------------------------------ | ---------------------------- | ------- |
| **M1: 基础设施** | 项目初始化、数据库、基础配置   | 前后端项目骨架、数据库Schema | Day 1   |
| **M2: 核心录入** | 扫码 + 语音 + LLM解析 + 入库   | 端到端录入功能可用           | Day 2-3 |
| **M3: 数据管理** | 记录列表、详情、编辑、双轨展示 | 完整CRUD功能                 | Day 4   |
| **M4: 智能对话** | 对话面板、语音查询、数据修改   | 对话查询可用                 | Day 5   |
| **M5: 容错增强** | 离线缓存、自动重试、定时备份   | 生产级可靠性                 | Day 6   |

### 11.2 任务依赖图

```
M1 基础设施
  ├──→ M2 核心录入（扫码 + 语音 + LLM + 入库）
  │         └──→ M3 数据管理（列表 + 详情 + 编辑）
  │                   └──→ M4 智能对话
  │                             └──→ M5 容错增强
  └──→ [并行] M3 数据管理
```

> M2 和 M3 可部分并行：M2 聚焦录入链路，M3 聚焦展示链路，共享 M1 的基础设施。

### 11.3 依赖包清单

**前端 (client/package.json)**：

| 包名                       | 类型          | 用途            |
| -------------------------- | ------------- | --------------- |
| vue                        | dependency    | 核心框架        |
| vue-router                 | dependency    | 路由            |
| pinia                      | dependency    | 状态管理        |
| vant                       | dependency    | 移动端UI组件    |
| axios                      | dependency    | HTTP客户端      |
| html5-qrcode               | dependency    | 条码/二维码解析 |
| dayjs                      | dependency    | 日期处理        |
| @vitejs/plugin-vue         | devDependency | Vite Vue插件    |
| vite                       | devDependency | 构建工具        |
| typescript                 | devDependency | TypeScript      |
| vue-tsc                    | devDependency | Vue类型检查     |
| @vant/auto-import-resolver | devDependency | Vant按需引入    |
| unplugin-vue-components    | devDependency | 组件自动导入    |
| unplugin-auto-import       | devDependency | API自动导入     |
| tailwindcss                | devDependency | CSS框架         |
| postcss                    | devDependency | CSS处理         |
| autoprefixer               | devDependency | 浏览器前缀      |

**后端 (server/package.json)**：

| 包名                  | 类型          | 用途               |
| --------------------- | ------------- | ------------------ |
| express               | dependency    | Web框架            |
| better-sqlite3        | dependency    | SQLite驱动         |
| openai                | dependency    | LLM SDK (兼容格式) |
| cors                  | dependency    | 跨域中间件         |
| node-cron             | dependency    | 定时任务           |
| dotenv                | dependency    | 环境变量           |
| uuid                  | dependency    | UUID生成           |
| dayjs                 | dependency    | 日期处理           |
| tsx                   | devDependency | TypeScript执行     |
| typescript            | devDependency | TypeScript         |
| @types/express        | devDependency | Express类型        |
| @types/better-sqlite3 | devDependency | SQLite类型         |
| @types/cors           | devDependency | CORS类型           |
| @types/node-cron      | devDependency | Cron类型           |
| @types/uuid           | devDependency | UUID类型           |
