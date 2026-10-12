# MzansiConnect API

The shared system of record for the citizen portal, Android client, staff operations dashboard, and admin dashboard.

## Local setup

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Apply `schema.sql`, then migrations `002_external_ref.sql`, `003_normalise_municipality.sql`, `004_mfa_challenges.sql`, `005_service_categories.sql`, and `006_municipalities_and_photos.sql`.
3. Copy `.env.example` to `.env`, configure a unique `AUTH_SECRET`, enable Firebase Email/Password email-link sign-in, and ensure each staff/admin account has a reachable email address. Then run `npm.cmd install`, `npm.cmd run check`, and `./start-local.ps1` on Windows.
4. Import the 257 municipality records into the new table: `npm.cmd run import:municipalities`. The importer aborts unless it reads exactly 8 metropolitan, 44 district, and 205 local municipalities; it does not silently publish a partial list.

Run `npm.cmd run test:municipalities` with the local API and database running to
exercise report submission for all 257 municipalities. The integration test
creates and removes its own temporary reports and citizen accounts, and refuses
to run against non-local API or database hosts.
Run `npm.cmd run test:staff-phone` with the local API and database running to
verify admin authorization, E.164 validation, staff-only updates, and cleanup
for the registered-phone management endpoint.

For an empty database, `npm.cmd run setup:database` applies the base schema and
five migrations in order as a single transaction. It refuses to run if
`app_users` already exists; continue using the individual migrations for an
existing database. The [Render setup instructions](../Citizen%20Portal%20Mobile%20App/README.md#publish-on-github-pages)
cover securely initializing a new hosted database and importing municipalities.

Report photos are optional JPEG, PNG, or WebP uploads up to 3 MB. They are stored in PostgreSQL `report_photos` and served only to the submitting citizen or municipality-scoped staff/admin account. No attachment is accepted until migration 006 is applied.

### Windows PostgreSQL setup

PostgreSQL 16 installs `psql` at `C:\Program Files\PostgreSQL\16\bin`. Open a new PowerShell window after installation, then verify:

```powershell
psql --version
```

Create the application database using the password chosen during PostgreSQL installation:

```powershell
psql -U postgres -h localhost -c "CREATE DATABASE mzansi_connect;"
psql -U postgres -h localhost -d mzansi_connect -f schema.sql
psql -U postgres -h localhost -d mzansi_connect -f migrations/002_external_ref.sql
psql -U postgres -h localhost -d mzansi_connect -f migrations/003_normalise_municipality.sql
psql -U postgres -h localhost -d mzansi_connect -f migrations/004_mfa_challenges.sql
psql -U postgres -h localhost -d mzansi_connect -f migrations/005_service_categories.sql
psql -U postgres -h localhost -d mzansi_connect -f seed.sql
```

Each command prompts for the local `postgres` password. If authentication fails, use the password selected in the PostgreSQL installer or reset it through pgAdmin before retrying.

If PostgreSQL rejects the connection, verify `DATABASE_URL`, the database service,
and the password configured during installation. Reset credentials through the
database administrator or the official PostgreSQL/pgAdmin workflow; do not
disable password authentication or change localhost rules to `trust`.

The API is intentionally small and explicit. It issues staff/admin dashboard tokens only after password verification and a Firebase email-link sign-in. The API independently validates the Firebase ID token, requires a verified email matching the active account, and binds the proof to a short-lived password challenge. Citizen clients do not use this dashboard MFA flow. Never expose PostgreSQL directly to clients.

Dashboard authentication is enforced by the API. Set `AUTH_SECRET` in production; the server refuses to start with the development fallback when `NODE_ENV=production`.

### Firebase MFA for staff/admin dashboards

Staff and admin dashboards use **Google Firebase email-link sign-in** for the
second factor. Firebase MFA applies only to staff/admin dashboard login; citizen
registration/login and Android push notifications keep their existing flows.
Set `MFA_PROVIDER=firebase` and `FIREBASE_PROJECT_ID` (for example
`mzansireport-e01b4`) in `backend/.env`, then restart the API. With Firebase enabled:

1. `POST /api/auth/login` verifies the password and returns
   `{ mfaRequired: "firebase-email", mfaToken, firebase: { projectId } }`
   instead of a dashboard token. The signed challenge expires after ten minutes.
2. The dashboard uses Firebase `sendSignInLinkToEmail` and
   `signInWithEmailLink`, then posts the Firebase ID token, account email, and
   password challenge to `POST /api/auth/firebase-email-verify`.
3. The API checks the challenge, verifies the ID token's RS256 signature
   against Google's public certificates and checks `aud`, `iss`, expiry, and
   `email_verified`, then confirms the verified email matches the active account
   before issuing the dashboard token.

Enable **Email/Password** and its **Email link (passwordless sign-in)** option
under *Authentication -> Sign-in method* in the Firebase console. The dashboards
read their web config from the repository-root `firebase-config.js`; `appId`
must be the Web-app id from the console, not the Android
`google-services.json` value. Add hosted dashboard domains to
*Authentication -> Settings -> Authorized domains*; `localhost` is already
authorized for local development. Firebase sends the link to the email address
on the active admin/staff account. The user must open the link and complete
sign-in within ten minutes of entering their password. The email link carries
the signed short-lived challenge so it can be completed in another browser.

Set `ESKOM_SE_PUSH_TOKEN` from https://developer.sepush.co.za/ in `backend/.env` or in the deployed API's environment to enable live load-shedding lookups. The Render Blueprint declares this as a secret environment variable; enter the token when creating/updating the Render service. The API uses a supplied municipality when available, otherwise reverse-geocodes client coordinates and searches EskomSePush for the matching area. Requests without a location return the provider's national status. The endpoint returns a clear service error when the token is missing/invalid or no area matches; it never invents a stage.

## Client synchronization

- The Android app posts reports to `POST /api/reports`; the local Room mirror is refreshed only from confirmed PostgreSQL rows.
- Android identifies the citizen using a stable external reference stored in `app_users.external_ref`.
- The Android emulator uses `http://10.0.2.2:8787/`; physical devices need a deployed HTTPS API URL in `app/build.gradle.kts`.
- Existing databases should apply all four migrations before updating clients.

`GET /api/admin/analytics` is restricted to administrators and aggregates only
database report rows. `GET /api/options` returns categories and guided issue types from PostgreSQL
`service_categories`/`service_issue_types`, and all imported municipalities from
`municipalities`. `GET /api/location/reverse` uses the client's GPS coordinates
with the backend geocoder and returns a human-readable place name plus the
matching municipality; clients do not display coordinates as the location label. A missing live Eskom provider returns `503`; the API does not
substitute a schedule fixture.

Report creation stores `sla_due_at` in PostgreSQL using a 48-hour default.
Citizen countdowns read that persisted deadline; they do not calculate a local
per-category schedule.

## API reference

All endpoints are served on port `8787`. Protected staff/admin routes require a
Protected dashboard routes require a token issued after password and Firebase email-link verification.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API and PostgreSQL health |
| `GET` | `/api/options` | Public | Database-backed categories and municipalities |
| `POST` | `/api/auth/login` | Public | Check password and start Firebase email-link MFA for staff/admin accounts |
| `POST` | `/api/auth/firebase-email-verify` | Public | Verify the Firebase email ID token and password challenge, then issue the dashboard token |
| `GET` | `/api/dashboard` | Staff/admin | Report queue and workforce summary |
| `GET` | `/api/admin/analytics` | Admin | Report aggregates from PostgreSQL |
| `PATCH` | `/api/staff/phone` | Admin | Update a staff account's contact phone number |
| `POST` | `/api/reports` | Public citizen client | Commit a report and broadcast the update |
| `GET` | `/api/reports?externalRef=...` | Public citizen client | Read that citizen's database reports |
| `PATCH` | `/api/reports/:id/status` | Staff/admin | Update report status and audit trail |
| `GET` | `/api/events` | Citizen ID or staff/admin | Server-sent live report updates |
