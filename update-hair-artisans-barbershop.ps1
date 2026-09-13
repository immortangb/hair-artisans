# ============================================================
# HAIR-ARTISAN'S BARBERSHOP
# BRAND + BOOKING HOURS UPDATE
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   HAIR-ARTISAN'S BARBERSHOP WEBSITE UPDATE" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Get-Location

# ------------------------------------------------------------
# NEW BUSINESS NAME
# ------------------------------------------------------------

$oldNames = @(
    "Hair Artisan's",
    "Hair Artisans",
    "Hair Artisan"
)

$newName = "Hair-Artisan's Barbershop"

# ------------------------------------------------------------
# SOURCE DIRECTORIES
# ------------------------------------------------------------

$directories = @(
    "app",
    "components",
    "lib"
)

# ------------------------------------------------------------
# FILE TYPES TO UPDATE
# ------------------------------------------------------------

$fileExtensions = @(
    "*.ts",
    "*.tsx",
    "*.js",
    "*.jsx"
)

# ------------------------------------------------------------
# UPDATE BUSINESS NAME
# ------------------------------------------------------------

foreach ($directory in $directories) {

    $directoryPath = Join-Path $projectRoot $directory

    if (-not (Test-Path $directoryPath)) {
        continue
    }

    foreach ($extension in $fileExtensions) {

        $files = Get-ChildItem `
            -Path $directoryPath `
            -Filter $extension `
            -Recurse `
            -File

        foreach ($file in $files) {

            $content = Get-Content `
                -Path $file.FullName `
                -Raw

            $originalContent = $content

            foreach ($oldName in $oldNames) {

                $content = $content.Replace(
                    $oldName,
                    $newName
                )
            }

            if ($content -ne $originalContent) {

                Set-Content `
                    -Path $file.FullName `
                    -Value $content `
                    -Encoding UTF8

                Write-Host "Updated brand:" $file.FullName -ForegroundColor Green
            }
        }
    }
}

# ------------------------------------------------------------
# UPDATE BOOKING CONFIGURATION
# ------------------------------------------------------------

$configFile = Join-Path `
    $projectRoot `
    "lib\booking\config.ts"

if (-not (Test-Path $configFile)) {

    Write-Host ""
    Write-Host "ERROR: lib/booking/config.ts was not found." `
        -ForegroundColor Red

    exit 1
}

$config = Get-Content `
    -Path $configFile `
    -Raw

# Change every business opening time from 09:00 to 10:00
$config = $config.Replace(
    'open: "09:00"',
    'open: "10:00"'
)

# Update comments
$config = $config.Replace(
    "Wednesday - Sunday = 09:00 - 17:00",
    "Wednesday - Sunday = 10:00 - 17:00"
)

$config = $config.Replace(
    "HAIR ARTISAN'S BOOKING CONFIGURATION",
    "HAIR-ARTISAN'S BARBERSHOP BOOKING CONFIGURATION"
)

Set-Content `
    -Path $configFile `
    -Value $config `
    -Encoding UTF8

Write-Host ""
Write-Host "Booking configuration updated." -ForegroundColor Green
Write-Host "New opening time: 10:00" -ForegroundColor Yellow
Write-Host "Closing time: 17:00" -ForegroundColor Yellow

# ------------------------------------------------------------
# UPDATE BOOKING PAGE DISPLAY
# ------------------------------------------------------------

$bookingFile = Join-Path `
    $projectRoot `
    "app\booking\page.tsx"

if (Test-Path $bookingFile) {

    $bookingPage = Get-Content `
        -Path $bookingFile `
        -Raw

    $bookingPage = $bookingPage.Replace(
        "09:00 to 17:00",
        "10:00 to 17:00"
    )

    $bookingPage = $bookingPage.Replace(
        "09:00–17:00",
        "10:00–17:00"
    )

    $bookingPage = $bookingPage.Replace(
        "09:00 – 17:00",
        "10:00 – 17:00"
    )

    Set-Content `
        -Path $bookingFile `
        -Value $bookingPage `
        -Encoding UTF8

    Write-Host "Booking page display updated." -ForegroundColor Green
}

# ------------------------------------------------------------
# UPDATE HOMEPAGE HOURS
# ------------------------------------------------------------

$homeFile = Join-Path `
    $projectRoot `
    "app\page.tsx"

if (Test-Path $homeFile) {

    $homePage = Get-Content `
        -Path $homeFile `
        -Raw

    $homePage = $homePage.Replace(
        "09:00 – 17:00",
        "10:00 – 17:00"
    )

    $homePage = $homePage.Replace(
        "09:00-17:00",
        "10:00-17:00"
    )

    Set-Content `
        -Path $homeFile `
        -Value $homePage `
        -Encoding UTF8

    Write-Host "Homepage opening hours updated." -ForegroundColor Green
}

# ------------------------------------------------------------
# UPDATE NEXT.JS METADATA
# ------------------------------------------------------------

$layoutFile = Join-Path `
    $projectRoot `
    "app\layout.tsx"

if (Test-Path $layoutFile) {

    $layout = Get-Content `
        -Path $layoutFile `
        -Raw

    $layout = $layout.Replace(
        "Hair Artisan's",
        $newName
    )

    Set-Content `
        -Path $layoutFile `
        -Value $layout `
        -Encoding UTF8

    Write-Host "Next.js metadata updated." -ForegroundColor Green
}

# ------------------------------------------------------------
# FINISHED
# ------------------------------------------------------------

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "              UPDATE COMPLETE" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Business name:" -NoNewline
Write-Host " Hair-Artisan's Barbershop" -ForegroundColor Yellow

Write-Host "New bookings:" -NoNewline
Write-Host " 10:00 - 17:00" -ForegroundColor Yellow

Write-Host "Existing 09:00 bookings:" -NoNewline
Write-Host " NOT DELETED" -ForegroundColor Green

Write-Host "Existing 09:30 bookings:" -NoNewline
Write-Host " NOT DELETED" -ForegroundColor Green

Write-Host ""
Write-Host "IMPORTANT:"
Write-Host "The Supabase SQL migration must also be run."
Write-Host ""