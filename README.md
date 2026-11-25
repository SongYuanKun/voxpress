# VoxPress

VoxPress is a mobile H5 express parcel intake assistant for small ecommerce/workshop warehouse workflows.

Core MVP flow:

1. Enter or scan tracking number.
2. Type or speak parcel contents.
3. Use an LLM to parse contents into `name + quantity + unit` (quantity supports decimals, e.g. `12.5`).
4. Optionally attach a weighing photo and a packing photo, plus a platform order number / buyer note.
5. Confirm and save into SQLite.
6. Search (including platform order notes), edit, reset, or soft-delete records; export CSV with photo path refs.

Video flow:

1. Upload a gallery video or record a new video in the browser.
2. Server extracts frames with FFmpeg.
3. Server recognizes tracking numbers locally with zbar + Tesseract OCR.
4. Server extracts audio and calls the configured ASR provider.
5. DeepSeek parses the transcript into `name + quantity + unit`.
6. User confirms the result, saves it, or downloads the current result as CSV.

## Quick Start

```bash
cp .env.example .env
# edit LLM_API_KEY and APP_AUTH_TOKEN
npm run install:all
npm run dev:server
npm run dev:client
```

Server: <http://localhost:3000/api/health>  
Client: <http://localhost:5173>

## Docker

```bash
cp .env.example .env
docker compose up --build -d
curl http://localhost:8086/api/health
```

Deployment follows the existing `au / au_message` style:

- Dockerfile builds the app image
- docker-compose starts the app container
- `./data`, `./logs`, and `./backups` are mounted
- `/api/health` is used for healthcheck
- 1Panel/OpenResty should terminate HTTPS and reverse proxy to `127.0.0.1:8086`

The production Compose port binds only to loopback and always enables reverse-proxy
mode. Set `TRUST_PROXY` to the OpenResty source IP or CIDR before it can start.
`docker-compose.local.yml` keeps direct mode disabled. This makes rate limiting use
the actual client IP rather than one shared proxy address.

## LLM Config

```env
LLM_PROVIDER=deepseek
LLM_API_BASE=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
LLM_MODEL=deepseek-v4-flash
LLM_TIMEOUT_MS=15000
LLM_MAX_INPUT_CHARS=1000
LLM_TEMPERATURE=0
LLM_MAX_OUTPUT_TOKENS=800
LLM_DAILY_LIMIT=1000
```

LLM keys are server-only. The frontend never calls the LLM provider directly.

For the current deployment, `deepseek-v4-flash` is the recommended default for text structuring. `deepseek-v4-pro` is not needed unless later prompts become complex enough to justify the higher cost.

## Video / ASR Config

```env
UPLOAD_DIR=/app/data/uploads
VIDEO_MAX_UPLOAD_MB=80
VIDEO_FRAME_COUNT=4
VIDEO_FRAME_WIDTH=1280

ASR_PROVIDER=openai-compatible
ASR_API_BASE=https://api.openai.com/v1
ASR_API_KEY=sk-xxxxxxxxxxxxxxxx
ASR_MODEL=whisper-1
ASR_TIMEOUT_MS=60000
ASR_MAX_RETRIES=1
```

DeepSeek v4-flash/pro currently works for text structuring in this app, but the tested API rejects image input and does not provide a compatible audio transcription endpoint. VoxPress therefore keeps tracking-number recognition local and keeps ASR as a separate OpenAI-compatible provider.

## Backup

Backups are manual only; no application cron is created. Build the server first,
then run `npm --prefix server run backup`. The production image includes the same
compiled `dist/scripts/backup.js` command, and its `/app/backups` directory is the
mounted `./backups` path. The command uses SQLite's backup API, records the result
in `backup_logs`, and retains seven days by default.

Dates in list filtering and CSV export use the warehouse business day, UTC+08:00.

## Database migration (deploy)

On startup the server runs additive SQLite migrations automatically:

1. Adds `platform`, `platform_order_note`, `weighing_photo`, and `packing_photo` columns to `express_records` when missing.
2. Rebuilds `express_record_items` so `quantity` uses `REAL` affinity (existing integer rows are preserved via `CAST`).
3. Creates `idx_platform_order_note` when missing.

Deploy steps:

1. Back up the live DB first (`npm --prefix server run backup` or copy `./data/express.db*`).
2. Redeploy / restart the container (`docker compose up --build -d`).
3. Confirm `/api/health` is healthy; migrations run during process boot before traffic.
4. Photos are stored under `UPLOAD_DIR/photos/<recordId>/` (mounted `./data/uploads` in Compose). No manual SQL is required for a normal upgrade.

CSV export now includes columns: 平台, 平台订单号或买家备注, 称重照, 装箱照 (photo cells are relative paths such as `photos/12/weighing.jpg`).
