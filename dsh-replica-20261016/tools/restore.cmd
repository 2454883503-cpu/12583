@echo off
rem ===========================================================================
rem  DSH replica - restore launcher
rem  Runs tools\restore.ps1 with the execution policy bypassed for this process
rem  only (no machine-wide policy change). Forward any argument to the script:
rem      restore.cmd -DryRun
rem      restore.cmd -ComponentsDir "E:\dsh\components" -Force
rem ===========================================================================
setlocal
set "PS=powershell.exe"
where pwsh.exe >nul 2>nul && set "PS=pwsh.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore.ps1" %*
exit /b %ERRORLEVEL%
