# Connects the physical Android device (over USB) to the local MzansiConnect API.
#
# Run this once after plugging the phone in and after the API is up. It:
#   1. ensures a single USB-attached device is present,
#   2. forwards the phone's localhost:8787 to this PC's API (`adb reverse`),
#   3. verifies the phone can actually reach the API.
#
# The debug APK is built with API_BASE_URL=http://127.0.0.1:8787/, so the reverse
# tunnel is what lets the app talk to the backend over USB. Re-run this after
# reconnecting the cable, rebooting the phone, or restarting the adb server.
$ErrorActionPreference = 'Stop'

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "adb not found at $adb" }

$devices = (& $adb devices) | Select-String -Pattern "\sdevice$"
if (-not $devices) { throw 'No USB device detected. Enable USB debugging and authorise this computer.' }
Write-Host "Device(s): $($devices -join ', ')"

# Forward the phone's loopback to this PC so the app's 127.0.0.1:8787 reaches the API.
& $adb reverse tcp:8787 tcp:8787 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'adb reverse failed' }
Write-Host 'USB tunnel ready: phone 127.0.0.1:8787 -> PC API on 8787'

# Confirm the API is listening locally before declaring success.
try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 8
  Write-Host "API health: $($health | ConvertTo-Json -Compress)"
}
catch {
  Write-Warning 'API is not reachable on 127.0.0.1:8787. Start it with backend/run-api.ps1 first.'
}

& $adb reverse --list