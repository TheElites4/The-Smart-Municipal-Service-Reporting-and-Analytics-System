# Save Gmail API OAuth credentials for staff/admin email OTP without displaying secrets.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

$gmailUser = (Read-Host 'Gmail address used to send dashboard sign-in codes').Trim()
if ($gmailUser -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Enter a valid Gmail or Google Workspace address.' }
$clientId = (Read-Host 'Google OAuth client ID').Trim()
if ($clientId -notmatch '^[^\s]+\.apps\.googleusercontent\.com$') { throw 'Enter a valid Google OAuth client ID.' }

function Read-SecretText($prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$clientSecret = Read-SecretText 'Google OAuth client secret (hidden)'
$refreshToken = Read-SecretText 'Google OAuth refresh token (hidden)'
if ([string]::IsNullOrWhiteSpace($clientSecret)) { throw 'Google OAuth client secret cannot be empty.' }
if ([string]::IsNullOrWhiteSpace($refreshToken)) { throw 'Google OAuth refresh token cannot be empty.' }
if ($clientSecret -match '[\r\n]' -or $refreshToken -match '[\r\n]') { throw 'OAuth secrets must be entered as single-line values.' }

$lines = [System.Collections.Generic.List[string]](Get-Content .env | Where-Object { $_ -notmatch '^SMTP_(HOST|PORT|SECURE|USER|APP_PASSWORD|FROM)=' })
foreach ($entry in @(
  @{ Key = 'GMAIL_USER'; Value = $gmailUser },
  @{ Key = 'GMAIL_CLIENT_ID'; Value = $clientId },
  @{ Key = 'GMAIL_CLIENT_SECRET'; Value = $clientSecret },
  @{ Key = 'GMAIL_REFRESH_TOKEN'; Value = $refreshToken }
)) {
  $index = ($lines | Select-String -Pattern "^$($entry.Key)=" | Select-Object -First 1).LineNumber
  if ($index) { $lines[$index - 1] = "$($entry.Key)=$($entry.Value)" }
  else { $lines.Add("$($entry.Key)=$($entry.Value)") }
}
Set-Content .env $lines -Encoding UTF8

Write-Host 'Gmail API OAuth settings saved to backend/.env without displaying secrets.'
Write-Host 'Run npm.cmd run check:deployment, then restart the backend.'
