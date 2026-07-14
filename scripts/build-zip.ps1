# Build a Chrome/Edge Web Store upload zip from the extension files in the repo root.
# Windows/PowerShell equivalent of build-zip.sh, for the one-time manual first
# upload (CI uses the .sh version on Linux). The zip has manifest.json at the top
# level (no wrapping folder), which is what the Chrome Web Store expects.
# Output: dist\homework-sheets-<version>.zip
#
# Run from anywhere:  .\scripts\build-zip.ps1
$ErrorActionPreference = "Stop"

# Move to the repo root (the parent of this script's folder).
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$version = (Get-Content manifest.json -Raw | ConvertFrom-Json).version
$out = "dist\homework-sheets-$version.zip"

New-Item -ItemType Directory -Force -Path dist | Out-Null
if (Test-Path $out) { Remove-Item $out }

# Only the files the extension actually needs — never the repo metadata.
$items = "manifest.json", "content.js", "content.css", "docx-lib.js", "icons"
Compress-Archive -Path $items -DestinationPath $out

$hash = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
Write-Host "Built $out"
Write-Host "sha256: $hash"
