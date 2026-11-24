# BiletFlow mobile (Expo / React Native)

The BiletFlow app for phones: **everything the web app does, plus the door QR scanner** (SRS 4.8).
It talks to the BiletFlow FastAPI backend (`biletflow_web/backend`); Supabase is used only by the backend.
The UI follows biletflow_web: same palette (white header with the blue BiletFlow wordmark, blue-600 actions,
emerald/red/amber notices, rounded white cards), and the **web's own KK / RU / EN dictionaries**
(`src/locales/*.js`, copied by `node tools/sync-web-locales.mjs`), so every shared screen uses identical wording.

| Web page / feature | Mobile screen |
| --- | --- |
| Events (featured carousel: fade, autoplay, arrows, dots, play/pause, swipe; search, categories, cards with "from" price) | Events tab |
| Event details (dates, registration banners, tiers, hybrid venue map: seating plan with zoom and seat booking, location, tiers & pricing; `.ics`, ask organizer) | Event screen (calendar file opens the share sheet; the location tab opens Google / Yandex Maps instead of an embedded map) |
| Checkout modal (hold timer, promo code, attendee details, demo approve/decline, free registration) | Checkout screen |
| My orders (filters, PDF, help, cancellation request) · Order page · Ticket view with QR | Orders tab · Order · E-ticket (QR on screen, A4 PDF via share sheet) |
| Login, sign-up with email confirmation, forgot password, profile (payout for organizers) | Account tab · Sign in · Sign up · Reset · Profile |
| Support cases, contextual new case, thread with status/assign/escalate, notification bell | Support tab · Case · Bell in the header (30 s polling, like the web) |
| Organizer dashboard (stats, phases, publish/unpublish/cancel), analytics with filters and sales chart | Organizer tab · Analytics |
| Event management: editor, ticket types, paid-sales activation checklist | Manage event (tabs) |
| **Mobile extra:** staff assignment for an event (FS-04 API) | Manage event → Check-in staff |
| **Mobile extra:** QR scanner, attendee lookup, manual check-in/undo, live counts, scan timing | Scan tab (staff, organizers, platform admins) |

Tabs depend on the role from `/api/users/me`: guests see Events + Account; attendees add Orders and Support;
organizers add Organizer and Scan; event staff add Scan. The server still authorizes every request.

### Scanner tickets (FS-21 – FS-25)

| Ticket | What the app does |
| --- | --- |
| FS-21 | Tokens in SecureStore, refresh on 401, expired-session message; Scan tab lists events from `/api/mobile/events`; a revoked assignment (403) blocks actions; sign-out revokes the session and clears all user data on the device. |
| FS-22 | Camera scanner; one request at a time; campaign, malformed and other-event QR rejected **on the device without calling the admission endpoint**; specific result text + colour + speech + vibration; network failure shows "NOT admitted"; every online check timed against the 2 s SRS target (Scan log tab, shareable). |
| FS-23 | Attendee search, manual check-in and undo with confirmation, live counters (5 s, after changes, on foreground); stale data disables writes. |
| FS-24 | `npm test`, fixtures and the release test matrix: [docs/RELEASE_TEST_MATRIX.md](docs/RELEASE_TEST_MATRIX.md). |
| FS-25 | Docker demo, env templates, migrations/seed order, backup/restore, demo script: [deploy/README.md](deploy/README.md). |

## Run

```sh
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL (see below)
npx expo start --clear      # scan the QR with Expo Go, or press i / a for a simulator
npm test                    # unit + contract tests (mocked HTTP)
```

### API origin (`EXPO_PUBLIC_API_URL`)

FastAPI must listen on all interfaces: `uvicorn main:app --host 0.0.0.0 --port 8000` (or the Docker demo).

| Where the app runs | Value |
| --- | --- |
| Physical phone (same Wi-Fi as the computer) | `http://<computer LAN IPv4>:8000`, e.g. `http://192.168.0.157:8000` |
| iOS simulator on the same Mac | `http://127.0.0.1:8000` |
| Android emulator | `http://10.0.2.2:8000` |
| Release build | the deployed `https://` FastAPI origin |

Rules enforced by the app: origin only (no `/api`, query or credentials), never a `*.supabase.co` URL,
plain HTTP only in development builds and only for private/loopback addresses. Restart Expo with `--clear`
after changing `.env`. Never put `SUPABASE_KEY`, a service-role key or `QR_SECRET` in `EXPO_PUBLIC_*`.

`EXPO_PUBLIC_WEB_URL` (optional) enables "Forgot password?", which opens the web reset page.

## Structure

```
App.js                    navigation: role-based bottom tabs + detail stack, header bell and language switcher
src/api.js                API client for every web endpoint + scanner; tokens, refresh      (pure JS, tested)
src/models.js             web rules ported: event normalizer, availability, checkout codes, .ics (pure JS, tested)
src/auth.js, notifications.js   session (any role) and 30 s notification polling
src/files.js              ticket PDF download + .ics -> system share sheet; map links
src/ui.js                 web-style blocks: sections, stats, tabs, select/date pickers, QR renderer
src/locales/*.js          copy of the biletflow_web dictionaries (tools/sync-web-locales.mjs)
src/qr.js                 QR classification + server-error mapping                         (pure JS, tested)
src/stats.js              scan latency summary vs 2 s target                               (pure JS, tested)
src/strings.js            KK/RU/EN copy and web date format                                (pure JS, tested)
src/sessionStore.js       SecureStore (memory only in the web preview)
src/localCache.js         per-user event cache (AsyncStorage), cleared on sign-out
src/components.js         Navbar, LanguageSwitcher, Button, Field, Notice, Card, Badge, PillTabs, ConfirmDialog
src/screens/*             Discover, EventDetails, Checkout, Orders, Order, Ticket, Support*, Account*, Organizer*, Checkin*
tools/make-test-qr.mjs    printable QR sheet with every scanner outcome (needs QR_SECRET)
deploy/                   Docker Compose demo, fixtures, backup/restore
```

## Storage and security

- Tokens: Expo SecureStore only. Language choice: AsyncStorage (kept after sign-out, like the web).
- Event list cache: AsyncStorage, keyed to the user, removed on sign-out or when another account signs in.
- Attendee rosters, QR payloads and scan logs are kept in memory only.
- Offline: cached events can be browsed, but **no offline admission** — every scan needs the server
  (SRS: online verification only). Writes are never queued or retried automatically.
- Client checks (role, campaign/other-event QR) are convenience; the backend remains the authority.

See [docs/MOBILE_INTEGRATION.md](docs/MOBILE_INTEGRATION.md) for the backend contract and open backend gaps.
