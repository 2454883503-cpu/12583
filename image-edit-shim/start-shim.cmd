@echo off
rem Keep the image-edit shim running alongside the Codex bridge.
rem The shim (127.0.0.1:18081) adds /v1/images/edits support to the bridge at
rem 127.0.0.1:18080, which only implements /v1/images/generations.
rem Launched hidden at logon by the "DSH-Image-Edit-Shim" scheduled task.
setlocal
set "SHIM_PORT=18081"
set "SHIM_UPSTREAM=http://127.0.0.1:18080"
set "SHIM_EDIT_MODEL=gpt-6-luna"
set "SHIM_BACKGROUND=transparent"
set "SHIM_FORMAT=png"
"C:\Users\tanyu\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" "%~dp0server.mjs"
