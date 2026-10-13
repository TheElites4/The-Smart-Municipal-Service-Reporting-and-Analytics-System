# Save Gmail SMTP credentials for staff/admin email OTP without displaying the app password.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

$smtpUser = (Read-Host 'Gmail address used to send dashboard sign-in codes').Trim()
if ($smtpUser -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Enter a valid Gmail or Google Workspace address.' }

$secure = Read-Host 'Google App Password (hidden; do not use your regular password)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
if ([string]::IsNullOrWhiteSpace($appPassword)) { throw 'Google App Password cannot be empty.' }
$appPassword = $appPassword -replace '\s', ''

$lines = [System.Collections.Generic.List[string]](Get-Content .env)
foreach ($entry in @(
  @{ Key = 'SMTP_HOST'; Value = 'smtp.gmail.com' },
  @{ Key = 'SMTP_PORT'; Value = '465' },
  @{ Key = 'SMTP_SECURE'; Value = 'true' },
  @{ Key = 'SMTP_USER'; Value = $smtpUser },
  @{ Key = 'SMTP_APP_PASSWORD'; Value = $appPassword }
)) {
  $index = ($lines | Select-String -Pattern "^$($entry.Key)=" | Select-Object -First 1).LineNumber
  if ($index) { $lines[$index - 1] = "$($entry.Key)=$($entry.Value)" }
  else { $lines.Add("$($entry.Key)=$($entry.Value)") }
}
Set-Content .env $lines -Encoding UTF8

Write-Host 'Gmail SMTP settings saved to backend/.env without displaying the app password.'
Write-Host 'Run npm.cmd run check:deployment, then restart the backend.'
