# MzansiConnect deployment checklist

## Local API and PostgreSQL

1. Install PostgreSQL or Docker.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.
3. Apply the schema and migration:

```powershell
psql $env:DATABASE_URL -f backend/schema.sql
psql $env:DATABASE_URL -f backend/migrations/002_external_ref.sql
psql $env:DATABASE_URL -f backend/seed.sql
```

4. Start the API from `backend` with `npm install` and `npm start`.
5. Verify `GET http://localhost:8787/health` returns `database: connected`.

## Web clients

Copy `Citizen Portal Mobile App/.env.example` to `.env.local`, set `VITE_API_URL`, then run `npm run build`.

## Android

Copy `MzansiConnect/gradle.properties.example` to `MzansiConnect/gradle.properties` and set `API_BASE_URL` to the same HTTPS API URL used by the web clients. Do not ship the emulator URL in a release build.

## Firebase

Create a Firebase project, enable Email/Password Authentication, Firestore, and Realtime Database, then place the generated `google-services.json` at `MzansiConnect/app/google-services.json`. The Android module currently uses Firebase SDKs but intentionally does not contain project credentials.

## Production requirements

Use HTTPS, a managed secret store, PostgreSQL backups, an OIDC/JWT identity provider, role checks for staff/admin routes, rate limiting, and object storage for report photos. Do not commit `.env`, `google-services.json`, passwords, or API keys.
