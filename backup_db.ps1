$ErrorActionPreference = "Stop"

# 1. Read DATABASE_URL from .env
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found!"
    exit 1
}

$envContent = Get-Content $envFile
$dbUrlLine = $envContent | Where-Object { $_ -match "^DATABASE_URL=" }
if (-not $dbUrlLine) {
    Write-Error "DATABASE_URL not found in .env"
    exit 1
}

# Parse connection string (Basic parsing for postgres://user:pass@host:port/dbname)
$connectionString = $dbUrlLine -replace "^DATABASE_URL=", "" -replace '"', ""
if ($connectionString -match "postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/([^?]+)") {
    $dbUser = $matches[1]
    $dbPass = $matches[2]
    $dbHost = $matches[3]
    $dbPort = if ($matches[4]) { $matches[4] } else { "5432" }
    $dbName = $matches[5]
} else {
    Write-Warning "Could not parse DATABASE_URL specifically. Will try standard params if possible."
    # Fallback or exit? Let's try to proceed by asking user or using default env vars for pg_dump
}

Write-Host "Detected Database Info:"
Write-Host "  Host: $dbHost"
Write-Host "  Database: $dbName"
Write-Host "  User: $dbUser"

# 2. Find pg_dump.exe
$pgDumpPath = "pg_dump" # Default assuming in PATH
try {
    $null = Get-Command "pg_dump" -ErrorAction Stop
} catch {
    Write-Warning "pg_dump not found in system PATH. Searching standard locations..."
    $searchPaths = @(
        "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe",
        "C:\Program Files (x86)\PostgreSQL\*\bin\pg_dump.exe"
    )
    $found = Get-ChildItem -Path $searchPaths -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) {
        $pgDumpPath = $found.FullName
        Write-Host "Found pg_dump at: $pgDumpPath"
    } else {
        Write-Error "Could not find pg_dump.exe. Please install PostgreSQL or add it to your PATH."
        exit 1
    }
}

# 3. Executing Backup
$date = Get-Date -Format "yyyyMMdd_HHmm"
$backupFile = "butsacco_db_backup_$date.sql"

Write-Host "Starting backup to $backupFile..."

$env:PGPASSWORD = $dbPass
& $pgDumpPath --host=$dbHost --port=$dbPort --username=$dbUser --dbname=$dbName --file=$backupFile --format=plain --no-owner --no-acl

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Database backup created at $backupFile"
    Write-Host "You should copy this file to your new PC."
    Write-Host "To restore on new PC: psql -U $dbUser -d $dbName -f $backupFile"
} else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
}

$env:PGPASSWORD = $null # Clear password
