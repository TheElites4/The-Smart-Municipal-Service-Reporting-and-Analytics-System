# Citizen Portal

The citizen web app is a Vite/React client. It reads and submits reports through
the shared PostgreSQL-backed API; a successful submission is shown only after
the API confirms it.

## Requirements

- Node.js LTS
- The MzansiConnect API running at `http://localhost:8787`
- PostgreSQL configured for the API; see [the repository setup guide](../DEPLOYMENT.md)

## Run on Windows

From PowerShell:

```powershell
Set-Location 'Citizen Portal Mobile App'
npm.cmd install
$env:VITE_API_URL = 'http://localhost:8787'
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

Open `http://localhost:5173`. Configure the API's `ALLOWED_ORIGINS` to include
`http://localhost:5173` when the page is served from another origin.

## Build

```powershell
npm.cmd run build
```

The output is written to `dist/`. Citizen report lists and form choices come
from the API; analytics are reserved for the admin dashboard.

Report attachments are not currently supported. The form does not accept or
display local-only images; add upload controls only when the API has durable
authenticated storage for them.