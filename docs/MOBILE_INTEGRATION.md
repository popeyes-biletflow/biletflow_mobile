# Web/mobile integration review

Scope: mobile-side integration with the available local `biletflow_web` checkout, commit `15a390d737b3152a8e67b1f4b85049561425ea16`. The local main and locally cached origin/main both point to this commit. A fresh GitHub clone could not be completed because network approval was declined; no claim is made about newer remote commits or branches. No web/backend files were modified.

## Verified mismatches and mobile changes

| Previous mobile assumption | Inspected backend source | Mobile change |
| --- | --- | --- |
| `/api/mobile/auth/login`, camelCase token | `backend/main.py`: `/api/auth/login`, `access_token` | Web adapter maps the actual response |
| `/api/mobile/events`, `{ events: [...] }`, assigned events | `backend/main.py`: `/api/events`, raw public array | Authenticate profile first, normalize array, label as platform events |
| `name`, `startsAt`, `venue` only | `frontend/src/services/events.ts`: title/date/venue column aliases | Match supported display aliases without inventing an event date |
| Event-specific validate route with `qrPayload` | `backend/routers/tickets.py`: `/api/tickets/verify`, `qr_payload`, `ticket_id` | Match actual route and fields, reject cross-event QR before mutation |
| Error payload `message`/`error` | FastAPI uses `detail` | Preserve backend error explanations |
| HTTPS only during local development | Web client defaults to `http://localhost:8000` | Permit private-network HTTP only in development; retain HTTPS for release |
| Attendance/search/undo APIs already exist | No corresponding routes in inspected main | Disable unsupported operations in default web mode; retain extended mode for a future backend |

## Remaining backend blockers

1. The inspected `/api/tickets/verify` has no authentication dependency or staff/event authorization. Adding a bearer header and checking the profile in the mobile app does not secure a publicly callable endpoint. Enforce these checks in FastAPI.
2. Verify reads ticket status and then updates it without an atomic conditional transition. Concurrent scanners can both receive success. The backend must perform an atomic `valid → checked_in` transition and reject other ticket statuses, including cancelled/refunded tickets.
3. The verified QR includes an event ID, but the legacy ticket lookup selects only `id, status`. The backend must validate stored event/user/signature membership and reject tickets that do not match the verified payload. The mobile event precheck prevents accidental cross-event calls but cannot establish database consistency.
4. No event-assignment API exists in this checkout. Public events must not be treated as a server-authorized staff assignment list.
5. Attendee search, central attendance totals, manual check-in, and undo need authorized backend endpoints. `/api/tickets` in `promo.py` lists SQLite ticket types and cannot supply attendance.
6. The QR helper defaults to 72-hour expiry, potentially expiring tickets before the event. The client must not bypass server expiry or hold `QR_SECRET`; fix ticket issuance on the backend.
7. Backend HTTP clients use `verify=False`. Enable certificate verification on the server. This cannot be repaired by mobile configuration.

## API URL

No deployed API origin was present in the inspected tracked configuration. During this session the computer's active Wi-Fi IPv4 address was `192.168.0.157`. `.env` is configured as `http://192.168.0.157:8000`, mode `web`, for a phone on the same Wi-Fi after starting FastAPI with `--host 0.0.0.0 --port 8000`. This is a local development address, not proof that a service is already running or reachable. Use a deployed HTTPS FastAPI origin for production. A Supabase project URL cannot serve these custom FastAPI routes.

## Verification

Automated mocked contract tests cover real web routes, snake_case normalization, staff profile checks, cross-event rejection before mutation, FastAPI conflict messages, unavailable-feature behavior, connection checks, local/production URL validation, and the optional extended mobile contract.

To verify against a running platform:

1. Open `<backend-origin>/docs` on the phone and confirm actual route availability.
2. Sign in with an existing staff profile; confirm an attendee profile is rejected by the client.
3. Select an event and scan a real signed QR issued for that event. Confirm the central ticket changes state.
4. Scan the same ticket again; expect the server's 409 explanation. Scan a different-event ticket; confirm no verify request is sent.
5. Disconnect and foreground the app; verify connection-state recovery and that no offline admission is granted.
6. Test on two scanners concurrently after the backend atomicity fix.
7. Enable extended mode only after its routes exist; then verify cross-device manual check-in, authorized/forbidden undo, counters, and a re-scan following reversal.

Full device, live database, and deployed-server tests were not performed during this mobile-side integration.
