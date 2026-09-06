# ============================================================
# HAIR ARTISAN'S - IMAGE PREPARATION SCRIPT
# ============================================================
#
# This script:
# 1. Reads images from /images-source
# 2. Copies them into /public/images/gallery
# 3. Renames them gallery-01.jpeg, gallery-02.jpeg, etc.
#
# Run from the Hair Artisan's project root:
#
# powershell -ExecutionPolicy Bypass -File .\scripts\prepare-images.ps1
#
# ============================================================

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$sourceFolder = Join-Path $projectRoot "images-source"
$destinationFolder = Join-Path $projectRoot "public\images\gallery"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " Hair Artisan's Image Preparation" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Check source folder
# ------------------------------------------------------------

if (-not (Test-Path $sourceFolder)) {
    Write-Host "ERROR: images-source folder was not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Create this folder:"
    Write-Host "$sourceFolder"
    Write-Host ""
    Write-Host "Then put your extracted images inside it."
    exit 1
}

# ------------------------------------------------------------
# Create destination folder
# ------------------------------------------------------------

if (-not (Test-Path $destinationFolder)) {
    New-Item -ItemType Directory -Path $destinationFolder -Force | Out-Null
}

# ------------------------------------------------------------
# Find image files
# ------------------------------------------------------------

$imageFiles = Get-ChildItem `
    -Path $sourceFolder `
    -File `
    -Include *.jpg, *.jpeg, *.png, *.webp `
    | Sort-Object Name

if ($imageFiles.Count -eq 0) {
    Write-Host "ERROR: No image files were found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Put the extracted images inside:"
    Write-Host "$sourceFolder"
    exit 1
}

# ------------------------------------------------------------
# Copy and rename
# ------------------------------------------------------------

$counter = 1

foreach ($image in $imageFiles) {

    $extension = $image.Extension.ToLower()

    $newName = "gallery-{0:D2}{1}" -f $counter, $extension

    $destination = Join-Path `
        $destinationFolder `
        $newName

    Copy-Item `
        -Path $image.FullName `
        -Destination $destination `
        -Force

    Write-Host "Copied:" -NoNewline
    Write-Host " $($image.Name)" -ForegroundColor DarkGray

    Write-Host "   -> $newName" -ForegroundColor Green

    $counter++
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " Images prepared successfully!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Images copied: $($imageFiles.Count)"
Write-Host ""
Write-Host "Destination:"
Write-Host "$destinationFolder"
Write-Host ""

Write-Host "You can now remove the images-source folder"
Write-Host "after confirming the images exist in public/images/gallery."
Write-Host ""