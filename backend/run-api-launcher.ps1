$ErrorActionPreference = "Stop"
Set-Location 'C:\Users\Mhlengie Prince\Documents\GitHub\The-Smart-Municipal-Service-Reporting-and-Analytics-System\backend'
Set-Item -Path "env:MFA_PROVIDER" -Value 'firebase'
Set-Item -Path "env:TWILIO_FROM_NUMBER" -Value '+27630740344'
Set-Item -Path "env:ALLOWED_ORIGINS" -Value '*'
Set-Item -Path "env:MFA_EMAIL_FROM" -Value 'MzansiConnect <onboarding@resend.dev>'
Set-Item -Path "env:TWILIO_AUTH_TOKEN" -Value 'cedd33d402c22443b9f61787f190b8b2'
Set-Item -Path "env:TWILIO_ACCOUNT_SID" -Value 'ACc303cad8f96cf6d69e0d8d528dd97e2f'
Set-Item -Path "env:PORT" -Value '8787'
Set-Item -Path "env:AUTH_SECRET" -Value 'local-development-secret-please-change-0123456789abcdef'
Set-Item -Path "env:FIREBASE_PROJECT_ID" -Value 'mzansireport-e01b4'
Set-Item -Path "env:DATABASE_URL" -Value 'postgresql://postgres:mhl3ngiprince@localhost:5432/mzansi_connect'
node src/server.js
