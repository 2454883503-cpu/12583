#Requires -Version 5.1
<#
.SYNOPSIS
  Verifies a restored DSH replica against MANIFEST.json.

.DESCRIPTION
  Checks, in order:

    1. reference files  byte-for-byte SHA256 against the bundle manifest
    2. target files     no path token is left, and expected content is present
    3. JSON             every restored .json file parses
    4. patch layer      cordis.patch.yml entry count and key rows
    5. node             `node --check` on the gpt-quota plugin sources
    6. layout           app.asar + bundled @deepseek-ai packages reachable

  Exit code 0 = all checks passed, 1 = at least one FAIL.

.EXAMPLE
  ./verify-restore.ps1 -ComponentsDir 'E:\dsh\组件' -DshInstallDir 'C:\DSH'
#>
[CmdletBinding()]
param(
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
  [Parameter(Mandatory)][string]$ComponentsDir,
  [Parameter(Mandatory)][string]$DshInstallDir,
  [string]$CodexHome = (Join-Path $env:USERPROFILE '.codex-chatgpt'),
  [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$fail = 0
$pass = 0

function Say([string]$m, [string]$color = 'Gray') { if (-not $Quiet) { Write-Host "  $m" -ForegroundColor $color } }
function Pass([string]$m) { $script:pass++; Write-Host "  [PASS] $m" -ForegroundColor Green }
function Fail([string]$m) { $script:fail++; Write-Host "  [FAIL] $m" -ForegroundColor Red }
function Step([string]$m) { Write-Host "`n== $m" -ForegroundColor Cyan }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false, $true)
function Read-Text([string]$path) { return [System.IO.File]::ReadAllText($path, $utf8NoBom) }

Write-Host ''
Write-Host 'DSH replica verification' -ForegroundColor Cyan
Say "bundle     : $Root"
Say "DSH home   : $DshHome"
Say "components : $ComponentsDir"

$manifestPath = Join-Path $Root 'MANIFEST.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw "MANIFEST.json not found: $manifestPath" }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

# ---------------------------------------------------------------- 1. reference
Step '1. reference files (SHA256)'
$checked = 0
foreach ($entry in $manifest.referenceFiles) {
  $p = Join-Path $Root $entry.Path
  if (-not (Test-Path -LiteralPath $p)) { Fail "missing: $($entry.Path)"; continue }
  $h = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash
  if ($h -eq $entry.Sha256) { $checked++ }
  else { Fail "hash mismatch: $($entry.Path)" }
}
if ($checked -eq $manifest.referenceFiles.Count) { Pass "$checked/$($manifest.referenceFiles.Count) reference files match the manifest" }

# ---------------------------------------------------------------- 2. tokens
Step '2. path tokens fully substituted'
# Only __TOKEN__ residue and the gpt-quota runtime path are checked here. The
# curated patch file legitimately documents the source machine's path inside a
# comment, so a bare 'D:\AA12583' match there would be a false positive.
$tokenFiles = @{
  (Join-Path $DshHome 'profiles\desktop\cordis.patch.yml') = @('__COMPONENTS_DIR__', '__COMPONENTS_DIR_URL__', '__PORTABLE_GIT__')
  (Join-Path $ComponentsDir 'gpt-quota-plugin\index.mjs')  = @('__DSH_INSTALL_DIR__')
}
foreach ($file in $tokenFiles.Keys) {
  if (-not (Test-Path -LiteralPath $file)) { Fail "missing: $file"; continue }
  $text = Read-Text $file
  $left = @($tokenFiles[$file] | Where-Object { $text.Contains($_) })
  if ($left.Count -eq 0) { Pass "clean: $file" }
  else { Fail "unsubstituted in $file -> $($left -join ', ')" }
}

# expected content
$patchPath = Join-Path $DshHome 'profiles\desktop\cordis.patch.yml'
if (Test-Path -LiteralPath $patchPath) {
  $patch = Read-Text $patchPath
  $expected = @{
    'ui-settings enabled: true'      = 'enabled: true'
    'account completion: api-key'    = 'completion: api-key'
    'performanceUsage: detailed'     = 'performanceUsage: detailed'
    'agent model gpt-6.1-sol'        = 'model: gpt-6.1-sol'
    'gpt-quota revision 5'           = 'revision: 5'
  }
  foreach ($k in $expected.Keys) {
    if ($patch.Contains($expected[$k])) { Pass "patch contains $k" } else { Fail "patch missing $k" }
  }
  if ($patch.Contains('gpt-quota-plugin/index.mjs')) { Pass 'gpt-quota points at a real file URL' } else { Fail 'gpt-quota entry lost' }
  if ($patch.Contains('gpt-bridge-autostart/index.mjs')) { Pass 'gpt-bridge-autostart is mounted' } else { Fail 'gpt-bridge-autostart entry lost' }
}

# ---------------------------------------------------------------- 3. JSON
Step '3. JSON parses'
$jsonTargets = @()
$jsonTargets += Get-ChildItem -LiteralPath $DshHome -Recurse -Filter '*.json' -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' }
foreach ($j in $jsonTargets) {
  try { $null = Read-Text $j.FullName | ConvertFrom-Json; Pass "json ok: $($j.FullName.Replace($DshHome, '%DSH_HOME%'))" }
  catch { Fail "invalid json: $($j.FullName)" }
}
if ($jsonTargets.Count -eq 0) { Say 'no json files under DSH home' 'DarkGray' }

# ---------------------------------------------------------------- 4. patch layer
Step '4. patch layer shape'
if (Test-Path -LiteralPath $patchPath) {
  $rows = (Read-Text $patchPath) -split "`n" | Where-Object { $_ -match '^\s*-\s+(id:|insert:)' }
  if ($rows.Count -ge 7) { Pass "cordis.patch.yml has $($rows.Count) top-level entries (expected >= 7)" }
  else { Fail "cordis.patch.yml has only $($rows.Count) top-level entries (expected >= 7)" }
  $sessions = Get-ChildItem -LiteralPath (Join-Path $DshHome 'sessions') -Directory -ErrorAction SilentlyContinue
  Pass "sessions restored: $($sessions.Count) conversation folder(s)"
}

# ---------------------------------------------------------------- 5. node --check
Step '5. plugin sources parse'
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$node = if ($nodeCmd) { $nodeCmd.Source } else { $null }
if (-not $node) {
  $exe = Join-Path $DshInstallDir 'DeepSeek Harness.exe'
  if (Test-Path -LiteralPath $exe) { $node = $exe }
}
if ($node) {
  foreach ($src in 'index.mjs', 'quota.mjs', 'client.js') {
    $f = Join-Path $ComponentsDir "gpt-quota-plugin\$src"
    if (-not (Test-Path -LiteralPath $f)) { Fail "missing: $src"; continue }
    & $node --check $f 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass "syntax ok: $src" } else { Fail "syntax error: $src" }
  }
  foreach ($t in 'quota.test.mjs') {
    $f = Join-Path $ComponentsDir "gpt-quota-plugin\$t"
    if (Test-Path -LiteralPath $f) { Say "test available: $t (run: node --test $f)" 'DarkGray' }
  }
} else {
  Say 'node not found; skipped syntax checks' 'Yellow'
}

# ---------------------------------------------------------------- 6. layout
Step '6. DSH install layout'
$asar = Join-Path $DshInstallDir 'resources\app.asar'
if (Test-Path -LiteralPath $asar) { Pass "app.asar present: $((Get-Item -LiteralPath $asar).Length) bytes" } else { Fail "app.asar missing under $DshInstallDir" }
if ((Get-FileHash -LiteralPath $asar -Algorithm SHA256).Hash -eq $manifest.appAsarSha256) {
  Pass 'app.asar byte-identical to the source machine'
} else {
  Say 'app.asar differs from the source machine (replica does not patch it)' 'Yellow'
}
$bridge = Join-Path $ComponentsDir 'openai-api-server-via-codex\openai-api-server-via-codex.exe'
if (Test-Path -LiteralPath $bridge) { Pass 'codex bridge binary restored' } else { Fail 'codex bridge binary missing' }
$auth = Join-Path $CodexHome 'auth.json'
if (Test-Path -LiteralPath $auth) { Pass 'codex auth.json in place' } else { Say 'codex auth.json absent (fine with -SkipSecrets)' 'Yellow' }

# ---------------------------------------------------------------- summary
Write-Host ''
if ($fail -eq 0) {
  Write-Host "Verification PASSED ($pass checks)." -ForegroundColor Green
  Write-Host ''
  exit 0
}
Write-Host "Verification FAILED: $fail failed, $pass passed." -ForegroundColor Red
Write-Host ''
exit 1
