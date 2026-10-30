; Backport electron-builder a356198's bounded shell-path copy (#9769/#7921).
; customHeader runs after multiUser.nsh but before one-click init expands it.
!ifndef TIKMNG_SAFE_PER_USER_PATH
!define TIKMNG_SAFE_PER_USER_PATH
!macroundef setInstallModePerUser
!macro setInstallModePerUser
  StrCpy $installMode CurrentUser
  SetShellVarContext current
  ReadRegStr $perUserInstallationFolder HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $perUserInstallationFolder != ""
    StrCpy $INSTDIR $perUserInstallationFolder
  ${Else}
    StrCpy $0 "$LocalAppData\Programs"
    Push $1
    Push $2
    StrCpy $2 0
    System::Call 'SHELL32::SHGetKnownFolderPath(g "${FOLDERID_UserProgramFiles}", i ${KF_FLAG_CREATE}, p 0, *p .r2)i.r1'
    ${If} $1 == 0
      System::Call 'KERNEL32::lstrcpynW(w .r0, p r2, i ${NSIS_MAX_STRLEN})p'
    ${EndIf}
    ${If} $2 != 0
      System::Call 'OLE32::CoTaskMemFree(p r2)'
    ${EndIf}
    Pop $2
    Pop $1
    StrCpy $INSTDIR "$0\${APP_FILENAME}"
  ${EndIf}
  ${StdUtils.GetParameter} $R0 "D" ""
  ${If} $R0 != ""
    StrCpy $INSTDIR $R0
  ${EndIf}
!macroend
!endif
