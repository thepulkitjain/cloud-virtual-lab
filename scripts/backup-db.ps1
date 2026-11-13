# ==============================================================================
# Windows PowerShell Database Backup Script
# ==============================================================================

param(
  [string]$BackupDir = "./backups/database",
  [string]$DatabaseName = "cloud_virtual_lab",
  [string]$User = "postgres",
  [string]$HostName = "localhost",
  [int]$Port = 5432
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$OutputFile = Join-Path $BackupDir "cvl_backup_$Timestamp.sql"

if (!(Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Cloud Virtual Lab - Windows Database Backup" -ForegroundColor Cyan
Write-Host " Database: $DatabaseName on $HostName`:$Port" -ForegroundColor Cyan
Write-Host " Target File: $OutputFile" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

pg_dump -h $HostName -p $Port -U $User -d $DatabaseName -F p -f $OutputFile

if (Test-Path $OutputFile) {
  $Size = (Get-Item $OutputFile).Length / 1KB
  Write-Host " Database backup created successfully! ($([math]::Round($Size, 2)) KB)" -ForegroundColor Green
} else {
  Write-Host "❌ Backup failed." -ForegroundColor Red
}
