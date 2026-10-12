# MzansiConnect setup and operations

The citizen website, Android app, staff dashboard, and admin dashboard use the
same PostgreSQL-backed API. Reports appear in the staff/admin queues only after
the API commits them to PostgreSQL. Android keeps a local mirror for rendering,
but it refreshes from the API and does not treat an unconfirmed local submission
as successful. Citizen analytics and sample service-status rows have been
removed; database analytics are visible to administrators only.

## Run locally on Windows (without AI tools)

Prerequisites: Node.js LTS, Docker Desktop (or PostgreSQL 16 plus `psql`), and
for Android, Android Studio/SDK and a configured device or emulator.

1. From the repository root, start PostgreSQL. On a new database Docker loads
   `backend/schema.sql` automatically:

```powershell
docker compose up -d postgres
$env:DATABASE_URL = 'postgresql://mzansi:change-me-local-only@localhost:5432/mzansi_connect'
psql $env:DATABASE_URL -f backend/migrations/002_external_ref.sql
psql $env:DATABASE_URL -f backend/migrations/003_normalise_municipality.sql
psql $env:DATABASE_URL -f backend/migrations/004_mfa_challenges.sql
psql $env:DATABASE_URL -f backend/migrations/005_service_categories.sql
psql $env:DATABASE_URL -f backend/migrations/006_municipalities_and_photos.sql
Set-Location backend
npm.cmd run import:municipalities
Set-Location ..
psql $env:DATABASE_URL -f backend/seed.sql
```

   Apply `schema.sql` first if using a separately installed empty PostgreSQL
   database. Do not rerun `seed.sql` after changing the initial passwords; it
   resets the seeded account passwords.

2. Copy `backend/.env.example` to `backend/.env`. Configure a long random
   `AUTH_SECRET`, the same `DATABASE_URL`, a real MFA provider as described
   below, and local browser origins:

```text
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
```

   In a PowerShell terminal:

```powershell
Set-Location backend
npm.cmd install
.\start-local.ps1
```

   The API listens at `http://localhost:8787`. Check
   `http://localhost:8787/health` for `database: connected`.

3. Open a second terminal from the repository root and serve both dashboards:

```powershell
$env:STATIC_PORT = '8080'
node serve-static.mjs
```

   Staff: `http://localhost:8080/Staff%20Dashboard/`

   Admin: `http://localhost:8080/Admin%20Dashboard/`

4. In another terminal, run the citizen web app:

```powershell
Set-Location 'Citizen Portal Mobile App'
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

   Open `http://localhost:5173`.

5. To build/install Android in an emulator, use the emulator API address:

```powershell
Set-Location MzansiConnect
.\gradlew.bat assembleDebug -PAPI_BASE_URL=http://10.0.2.2:8787/
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The Android Room database is only a replaceable cache. This version resets an
older cache on first launch after upgrade; the report list is then repopulated
from PostgreSQL through the API. Reports not confirmed by the API are not saved
as offline submissions.

   For a physical device over USB, build with
   `-PAPI_BASE_URL=http://127.0.0.1:8787/`, then run
   `backend/connect-device.ps1` while the API is running and USB debugging is
   enabled. See the detailed device notes below. For the mobile browser on a
   different device, configure the API host and allowed origin for the LAN.

## Real staff/admin MFA
Dashboard login requires a one-time code sent to an actual email address or
phone number. Email uses Resend; SMS uses Twilio. The repository cannot create
provider accounts, secrets, verified sender domains, or real staff contacts.
Run the interactive setup after obtaining those values from the provider and
staff/admin users:

```powershell
Set-Location backend
.\configure-mfa.ps1
# Select resend; the script sets MFA_EMAIL_FROM to onboarding@resend.dev
npm.cmd run check:deployment
```

The script writes provider values to `backend/.env` without printing them and
can update the admin email/phone in PostgreSQL. When using Resend's
`onboarding@resend.dev` testing sender, use the email address associated with
your Resend account as the admin recipient if Resend rejects other recipients.
This sender is for testing, not unrestricted production delivery. The script
does not accept placeholders.
Restart the backend after changing `.env`. Set `RESEND_API_KEY` and a
verified `MFA_EMAIL_FROM` sender for email, or set `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` for SMS. Keep secrets in the local
environment or a deployment secret manager, never in source control.

Update each staff/admin account with an inbox/phone that the user can access.
Phone numbers must be in international E.164 format, for example `+27821234567`.
The seeded `example.gov.za` addresses are placeholders and cannot receive mail;
replace the initial admin address in PostgreSQL before the first dashboard login. For example:

```powershell
psql $env:DATABASE_URL -c "UPDATE app_users SET email='admin@your-real-domain.za', phone='+27821234567' WHERE email='admin@example.gov.za';"
```

Use the new email as the admin login. Then use the admin dashboard to create
staff accounts with their real delivery details. The server returns an error and does not
issue a dashboard token if delivery is not configured or the provider rejects
the message. Codes expire after 10 minutes, allow at most five attempts, and
are stored hashed in PostgreSQL. Apply migration `004_mfa_challenges.sql` before
starting the updated API. Existing databases must also apply
`005_service_categories.sql` and `006_municipalities_and_photos.sql`, then run
`npm.cmd run import:municipalities`, before using the report forms. The importer
aborts instead of importing an incomplete municipality directory.

## Database-backed analytics and dropdown options

`GET /api/admin/analytics` requires an admin token and aggregates category,
status, monthly, and municipality counts from `service_reports`. Report forms
load their municipality choices from `GET /api/options`; municipalities come
from the PostgreSQL `municipalities` table populated by the explicit importer.
Categories and guided issue choices are stored in PostgreSQL. GPS lookup calls
the backend reverse-geocoder and stores a human-readable place name plus
municipality. Optional report photos are stored in PostgreSQL after migration
006; no local-only attachment is reported as submitted.

## Local API and PostgreSQL

1. Install PostgreSQL or Docker.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.
3. Apply the schema and migrations (for a new non-Docker database):

```powershell
psql $env:DATABASE_URL -f backend/schema.sql
psql $env:DATABASE_URL -f backend/migrations/002_external_ref.sql
psql $env:DATABASE_URL -f backend/migrations/003_normalise_municipality.sql
psql $env:DATABASE_URL -f backend/migrations/004_mfa_challenges.sql
psql $env:DATABASE_URL -f backend/migrations/005_service_categories.sql
psql $env:DATABASE_URL -f backend/migrations/006_municipalities_and_photos.sql
Set-Location backend
npm.cmd run import:municipalities
Set-Location ..
psql $env:DATABASE_URL -f backend/seed.sql
```

4. Set `AUTH_SECRET` to a long random value, then start the API from `backend` with `npm install` and `npm start`.
5. Verify `GET http://localhost:8787/health` returns `database: connected`.

The seeded dashboard accounts are:

- Staff: `staff@example.gov.za` / `ChangeMeStaff!2026`
- Admin: `admin@example.gov.za` / `ChangeMeAdmin!2026`

Change both passwords immediately in the database or through your account-management process before production. Set a long random `AUTH_SECRET`; changing it invalidates existing dashboard sessions.

The admin dashboard includes an **Add staff member** form. It calls `POST /api/staff`; the API requires an admin token, hashes the password with PostgreSQL `crypt()`, and saves the staff member's municipality, department, and optional SMS number. New staff can then sign in using email/password plus a delivered MFA code.

The staff and admin dashboards require these credentials and MFA. Staff can update report status; admins can view workforce data and database-backed analytics. The API rejects protected dashboard, analytics, and realtime requests without a valid role token.

## Web clients

Copy `Citizen Portal Mobile App/.env.example` to `.env.local`, set `VITE_API_URL`, then run `npm run build`.

## Android

Copy `MzansiConnect/gradle.properties.example` to `MzansiConnect/gradle.properties` and set `API_BASE_URL` to the same HTTPS API URL used by the web clients. Do not ship the emulator URL in a release build.

### Testing on a physical device over USB

`10.0.2.2` only exists inside the Android emulator. A real phone reaches the
backend either over the LAN or through a USB tunnel. The USB route needs no
firewall changes and no shared Wi-Fi:

1. Start the API so it listens on all interfaces: `backend/run-api.ps1`.
2. Build the debug APK with the loopback URL the tunnel exposes:

```powershell
cd MzansiConnect
.\gradlew assembleDebug -PAPI_BASE_URL=http://127.0.0.1:8787/
```

3. Plug the phone in, enable USB debugging, then run `backend/connect-device.ps1`.
   It runs `adb reverse tcp:8787 tcp:8787`, which maps the phone's
   `127.0.0.1:8787` to this PC's API, and confirms the health endpoint.
4. Install and launch: `adb install -r MzansiConnect/app/build/outputs/apk/debug/app-debug.apk`.

Re-run step 3 whenever the cable is reconnected, the phone reboots, or the adb
server restarts - the reverse tunnel does not survive those. If the phone and
PC share a network, `-PAPI_BASE_URL=http://<PC-LAN-IP>:8787/` works instead and
needs no tunnel; the host must be listed in `network_security_config.xml` because
Android 9+ blocks cleartext HTTP by default.

A report submitted from the phone is accepted by `POST /api/reports` and shows
up on the Staff and Admin dashboards immediately. Verify from the terminal with
`GET /api/dashboard` using a staff or admin bearer token.

## Firebase

Firebase is optional and is not required for report submission or PostgreSQL synchronization. It can be configured separately for push notifications; report records are not mirrored to Firebase.

## Production requirements

Use HTTPS, a managed secret store, PostgreSQL backups, rate limiting, and an established identity provider for production. Report photo uploads are not currently supported; add them only with authenticated upload handling and object storage. Do not commit `.env`, `google-services.json`, passwords, or API keys.
