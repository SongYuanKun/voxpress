FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:20-bookworm-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY server/ ./
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/express.db
ENV TZ=Asia/Shanghai

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg tesseract-ocr zbar-tools tzdata python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./server/
RUN cd server && npm_config_build_from_source=true npm_config_nodedir=/usr/local npm ci --omit=dev --no-audit --no-fund

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/src/db/schema.sql ./server/dist/db/schema.sql
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /app/data /app/data/uploads /app/logs /app/backups

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
