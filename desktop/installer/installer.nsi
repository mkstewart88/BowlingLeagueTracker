!include "MUI2.nsh"

!define APP_NAME "Bowling League Helper"
!define APP_EXE "BowlingLeagueHelper.exe"
!define INSTALL_DIR "C:\BowlingLeagueHelper"
!ifndef OUT_FILE
  !define OUT_FILE "../../installer.exe"
!endif
!ifndef HOST_EXE
  !define HOST_EXE "../dist-host/BowlingLeagueHelper.exe"
!endif
!ifndef WEBVIEW2_DLL
  !define WEBVIEW2_DLL "../vendor/WebView2Loader.dll"
!endif
!ifndef WEBVIEW2_LICENSE
  !define WEBVIEW2_LICENSE "../vendor/WebView2-LICENSE.txt"
!endif
!ifndef APP_HTML
  !define APP_HTML "../../BowlingLeagueHelper.html"
!endif
!ifndef APP_VERSION_JSON
  !define APP_VERSION_JSON "../../version.json"
!endif
!ifndef APP_ICO
  !define APP_ICO "../assets/icon.ico"
!endif
!ifndef APP_PNG
  !define APP_PNG "../assets/icon.png"
!endif

Name "${APP_NAME}"
OutFile "${OUT_FILE}"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUnInstDetails show

!define MUI_ICON "${APP_ICO}"
!define MUI_UNICON "${APP_ICO}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APP_NAME}"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchBowlingApp

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

Function LaunchBowlingApp
  Exec '"$WINDIR\explorer.exe" "$INSTDIR\${APP_EXE}"'
FunctionEnd

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install Bowling League Helper" SecMain
  SetOutPath "$INSTDIR"

  ; Install native desktop host executable, WebView2 loader, app bundle, version manifest, and icons into C:\BowlingLeagueHelper
  File "/oname=${APP_EXE}" "${HOST_EXE}"
  File "/oname=WebView2Loader.dll" "${WEBVIEW2_DLL}"
  File "/oname=WebView2-LICENSE.txt" "${WEBVIEW2_LICENSE}"
  File "/oname=BowlingLeagueHelper.html" "${APP_HTML}"
  File "/oname=version.json" "${APP_VERSION_JSON}"
  File "/oname=icon.ico" "${APP_ICO}"
  File "/oname=bowling-icon.png" "${APP_PNG}"

  ; Grant built-in Windows Users group (SID S-1-5-32-545) Modify access to C:\BowlingLeagueHelper
  ; so clicking Update and Restart inside the program overwrites files directly without UAC prompts
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant "*S-1-5-32-545:(OI)(CI)F" /T /C'

  ; Create Desktop Shortcut with custom Bowling Ball & Pins Icon
  SetOutPath "$INSTDIR"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\icon.ico" 0

  ; Create Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\icon.ico" 0

  ; Register Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper"
  RMDir /r "$INSTDIR"
SectionEnd
