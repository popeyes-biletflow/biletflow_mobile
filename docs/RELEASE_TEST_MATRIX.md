# Release test matrix (FS-24)

Named run: **RT-1 — mobile release candidate, 2026-11-22**
Web `7a89773c01dc0ac97a2038f72de504b91c149687` · Mobile branch `feature/FS-21-25-mobile-release` (base `ebfabe8`)
Fixtures: [deploy/sql/demo_door_fixtures.sql](../deploy/sql/demo_door_fixtures.sql) + QR sheet from `tools/make-test-qr.mjs`.

Status legend: **PASS** verified · **FAIL** verified failing · **OPEN** not yet executed (needs live Supabase / devices) · **BLOCKED** depends on a backend gap.
A failed or blocked P0 is retested before the demo is called ready.

## 1. Unit / contract (automated, mocked HTTP)

| Suite | Command | Result |
| --- | --- | --- |
| Mobile (QR rules, API client, session, latency, config, i18n) | `npm test` in `biletflow_mobile` | **PASS** — 25/25 |
| Mobile bundle (Metro, Hermes) | `npx expo export --platform android --platform ios` | **PASS** — both bundles built |
| QR sheet signatures vs backend `crypto.verify_hmac_signature` | `make-test-qr.mjs` + backend crypto (read-only) | **PASS** — 7 valid, expired/tampered/campaign rejected as expected |
| Backend (web repo, owned by FS-01…FS-20) | `pytest` in `biletflow_web/backend` | Not part of this run (owned by the web team) |

## 2. Integration (packaged stack)

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| `docker compose build` | api + web images build from the web checkout | built | **PASS** |
| `docker compose up` health | api, web, mailpit healthy | all healthy | **PASS** |
| Mobile routes present in packaged API | `/api/mobile/*`, `/api/tickets/undo-checkin` in OpenAPI | present | **PASS** |
| No secrets in image | no `.env` in `/app` | none | **PASS** |
| UI against mock API (web preview, 390×844) | sign-in, events, scanner, roster, confirm, RU | rendered as designed | **PASS** |
| Live Supabase run with fixtures | rows below | — | **OPEN** |

## 3. SRS success criteria and FS acceptance (live stack + devices)

Fill in *Actual*, latency and evidence (screenshot / shared scan log / video) for each row.

| # | Criterion (SRS §11 / FS) | Steps | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Organizer publishes free event, valid tickets issued | Web: create, publish, register as attendee | Zero-value order, ticket valid | | OPEN |
| 2 | Simulated paid activation + demo orders | Web activation, paid checkout approve/decline | Paid order only after approve; decline issues none | | OPEN |
| 3 | Attendee checkout → QR ticket | Web checkout | Ticket page + email with link | | OPEN |
| 4 | **Print-to-scan** (A4, grayscale) on iOS and Android | Print PDF → scan on both phones | First scan admitted; second "Already used"; PDF + screen = one admission | | OPEN |
| 5 | **Validate + prevent duplicate entry** | Scan valid twice | 1× CHECKED_IN, 1× ALREADY_USED | | OPEN |
| 5a | Simultaneous admission, 2 devices | Scan sheet #3 at the same moment | Exactly one admission | | BLOCKED (gap 3: non-atomic) |
| 6 | Contextual support case | Web support flow | Thread visible to both | | OPEN |
| 7 | Campaign QR gives discount + attribution | Scan campaign QR with phone camera → web | Discount applied, order attributed | | OPEN |
| 8 | **Scanner rejects campaign QR** | Scan sheet #10 in the app | "Promo QR — not a ticket", no request (log shows no latency) | Unit-tested | OPEN (device) |
| 9 | Accurate ticket/attendance/refund records | Compare organizer dashboard with app counter | Counts equal | | OPEN |
| 10 | Analytics without extra checkout fields | Web dashboard | | | OPEN |
| 11 | History + duplicate | Web | | | OPEN |
| 12 | Admin suspends event, sales stop | Web admin | Checkout blocked | | OPEN |
| FS-21a | Staff sees only assigned event A | Staff signs in | A listed, B absent | | OPEN (BLOCKED if account has no assignments: gap 1) |
| FS-21b | Organizer can scan own event | Organizer signs in, scans valid | Admitted | | OPEN |
| FS-21c | Revocation | Organizer removes staff during session | Revoked banner, actions blocked, list refreshed | | OPEN |
| FS-21d | Logout clears cache | Sign out, sign in as other user | No previous events / logs | Unit-tested (session) | OPEN (device) |
| FS-21e | Wrong password / expired token / offline | Each case on iOS + Android | Recoverable message, no stored session on failure | Unit-tested | OPEN (device) |
| FS-22a | Outcomes: valid, wrong-event, invalid, expired, used, refunded, cancelled, campaign | QR sheet #1–#10 | Specific text + colour + speech | | OPEN |
| FS-22b | Network interruption | Airplane mode, scan, reconnect, rescan | "NOT admitted", then normal result | | OPEN |
| FS-22c | **Latency ≤ 2 s** | ≥ 20 online scans per device, share Scan log | p95 ≤ 2000 ms | | OPEN |
| FS-23a | Search + manual check-in | Search name, check in | Badge "Checked in", counter +1 | | OPEN (BLOCKED for event_admin: gap 2) |
| FS-23b | Second client sees count | Second phone pull-to-refresh / wait 5 s | Same count | | OPEN |
| FS-23c | Authorized undo / denied undo | Organizer undo; staff without permission undo | Success / server 403 | | BLOCKED (gap 5: no per-assignment permission) |
| FS-23d | Disconnect → stale, writes disabled | Airplane mode on Attendees tab | Stale banner, buttons disabled | | OPEN |
| FS-25 | Second member starts from clean checkout | Follow deploy/README.md | Health checks pass, Expo connects | | OPEN |
| FS-25b | Backup restores | `backup.sh` + `restore-test.sh` | Row counts printed | | OPEN |

## 4. Device smoke (record per device)

| Device | OS | Expo Go / build | Sign-in | Scan paper | Scan grayscale | Latency p95 | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone … | iOS … | | | | | | OPEN |
| Android … | Android … | | | | | | OPEN |

## Open backend items blocking P0/P1 rows

Gaps 1, 2, 3 and 5 in [MOBILE_INTEGRATION.md](MOBILE_INTEGRATION.md#backend-gaps-found-owners-fs-04-baibol-fs-06-ibragim)
belong to FS-04/FS-06. Re-run rows 5a, FS-21a, FS-23a and FS-23c after they land.

## 5. Full mobile app — web parity (added after RT-1)

Verified in the browser preview against a mock API (390×844, EN/RU): discovery, event details + seating, sign-in,
checkout select → hold review (timer, server totals, demo payment), orders, e-ticket with QR, organizer dashboard,
analytics (chart, by type, promo), manage event (readiness, tabs, staff), support list and thread, account (RU).
Device runs below are still **OPEN**.

| Flow | Expected | Status |
| --- | --- | --- |
| Guest browses events and details, adds `.ics` to Calendar | Share sheet opens with the calendar file | OPEN |
| Sign up → confirmation email (Mailpit) → sign in | Account created, role attendee, no Scan tab | OPEN |
| Free registration and paid demo checkout (approve / decline) | Order page; declined issues no ticket; leaving checkout releases the hold | OPEN |
| E-ticket QR on phone A scanned by phone B | Admitted once, second scan "Already used" | OPEN |
| Ticket PDF from the app | A4 PDF in share sheet; prints and scans | OPEN |
| Cancellation request / support case / reply / notification bell | Case created; reply appears within 15–30 s; bell count | OPEN |
| Organizer: create draft, add tiers, activate paid sales, publish, assign staff | Same results as on the web | OPEN |
| Organizer analytics filters (date, tier) | Figures match the web dashboard | OPEN |
