$ErrorActionPreference = "Stop"
Set-Location 
'C:\Users\Mhlengie Prince\Documents\GitHub\The-Smart-Municipal-Service-Reporting-and-Analytics-System\backend'
Set-Item -Path "env:PORT" -Value '8787'
Set-Item -Path "env:ALLOWED_ORIGINS" -Value '*'
Set-Item -Path "env:DATABASE_URL" -Value 'postgresql://postgres:mhl3ngiprince@localhost:5432/mzansi_connect'
Set-Item -Path "env:AUTH_SECRET" -Value 'local-development-secret-please-change-0123456789abcdef'
& "C:\Program Files\nodejs\node.exe" src/server.js
