# Interactive production MFA setup. Values are entered by the deployment owner;
# this script never invents, logs, or prints provider secrets.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

function Read-SecretText($prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$provider = (Read-Host 'Provider (resend or twilio)').ToLowerInvariant()
$values = @{}
if ($provider -eq 'resend') {
  $values.RESEND_API_KEY = Read-SecretText 'Resend API key (hidden)'
  # Resend's onboarding sender is for testing and may only deliver to the
  # email address associated with the Resend account. It is not a production
  # sender for arbitrary staff/admin recipients.
  $values.MFA_EMAIL_FROM = 'MzansiConnect <onboarding@resend.dev>'
  Write-Host 'Using Resend test sender: onboarding@resend.dev'
} elseif ($provider -eq 'twilio') {
  $values.TWILIO_ACCOUNT_SID = Read-SecretText 'Twilio Account SID (hidden)'
  if ($values.TWILIO_ACCOUNT_SID -notmatch '^AC[0-9a-fA-F]{32}$') { throw 'Twilio Account SID must start with AC and contain 32 hexadecimal characters.' }
  $values.TWILIO_AUTH_TOKEN = Read-SecretText 'Twilio Auth Token (hidden, 32 hex characters, no AC prefix)'
  if ([string]::IsNullOrWhiteSpace($values.TWILIO_AUTH_TOKEN)) { throw 'Twilio Auth Token cannot be empty.' }
  if ($values.TWILIO_AUTH_TOKEN -eq $values.TWILIO_ACCOUNT_SID) { throw 'Auth Token must not equal the Account SID. Copy the real token from the Twilio Console.' }
  if ($values.TWILIO_AUTH_TOKEN -match '^AC') { throw 'That looks like an Account SID, not an Auth Token. The Auth Token has no AC prefix.' }
  $values.TWILIO_FROM_NUMBER = Read-Host 'Twilio SMS sender in E.164 format, e.g. +27821234567'
  if ($values.TWILIO_FROM_NUMBER -notmatch '^\+[1-9]\d{7,14}$') { throw 'Twilio sender must use E.164 format, for example +27821234567.' }
} else { throw 'Choose resend or twilio.' }

if ($provider -eq 'twilio') {
  $adminEmail = Read-Host 'Admin email (optional; press Enter to keep the database value)'
  $adminPhone = Read-Host 'Real admin E.164 phone receiving MFA, e.g. +27821234567'
  if ($adminPhone -notmatch '^\+[1-9]\d{7,14}$') { throw 'Admin phone must use E.164 format, for example +27821234567.' }
} else {
  $adminEmail = Read-Host 'Admin email (must be the email allowed by Resend onboarding sender; leave blank to keep database value)'
  $adminPhone = Read-Host 'Real admin E.164 phone (leave blank to keep database value)'
}
$lines = [System.Collections.Generic.List[string]](Get-Content .env)
foreach ($key in $values.Keys) {
  $escaped = $values[$key].Replace('\', '\\').Replace('$', '`$')
  $index = ($lines | Select-String -Pattern "^$key=" | Select-Object -First 1).LineNumber
  if ($index) { $lines[$index - 1] = "$key=$escaped" } else { $lines.Add("$key=$escaped") }
}
Set-Content .env $lines -Encoding UTF8
if ($adminEmail -or $adminPhone) {
  if (-not $env:DATABASE_URL) { $env:DATABASE_URL = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '' }
  if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) { throw 'DATABASE_URL is required to update the admin contact.' }
  $assignments = @()
  if ($adminEmail) { $assignments += "email='" + $adminEmail.Replace("'", "''") + "'" }
  if ($adminPhone) { $assignments += "phone='" + $adminPhone.Replace("'", "''") + "'" }
  & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -c "UPDATE app_users SET $($assignments -join ', ') WHERE role = 'admin';"
}

Write-Host 'MFA values saved to backend/.env without displaying secrets.'
Write-Host 'For onboarding@resend.dev, the admin recipient normally must be the Resend account email.'
Write-Host 'Run: npm.cmd run check:deployment, then restart the backend.'
