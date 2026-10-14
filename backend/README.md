# MzansiConnect API

The shared system of record for the citizen portal, Android client, staff operations dashboard, and admin dashboard.

## Local setup

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Apply `schema.sql`, then migrations `002_external_ref.sql`, `003_normalise_municipality.sql`, `004_mfa_challenges.sql`, `005_service_categories.sql`, and `006_municipalities_and_photos.sql`.
3. Copy `.env.example` to `.env`, configure a unique `AUTH_SECRET`, Gmail API OAuth credentials (`GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN`), and ensure each staff/admin account has a reachable email address. Then run `npm.cmd install`, `npm.cmd run check`, and `./start-local.ps1` on Windows.
4. Import the 257 municipality records into the new table: `npm.cmd run import:municipalities`. The importer aborts unless it reads exactly 8 metropolitan, 44 district, and 205 local municipalities; it does not silently publish a partial list.

Run `npm.cmd run test:municipalities` with the local API and database running to
exercise report submission for all 257 municipalities. The integration test
creates and removes its own temporary reports and citizen accounts, and refuses
to run against non-local API or database hosts.
Run `npm.cmd run test:staff-phone` with the local API and database running to
verify admin authorization, E.164 validation, staff-only updates, and cleanup
for the registered-phone management endpoint.
Run `npm.cmd run test:report-photo` with the local API and database running to
verify image upload, PostgreSQL persistence, and authorized dashboard retrieval.
Run `npm.cmd run test:auth-email-mfa` to verify staff and admin email-code login
using a local Gmail API mock and database.

For an empty database, `npm.cmd run setup:database` applies the base schema and
five migrations in order as a single transaction. It refuses to run if
`app_users` already exists; continue using the individual migrations for an
existing database. The [Render setup instructions](../Citizen%20Portal%20Mobile%20App/README.md#publish-on-github-pages)
cover securely initializing a new hosted database and importing municipalities.

Report photos are optional. The web and Android clients resize and JPEG-compress selected images to at most 2.5 MB before upload; the API also accepts JPEG, PNG, or WebP images up to 3 MB. Image bytes are stored in PostgreSQL `report_photos` in the same transaction as the report. The API serves them only to the submitting citizen or an authorized staff/admin account scoped to the report's municipality. Staff/admin queues include photo availability and load the image immediately with the report. Existing databases must have migration 006 applied.

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

The API issues staff/admin dashboard tokens only after password verification and a one-time email code. Codes are HMAC-hashed in PostgreSQL, expire after five minutes, are single-use, and allow at most five attempts. Citizen clients do not use this dashboard MFA flow. Never expose PostgreSQL directly to clients.

Dashboard authentication is enforced by the API. Set `AUTH_SECRET` in production; the server refuses to start with the development fallback when `NODE_ENV=production`.

### Email OTP MFA for staff/admin dashboards

Enable the Gmail API in Google Cloud and configure an OAuth consent screen and
OAuth client. Authorize the sending account for
`https://www.googleapis.com/auth/gmail.send`, then obtain a refresh token using
the official [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
Set `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and
`GMAIL_REFRESH_TOKEN` in `backend/.env`. The `configure-mfa.ps1` helper prompts
for these values and hides the client secret and refresh token. Do not use an
App Password; the API uses HTTPS and does not connect to SMTP.

The sender receives the narrow Gmail permission scope
`https://www.googleapis.com/auth/gmail.send`; no inbox-reading scopes are
requested. If the consent screen is in Testing mode, add the sender as a test
user. Google may expire refresh tokens for external apps left in Testing mode
after seven days.

After validating a staff/admin password, `POST /api/auth/login` sends a
six-digit code to the account email and returns `{ mfaRequired: "email-otp",
mfaToken }`, never a dashboard token. The short-lived challenge is bound to a
database record. `POST /api/auth/email/verify` checks and consumes the code
before issuing the dashboard token. Gmail API failures are surfaced explicitly and
do not permit password-only access. Citizen login is unchanged.

Set `ESKOM_SE_PUSH_TOKEN` from https://developer.sepush.co.za/ in `backend/.env` or in the deployed API's environment to enable live load-shedding lookups. The Render Blueprint declares this as a secret environment variable; enter the token when creating/updating the Render service. The API uses a supplied municipality when available, otherwise reverse-geocodes client coordinates and searches EskomSePush for the matching area. Requests without a location return the provider's national status. The endpoint returns a clear service error when the token is missing/invalid or no area matches; it never invents a stage.

## Client synchronization

- The Android app posts reports to `POST /api/reports`; the local Room mirror is refreshed only from confirmed PostgreSQL rows.
- Android identifies the citizen using a stable external reference stored in `app_users.external_ref`.
- The Android emulator uses `http://10.0.2.2:8787/`; physical devices need a deployed HTTPS API URL in `app/build.gradle.kts`.
- Existing databases should apply all migrations (including `007_totp_mfa.sql`) before updating clients.

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
token issued after password and email OTP verification.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API and PostgreSQL health |
| `GET` | `/api/options` | Public | Database-backed categories and municipalities |
| `POST` | `/api/auth/login` | Public | Check password and email a verification code for staff/admin accounts |
| `POST` | `/api/auth/email/verify` | Public | Verify a one-time email code and issue the dashboard token |
| `GET` | `/api/dashboard` | Staff/admin | Report queue and workforce summary |
| `GET` | `/api/admin/analytics` | Admin | Report aggregates from PostgreSQL |
| `PATCH` | `/api/staff/phone` | Admin | Update a staff account's contact phone number |
| `POST` | `/api/reports` | Public citizen client | Commit a report and broadcast the update |
| `GET` | `/api/reports?externalRef=...` | Public citizen client | Read that citizen's database reports |
| `GET` | `/api/reports/:id/photo` | Citizen owner or authorized staff/admin | Read a stored report photo |
| `PATCH` | `/api/reports/:id/status` | Staff/admin | Update report status and audit trail |
| `GET` | `/api/events` | Citizen ID or staff/admin | Server-sent live report updates |
