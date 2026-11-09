# BiletFlow Event Admin Mobile

Expo / React Native client for the BiletFlow FastAPI backend. Supabase is used by the backend; the mobile app calls FastAPI, not the Supabase project URL.

## Local setup

1. Install mobile dependencies with `npm install`.
2. In the web repository, configure the backend's server-only environment and install its Python requirements. Start it from `biletflow_web/backend`:

   ```sh
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. Configure this repository's `.env`:

   ```env
   EXPO_PUBLIC_API_URL=http://192.168.0.157:8000
   EXPO_PUBLIC_API_MODE=web
   ```

   This LAN address was detected on the development computer during integration. A physical phone must use the same Wi-Fi network. Update the address if the computer's IP changes. This URL works only while that backend is running and reachable; it is not a deployed public endpoint. For the iOS simulator on the same Mac use `http://127.0.0.1:8000`; for the standard Android emulator use `http://10.0.2.2:8000`.

4. Run `npx expo start --clear` after changing environment variables.

HTTP is accepted only by development builds for loopback/private network addresses. Production requires the deployed FastAPI HTTPS origin, without an `/api` suffix. A hosted frontend URL works only if that hosting explicitly proxies `/api` to FastAPI. Never put `SUPABASE_KEY`, a service-role key, or `QR_SECRET` in `EXPO_PUBLIC_*` variables.

No deployed API URL was found in the inspected web source. Check `<backend-origin>/docs` to verify the routes on the actual running deployment.

## Default web integration

`EXPO_PUBLIC_API_MODE=web` matches the locally inspected `biletflow_web` main commit `15a390d737b3152a8e67b1f4b85049561425ea16`. GitHub access was declined, so this does not assert compatibility with a newer remote main.

| Operation | Existing web contract |
| --- | --- |
| Sign in | `POST /api/auth/login`, `{ email, password }` → `{ access_token, refresh_token, user_id, email }` |
| Staff profile / session | `GET /api/users/me` with Bearer token |
| Event selection | `GET /api/events` → array of event rows |
| Connection heartbeat | Authenticated profile check followed by `GET /api/events/{eventId}` |
| QR check-in | `POST /api/tickets/verify`, `{ qr_payload }` → `{ valid, message, ticket_id }` |

The client maps `title`/`name`, `starts_at`/`start_time`/`date`/`event_date`, and `venue_name`/`venue`/`location` to the mobile display fields. The web events route returns a public event list, not staff assignments; the UI identifies it accordingly. The client requires a profile role of `event_admin`, `organizer`, or `admin` (case-insensitive, spaces/hyphens normalized) before displaying events or submitting QR verification. Align this allowlist with the deployed role vocabulary if it differs. This is a client access check, not a replacement for backend authorization.

QR payloads use `ticket_id:event_id:user_id:expires_at:signature`. A malformed payload or a payload for a different selected event is rejected before sending the mutating request. HMAC verification stays on the server. FastAPI `detail` errors are displayed; 400/404/409 verification responses become invalid-ticket results. Bearer tokens are sent on requests even though the inspected verify route does not enforce them.

The connection indicator checks the session and selected event every five seconds after the previous check completes, on foregrounding, and after scans. It reports connection health only. The current web backend has no attendee search, manual check-in, undo, or attendance counter endpoints; these operations are unavailable in web mode rather than producing fabricated totals or repeated 404s. `/api/tickets` is deliberately not used: it returns SQLite ticket types, not event attendees.

## Extended mobile contract

The previously added attendee search, manual check-in, undo, and live attendance UI is retained behind `EXPO_PUBLIC_API_MODE=mobile`. Enable this mode only when the central backend implements **all** of these routes:

- `POST /api/mobile/auth/login` accepts `{ "email": "...", "password": "..." }` and returns `{ "accessToken": "..." }`.
- `GET /api/mobile/events` returns `{ "events": [{ "id": "e1", "name": "Concert", "venue": "Hall", "startsAt": "ISO-8601" }] }`, scoped to the staff member's assignments.
- `POST /api/mobile/events/{eventId}/tickets/validate` accepts `{ "qrPayload": "..." }` and returns `{ "valid": true, "message": "...", "ticketId": "t1" }`. `ticketId` enables direct scan undo.
- `GET /api/mobile/events/{eventId}/attendance` returns `{ "checkedIn": 145, "total": 200, "canUndoCheckIn": true }`. Counts must be nonnegative integers with `checkedIn <= total`.
- `GET /api/mobile/events/{eventId}/attendees?search=...&cursor=...&limit=50` searches all attendees by name, email, or ticket ID. Returns `{ "attendees": [{ "ticketId": "t1", "name": "Alex", "email": "alex@example.com", "checkedIn": false }], "nextCursor": null }`. Use stable ordering and opaque cursors.
- `POST /api/mobile/events/{eventId}/tickets/check-in` accepts `{ "ticketId": "t1" }` and succeeds only after check-in commits.
- `POST /api/tickets/undo-checkin` accepts `{ "eventId": "e1", "ticketId": "t1" }` and succeeds only after reversal commits.

All routes must authorize the authenticated staff member for the event. Mutations must check ticket/event membership, ticket status, and permissions, commit atomically, and record audit information. Undo requires a fresh server-side permission check; the UI boolean only controls button visibility. Return 401 for expired sessions and 403 for forbidden actions.

In mobile mode search is debounced by 300 ms, check-in and undo require confirmation, and the current page and attendance counters refresh every five seconds after the previous refresh finishes. Failed syncs retain old data with an outdated indicator and disable manual actions. This is polling, not a push subscription.

## Storage and validation

Access tokens use Expo SecureStore. Event lists and scan history use AsyncStorage and are cleared on sign-out. QR payloads/messages are unencrypted on-device; attendee results stay in memory only. Every scan consults the backend so stale cached results cannot block a reversed ticket. Offline scans never authorize admission. Requests time out after 15 seconds; writes are not automatically retried or queued. Following an interrupted write, staff must verify the central ticket status before retrying. Refresh-token rotation is not implemented; sign in again after session expiry.

Run `npm test` for web-adapter and extended-contract tests. These use mocked responses; they do not establish that a backend is deployed. Device testing requires Expo dependencies and the running backend.

See [the integration review](docs/MOBILE_INTEGRATION.md) for remaining backend requirements and a device test checklist.
