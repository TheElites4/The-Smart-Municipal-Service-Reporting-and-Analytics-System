$adb = "C:\Users\Mhlengie Prince\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$xmlPath = "c:\Users\Mhlengie Prince\Documents\GitHub\The-Smart-Municipal-Service-Reporting-and-Analytics-System\ui-now.xml"

& $adb shell uiautomator dump /sdcard/ui.xml 2>&1 | Out-Null
& $adb shell cat /sdcard/ui.xml > $xmlPath 2>$null
$xml = Get-Content $xmlPath -Raw

# Find the Submit Report button and its bounds.
$m = [regex]::Match($xml, 'text="Submit Report"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $m.Success) {
  $m = [regex]::Match($xml, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?text="Submit Report"')
}

if ($m.Success) {
  $x1 = [int]$m.Groups[1].Value; $y1 = [int]$m.Groups[2].Value
  $x2 = [int]$m.Groups[3].Value; $y2 = [int]$m.Groups[4].Value
  $cx = [int](($x1 + $x2) / 2)
  $cy = [int](($y1 + $y2) / 2)
  Write-Output "Submit Report at ($cx,$cy)"

  $env:PGPASSWORD = "mhl3ngiprince"
  $before = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U postgres -d mzansi_connect -t -A -c "select count(*) from service_reports;"
  Write-Output "BEFORE: $before"

  & $adb shell input tap $cx $cy
  Start-Sleep -Seconds 10

  $after = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U postgres -d mzansi_connect -t -A -c "select count(*) from service_reports;"
  Write-Output "AFTER:  $after"
} else {
  Write-Output "Submit Report button not found. Current screen text:"
  [regex]::Matches($xml, 'text="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_.Trim() } | Select-Object -Unique
}