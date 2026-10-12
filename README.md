# Biletflow Event Admin

An Expo / React Native app for event staff to sign in, view assigned events, and scan ticket QR codes.

## Getting started

1. Install Node.js (LTS) and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the HTTPS origin of your admin API.
4. Start Expo with `npm start`, then open the app on a device or simulator.

Camera scanning requires a device or simulator with camera support. The app requests camera permission when the scanner is opened.

## Admin API contract

The app expects these endpoints on `EXPO_PUBLIC_API_URL`:

- `POST /api/mobile/auth/login` accepts `{ "email": "...", "password": "..." }` and returns `{ "accessToken": "..." }`.
- `GET /api/mobile/events` accepts the access token as a Bearer token and returns `{ "events": [{ "id": "...", "name": "...", "venue": "...", "startsAt": "ISO-8601" }] }`. `venue` and `startsAt` are optional.

The access token is stored with Expo SecureStore; the password and scanned QR contents are not persisted. All API requests require HTTPS. QR scans are detected on-device; ticket validation or check-in requires a server endpoint and is not performed by this UI.
