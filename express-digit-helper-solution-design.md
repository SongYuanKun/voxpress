# VoxPress 智能多模态快递数字化助手

## 产品方案与 MVP 实施设计文档

| 项目信息 | 内容 |
| --- | --- |
| 项目名称 | VoxPress / Express-Digit-Helper |
| 产品定位 | 面向小型电商、手作工作室和轻量仓储的移动端快递入库记录工具 |
| 文档版本 | v1.1 |
| 更新日期 | 2026-05-21 |
| 目标平台 | 移动端 H5 网页（iOS / Android 手机浏览器） |
| 文档状态 | 产品方案评审稿 |
| 首版目标 | 打通扫码识别单号、语音或文字录入、AI 结构化、人工确认、入库查询的 MVP 闭环 |
| 部署参考 | 参考 au / au_message 项目的 Docker Compose + 1Panel/OpenResty 部署方式 |

---

## 目录

1. 一句话结论
2. 项目背景与产品定位
3. 目标用户与核心场景
4. MVP 范围与版本边界
5. 核心用户旅程
6. 产品体验原则
7. 功能模块设计
8. 技术方案选型
9. 系统架构设计
10. 数据库设计
11. API 接口设计
12. 异常状态与容错设计
13. 安全、权限与部署设计
14. 验收标准
15. AI Agent 协作实施计划
16. 项目结构
17. 实施计划

---

## 1. 一句话结论

VoxPress 是一个轻量级移动端快递入库助手，不做完整 WMS，不做复杂 ERP，首版只聚焦一个高频动作：仓库人员拿手机扫快递单号，口述或输入包裹内容，由 AI 转成结构化清单，人工确认后保存，并能快速查询和修正。

MVP 的核心假设是：

“扫码 + 口述/文字 + AI 结构化 + 人工确认”的流程，能否在小型仓储入库场景中比手写、Excel 或纯手动录入更快、更少错、更容易追溯。

首版优先验证录入闭环。智能对话、完整离线同步、多用户权限、复杂统计和备份面板不作为第一版前置交付。

---

## 2. 项目背景与产品定位

### 2.1 痛点分析

| 痛点 | 现状 | 影响 | 优先级 |
| --- | --- | --- | --- |
| 单号录入效率低 | 手动输入 12-20 位快递单号 | 单条耗时 15-30 秒，易出错 | P0 |
| 商品明细记录繁琐 | 快递内物品需逐项记录 | 入库慢，漏记、错记常见 | P0 |
| 修改缺少追溯 | 改过后丢失原始记录 | 售后、盘点、纠纷难举证 | P1 |
| 查询不方便 | 纸质或 Excel 记录，检索困难 | 无法快速回答“今天入了几张相纸” | P1 |
| 弱网环境易丢数据 | 仓库网络不稳定 | 录入中断，重复劳动 | P2 |

### 2.2 产品定位

本产品定位为面向小型电商、手作工作室和轻量仓储场景的移动端快递入库记录工具，核心目标是降低“快递单号 + 包裹内容明细”的录入成本。

首版不追求完整仓储系统能力，而是优先解决高频、重复、易出错的入库记录问题，让用户在手机上通过扫码和口述完成单件快递的快速建档、确认、查询和修正。

### 2.3 非目标

首版不做以下内容：

- 不做完整库存管理系统
- 不处理采购、销售、出库、财务结算和多仓调拨
- 不承诺替代专业 WMS
- 不优先支持多人协作和复杂权限
- 不把智能对话作为核心录入路径
- 不让 AI 直接执行不可逆数据修改

---

## 3. 目标用户与核心场景

### 3.1 首版目标用户

首版优先服务日处理 30-200 件快递的小型电商卖家、手作工作室店主或仓库操作人员。

这类用户通常没有完整仓储系统，但已经感受到纸质记录、Excel 和手动输入的效率瓶颈。他们更关注录入速度、查找方便、出错后可修正，而不是复杂库存、财务或多角色权限管理。

### 3.2 典型用户画像

| 用户 | 场景 | 核心诉求 |
| --- | --- | --- |
| 小型电商卖家 | 每天处理几十到上百件快递 | 快速记录单号和物品，方便售后查找 |
| 手作工作室 | 商品品类杂、数量不固定 | 用口述替代逐项打字，降低漏记 |
| 轻量仓储人员 | 仓库现场连续入库 | 手机单手操作，弱网不丢记录 |
| 店主或负责人 | 需要盘点和查询 | 快速知道某天某类物品录入数量 |

### 3.3 核心场景

仓库人员收到或处理一件快递，打开手机 H5 页面，对准面单扫码识别快递单号，然后口述“5 张相纸、2 个手机壳、一盒胶带”。系统将语音识别结果交给 AI 解析为结构化清单，用户确认无误后保存。

后续用户可以按日期、单号或物品名称快速查找记录，并在发现识别错误时手动修正，同时保留原始口述和首次解析结果作为追溯依据。

---

## 4. MVP 范围与版本边界

### 4.1 MVP 目标

MVP 的目标不是验证所有 AI 能力，而是验证核心录入闭环是否成立。

只要首版能稳定完成单件录入、记录查询和人工修正，就具备继续扩展智能对话、离线同步、统计分析和多端协作的基础。

### 4.2 P0 必须完成

| 功能 | 说明 |
| --- | --- |
| 手机 H5 打开可用 | 通过正式 HTTPS 域名访问 |
| 扫码识别单号 | 点击触发摄像头权限，支持手动输入兜底 |
| 语音/文字录入 | 语音作为增强能力，文字输入必须可用 |
| AI 结构化解析 | 将口述内容解析为物品名和数量 |
| 人工确认保存 | AI 结果必须展示给用户确认后入库 |
| 记录列表与详情 | 支持日期、关键词、单号检索 |
| 手动修正 | 以表单行编辑物品名和数量，不暴露 JSON |
| 双轨存储 | 保留原始文本、首次解析结果和用户修正结果 |
| 基础安全 | API 鉴权、CORS 白名单、限流、日志脱敏 |

### 4.3 P1 建议完成

| 功能 | 说明 |
| --- | --- |
| 日期筛选 | 按日查询入库记录 |
| 已修改标识 | custom 数据与 original 数据不一致时标记 |
| 恢复初始数据 | 一键恢复首次 AI 解析结果 |
| 简单统计 | 今日录入件数、某物品总数 |
| LLM 失败兜底 | 保留原始文本，允许稍后重试解析 |
| 重复单号提示 | 提醒用户查看原记录或确认仍然保存 |
| 待同步队列可见 | 弱网时展示待同步数量和失败原因 |

### 4.4 P2 暂缓

| 功能 | 暂缓原因 |
| --- | --- |
| 智能对话查询 | 先验证录入闭环，避免首版复杂化 |
| 对话驱动修改数据 | 有误改风险，需要更强确认机制 |
| 完整离线自动同步 | 需要 IndexedDB、幂等和状态机支撑 |
| 定时备份面板 | 服务端备份可先内部实现，不进入首版 UI |
| 多用户、多角色、多仓库 | 不属于第一阶段核心问题 |
| 复杂审计日志 | MVP 先保留 original/custom 双轨 |

---

## 5. 核心用户旅程

### 5.1 标准入库

1. 用户打开首页，系统进入“扫码待命”状态。
2. 用户点击“开始扫码”，浏览器请求摄像头权限。
3. 用户对准快递面单条码，识别成功后震动、显示单号、播报“单号已识别”。
4. 页面自动切换到录入区，用户长按说出物品和数量，或直接输入文字。
5. 系统展示识别原文和 AI 结构化结果。
6. 用户确认无误后点击“确认入库”。
7. 系统生成记录，并进入“下一件”状态。
8. 页面保留最近 3 条入库结果，方便现场复核。

### 5.2 扫码失败

1. 摄像头无法识别条码。
2. 页面提示调整角度、距离、光线。
3. 超过 5 秒未识别时，提供“手动输入单号”。
4. 用户输入后继续语音或文字录入，不中断入库流程。

### 5.3 语音识别不准

1. 用户口述后，页面先展示识别原文。
2. AI 解析结果以“物品 + 数量”的可编辑清单展示。
3. 用户可直接修改数量、删除误识别项、补充漏识别项。
4. 保存时同时保留原始语音文本和用户修正后的结构化结果。

### 5.4 弱网或离线入库

1. 用户完成扫码和录入后，网络不可用。
2. 系统本地保存“待同步记录”，明确显示“已离线保存，待同步”。
3. 用户可继续录入下一件。
4. 网络恢复后自动同步，并在列表中标记同步成功或同步失败。

---

## 6. 产品体验原则

1. 先保留，再解析：扫码结果和语音/文字原文必须优先保存，AI 解析失败不能导致原始信息丢失。
2. 用户始终知道当前状态：页面必须明确展示当前处于扫码、录音、解析、待确认、已保存、待同步还是失败状态。
3. 高风险动作必须确认：删除记录、恢复初始数据、覆盖已有单号、AI 修改数据，都需要二次确认。
4. 编辑优先表单化：面向仓库用户，不暴露 JSON 编辑。结构化数据以“物品名 + 数量”的清单行呈现。
5. 连续入库优先：每次保存成功后，默认回到下一件扫码状态，减少页面跳转。
6. 弱网可继续作业：网络异常时允许继续扫码和录入，本地队列可查看、可重试、可删除。
7. AI 只做辅助：AI 查询可以给建议；AI 修改数据必须展示修改前后差异，并由用户确认。

---

## 7. 功能模块设计

### 7.1 首页：连续入库工作台

首页只服务一个目标：快速完成当前快递入库，并立即进入下一件。

页面状态：

- 待扫码
- 已识别单号，待录入
- 已识别语音/文字，待解析
- 已解析，待确认
- 入库成功，准备下一件
- 离线已保存，待同步
- 异常待处理

页面结构：

| 区域 | 内容 |
| --- | --- |
| 顶部 | 网络状态、待同步数量、TTS 开关 |
| 主区域 | 扫码取景框或单号输入框 |
| 中部 | 语音录入按钮、文字输入框、识别原文 |
| 下方 | AI 解析结果确认卡片 |
| 底部 | 确认入库、重录、手动编辑、下一件 |

关键交互：

- 扫码成功后不自动提交，先进入录入状态。
- 语音识别完成后不直接入库，先展示解析结果确认卡片。
- “确认入库”是主按钮，“重录”“编辑”“下一件”是辅助动作。
- 最近入库结果固定展示最近 3 条：单号尾号、物品摘要、同步状态。
- 长按说话按钮要足够大，适合单手拇指操作。
- 扫码时提供手电筒入口。
- 单号输入框支持粘贴、清空、扫码覆盖。
- 重复单号弹出确认：“该单号今天已录入，是否继续保存为新记录？”
- TTS 播报可关闭。

### 7.2 扫码模块

| 设计项 | 说明 |
| --- | --- |
| 触发方式 | 用户点击“开始扫码”后请求摄像头权限 |
| 扫描能力 | 支持一维条形码和二维码 |
| 解析位置 | 前端本地解析，不经后端 |
| 成功反馈 | 短震动 + 显示单号 + 可选 TTS 播报 |
| 失败处理 | 手动输入单号兜底 |
| 技术方案 | html5-qrcode |

### 7.3 语音与文字录入模块

| 设计项 | 说明 |
| --- | --- |
| 语音交互 | 大面积“按住说话”按钮 |
| 语音识别 | Web Speech API，作为增强能力 |
| 文字兜底 | 始终提供文字输入 |
| 输出展示 | 展示识别原文，允许编辑 |
| 重录支持 | 可重新录音，覆盖上次结果 |

Web Speech API 在移动端兼容性不稳定，尤其 iOS Safari 风险较高。MVP 不能把语音作为唯一输入链路，文字输入必须完整可用。

### 7.4 AI 结构化解析模块

输入字段：

| 字段 | 说明 |
| --- | --- |
| tracking_number | 快递单号 |
| raw_text | 语音识别或手动输入的原始文本 |

输出结构：

| 字段 | 说明 |
| --- | --- |
| items | 物品数组 |
| items.name | 物品名 |
| items.quantity | 数量，必须为正整数 |

规则：

- 输出必须为合法 JSON。
- 物品名称不能为空。
- 数量必须为正整数。
- 未明确数量时默认为 1。
- 无法识别内容不得写入结构化结果。
- LLM 输出必须通过 JSON Schema 校验。
- 解析失败时保留原始文本，允许用户手动编辑或稍后重试。

### 7.5 记录列表页

功能：

- 日期筛选
- 单号/物品关键词搜索
- 同步状态筛选
- 记录卡片展示：单号、物品摘要、创建时间、是否修改、同步状态
- 支持进入详情、继续编辑、软删除

### 7.6 记录详情页

展示：

- 快递单号
- 原始语音/文字文本
- original_json 只读区
- custom_json 可编辑区
- 修改状态和更新时间
- 同步状态

操作：

- 保存修改
- 恢复初始数据
- 删除记录
- 重试同步

### 7.7 待同步页

离线队列必须对用户可见，不只存在 IndexedDB 中。

每条离线记录至少展示：

- client_request_id
- 快递单号
- 原始文本
- 创建时间
- 重试次数
- 同步状态
- 失败原因

操作：

- 单条重试
- 全部重试
- 删除本地草稿

### 7.8 智能查询页（P2）

智能查询不是 MVP 核心路径，建议放到第二阶段。

规则：

- 查询类问题由后端生成受控查询结果，再交给 LLM 组织语言。
- 不允许 LLM 直接拼接或执行 SQL。
- 修改类问题必须展示修改前后差异，并由用户二次确认。
- AI 只产生“建议修改”，不直接落库。

---

## 8. 技术方案选型

| 层级 | 技术选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 前端框架 | Vue 3 | 3.4+ | Composition API，适合复杂交互状态 |
| 移动端 UI | Vant 4 | 4.8+ | 轻量移动端组件库 |
| 构建工具 | Vite | 5.4+ | 快速开发和构建 |
| 状态管理 | Pinia | 2.1+ | Vue 3 官方推荐 |
| HTTP 客户端 | Axios | 1.7+ | 拦截器、统一错误处理 |
| 条码解析 | html5-qrcode | 2.3.9+ | 前端本地解析条码/二维码 |
| 语音识别 | Web Speech API | 浏览器原生 | 增强能力，必须有文字兜底 |
| 语音合成 | speechSynthesis | 浏览器原生 | 可选播报 |
| 后端运行时 | Node.js | 20 LTS | I/O 密集型场景适合 |
| 后端框架 | Express | 4.21+ | 成熟稳定 |
| 数据库 | SQLite / better-sqlite3 | 11+ | 单机部署简单 |
| LLM 接口 | OpenAI SDK 兼容格式 | 4.52+ | 可切换 DeepSeek/Qwen |
| 鉴权与安全 | Bearer Token / Basic Auth + helmet + rate limit | - | MVP 基础防护 |
| 离线队列 | IndexedDB | 浏览器原生 | 比 localStorage 更适合可靠队列 |

关键调整：

| 事项 | 原方案 | 调整后方案 | 原因 |
| --- | --- | --- | --- |
| 摄像头权限 | 进入页面自动请求 | 用户点击后请求 | 避免移动浏览器拦截和用户反感 |
| 语音输入 | 默认主链路 | 增强能力，文字兜底 | Web Speech 移动端兼容性不稳定 |
| 离线缓存 | localStorage | IndexedDB | localStorage 容量和事务能力不足 |
| 对话修改 | AI 识别后直接更新 | AI 只给建议，用户确认后提交 | 避免误改 |
| API 安全 | 未明确 | 基础鉴权、CORS、限流、日志脱敏 | 防止数据泄露和 LLM 费用被刷 |
| 技术范围 | 首版包含对话/备份/离线完整能力 | 首版聚焦录入闭环 | 降低 MVP 风险 |

---

## 9. 系统架构设计

整体架构：

    移动端 H5 (Vue 3 + Vant)
      - 连续入库工作台
      - 扫码模块 html5-qrcode
      - 语音/文字录入模块
      - 记录列表/详情
      - 待同步队列 IndexedDB
      - Axios API Client
            |
            | HTTPS
            v
    1Panel / OpenResty / Nginx HTTPS 反向代理
            |
            v
    Node.js + Express
      - auth / cors / rate limit / error handler
      - express routes
      - express service
      - llm service
      - sync service
      - SQLite (better-sqlite3, WAL)

后端分层保持简单：

    routes -> services -> db

MVP 暂不引入过重抽象。等功能扩展到多模块后，再拆 Repository 和更复杂的领域层。

---

## 10. 数据库设计

### 10.1 核心表

    CREATE TABLE express_records (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        client_request_id TEXT UNIQUE NOT NULL,
        tracking_number   TEXT NOT NULL,
        raw_text          TEXT NOT NULL,
        original_json     TEXT NOT NULL,
        custom_json       TEXT NOT NULL,
        source_type       TEXT DEFAULT 'manual',
        sync_status       TEXT DEFAULT 'synced',
        status            INTEGER DEFAULT 1,
        created_by        TEXT,
        deleted_at        DATETIME,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_tracking_number ON express_records(tracking_number);
    CREATE INDEX idx_status_created ON express_records(status, created_at DESC);
    CREATE INDEX idx_sync_status ON express_records(sync_status);

说明：

- client_request_id 用于离线重试和幂等提交，避免重复入库。
- original_json 首次写入后不允许普通编辑接口修改。
- custom_json 是用户可编辑结果。
- 是否允许同一单号多次保存，需要根据真实业务确认。MVP 默认提示重复，不静默覆盖。

### 10.2 可选明细表

如果“按物品统计”成为核心能力，建议增加明细表，避免长期依赖 JSON 查询。

    CREATE TABLE express_record_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id   INTEGER NOT NULL,
        item_name   TEXT NOT NULL,
        quantity    INTEGER NOT NULL,
        is_original INTEGER DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

MVP 可以先用 JSON 双轨快速启动；统计需求增强后再引入明细表。

### 10.3 对话记录表（P2）

    CREATE TABLE chat_messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT NOT NULL,
        role        TEXT NOT NULL,
        content     TEXT NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

### 10.4 备份日志表（P1/P2）

    CREATE TABLE backup_logs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path    TEXT NOT NULL,
        record_count INTEGER DEFAULT 0,
        file_size    TEXT DEFAULT '0B',
        status       INTEGER DEFAULT 1,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

备份要求：

- SQLite 开启 WAL 或定义明确写入模式。
- 备份使用 SQLite 安全备份方式，避免写入中直接复制数据库文件。
- 可选方案：SQLite backup API、VACUUM INTO、WAL checkpoint 后复制。
- 至少保留最近 7 天备份。

---

## 11. API 接口设计

### 11.1 统一响应格式

成功：

    { "code": 0, "data": {}, "message": "success" }

失败：

    { "code": 1001, "data": null, "message": "参数校验失败" }

### 11.2 错误码

| 错误码 | 含义 | HTTP 状态码 |
| --- | --- | --- |
| 0 | 成功 | 200 |
| 1001 | 参数校验失败 | 400 |
| 1002 | 记录不存在 | 404 |
| 1003 | LLM 输出非法或无法解析 | 422 |
| 1004 | LLM 调用超时 | 504 |
| 1005 | 数据库操作失败 | 500 |
| 1006 | 鉴权失败 | 401 |
| 1007 | 权限不足 | 403 |
| 1008 | 重复请求或重复单号 | 409 |
| 1009 | 请求过于频繁 | 429 |

### 11.3 核心接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/health | 健康检查，供 Docker healthcheck 使用 |
| POST | /api/express/parse | 解析但不保存，用于确认卡片 |
| POST | /api/express | 创建入库记录 |
| GET | /api/express | 记录列表，支持分页、日期、关键词 |
| GET | /api/express/:id | 单条记录详情 |
| PATCH | /api/express/:id | 更新 custom_json |
| POST | /api/express/:id/reset | 恢复 original_json |
| DELETE | /api/express/:id | 软删除 |
| POST | /api/express/sync | 批量同步，P1 |
| POST | /api/express/chat | 智能对话，P2 |

创建记录处理流程：

    鉴权
      -> 参数校验
      -> client_request_id 幂等检查
      -> 重复单号检查
      -> LLM 解析
      -> JSON Schema 校验
      -> 写入 original_json/custom_json
      -> 返回结果

智能对话约束：

- 查询类问题由后端先生成受控数据结果。
- LLM 只负责组织自然语言回复。
- 修改类问题返回建议，不直接落库。
- 用户确认后再调用 PATCH 接口。

---

## 12. 异常状态与容错设计

### 12.1 空状态与错误状态

| 场景 | 页面提示 | 可操作项 |
| --- | --- | --- |
| 首次打开无记录 | 暂无入库记录，扫码后会显示在这里 | 开始扫码 |
| 摄像头无权限 | 无法使用摄像头，请允许浏览器访问相机 | 重新授权 / 手动输入 |
| 摄像头不可用 | 当前浏览器或设备无法打开摄像头 | 手动输入单号 |
| 扫码超时 | 暂未识别到条码，请调整角度或光线 | 继续扫码 / 手动输入 |
| 麦克风无权限 | 无法使用语音录入，请允许麦克风权限 | 重新授权 / 手动输入内容 |
| 语音未识别 | 没听清内容，请重录或手动输入 | 重录 / 手动输入 |
| AI 解析失败 | 已保留原文，请手动确认物品清单 | 手动编辑 / 重试解析 |
| 网络异常 | 已离线保存，联网后自动同步 | 查看待同步 / 继续录入 |
| 同步失败 | 有记录未同步成功，请检查网络后重试 | 立即重试 |
| 查询无结果 | 没找到相关记录 | 清空筛选 / 修改关键词 |
| 重复单号 | 该单号已有记录 | 查看原记录 / 仍然保存 |

### 12.2 离线队列状态

| 状态 | 含义 |
| --- | --- |
| draft | 本地草稿，尚未提交 |
| pending_parse | 已录入，待解析 |
| pending_sync | 已解析或已确认，待同步 |
| syncing | 正在同步 |
| synced | 已同步 |
| failed | 同步失败 |

离线记录字段：

| 字段 | 说明 |
| --- | --- |
| client_request_id | 幂等 ID |
| tracking_number | 快递单号 |
| raw_text | 原始录入文本 |
| items | 已解析物品清单 |
| created_at | 创建时间 |
| retry_count | 重试次数 |
| status | 同步状态 |
| error_message | 失败原因 |

---

## 13. 安全、权限与部署设计

### 13.1 部署方式参考 au / au_message

VoxPress 部署方式参考现有 au 项目，而不是单独走 PM2 + 手写 Nginx 的散装方案。

au 项目当前模式：

- Dockerfile 构建应用镜像。
- docker-compose.yml：仅应用容器 + 外部数据库。
- docker-compose.mysql.yml：应用 + 内置 MySQL，仅本地/开发联调。
- 应用容器固定端口映射，例如 my-au 为 8083:8083。
- env_file 加载环境变量。
- logs 目录挂载到容器。
- healthcheck 请求 /api/health。
- json-file 日志驱动，配置 max-size 和 max-file。
- 生产入口由 1Panel / OpenResty 做 HTTPS 和反向代理。

VoxPress 对齐后的部署建议：

| 文件 | 用途 |
| --- | --- |
| Dockerfile | 构建 Node/Vue 应用镜像 |
| docker-compose.yml | 生产/准生产：应用容器 + 外部或挂载 SQLite 数据目录 |
| docker-compose.local.yml | 本地联调：一键启动应用，SQLite 使用本地 volume |
| .env.example | 应用环境变量模板 |
| deploy/openresty-site.conf.example | 1Panel/OpenResty 反向代理示例 |
| deploy/backup.md | SQLite 备份说明 |

### 13.2 推荐容器约定

| 项 | 建议 |
| --- | --- |
| 镜像名 | voxpress:latest |
| 容器名 | voxpress |
| 应用端口 | 8086:3000，避免和 my-au 8083 冲突 |
| 数据目录 | ./data:/app/data |
| 日志目录 | ./logs:/app/logs |
| 健康检查 | curl -f http://localhost:3000/api/health |
| 重启策略 | unless-stopped |
| 时区 | TZ=Asia/Shanghai |
| 日志轮转 | json-file，max-size=10m，max-file=3 |

### 13.3 安全要求

MVP 必须补齐基础访问边界：

- 前端必须通过 HTTPS 访问。
- 后端 API 必须鉴权。
- LLM API Key 只存在后端 .env，不能进入前端。
- CORS 只允许正式前端域名。
- 启用请求限流，防止 LLM 接口被刷。
- 限制请求体大小，避免大 payload 攻击。
- 日志脱敏，不输出 Authorization、API Key、完整环境变量。
- SQLite 数据库和备份目录不得被 Web 静态服务访问。

### 13.4 环境变量

    PORT=3000
    APP_AUTH_TOKEN=change-me
    LLM_API_BASE=https://api.deepseek.com/v1
    LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
    LLM_MODEL=deepseek-chat
    DB_PATH=/app/data/express.db
    BACKUP_CRON=0 2 * * *
    BACKUP_DIR=/app/backups
    CORS_ORIGIN=https://voxpress.example.com

---

## 14. 验收标准

### 14.1 产品验收

- 单件快递从扫码到保存，目标耗时不超过 10 秒。
- 快递单号扫码成功率在光线正常、面单清晰条件下不低于 90%。
- 常见口述内容的 AI 结构化结果可直接使用率不低于 80%。
- 用户可以在 3 步内完成错误数量或物品名修正。
- 记录保存后，可通过单号、日期或物品关键词在 3 秒内找到目标记录。
- LLM 或网络异常时，用户已输入的单号和文本不应丢失。

### 14.2 技术验收

- iOS Safari、Android Chrome 可通过正式 HTTPS 域名访问。
- 用户点击后可正常请求摄像头权限并完成扫码。
- 摄像头权限拒绝时，页面提供手动输入单号入口。
- 语音识别不可用时，不影响文本录入主流程。
- LLM 返回结果必须通过 JSON Schema 校验。
- 同一 client_request_id 重复提交不会产生重复记录。
- original_json 首次写入后不可被普通编辑接口修改。
- 用户编辑只影响 custom_json。
- custom_json != original_json 时列表展示“已修改”状态。
- 前端不暴露 LLM API Key。
- LLM 超时阈值不超过 15 秒，失败后给出可重试提示。
- API 启用基础鉴权、CORS 白名单、请求限流和日志脱敏。

### 14.3 部署验收

- docker compose up --build -d 可启动。
- docker ps 显示 voxpress 容器为 healthy。
- curl http://localhost:8086/api/health 返回健康。
- data 目录持久化 SQLite，容器重启不丢数据。
- logs 目录有应用日志。
- 1Panel/OpenResty 反代后，手机 HTTPS 可访问并能请求摄像头权限。
- SQLite 数据库和备份目录不能通过静态路径访问。

---

## 15. AI Agent 协作实施计划

### 15.1 本次文档优化的实际拆分

| Agent | 实际状态 | 负责内容 | 结果 |
| --- | --- | --- | --- |
| OpenClaw 主控 | 已执行 | 总体调度、文档整合、au 部署方式核查 | 合并到本文档 |
| OpenClaw 产品子 Agent | 已完成 | 用户定位、MVP 边界、验收指标 | 已吸收 |
| OpenClaw 技术子 Agent | 已完成 | 技术风险、安全、接口、数据库 | 已吸收 |
| OpenClaw 体验子 Agent | 已完成 | 连续入库、移动端交互、异常状态 | 已吸收 |
| Claude CLI | 已完成 | 文档结构、T0-T5 任务拆分、部署对齐 | 已吸收 |
| Codex CLI | 阻塞 | 工程审查 | 当前 CLI 鉴权 401，不能作为本轮有效输出 |
| Cursor Agent | 阻塞 | 后续编码拆分 | 本轮命令超时，后续可在 Cursor IDE 内执行 |
| Hermes | 阻塞 | 多 Agent 调度复核 | 本轮命令超时，后续可改短任务或交互式执行 |

### 15.2 后续开发阶段分工

| Agent | 写入范围 | 任务 |
| --- | --- | --- |
| OpenClaw 主控 | 全局 | 需求冻结、任务拆分、接口契约、最终验收、Git 提交 |
| Cursor Agent | client/ 和 server/ 主实现 | 复杂工程实现、前后端主干、跨模块联调 |
| Claude CLI | docs/、server/ 局部模块 | 文档、后端服务、脚本、部署说明 |
| Codex CLI | 审查和测试 | 代码审查、测试失败定位；需先修复鉴权 |
| Hermes | 调度和复核 | 长任务复核、备用 GPT 系分析、MCP 代理 |
| OpenCode | 简单脚本 | 低风险辅助脚本、多版本草稿 |

### 15.3 开发阶段任务拆分

#### T0：部署基础设施

推荐 Agent：Claude CLI + OpenClaw 审核

写入范围：

- Dockerfile
- docker-compose.yml
- docker-compose.local.yml
- .env.example
- deploy/openresty-site.conf.example
- deploy/backup.md

验收：

- docker compose up --build -d 可启动。
- /api/health 可用。
- data/logs 挂载生效。
- 端口不与 au 的 8083 冲突。

#### T1：后端骨架

推荐 Agent：Cursor Agent

写入范围：

- server/

任务：

- Express + TypeScript 初始化
- SQLite 初始化
- 鉴权、CORS、限流、错误处理
- /api/health

#### T2：核心解析链路

推荐 Agent：Cursor Agent + Claude CLI

写入范围：

- server/src/services/llmService.ts
- server/src/routes/express.ts
- server/src/schemas/

任务：

- LLM 调用
- JSON Schema 校验
- client_request_id 幂等
- original/custom 双轨写入

#### T3：数据管理 API

推荐 Agent：Cursor Agent

写入范围：

- server/src/routes/express.ts
- server/src/services/expressService.ts
- server/src/db/

任务：

- 列表、详情、编辑、恢复、软删除
- 重复单号提示
- 修改状态标识

#### T4：前端连续入库工作台

推荐 Agent：Cursor Agent

写入范围：

- client/src/views/HomeView.vue
- client/src/components/
- client/src/composables/

任务：

- 扫码
- 文字/语音录入
- AI 解析确认卡
- 最近 3 条结果
- 异常状态展示

#### T5：前端数据管理页面

推荐 Agent：Cursor Agent + Claude CLI 局部辅助

写入范围：

- client/src/views/ListView.vue
- client/src/views/DetailView.vue
- client/src/views/SyncQueueView.vue

任务：

- 列表搜索筛选
- 详情编辑
- 待同步队列 UI

#### T6：测试与审查

推荐 Agent：Codex CLI（修复鉴权后）+ OpenClaw

写入范围：

- tests/
- docs/acceptance.md

任务：

- API 测试
- 关键流程测试
- 安全检查
- 移动端验收清单

### 15.4 并行规则

- 先由 OpenClaw 冻结 API、Schema、环境变量。
- Cursor 负责主工程实现，不和 Claude 同时改同一文件。
- Claude 负责部署、文档、局部后端模块。
- Codex 只做审查和测试，避免和实现 Agent 冲突。
- Hermes 用于调度复核，不直接改核心文件。
- 每个 Agent 完成后必须列出改动文件、测试结果和风险点。

---

## 16. 项目结构

    voxpress/
    ├── client/
    │   ├── index.html
    │   ├── vite.config.ts
    │   ├── package.json
    │   └── src/
    │       ├── main.ts
    │       ├── App.vue
    │       ├── router/
    │       ├── stores/
    │       ├── api/
    │       ├── composables/
    │       ├── components/
    │       ├── views/
    │       └── utils/
    ├── server/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── config/
    │   │   ├── routes/
    │   │   ├── middleware/
    │   │   ├── services/
    │   │   ├── db/
    │   │   ├── prompts/
    │   │   ├── schemas/
    │   │   └── utils/
    │   └── data/
    ├── deploy/
    │   ├── openresty-site.conf.example
    │   └── backup.md
    ├── tests/
    ├── Dockerfile
    ├── docker-compose.yml
    ├── docker-compose.local.yml
    ├── .env.example
    ├── express-digit-helper-solution-design.md
    └── README.md

---

## 17. 实施计划

### 17.1 里程碑

| 阶段 | 内容 | 交付物 | 建议工期 |
| --- | --- | --- | --- |
| M0：技术 Spike | 验证 HTTPS、扫码、语音兼容性 | Spike 结论 | 0.5-1 天 |
| M1：基础骨架 | 前后端项目、SQLite、鉴权、健康检查 | 可启动骨架 | 1 天 |
| M2：核心录入 | 扫码/手输、文本录入、LLM 解析、入库 | 端到端录入闭环 | 2 天 |
| M3：数据管理 | 列表、详情、编辑、恢复、软删除 | CRUD 可用 | 1-2 天 |
| M4：可靠性 | 幂等、重复单号、错误状态、基础离线队列 | MVP 稳定版 | 1-2 天 |
| M5：增强能力 | 语音、TTS、统计、智能查询 | MVP 后 |

### 17.2 推荐第一版交付标准

第一版只要做到以下内容，就可以进入真实场景试用：

- 手机 HTTPS 打开页面。
- 点击扫码能识别快递单号，失败可手输。
- 输入物品描述后，AI 能解析成可编辑清单。
- 用户确认后保存到 SQLite。
- 列表能按日期、单号、物品关键词查询。
- 详情能查看原始文本、首次解析、当前修正结果。
- 网络或 LLM 异常时不丢用户已经输入的信息。
- API 有基础鉴权和限流。
- README 能指导本地启动。
- Docker Compose 部署方式与 au 项目保持一致风格。

### 17.3 后续扩展方向

- 智能对话查询
- AI 建议修改，人工确认落库
- 统计看板
- CSV/Excel 导出
- 多账号、多仓库
- 与电商平台订单数据对接
- 私有化部署包
- 付费订阅或一次性部署服务

---

## 结论

VoxPress 的第一阶段不应该做成一个“AI 能力展示项目”，而应该做成一个真实仓库能用的轻量入库工具。

最重要的是先验证这条闭环：

    扫码识别单号 -> 语音/文字录入物品 -> AI 结构化 -> 人工确认 -> 保存 -> 查询/修正

等这个闭环稳定后，再扩展智能对话、离线同步、统计分析和多用户协作。
