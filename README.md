# Biletflow Event Admin

An Expo / React Native app for event staff to sign in, view assigned events, and scan ticket QR codes.

## Getting started

1. Install Node.js (LTS) and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the HTTPS origin of your admin API.
4. Start Expo with `npm start`, then open the app on a device or simulator.

Camera scanning requires a device or simulator with camera support. The app requests camera permission when the scanner is opened. Expo Camera processes QR codes in the native camera viewfinder; no image or QR decoding is sent to a third party.

## Admin API contract

The app expects these endpoints on `EXPO_PUBLIC_API_URL`:

- `POST /api/mobile/events/{eventId}/tickets/validate` accepts `{ "qrPayload": "..." }` and returns `{ "valid": true }` or `{ "valid": false, "message": "..." }`. The API must authorize the staff member for the event and validate/check in the ticket before returning `valid: true`.

- `POST /api/mobile/auth/login` accepts `{ "email": "...", "password": "..." }` and returns `{ "accessToken": "..." }`.
- `GET /api/mobile/events` accepts the access token as a Bearer token and returns `{ "events": [{ "id": "...", "name": "...", "venue": "...", "startsAt": "ISO-8601" }] }`. `venue` and `startsAt` are optional.

The access token is stored with Expo SecureStore. Assigned events and ticket scan outcomes are cached locally with AsyncStorage. A successful or rejected online validation is cached per event and QR payload so a repeated scan can be identified while offline. A new ticket scanned without a network connection is **not** accepted; the scanner reports that it could not be validated. The QR payload and validation message are stored unencrypted on-device until staff sign out, when the app clears its local cache. All API requests require HTTPS.

Scanning gives immediate spoken “Checking ticket” feedback, then speaks the validation result and displays a color-coded result in the viewfinder. The app depends on the backend validation endpoint for ticket authenticity and check-in; local caching is for repeat-scan detection, not offline authorization of previously unseen tickets.
