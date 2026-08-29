!macro customInstall
  DetailPrint "Configuring WebView2 runtime..."
  IfFileExists "$INSTDIR\resources\WebView2Loader.dll" 0 +3
    CopyFiles /SILENT "$INSTDIR\resources\WebView2Loader.dll" "$INSTDIR\WebView2Loader.dll"
    Goto +2
  IfFileExists "$INSTDIR\resources\_WebView2Loader.dll" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\_WebView2Loader.dll" "$INSTDIR\WebView2Loader.dll"
!macroend
