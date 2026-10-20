@echo off
rem ===========================================================================
rem  DSH replica - verification launcher
rem  Requires the target paths, because it validates a restored tree:
rem      verify.cmd -ComponentsDir "E:\dsh\components" -DshInstallDir "C:\DSH"
rem ===========================================================================
setlocal
set "PS=powershell.exe"
where pwsh.exe >nul 2>nul && set "PS=pwsh.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-restore.ps1" %*
exit /b %ERRORLEVEL%
