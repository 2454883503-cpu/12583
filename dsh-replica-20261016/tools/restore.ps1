#Requires -Version 5.1
<#
.SYNOPSIS
  Restores a DSH replica bundle onto this machine and repoints its paths.

.DESCRIPTION
  Reads MANIFEST.json next to this script and performs, in order:

    1. sanity checks   bundle integrity + DSH version compatibility
    2. preflight       shows every destination, refuses to clobber without -Force
    3. copy            payload\components -> <ComponentsDir>
                       payload\dsh-home    -> <DshHome>
                       reference\profiles  -> <DshHome>\profiles
    4. secrets         payload\dsh-home\secrets -> <DshHome>\secrets + codex auth
                       (skipped entirely with -SkipSecrets)
    5. repoint         calls repoint.ps1 to substitute path tokens
    6. verify          calls verify-restore.ps1

  Nothing outside <DshHome> and <ComponentsDir> is written.

.PARAMETER DshHome
  Target DSH home. Default: %USERPROFILE%\.dsh

.PARAMETER ComponentsDir
  Target directory for the plugins and analysis artifacts. Default: a
  'dsh-components' folder next to the restored replica root.

.PARAMETER DshInstallDir
  DSH install root (the folder holding 'DeepSeek Harness.exe' and 'resources').
  Auto-detected when omitted.

.PARAMETER SkipSecrets
  Do not restore credentials at all (DeepSeek account, Codex auth).

.PARAMETER DryRun
  Print the full plan and exit without writing anything.

.EXAMPLE
  ./restore.ps1 -DryRun
.EXAMPLE
  ./restore.ps1 -ComponentsDir 'E:\dsh\组件' -Force
#>
[CmdletBinding()]
param(
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
  [string]$ComponentsDir,
  [string]$DshInstallDir,
  [string]$PortableGit,
  [string]$CodexHome = (Join-Path $env:USERPROFILE '.codex-chatgpt'),
  [string[]]$WorkspacePathMap = @(),
  [switch]$ClearWorkspaces,
  [switch]$SkipSecrets,
  [switch]$Force,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot          # bundle root (parent of tools\)
$Payload = Join-Path $Root 'payload'
if (-not $ComponentsDir) { $ComponentsDir = Join-Path $Root 'components' }

function Say([string]$m, [string]$color = 'Gray') { Write-Host "  $m" -ForegroundColor $color }
function Ok([string]$m)   { Say "[ok] $m" 'Green' }
function Skip([string]$m) { Say "[--] $m" 'DarkGray' }
function Warn([string]$m) { Say "[!!] $m" 'Yellow' }
function Step([string]$m) { Write-Host "`n== $m" -ForegroundColor Cyan }

function Find-DshInstall {
  $candidates = @()
  if ($env:DSH_INSTALL_DIR) { $candidates += $env:DSH_INSTALL_DIR }
  $candidates += @(
    'D:\AA12583\dsh',
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
    (Join-Path ${env:ProgramFiles} 'DeepSeek Harness')
  )
  foreach ($key in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                   'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*') {
    try {
      Get-ItemProperty $key -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like '*DeepSeek Harness*' -and $_.InstallLocation } |
        ForEach-Object { $candidates += $_.InstallLocation }
    } catch { }
  }
  foreach ($c in $candidates) {
    if (-not $c) { continue }
    $exe = Join-Path $c 'DeepSeek Harness.exe'
    $asar = Join-Path $c 'resources\app.asar'
    if ((Test-Path -LiteralPath $exe) -and (Test-Path -LiteralPath $asar)) { return (Resolve-Path -LiteralPath $c).Path }
  }
  return $null
}

Write-Host ''
Write-Host 'DSH replica restore' -ForegroundColor Cyan
Say "bundle       : $Root"
Say "DSH home     : $DshHome"
Say "components   : $ComponentsDir"
if ($DryRun) { Say 'MODE         : DryRun (nothing is written)' 'Yellow' }

# ---------------------------------------------------------------- 1. sanity
Step '1. sanity checks'

$manifestPath = Join-Path $Root 'MANIFEST.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw "MANIFEST.json not found next to tools\: $manifestPath" }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
Say "manifest     : $($manifest.fileCount) files, built $($manifest.createdUtc)"
Say "source DSH   : $($manifest.dshVersion)  (app.asar sha256 $($manifest.appAsarSha256.Substring(0,16))...)"

if (-not $DshInstallDir) { $DshInstallDir = Find-DshInstall }
if (-not $DshInstallDir) {
  throw "Could not locate the DSH install root. Install DSH 0.2.0-rc.2 first, or pass -DshInstallDir 'X:\path\to\dsh'."
}
Ok "DSH install  : $DshInstallDir"

$versionFile = Join-Path $DshInstallDir 'version'
if (Test-Path -LiteralPath $versionFile) {
  $electron = (Get-Content -LiteralPath $versionFile -Raw).Trim()
  Say "electron     : $electron (source machine had $($manifest.electronVersion))"
}
$asar = Join-Path $DshInstallDir 'resources\app.asar'
$asarHash = (Get-FileHash -LiteralPath $asar -Algorithm SHA256).Hash
if ($asarHash -eq $manifest.appAsarSha256) {
  Ok 'app.asar matches the source machine byte for byte'
} else {
  Warn "app.asar differs from the source machine (expected $($manifest.appAsarSha256.Substring(0,16))..., got $($asarHash.Substring(0,16))...)"
  Warn 'Plugin inventory and _dsh\ reference docs may drift. The replica itself does not patch app.asar.'
}

foreach ($dir in @('payload\components', 'payload\dsh-home\profiles', 'reference\profiles')) {
  $p = Join-Path $Root $dir
  if (-not (Test-Path -LiteralPath $p)) { throw "bundle is incomplete, missing: $p" }
}
Ok 'bundle layout complete'

# ---------------------------------------------------------------- 2. preflight
Step '2. preflight'

$jobs = [System.Collections.Generic.List[object]]::new()
function Add-Job([string]$kind, [string]$from, [string]$to, [string]$group = 'core') {
  $jobs.Add([pscustomobject]@{ Kind = $kind; From = $from; To = $to; Group = $group })
}

$referenceProfiles = Join-Path $Root 'reference\profiles'
Add-Job 'dir'  (Join-Path $Payload 'components')        $ComponentsDir                          'core'
Add-Job 'dir'  (Join-Path $Payload 'dsh-home\profiles') (Join-Path $DshHome 'profiles')         'core'
Add-Job 'dir'  $referenceProfiles                        (Join-Path $DshHome 'profiles')         'core'
Add-Job 'dir'  (Join-Path $Payload 'dsh-home\sessions') (Join-Path $DshHome 'sessions')         'core'
Add-Job 'dir'  (Join-Path $Payload 'dsh-home\storages') (Join-Path $DshHome 'storages')         'core'
Add-Job 'file' (Join-Path $Payload 'dsh-home\secrets\.credentials.yaml')  (Join-Path $DshHome '.credentials.yaml')                'secret'
Add-Job 'file' (Join-Path $Payload 'dsh-home\secrets\.anonymous-user-id') (Join-Path $DshHome '.anonymous-user-id')               'secret'
Add-Job 'file' (Join-Path $Payload 'dsh-home\secrets\codex-auth.json')    (Join-Path $CodexHome 'auth.json')                       'secret'

foreach ($job in $jobs) {
  $exists = Test-Path -LiteralPath $job.To
  $flag = if ($exists) { 'EXISTS' } else { 'new' }
  $color = if ($exists) { 'Yellow' } else { 'Gray' }
  if ($SkipSecrets -and $job.Group -eq 'secret') { $flag = 'SKIP'; $color = 'DarkGray' }
  Say ("{0,-6} {1}" -f $flag, $job.From.Replace($Root, '.')) $color
  Say ("       -> {0}" -f $job.To) $color
}
Say 'Plugin side effects: the four third-party plugins in profiles\desktop\node_modules stay INACTIVE' 'Yellow'
Say "until you list them in dsh.profile.bundles (Settings -> Plugins)." 'Yellow'

if ($DryRun) {
  Write-Host "`nDryRun complete. Re-run without -DryRun to apply.`n" -ForegroundColor Cyan
  exit 0
}

# ---------------------------------------------------------------- 3. copy
Step '3. copying payload'

function Copy-Tree([string]$from, [string]$to, [string[]]$excludeFiles = @()) {
  if (-not (Test-Path -LiteralPath $from)) { Warn "skip, missing: $from"; return }
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  $rcArgs = @($from, $to, '/E', '/XJ', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS')
  if ($excludeFiles.Count -gt 0) { $rcArgs += '/XF'; $rcArgs += $excludeFiles }
  $null = robocopy @rcArgs
  Ok "-> $to"
}

if ((Test-Path -LiteralPath $ComponentsDir) -and -not $Force) {
  Warn "$ComponentsDir already exists; existing files will be overwritten, extras kept."
}
Copy-Tree (Join-Path $Payload 'components')          $ComponentsDir
Copy-Tree (Join-Path $Payload 'dsh-home\profiles')   (Join-Path $DshHome 'profiles')
# Reference profiles are copied AFTER the payload and must never overwrite the
# curated patch layer: the reference copy is the *live* (recovery-degraded)
# cordis.patch.yml. Keep its dependency manifest and lockfile only.
Copy-Tree (Join-Path $Root 'reference\profiles')     (Join-Path $DshHome 'profiles') @('cordis.yml', 'cordis.patch.yml')
Copy-Tree (Join-Path $Payload 'dsh-home\sessions')   (Join-Path $DshHome 'sessions')
Copy-Tree (Join-Path $Payload 'dsh-home\storages')   (Join-Path $DshHome 'storages')

# ---------------------------------------------------------------- 4. secrets
Step '4. credentials'
if ($SkipSecrets) {
  Warn 'skipped (-SkipSecrets): log in to DeepSeek and ChatGPT/Codex manually on this machine'
} else {
  foreach ($pair in @(
      @((Join-Path $Payload 'dsh-home\secrets\.credentials.yaml'),  (Join-Path $DshHome '.credentials.yaml')),
      @((Join-Path $Payload 'dsh-home\secrets\.anonymous-user-id'), (Join-Path $DshHome '.anonymous-user-id')),
      @((Join-Path $Payload 'dsh-home\secrets\codex-auth.json'),    (Join-Path $CodexHome 'auth.json'))
    )) {
    if (Test-Path -LiteralPath $pair[0]) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $pair[1]) | Out-Null
      Copy-Item -LiteralPath $pair[0] -Destination $pair[1] -Force
      Ok "-> $($pair[1])"
    } else { Warn "missing in bundle: $($pair[0])" }
  }
}

# ---------------------------------------------------------------- 5. repoint
Step '5. repointing machine-specific paths'
& (Join-Path $PSScriptRoot 'repoint.ps1') -DshHome $DshHome -ComponentsDir $ComponentsDir `
    -DshInstallDir $DshInstallDir -PortableGit $PortableGit `
    -WorkspacePathMap $WorkspacePathMap -ClearWorkspaces:$ClearWorkspaces

# ---------------------------------------------------------------- 6. verify
Step '6. verifying'
& (Join-Path $PSScriptRoot 'verify-restore.ps1') -DshHome $DshHome -ComponentsDir $ComponentsDir -DshInstallDir $DshInstallDir -CodexHome $CodexHome

Write-Host ''
Write-Host 'Restore finished.' -ForegroundColor Green
Say 'Next steps:'
Say '  1. start the Codex bridge:  <components>\openai-api-server-via-codex\start-server.cmd'
Say '  2. start DSH; check Settings -> Plugins and enable the third-party plugins you want'
Say '  3. verify the GPT quota overlay appears in the model selection popover'
Write-Host ''
