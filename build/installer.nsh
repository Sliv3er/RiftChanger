!macro customHeader
  !system "echo ''"
!macroend

!macro preInit
  SetSilent silent
!macroend

!macro customInstall
  ; Create desktop shortcut always
  CreateShortCut "$DESKTOP\RiftChanger.lnk" "$INSTDIR\RiftChanger.exe" "" "$INSTDIR\RiftChanger.exe" 0
!macroend

!macro customUnInstall
  Delete "$DESKTOP\RiftChanger.lnk"
!macroend
