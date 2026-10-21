# 2026-10-21 Repair Report

- Production Compose now requires an explicit OpenResty source IP/CIDR and binds its published port to loopback; local Compose remains direct mode.
- All manual and video raw-text paths require 1–1000 characters. Batch actions stop at the first invalid record instead of skipping it.
- Provider quota exhaustion remains HTTP 429/code 1017 and video responses explain that the editable source text and OCR candidates were retained.
- Scanner teardown now occurs when leaving the intake tab and cancels late camera-start completions.
- Date filters and CSV export use the UTC+08:00 business date. The manual backup command now runs the production `dist` script; it creates no cron job.
- Video batches now report saved, failed, cancelled, and previously saved records separately. A retry skips records that already reached the server; a cancelled duplicate confirmation is not counted as saved.

Validation: `node --test` covers raw-text boundaries, OCR fallback, UTC+08 day boundaries, persistent/concurrent quota reservation, quota rejection before a fake outbound call, and a fake batch with one success, one failure, and a retry that skips the prior success. The subsequent authorized dependency-backed validation is recorded below.

## Authorized dependency-backed validation (2026-10-21)

Locked project dependencies were installed in this isolated worktree. Client Vue/TypeScript production build and server TypeScript build passed. Root `npm test` passed strict server test typechecking, all five server test files and both client test files. Production output excludes tests; a separate no-emit configuration checks the test sources.

The builds exposed and fixed synchronous scanner `clear()` handling and SQLite quota adapter types, including bigint change counts. Server builds now clean generated output and refuse emission on errors. Native install permission is pinned to `better-sqlite3@11.10.0`; it compiled successfully against existing local Node 24 headers.

A real native SQLite test used only a newly created temporary database and backup directory. It verified quota exhaustion (429/code 1017), backup integrity (`ok`), record preservation, quota persistence and backup logging. Connections were closed and the temporary directory removed. No live database or AI API was used. Focused independent review approved the changes; `git diff --check` passed.

Remaining validation: production Docker Node 20 runtime, real camera/browser flows and deployed Express/reverse-proxy integration. Local host build/test success does not establish deployment success. Vite's large-chunk warning remains.

## Camera lifecycle follow-up (2026-10-21)

Scanner cleanup now waits for startup and playback settlement, deduplicates disposal, and serializes reopening. The camera DOM stays attached during cancellation. Chrome fake-device verification delayed getUserMedia by five seconds then switched tabs: the acquired track ended, zero video elements remained, and zero console errors occurred. Client typecheck/build passed; physical camera permission UI was not tested.
