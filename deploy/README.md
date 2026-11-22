# BiletFlow demo deployment and handoff (FS-25)

Reproducible local/demo setup: FastAPI + web in Docker Compose, Supabase as the external database/auth,
Expo app on a test phone. Credentials stay in `deploy/env/api.env` (git-ignored) and are injected at
container start; images contain only source code.

## Stack rationale (SRS §9)

| Choice | Why |
| --- | --- |
| FastAPI (Python) | Team familiarity, fast iteration, typed request models, auto-generated `/docs` for API contracts. One backend only. |
| Supabase Postgres + Auth | Relational data with constraints/transactions for inventory and admission, built-in email verification/reset, RLS; no auth server to run. |
| React + Vite + Tailwind (web) | SRS-recommended; static bundle served by nginx in the demo. |
| Expo / React Native (mobile) | One codebase for iOS and Android, SecureStore and camera modules, Expo Go for device demos without store publication. |
| Docker Compose | One command to start API, web and a demo mailbox identically on any team laptop. |

## Prerequisites

- Docker Desktop running; Node 20+ for the mobile app.
- Sibling checkouts: `biletflow/biletflow_web` and `biletflow/biletflow_mobile` (override with `WEB_REPO=/path/to/biletflow_web`).
- A Supabase project (URL, anon key, optional service key, database connection string).

## Run order

1. **Configure** — `cp deploy/env/api.env.example deploy/env/api.env` and fill it in. Use the computer's LAN IP
   for `PUBLIC_API_URL` / `FRONTEND_URL` so phones and email links reach it. Find it with
   `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).
2. **Database** — in the Supabase SQL editor, apply the `biletflow_web/backend/migrations` files in this order
   (each is re-runnable): `pb8_events_columns.sql`, `events_ticket_types.sql`, `001_support_cases.sql`,
   `002_paid_sales_activation.sql`, `003_campaigns_orders.sql`, `004_checkout_rpc.sql`, `005_campaign_stats.sql`,
   `006_promo_lookup.sql`, `007_history_duplicate.sql`, `008_staff_atomic_admission_moderation.sql`,
   `pb19_orders_pricing_and_analytics.sql`, `009_fs17_checkout.sql`, `010_fs20_notifications.sql`.
   The authoritative order/reconciliation belongs to FS-06; update this list if that ticket changes it.
3. **Demo accounts** — sign up three synthetic users on the web app and confirm them via Mailpit
   (http://localhost:8025): organizer, staff, attendee (e.g. `demo.organizer@example.com`, …). Use synthetic
   addresses only.
4. **Fixtures** — optional catalog: `seed_events.sql` (edit the organizer email at its top). Door-check fixtures:
   edit the emails at the top of [sql/demo_door_fixtures.sql](sql/demo_door_fixtures.sql) and run it. It sets the
   roles, creates "BiletFlow Door Demo" (staff assigned) and "Unassigned Event B", and tickets in every status.
   Note the attendee id it prints.
5. **Start** — from `deploy/`:
   ```sh
   PUBLIC_API_URL=http://<LAN IP>:8000 docker compose up --build -d
   docker compose ps          # api, web, mailpit: healthy
   ```
   Health checks: API `GET /` → `{"message":"Welcome to BiletFlow API"}`, web `GET /healthz`, Mailpit `/livez`.
   URLs: web http://localhost:5173 · API docs http://localhost:8000/docs · mailbox http://localhost:8025.
6. **Mobile** — in `biletflow_mobile`: `npm install`, set `EXPO_PUBLIC_API_URL=http://<LAN IP>:8000` (and
   `EXPO_PUBLIC_WEB_URL=http://<LAN IP>:5173`) in `.env`, `npx expo start --clear`, open in Expo Go on a phone on
   the same Wi-Fi. Simulators: iOS `http://127.0.0.1:8000`, Android emulator `http://10.0.2.2:8000`.
7. **Test QR sheet** — `QR_SECRET=<same as api.env> node tools/make-test-qr.mjs --attendee <id> --api http://<LAN IP>:8000`
   writes `deploy/qr-sheet.html`; print it on A4 (once in grayscale).

Stop: `docker compose down`. Rebuild after pulling web changes: `docker compose up --build -d`.

## Backup and restore

```sh
SUPABASE_DB_URL='postgresql://…' deploy/scripts/backup.sh          # -> deploy/backups/biletflow-<timestamp>.dump
deploy/scripts/restore-test.sh deploy/backups/biletflow-<ts>.dump  # restores into a throw-away local Postgres and prints row counts
```

`restore-test.sh` never touches the live project. To roll the demo project itself back, re-run the
migrations and fixtures (steps 2–4); fixtures are idempotent.

## Demo script (≈10 minutes)

1. **Organizer, web** — sign in, open "BiletFlow Door Demo", show tiers and the staff list.
2. **Attendee, web** — register a free ticket on a published event, open My orders, download the A4 PDF.
3. **Staff, phone** — sign in to BiletFlow Check-in; only "BiletFlow Door Demo" is listed (not Event B).
4. Scan the printed PDF → green *Valid — admitted*, counter +1. Scan it again → amber *Already used*.
5. Scan the QR sheet: cancelled, refunded, expired, tampered, other event, campaign QR → specific red results;
   campaign and other-event codes are rejected without contacting the server.
6. Attendees tab → search a name → *Check in* → confirm; second phone shows the new count after refresh.
7. Undo a check-in (organizer account, or staff with permission) → ticket valid again.
8. Airplane mode → scan → *No connection — NOT admitted*; reconnect → scan works.
9. Organizer removes the staff member → staff phone shows the revoked banner.
10. Scan log tab → median / p95 vs the 2 s target → Share (evidence for FS-24).

## Release record

| Item | Value |
| --- | --- |
| Web commit packaged | `7a89773c01dc0ac97a2038f72de504b91c149687` (main) |
| Mobile base commit | `ebfabe8ed17accdae5f03c2eab606e6abd452691`; release branch `feature/FS-21-25-mobile-release` (fill in the merge commit) |
| Images verified | `docker compose build` + `up`: api, web, mailpit healthy; no `.env` inside the API image (2026-11-22, placeholder credentials) |

Known gaps: see [../docs/MOBILE_INTEGRATION.md](../docs/MOBILE_INTEGRATION.md#backend-gaps-found-owners-fs-04-baibol-fs-06-ibragim)
and the open rows of [../docs/RELEASE_TEST_MATRIX.md](../docs/RELEASE_TEST_MATRIX.md).
