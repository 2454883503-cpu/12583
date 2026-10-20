@echo off
rem Launcher for openai-api-server-via-codex (ChatGPT login + local proxy).
rem Two things are required on this machine:
rem   1. the local proxy must be running (ziyoumao / 127.0.0.1:7892), since chatgpt.com is unreachable directly
rem   2. the ChatGPT-mode credentials, which live in a separate CODEX_HOME
setlocal
set "HTTPS_PROXY=http://127.0.0.1:7892"
set "HTTP_PROXY=http://127.0.0.1:7892"
set "NO_PROXY=localhost,127.0.0.1"
"%~dp0openai-api-server-via-codex.exe" -auth-json "%USERPROFILE%\.codex-chatgpt\auth.json" -port 18080 -verbose %*
