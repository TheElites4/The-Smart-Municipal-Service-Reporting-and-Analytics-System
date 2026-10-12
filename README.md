# MzansiConnect

Municipal service reporting system with a citizen web portal, Android app, staff
operations dashboard, admin dashboard, Node.js API, and PostgreSQL database.
PostgreSQL is the source of truth for submitted reports. Dashboard analytics are
admin-only and calculated from database rows; citizen views do not include
sample analytics or sample outage reports. Category and municipality selectors,
report lists, report status, and SLA deadlines use API/database responses.

## Components

- `backend/`: Node.js HTTP API, PostgreSQL schema/migrations, database-backed report and user operations, dashboard MFA delivery.
- `Citizen Portal Mobile App/`: Vite/React citizen website; its README covers development and production builds.
- `MzansiConnect/`: Android citizen application. The shared API is authoritative; Room is a replaceable display cache.
- `Staff Dashboard/`: static staff client for municipality-scoped queues and status updates.
- `Admin Dashboard/`: static admin client for workforce management and PostgreSQL analytics.

## Data flow

Citizen report submission goes to `POST /api/reports`. The API validates the
category and municipality, commits the row to PostgreSQL, then broadcasts a
server-sent event. Staff and admin clients reload from `GET /api/dashboard`;
citizen clients reload by stable external reference. Android stores a local
mirror only after the API confirms a report. The API owns the SLA deadline.

Staff/admin login is password plus **Google Firebase email-link verification**.
Only those dashboards use this MFA flow; citizen sign-in and Android push
notifications remain separate. The Firebase Web app config is in
`firebase-config.js`, and the API checks the verified email against the
staff/admin account and its short-lived password challenge before issuing a
dashboard token.

## Verification

```powershell
Set-Location backend
npm.cmd run check
Set-Location ..

Set-Location 'Citizen Portal Mobile App'
npm.cmd run build

Set-Location ..\MzansiConnect
.\gradlew.bat :app:assembleDebug
```

The API package currently has no automated test suite; use `npm.cmd run check`
for its syntax gate.

## Start the local system

For Windows instructions to initialize PostgreSQL, configure Firebase MFA for
staff/admin dashboards, start each app, and build the Android client, see
[DEPLOYMENT.md](DEPLOYMENT.md). The guide uses PowerShell, Node.js, PostgreSQL,
and Docker commands directly; no AI tools are required.

The default local addresses are:

- Citizen portal: `http://localhost:5173`
- Staff dashboard: `http://localhost:8080/Staff%20Dashboard/`
- Admin dashboard: `http://localhost:8080/Admin%20Dashboard/`
- API health: `http://localhost:8787/health`

Firebase Email/Password email-link sign-in must be enabled in the Firebase console, and
each staff/admin account needs a reachable registered phone number. The web
and Android citizen apps do not use the dashboard MFA flow.
