# VoxPress

VoxPress is a mobile H5 express parcel intake assistant for small ecommerce/workshop warehouse workflows.

Core MVP flow:

1. Enter or scan tracking number.
2. Type or speak parcel contents.
3. Use an LLM to parse contents into `name + quantity + unit`.
4. Confirm and save into SQLite.
5. Search, edit, reset, or soft-delete records.

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

## LLM Config

```env
LLM_PROVIDER=deepseek
LLM_API_BASE=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_MS=15000
LLM_MAX_RETRIES=1
LLM_MAX_INPUT_CHARS=1000
LLM_TEMPERATURE=0
LLM_MAX_OUTPUT_TOKENS=800
```

LLM keys are server-only. The frontend never calls the LLM provider directly.

