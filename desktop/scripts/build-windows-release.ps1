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
Copy-Item "dist\index.html" (Join-Path $DesktopDir "BowlingLeagueHelper.html") -Force
Copy-Item "version.json" (Join-Path $DesktopDir "version.json") -Force
Pop-Location

Write-Host "2. Packaging Electron Windows binary..."
Push-Location $DesktopDir
npm ci
npm run pack:win
Pop-Location

Write-Host "3. Compiling installer.exe with NSIS..."
New-Item -ItemType Directory -Force -Path $PackageStage | Out-Null
$NsisExe = "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
if (-not (Test-Path $NsisExe)) {
  $NsisExe = "makensis.exe"
}
& $NsisExe `
  "/DSOURCE_DIR=$DistWinDir\win-unpacked" `
  "/DOUT_FILE=$PackageStage\installer.exe" `
  (Join-Path $DesktopDir "installer\installer.nsi")

@"
Bowling League Helper - Windows Installation Instructions
=======================================================

1. Double-click installer.exe inside this folder.
2. It will automatically install all files to C:\BowlingLeagueHelper\
   and place a "Bowling League Helper" shortcut with the bowling icon on your Desktop.
3. Open "Bowling League Helper" from your Desktop anytime.
4. Saving & Updates:
   - Click "Save Backup..." to save your dated league file (e.g. OneDrive).
   - Closing the app automatically saves to that file.
   - Clicking "Update and Restart" automatically updates the files inside C:\BowlingLeagueHelper\.
"@ | Out-File -FilePath (Join-Path $PackageStage "README.txt") -Encoding utf8

$ZipOutput = Join-Path $RootDir "BowlingLeagueHelper-Windows.zip"
if (Test-Path $ZipOutput) { Remove-Item $ZipOutput -Force }
Compress-Archive -Path (Join-Path $PackageStage "*") -DestinationPath $ZipOutput -CompressionLevel Optimal

Write-Host "DONE! Created installer ZIP at: $ZipOutput"
