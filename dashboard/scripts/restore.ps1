# Restauration d'une sauvegarde faite par backup.ps1 dans la base de DATABASE_URL.
# Usage : npm run db:restore -- C:\Users\<vous>\AppData\Local\fig-backups\fig-20260914-1200.dump
# ATTENTION : remplace le contenu des tables (--clean) ; base locale uniquement sans SEED_ALLOW_REMOTE=1.
param([Parameter(Mandatory = $true)][string]$Dump)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $Dump)) { throw "Fichier introuvable : $Dump" }
$envFile = Join-Path $PSScriptRoot "..\.env.local"
if (-not $env:DATABASE_URL -and (Test-Path $envFile)) {
  $line = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if ($line) { $env:DATABASE_URL = $line.Substring("DATABASE_URL=".Length).Trim() }
}
if (-not $env:DATABASE_URL) { throw "DATABASE_URL introuvable (.env.local)." }
$host_ = ([uri]$env:DATABASE_URL).Host
if ($host_ -notin @("localhost", "127.0.0.1", "::1") -and $env:SEED_ALLOW_REMOTE -ne "1") {
  throw "Hôte $host_ refusé : la restauration ne vise qu'une base locale (SEED_ALLOW_REMOTE=1 pour forcer)."
}
$pgRestore = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_restore.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgRestore) { throw "pg_restore.exe introuvable sous C:\Program Files\PostgreSQL." }
& $pgRestore.FullName --clean --if-exists --no-owner --no-privileges --dbname $env:DATABASE_URL $Dump
if ($LASTEXITCODE -ne 0) { throw "pg_restore a échoué (code $LASTEXITCODE)." }
Write-Output "Restauration terminée depuis $Dump"
