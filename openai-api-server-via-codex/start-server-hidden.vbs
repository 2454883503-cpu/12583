' Launch the Codex bridge without a console window.
' Used by the Windows logon scheduled task "DSH-Codex-Bridge".
' The bridge must survive independent of DSH: its main use is to back the
' gpt-local provider in llm-pi-ai, which needs to be reachable whenever a DSH
' session asks for a GPT model.
Set shell = CreateObject("WScript.Shell")
bridgeDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = bridgeDir & "\start-server.cmd"
shell.Run "cmd.exe /c """ & cmd & """", 0, False
Set shell = Nothing
