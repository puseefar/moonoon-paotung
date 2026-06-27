# ============================================================
# build-local.ps1 - Build APK locally via Gradle (works on Windows)
# Project: Poatung (expense-tracker) | Variant: release (debug-signed, installable)
# NOTE: `eas build --local` does NOT support Windows, so we call Gradle directly.
#       The android/ folder is already prebuilt; release bundles current JS (Hermes).
# NOTE: ASCII-only on purpose - Windows PowerShell 5.1 mis-parses non-ASCII source.
# ============================================================

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "==> Checking environment" -ForegroundColor Cyan
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME }
Write-Host "    ANDROID_HOME = $env:ANDROID_HOME"

New-Item -ItemType Directory -Force -Path "build-output" | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outApk = Join-Path $PSScriptRoot "build-output\poatung-preview-$stamp.apk"

Write-Host "==> Running Gradle assembleRelease (about 10-20 minutes)" -ForegroundColor Green
Set-Location (Join-Path $PSScriptRoot "android")
& ".\gradlew.bat" :app:assembleRelease --no-daemon
$gradleExit = $LASTEXITCODE
Set-Location $PSScriptRoot

$gradleApk = Join-Path $PSScriptRoot "android\app\build\outputs\apk\release\app-release.apk"
if ($gradleExit -eq 0 -and (Test-Path $gradleApk)) {
    Copy-Item $gradleApk $outApk -Force
    $sizeMB = "{0:N1} MB" -f ((Get-Item $outApk).Length / 1MB)
    Write-Host "==> SUCCESS! APK: $outApk ($sizeMB)" -ForegroundColor Green
} else {
    Write-Host "==> BUILD FAILED (gradle exit $gradleExit) - see log above" -ForegroundColor Red
    exit 1
}
