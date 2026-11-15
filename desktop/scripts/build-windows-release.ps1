$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DesktopDir = Join-Path $RootDir "desktop"
$DistWinDir = Join-Path $RootDir "dist-win"
$PackageStage = Join-Path $DistWinDir "BowlingLeagueHelper-Package"

Write-Host "1. Building single-file frontend bundle..."
Push-Location $RootDir
npm ci
npm run build
Copy-Item "dist\index.html" "BowlingLeagueHelper.html" -Force
Copy-Item "dist\index.html" "public\BowlingLeagueHelper.html" -Force
Copy-Item "dist\index.html" "public\standalone_template.html" -Force
Copy-Item "dist\index.html" (Join-Path $DesktopDir "BowlingLeagueHelper.html") -Force
Copy-Item "version.json" (Join-Path $DesktopDir "version.json") -Force
Pop-Location

Write-Host "2. Building native desktop host executable & root installer.exe..."
Push-Location $RootDir
node desktop/scripts/build-installer.mjs
Pop-Location

Write-Host "3. Staging Windows ZIP package..."
New-Item -ItemType Directory -Force -Path $PackageStage | Out-Null
Copy-Item (Join-Path $RootDir "installer.exe") (Join-Path $PackageStage "installer.exe") -Force
Copy-Item (Join-Path $DesktopDir "README-Windows.txt") (Join-Path $PackageStage "README.txt") -Force

$ZipOutput = Join-Path $RootDir "BowlingLeagueHelper-Windows.zip"
if (Test-Path $ZipOutput) { Remove-Item $ZipOutput -Force }
Compress-Archive -Path (Join-Path $PackageStage "*") -DestinationPath $ZipOutput -CompressionLevel Optimal

Write-Host "DONE! Updated root installer.exe and created ZIP package at: $ZipOutput"
