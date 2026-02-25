!macro customInstall
  CreateShortCut "$DESKTOP\RiftChanger.lnk" "$INSTDIR\RiftChanger.exe" "" "$INSTDIR\RiftChanger.exe" 0
!macroend

!macro customUnInstall
  Delete "$DESKTOP\RiftChanger.lnk"
!macroend
