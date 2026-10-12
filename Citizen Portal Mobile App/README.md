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

## Publish on GitHub Pages

The repository workflow at `.github/workflows/deploy-citizen-pages.yml` builds
and publishes this app when changes are pushed to `main` or when the workflow
is run manually. In the GitHub repository:

1. Create a Render Blueprint from the repository root using [`render.yaml`](../render.yaml).
   It provisions the Node.js API and PostgreSQL database. Render states that
   free instances are not for production; its free PostgreSQL plan expires
   after 30 days and its data is eventually deleted unless you upgrade it.
   Free web services can sleep when idle.
2. Initialize the new database once from PowerShell, using the database's
   **External Database URL** from Render. This command prompts for the URL
   without echoing it:

   ```powershell
   $databaseCredential = Get-Credential -UserName 'Render database URL' -Message 'Paste the External Database URL as the password'
   $env:DATABASE_URL = $databaseCredential.GetNetworkCredential().Password
   $repoRoot = Get-Location
   try {
     Set-Location backend
     npm.cmd ci
     if ($LASTEXITCODE -ne 0) { throw 'Could not install backend dependencies.' }
     npm.cmd run setup:database
     if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
     npm.cmd run import:municipalities
     if ($LASTEXITCODE -ne 0) { throw 'Municipality import failed.' }
   } finally {
     Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
     Set-Location $repoRoot
   }
   ```

   `setup:database` only runs against an empty database and refuses to
   reinitialize one that already contains `app_users`. Keep the database URL
   private. Check the API's `/health` URL in Render; it should report
   `{"ok":true,"database":"connected"}`. See the repository
   [deployment guide](../DEPLOYMENT.md) for applying future schema migrations.
   This free setup does not run paid Render pre-deploy commands.
3. Under **Settings → Secrets and variables → Actions → Variables**, create the
   repository variable `VITE_API_URL` with the API's public HTTPS origin, for
   example `https://mzansi-connect-api.onrender.com` (no `/api` suffix). Find
   the actual API URL in the Render dashboard.
4. The Render blueprint sets `ALLOWED_ORIGINS` to
   `https://theelites4.github.io`. If your GitHub Pages owner or custom domain
   differs, update that Render environment variable to the exact site origin
   and redeploy the API.
5. Under **Settings → Pages**, set the build and deployment source to **GitHub
   Actions**. Push a change to this app on `main`, or run **Deploy citizen
   portal to GitHub Pages** from the Actions tab.

The workflow builds the app's `index.html` into `dist/` with the repository
subpath and deploys that directory. The published URL is
`https://theelites4.github.io/The-Smart-Municipal-Service-Reporting-and-Analytics-System/`.
The deployment fails rather than publishing a build that would silently send
API requests to `localhost`.
Citizen reporting and public options use this API after database setup. Staff
and admin sign-in additionally require provisioned accounts and a real MFA
provider configured in Render; do not load the example seed accounts into a
production database.

Report attachments are not currently supported. The form does not accept or
display local-only images; add upload controls only when the API has durable
authenticated storage for them.