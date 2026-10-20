@echo off
rem Launcher for openai-api-server-via-codex (ChatGPT login + local proxy).
rem Two things are required on this machine:
rem   1. a local proxy that can reach chatgpt.com (the source machine used
rem      ziyoumao on 127.0.0.1:7892). Override with DSH_LOCAL_PROXY, e.g.
rem        set DSH_LOCAL_PROXY=http://127.0.0.1:10809
rem   2. the ChatGPT-mode credentials, which live in a separate CODEX_HOME
rem REPLICA NOTE: the proxy used to be hard-coded to http://127.0.0.1:7892.
setlocal
if not defined DSH_LOCAL_PROXY set "DSH_LOCAL_PROXY=http://127.0.0.1:7892"
set "HTTPS_PROXY=%DSH_LOCAL_PROXY%"
set "HTTP_PROXY=%DSH_LOCAL_PROXY%"
set "NO_PROXY=localhost,127.0.0.1"
"%~dp0openai-api-server-via-codex.exe" -auth-json "%USERPROFILE%\.codex-chatgpt\auth.json" -port 18080 -verbose %*
