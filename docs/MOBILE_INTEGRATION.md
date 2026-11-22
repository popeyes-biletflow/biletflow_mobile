# Mobile ↔ backend integration (FS-21 – FS-23)

Reviewed against `biletflow_web` main `7a89773c01dc0ac97a2038f72de504b91c149687` (FS-01…FS-05, FS-16…FS-20 merged).
The mobile app was changed only in this repository; no web/backend file was modified.

## Contract used by the app

| Purpose | Request | Response used |
| --- | --- | --- |
| Sign in | `POST /api/auth/login {email, password}` | `access_token`, `refresh_token`, `user_id`, `email`; 401 wrong credentials; 403 `EMAIL_NOT_CONFIRMED` / suspended |
| Refresh | `POST /api/auth/refresh {refresh_token}` | new token pair; 401 = session over |
| Sign out | `POST /api/auth/logout` (Bearer) | revokes refresh token (fire-and-forget) |
| Profile / role | `GET /api/users/me` | `id`, `email`, `full_name`, `role`, `is_suspended` |
| Assigned events | `GET /api/mobile/events` | `{events: [{id, name, venue, startsAt}]}` |
| Cover images | `GET /api/events` (public) | `image_url`, `category`, `timezone`, `organizer_id` merged by id — never adds events |
| QR check-in | `POST /api/mobile/events/{id}/tickets/validate {qrPayload}` | 200 `{valid, ticketId, message}`; 400/404/409 with `detail` → result code |
| Counters | `GET /api/mobile/events/{id}/attendance` | `{checkedIn, total, canUndoCheckIn}` |
| Roster | `GET /api/mobile/events/{id}/attendees?search=&cursor=&limit=50` | `{attendees: [{ticketId, name, email, checkedIn}], nextCursor}` |
| Manual check-in | `POST /api/mobile/events/{id}/tickets/check-in {ticketId}` | 200; 409 already used |
| Undo | `POST /api/tickets/undo-checkin {eventId, ticketId}` | 200; 403 denied |

Any 401 triggers one token refresh and one retry (safe: FastAPI rejects 401 before the handler runs). A
403 on an event-scoped call is treated as a revoked/missing assignment.

### Result codes shown by the scanner

| Code | Source | Shown as |
| --- | --- | --- |
| `CHECKED_IN` | 200 valid | green "Valid — admitted" |
| `ALREADY_USED` | 409 | amber "Already used" |
| `WRONG_EVENT` | device (payload event ≠ selected) or 400 | red, no request sent when detected on device |
| `CAMPAIGN_QR` | device (HTTPS / `/c/<slug>` / `?promo=`) | red "Promo QR — not a ticket", no request sent |
| `INVALID_FORMAT` | device | red "Not a ticket", no request sent |
| `EXPIRED`, `INVALID_SIGNATURE`, `NOT_FOUND` | 400 / 404 `detail` | red, specific text |
| `CANCELLED_OR_REFUNDED` (`CANCELLED`, `REFUNDED` if the backend separates them) | 400 `detail` | red, specific text |
| `OFFLINE` | network error / timeout | amber "No connection — NOT admitted" |
| `FORBIDDEN` | 403 | red; event access revoked |

## Backend gaps found (owners: FS-04 Baibol, FS-06 Ibragim)

These are outside the mobile repository. The app does not hide them; FS-24 tracks them as open items.

1. **Unassigned staff see every event.** `GET /api/mobile/events` falls back to *all* events when an
   `event_admin` has no `event_staff` rows, and `assert_staff_assigned_to_event` allows such a user on any
   event. FS-21 acceptance ("never see unassigned B") holds only when every staff account has at least
   one assignment. Fix: return an empty list / 403 instead of the fallback.
2. **RLS blocks assigned staff.** The mobile endpoints use the caller's JWT, but RLS on `tickets` only
   allows owners (attendee) and event organizers to read. An assigned `event_admin` can get "Ticket not
   found" / empty rosters / zero counts. Organizers of their own events are not affected. Fix: SECURITY
   DEFINER RPCs that check the assignment, or a server-side service client after the FastAPI check.
3. **Admission is not atomic.** `validate` and `check-in` read the status and then update it without a
   conditional `WHERE status='valid'`; two parallel scans can both succeed. Migration 008 already contains
   `checkin_ticket_atomic` / `undo_checkin_atomic` but the routes do not call them.
4. **Manual check-in ignores cancelled/refunded status** (only rejects `checked_in`).
5. **Undo permission is not per assignment.** `canUndoCheckIn` is always `true` and any staff role can undo;
   FS-23 needs an assignment flag (e.g. `event_staff.can_undo`) checked by the API.
6. **Cancelled vs refunded** share one message (`Ticket is cancelled or refunded.`), so the app shows a
   combined result. Separate details would let it show "Cancelled" / "Refunded" (already supported).
7. **Roster paging.** `attendees` returns `nextCursor: null` and truncates to `limit`; searches beyond the
   first 50 matches are not reachable. The app already sends/handles opaque cursors.
8. **Audit insert failures are swallowed** in the mobile routes (`except: pass`).

## Device checklist

1. Set `EXPO_PUBLIC_API_URL` for the device type (README), start FastAPI on `0.0.0.0:8000`, open `<origin>/docs` on the phone.
2. Sign in as an attendee → refused with the staff-only message, nothing stored.
3. Sign in as staff assigned to A → only A listed (needs gap 1 fixed if the account has no assignments at all).
4. Sign in as the organizer → own events listed with "Your event"; scanning works.
5. Run the QR test sheet (`tools/make-test-qr.mjs`) — expected outcomes are printed on the sheet.
6. Airplane mode during a scan → "No connection — NOT admitted"; reconnect → fresh scan works.
7. Organizer removes the staff assignment → next poll shows the revoked banner, actions disabled.
8. Two phones: check in on one, counter changes on the other within ~5 s.
9. Sign out → sign in as another user → no previous events or scan log visible.
