# MzansiConnect API

The shared system of record for the citizen portal, Android client, staff operations dashboard, and admin dashboard.

## Local setup

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Apply `schema.sql` with `psql "$env:DATABASE_URL" -f schema.sql`.
3. Run `npm install` and `npm start`.

The API is intentionally small and explicit. Put authentication (OIDC/JWT), rate limiting, object storage for photos, and a queue worker in front of production deployment. Never expose PostgreSQL directly to clients.

## Client synchronization

- The Android app keeps an offline-first Room copy, mirrors to Firebase Firestore and Realtime Database, and posts authenticated reports to `POST /api/mobile/reports`.
- Android identifies the shared PostgreSQL citizen through Firebase UID stored as `app_users.external_ref`.
- The Android emulator uses `http://10.0.2.2:8787/`; physical devices need a deployed HTTPS API URL in `app/build.gradle.kts`.
- Existing databases should apply `migrations/002_external_ref.sql` before updating the Android app.
