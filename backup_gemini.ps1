$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$zipFile = "Gemini_Dev_Backup_$timestamp.zip"
$baseDir = "C:\Users\HP\.gemini\antigravity"
$foldersToBackup = @("conversations", "brain", "context_state")

Write-Host "Starting backup process..."
Write-Host "Target: $zipFile"

# Create a temporary directory structure to ensure clean zip relative paths
$tempRoot = Join-Path $PWD "temp_backup_$timestamp"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
    foreach ($folder in $foldersToBackup) {
        $sourcePath = Join-Path $baseDir $folder
        if (Test-Path $sourcePath) {
            Write-Host "Staging: $folder"
            $destPath = Join-Path $tempRoot $folder
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
        } else {
            Write-Warning "Source folder not found: $sourcePath"
        }
    }

    Write-Host "Compressing archive..."
    Compress-Archive -Path "$tempRoot\*" -DestinationPath $zipFile -Force
    
    Write-Host "Cleaning up temp files..."
    Remove-Item -Path $tempRoot -Recurse -Force
    
    Write-Host "SUCCESS: Backup created at $(Resolve-Path $zipFile)"
} catch {
    Write-Error "Backup failed: $_"
    if (Test-Path $tempRoot) { Remove-Item -Path $tempRoot -Recurse -Force }
    exit 1
}
