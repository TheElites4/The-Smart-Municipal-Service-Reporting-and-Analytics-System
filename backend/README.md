# MzansiConnect API

The shared system of record for the citizen portal, Android client, staff operations dashboard, and admin dashboard.

## Local setup

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Apply `schema.sql` with `psql "$env:DATABASE_URL" -f schema.sql`.
3. Run `npm install` and `npm start`.

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
psql -U postgres -h localhost -d mzansi_connect -f seed.sql
```

Each command prompts for the local `postgres` password. If authentication fails, use the password selected in the PostgreSQL installer or reset it through pgAdmin before retrying.

### If the PostgreSQL password is unknown

Open **PowerShell as Administrator**. Stop the service:

```powershell
Stop-Service postgresql-x64-16
Copy-Item 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf' 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf.backup'
```

Open this file as Administrator:

```text
C:\Program Files\PostgreSQL\16\data\pg_hba.conf
```

Temporarily change the two localhost lines from `scram-sha-256` to `trust`:

```text
host    all    all    127.0.0.1/32    trust
host    all    all    ::1/128         trust
```

Start PostgreSQL and reset the password. Type the new password directly when prompted:

```powershell
Start-Service postgresql-x64-16
psql -U postgres -h localhost
```

Inside `psql`, run:

```sql
\password postgres
\q
```

Restore password authentication immediately:

```powershell
Stop-Service postgresql-x64-16
Copy-Item 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf.backup' 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf' -Force
Start-Service postgresql-x64-16
```

Then retry the database setup commands using the new password. Never leave the localhost entries set to `trust`.

The API is intentionally small and explicit. Put authentication (OIDC/JWT), rate limiting, object storage for photos, and a queue worker in front of production deployment. Never expose PostgreSQL directly to clients.

Dashboard authentication is enforced by the API. Set `AUTH_SECRET` in production; the server refuses to start with the development fallback when `NODE_ENV=production`.

Set `ESKOM_SE_PUSH_TOKEN` from https://developer.sepush.co.za/ to enable live load-shedding lookups. The API reverse-geocodes the client's coordinates, searches EskomSePush for the area, and returns the active event. Without a token or matching area it reports unavailable rather than inventing a stage.

## Client synchronization

- The Android app keeps an offline-first Room copy, mirrors to Firebase Firestore and Realtime Database, and posts authenticated reports to `POST /api/mobile/reports`.
- Android identifies the shared PostgreSQL citizen through Firebase UID stored as `app_users.external_ref`.
- The Android emulator uses `http://10.0.2.2:8787/`; physical devices need a deployed HTTPS API URL in `app/build.gradle.kts`.
- Existing databases should apply `migrations/002_external_ref.sql` before updating the Android app.
