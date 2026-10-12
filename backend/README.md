# MzansiConnect API

The shared system of record for the citizen portal, Android client, staff operations dashboard, and admin dashboard.

## Local setup

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Apply `schema.sql`, then migrations `002_external_ref.sql`, `003_normalise_municipality.sql`, `004_mfa_challenges.sql`, `005_service_categories.sql`, and `006_municipalities_and_photos.sql`.
3. Copy `.env.example` to `.env`, configure `AUTH_SECRET` and a real Resend or Twilio MFA provider, then run `npm.cmd install`, `npm.cmd run check`, and `./start-local.ps1` on Windows.
   For temporary Resend testing without a domain, run `./configure-mfa.ps1`, choose `resend`, and use `onboarding@resend.dev`. Resend may restrict that sender to the email address associated with your Resend account; it is not a production sender for arbitrary staff/admin recipients.
4. Import the 257 municipality records into the new table: `npm.cmd run import:municipalities`. The importer aborts unless it reads exactly 8 metropolitan, 44 district, and 205 local municipalities; it does not silently publish a partial list.

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

The API is intentionally small and explicit. It issues staff/admin dashboard tokens only after a password and emailed/SMS one-time code are verified. The web portal and Android app never hold Resend/Twilio credentials: both call the API, and only the API sends MFA messages. Configure Resend or Twilio in the server environment; seeded example inboxes are not real recipients. Never expose PostgreSQL directly to clients.

Dashboard authentication is enforced by the API. Set `AUTH_SECRET` in production; the server refuses to start with the development fallback when `NODE_ENV=production`.

Set `ESKOM_SE_PUSH_TOKEN` from https://developer.sepush.co.za/ to enable live load-shedding lookups. The API reverse-geocodes the client's coordinates, searches EskomSePush for the area, and returns the active event. Without a token or matching area it reports unavailable rather than inventing a stage.

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
Bearer token issued after password and email/SMS MFA verification.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API and PostgreSQL health |
| `GET` | `/api/options` | Public | Database-backed categories and municipalities |
| `POST` | `/api/auth/login` | Public | Check password and send MFA code |
| `POST` | `/api/auth/verify-mfa` | Public | Verify code and issue dashboard token |
| `GET` | `/api/dashboard` | Staff/admin | Report queue and workforce summary |
| `GET` | `/api/admin/analytics` | Admin | Report aggregates from PostgreSQL |
| `POST` | `/api/reports` | Public citizen client | Commit a report and broadcast the update |
| `GET` | `/api/reports?externalRef=...` | Public citizen client | Read that citizen's database reports |
| `PATCH` | `/api/reports/:id/status` | Staff/admin | Update report status and audit trail |
| `GET` | `/api/events` | Citizen ID or staff/admin | Server-sent live report updates |
