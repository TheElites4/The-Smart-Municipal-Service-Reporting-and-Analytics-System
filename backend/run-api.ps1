# Starts the MzansiConnect API as a detached process, loading backend/.env into the
# child process environment. Detached (Start-Process) means the API keeps running
# after the launching shell/terminal closes, unlike a plain foreground `node`.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
  throw 'backend/.env is missing. Copy .env.example to .env and configure it first.'
}

$envVars = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $envVars[$matches[1]] = $matches[2].Trim()
  }
}

# Build a temporary launcher that sets the env vars then execs node, so the
# detached process inherits them regardless of the caller's shell state.
$launcher = Join-Path $PSScriptRoot 'run-api-launcher.ps1'
$lines = @('$ErrorActionPreference = "Stop"', 'Set-Location ' + ("'" + $PSScriptRoot + "'"))
foreach ($key in $envVars.Keys) {
  $value = $envVars[$key].Replace("'", "''")
  $lines += "Set-Item -Path `"env:$key`" -Value '$value'"
}
$lines += 'node src/server.js'
Set-Content -Path $launcher -Value $lines -Encoding UTF8

# -File cannot take a quoted path with spaces, so invoke via -Command with the
# launcher path escaped instead.
$process = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', "& '$launcher'") `
  -WorkingDirectory $PSScriptRoot `
  -RedirectStandardOutput (Join-Path $PSScriptRoot 'run-out.log') `
  -RedirectStandardError (Join-Path $PSScriptRoot 'run-err.log') `
  -WindowStyle Hidden -PassThru

Write-Host "API launcher started (PID $($process.Id)); database target: $($envVars['DATABASE_URL'] -replace ':[^:@]+@', ':***@')"