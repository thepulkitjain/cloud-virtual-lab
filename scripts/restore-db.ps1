# ==============================================================================
# Windows PowerShell Database Restore Script
# ==============================================================================

param(
  [Parameter(Mandatory=$true)]
  [string]$BackupFile,
  [string]$DatabaseName = "cloud_virtual_lab",
  [string]$User = "postgres",
  [string]$HostName = "localhost",
  [int]$Port = 5432
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupFile)) {
  Write-Host "❌ Error: Backup file '$BackupFile' does not exist." -ForegroundColor Red
  exit 1
}

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host " Cloud Virtual Lab - Windows Database Restore" -ForegroundColor Yellow
Write-Host " Source: $BackupFile" -ForegroundColor Yellow
Write-Host " Target: $DatabaseName on $HostName`:$Port" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow

$Confirm = Read-Host "⚠️  This will overwrite database records. Type 'YES' to proceed"
if ($Confirm -ne "YES") {
  Write-Host "Restore canceled by user." -ForegroundColor Gray
  exit 0
}

psql -h $HostName -p $Port -U $User -d $DatabaseName -f $BackupFile

Write-Host " Database restored successfully from $BackupFile!" -ForegroundColor Green
