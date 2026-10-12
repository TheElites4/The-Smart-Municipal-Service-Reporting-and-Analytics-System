# Loads backend/.env and starts the MzansiConnect API bound to all interfaces
# so the Android emulator (10.0.2.2) and physical devices (LAN IP) can reach it.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
  throw 'backend/.env is missing. Copy .env.example to .env and configure it first.'
}

Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    Set-Item -Path "env:$($matches[1])" -Value $matches[2].Trim()
  }
}

Write-Host "Starting API on 0.0.0.0:$env:PORT (db: $($env:DATABASE_URL -replace ':[^:@]+@', ':***@'))"
& (Get-Command node -ErrorAction Stop).Source src/server.js