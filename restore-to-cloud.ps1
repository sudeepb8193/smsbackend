# Script to restore local sms_db backup to the remote/cloud database
param (
    [Parameter(Mandatory=$true)]
    [string]$TargetDatabaseUrl
)

$PsqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$BackupFile = Join-Path $PSScriptRoot "sms_db_backup.sql"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found at $BackupFile"
    exit 1
}

if (-not (Test-Path $PsqlPath)) {
    Write-Error "psql.exe not found at $PsqlPath"
    exit 1
}

Write-Host "Restoring $BackupFile to target database..." -ForegroundColor Cyan
& $PsqlPath $TargetDatabaseUrl -f $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Database successfully migrated to cloud!" -ForegroundColor Green
} else {
    Write-Warning "`nRestoration finished with exit code $LASTEXITCODE (some warnings about roles or public schemas are normal)."
}
