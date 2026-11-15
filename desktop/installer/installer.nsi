!include "MUI2.nsh"

!define APP_NAME "Bowling League Helper"
!define APP_EXE "BowlingLeagueHelper.exe"
!define INSTALL_DIR "C:\BowlingLeagueHelper"
!ifndef SOURCE_DIR
  !define SOURCE_DIR "..\dist-win\win-unpacked"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "..\dist-win\BowlingLeagueHelper-Package\installer.exe"
!endif

Name "${APP_NAME}"
OutFile "${OUT_FILE}"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show

!define MUI_ICON "..\assets\icon.ico"
!define MUI_UNICON "..\assets\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APP_NAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install Bowling League Helper" SecMain
  SetOutPath "$INSTDIR"

  ; Install compiled desktop executable and all program files into C:\BowlingLeagueHelper\
  File /r "${SOURCE_DIR}\*.*"
  File "..\BowlingLeagueHelper.html"
  File "..\version.json"
  File "..\assets\icon.ico"

  ; Grant built-in Windows Users group (SID S-1-5-32-545) Modify access to C:\BowlingLeagueHelper\
  ; so clicking Update inside the program silently overwrites files without needing Admin UAC!
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant "*S-1-5-32-545:(OI)(CI)F" /T /C'

  ; Create Desktop Shortcut with custom Bowling Ball & Pins Icon
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\icon.ico" 0

  ; Create Start Menu Shortcut
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\icon.ico" 0

  ; Register Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BowlingLeagueHelper"
  RMDir /r "$INSTDIR"
SectionEnd
