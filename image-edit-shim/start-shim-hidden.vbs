' Launch the image-edit shim without a console window.
' Used by the Windows logon scheduled task "DSH-Image-Edit-Shim".
Set shell = CreateObject("WScript.Shell")
shimDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = shimDir & "\start-shim.cmd"
shell.Run "cmd.exe /c """ & cmd & """", 0, False
Set shell = Nothing
