# 2026-10-21 Repair Report

- Production Compose now requires an explicit OpenResty source IP/CIDR and binds its published port to loopback; local Compose remains direct mode.
- All manual and video raw-text paths require 1–1000 characters. Batch actions stop at the first invalid record instead of skipping it.
- Provider quota exhaustion remains HTTP 429/code 1017 and video responses explain that the editable source text and OCR candidates were retained.
- Scanner teardown now occurs when leaving the intake tab and cancels late camera-start completions.
- Date filters and CSV export use the UTC+08:00 business date. The manual backup command now runs the production `dist` script; it creates no cron job.
- Video batches now report saved, failed, cancelled, and previously saved records separately. A retry skips records that already reached the server; a cancelled duplicate confirmation is not counted as saved.

Validation: `node --test` covers raw-text boundaries, OCR fallback, UTC+08 day boundaries, persistent/concurrent quota reservation, quota rejection before a fake outbound call, and a fake batch with one success, one failure, and a retry that skips the prior success. Package dependencies are absent locally, so TypeScript/Vue builds, Express proxy parsing, and the better-sqlite3 backup command were not run.
