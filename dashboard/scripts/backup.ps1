# Sauvegarde de la base FIG (format custom de pg_dump, compressé, restaurable par restore.ps1).
# Usage : npm run db:backup  (ou : powershell -File scripts/backup.ps1)
# Lit DATABASE_URL dans .env.local ; écrit dans %LOCALAPPDATA%\fig-backups (hors OneDrive, hors dépôt).
$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot "..\.env.local"
if (-not $env:DATABASE_URL -and (Test-Path $envFile)) {
  $line = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if ($line) { $env:DATABASE_URL = $line.Substring("DATABASE_URL=".Length).Trim() }
}
if (-not $env:DATABASE_URL) { throw "DATABASE_URL introuvable (.env.local)." }
$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw "pg_dump.exe introuvable sous C:\Program Files\PostgreSQL." }
$dir = Join-Path $env:LOCALAPPDATA "fig-backups"
New-Item -ItemType Directory -Force $dir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$file = Join-Path $dir "fig-$stamp.dump"
& $pgDump.FullName --format=custom --no-owner --no-privileges --file $file $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump a échoué (code $LASTEXITCODE)." }
$size = [math]::Round((Get-Item $file).Length / 1KB, 1)
Write-Output "Sauvegarde écrite : $file ($size Ko)"
