# Custom NSIS installer script for ChatAnyLLM
# Ensures the installation directory always shows the full path including app subfolder

# Customize the directory page explanatory text
!macro customHeader
  # Override the default directory page header text
  !define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install ChatAnyLLM in the following folder.$\r$\n$\r$\nThe application will be installed in a 'ChatAnyLLM' subfolder of the path you select below. Click Browse to choose a different location.$\r$\n"

  # Make the label clearer
  !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Destination Folder (full path will include \ChatAnyLLM)"
!macroend

# Custom function to ensure directory includes app name when page is shown
!macro customInit
  # This ensures the directory is set correctly when the installer starts
  ${StrContains} $0 "ChatAnyLLM" "$INSTDIR"
  ${If} $0 == ""
    StrCpy $INSTDIR "$INSTDIR\ChatAnyLLM"
  ${EndIf}
!macroend
