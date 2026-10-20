#Requires -Version 5.1
<#
.SYNOPSIS
  Rewrites every machine-specific absolute path in a restored DSH replica.

.DESCRIPTION
  Runs against a target DSH home (default %USERPROFILE%\.dsh):

    * <home>\storages\workspace.json
          workspace .path values. Rewritten by targeted JSON string replacement,
          never by ConvertTo-Json round-tripping, so CJK titles and the original
          file layout are preserved byte for byte.
    * <home>\profiles\desktop\cordis.patch.yml
          __COMPONENTS_DIR__ / __COMPONENTS_DIR_URL__ / __PORTABLE_GIT__
    * <components>\gpt-quota-plugin\index.mjs
          __DSH_INSTALL_DIR__

  A .bak-<timestamp> copy is written next to every file it touches. The script
  is idempotent: a file that still needs no change is left untouched.

.PARAMETER WorkspacePathMap
  Extra workspace path rewrites, format "oldAbsolute=newAbsolute". Repeatable.
  Without it, workspace.json paths are rewritten only when they sit under
  D:\AA12583\dsh or C:\Users\tanyu, by swapping those prefixes.

.PARAMETER ClearWorkspaces
  Drop every workspace entry and every pinned/archived session instead of
  repointing them. Use when you want a clean sidebar on the new machine.

.EXAMPLE
  ./repoint.ps1 -ComponentsDir 'E:\dsh\组件' -DshInstallDir 'E:\Programs\DeepSeek Harness'

.EXAMPLE
  ./repoint.ps1 -ComponentsDir 'E:\dsh\组件' -DshInstallDir 'C:\DSH' -ClearWorkspaces
#>
[CmdletBinding()]
param(
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
  [Parameter(Mandatory)][string]$ComponentsDir,
  [Parameter(Mandatory)][string]$DshInstallDir,
  [string[]]$WorkspacePathMap = @(),
  [switch]$ClearWorkspaces,
  [string]$PortableGit,
  [switch]$WhatIfOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Say([string]$m, [string]$color = 'Gray') { Write-Host "  $m" -ForegroundColor $color }
function Ok([string]$m)   { Say "[ok] $m" 'Green' }
function Skip([string]$m) { Say "[--] $m" 'DarkGray' }
function Warn([string]$m) { Say "[!!] $m" 'Yellow' }

function Backup-File([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $bak = "$path.bak-$stamp"
  $i = 1
  while (Test-Path -LiteralPath $bak) { $bak = "$path.bak-$stamp-$i"; $i++ }
  Copy-Item -LiteralPath $path -Destination $bak
  return $bak
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false, $true)
function Read-Text([string]$path) { return [System.IO.File]::ReadAllText($path, $utf8NoBom) }
function Write-Text([string]$path, [string]$text) { [System.IO.File]::WriteAllText($path, $text, $utf8NoBom) }

# Percent-encode a Windows path the way a file:// URL needs it.
function ConvertTo-FileUrlPath([string]$path) {
  $p = $path -replace '\\', '/'
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $p.ToCharArray()) {
    if ([int][char]$ch -lt 128 -and $ch -match '[A-Za-z0-9\-._~/]') { [void]$sb.Append($ch) }
    else { foreach ($b in [System.Text.Encoding]::UTF8.GetBytes([string]$ch)) { [void]$sb.Append('%' + $b.ToString('X2')) } }
  }
  return 'file:///' + $sb.ToString().TrimStart('/')
}

Write-Host ''
Write-Host 'DSH replica - path repointing' -ForegroundColor Cyan
Say "DSH home    : $DshHome"
Say "components  : $ComponentsDir"
Say "DSH install : $DshInstallDir"
if ($WhatIfOnly) { Say 'MODE        : WhatIfOnly (nothing is written)' 'Yellow' }

if (-not (Test-Path -LiteralPath $DshHome))       { throw "DSH home not found: $DshHome" }
if (-not (Test-Path -LiteralPath $ComponentsDir)) { throw "components dir not found: $ComponentsDir" }

# ---------------------------------------------------------------- PortableGit
if (-not $PortableGit) {
  $PortableGit = @(
    (Join-Path $env:USERPROFILE '.workbuddy\binaries\PortableGit\versions\1.2.0\cmd\git.exe'),
    'C:\Users\tanyu\.workbuddy\binaries\PortableGit\versions\1.2.0\cmd\git.exe'
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
$portableGitFound = [bool]$PortableGit
if (-not $portableGitFound) {
  $PortableGit = 'git'
  Warn "PortableGit not found; session-sync.gitBin falls back to bare 'git' (needs git on PATH)."
}

$componentsUrl = ConvertTo-FileUrlPath $ComponentsDir

# ------------------------------------------------- cordis.patch.yml
$patchPath = Join-Path $DshHome 'profiles\desktop\cordis.patch.yml'
if (Test-Path -LiteralPath $patchPath) {
  $text = Read-Text $patchPath
  $before = $text
  $text = $text.Replace('__COMPONENTS_DIR_URL__', $componentsUrl)
  $text = $text.Replace('__COMPONENTS_DIR__', $ComponentsDir)
  $text = $text.Replace('__PORTABLE_GIT__', $PortableGit)
  $text = $text.Replace('file:///D:/AA12583/dsh/%E7%BB%84%E4%BB%B6', $componentsUrl)
  $text = $text.Replace('D:\AA12583\dsh\组件', $ComponentsDir)
  if ($text -ne $before) {
    if ($WhatIfOnly) { Ok 'cordis.patch.yml would be rewritten' }
    else {
      $null = Backup-File $patchPath
      Write-Text $patchPath $text
      Ok 'cordis.patch.yml rewritten'
      Say "gpt-quota.name -> $componentsUrl/gpt-quota-plugin/index.mjs"
      Say "session-sync.gitBin -> $PortableGit"
    }
  } else { Skip 'cordis.patch.yml already correct' }
} else { Warn "missing: $patchPath" }

# ------------------------------------------------- gpt-quota index.mjs
$indexPath = Join-Path $ComponentsDir 'gpt-quota-plugin\index.mjs'
if (Test-Path -LiteralPath $indexPath) {
  $text = Read-Text $indexPath
  $before = $text
  $text = $text.Replace('__DSH_INSTALL_DIR__', $DshInstallDir)
  $text = $text.Replace('D:/AA12583/dsh', $DshInstallDir)
  if ($text -ne $before) {
    if ($WhatIfOnly) { Ok 'gpt-quota-plugin/index.mjs would be rewritten' }
    else {
      $null = Backup-File $indexPath
      Write-Text $indexPath $text
      Ok 'gpt-quota-plugin/index.mjs rewritten'
      Say "createRequire -> $DshInstallDir/resources/app.asar/dsh/package.json"
    }
  } else { Skip 'gpt-quota-plugin/index.mjs already correct' }
} else { Warn "missing: $indexPath" }

# ------------------------------------------------- workspace.json
$wsPath = Join-Path $DshHome 'storages\workspace.json'
if (Test-Path -LiteralPath $wsPath) {
  $raw = Read-Text $wsPath

  try { $null = $raw | ConvertFrom-Json } catch { throw "workspace.json is not valid JSON: $wsPath" }

  $pairs = @()
  foreach ($pair in $WorkspacePathMap) {
    $kv = $pair -split '=', 2
    if ($kv.Count -ne 2) { throw "bad -WorkspacePathMap entry (need old=new): $pair" }
    $pairs += , @($kv[0].TrimEnd('\'), $kv[1].TrimEnd('\'))
  }

  $text = $raw
  $edits = 0

  if ($ClearWorkspaces) {
    foreach ($m in [regex]::Matches($raw, '"workspaces"\s*:\s*\{')) {
      $start = $m.Index + $m.Length - 1
      $depth = 0; $end = -1
      for ($i = $start; $i -lt $raw.Length; $i++) {
        switch ($raw[$i]) {
          '{' { $depth++ }
          '}' { $depth--; if ($depth -eq 0) { $end = $i; break } }
        }
        if ($end -ge 0) { break }
      }
      if ($end -gt $start) {
        $text = $text.Replace($raw.Substring($start, $end - $start + 1), '{}')
        $edits++
      }
    }
    foreach ($key in 'workspaceIds', 'archivedSessionIds', 'pinnedSessionIds') {
      $pattern = '("' + $key + '"\s*:\s*)\[(?:[^\[\]]*)\]'
      $new = [regex]::Replace($text, $pattern, '${1}[]')
      if ($new -ne $text) { $text = $new; $edits++ }
    }
    $new = [regex]::Replace($text, ',\s*"defaultWorkspaceId"\s*:\s*"[^"]*"', '')
    if ($new -ne $text) { $text = $new; $edits++ }
    if ($edits -gt 0) { Ok "workspace.json cleared ($edits edit groups)" }
  }
  else {
    $matches = [regex]::Matches($raw, '"path"\s*:\s*"((?:[^"\\]|\\.)*)"')
    foreach ($m in $matches) {
      $rawValue = $m.Groups[1].Value
      $old = $rawValue -replace '\\\\', '\'
      $new = $old
      foreach ($p in $pairs) {
        if ($old -like ($p[0] + '\*') -or $old -eq $p[0]) { $new = $p[1] + $old.Substring($p[0].Length); break }
      }
      if ($new -eq $old -and $old -like 'D:\AA12583\dsh\*') {
        $new = (Split-Path -Parent $ComponentsDir) + $old.Substring('D:\AA12583\dsh'.Length)
      }
      if ($new -eq $old -and $old -like 'C:\Users\tanyu\*') {
        $new = $env:USERPROFILE + $old.Substring('C:\Users\tanyu'.Length)
      }
      if ($new -ne $old) {
        $escaped = $new -replace '\\', '\\'
        $text = $text.Replace('"path": "' + $rawValue + '"', '"path": "' + $escaped + '"')
        $edits++
        Say "$old"
        Say "  -> $new"
      } else { Skip "unchanged: $old" }
    }
  }

  if ($edits -gt 0) {
    try { $null = $text | ConvertFrom-Json } catch { throw "refusing to write invalid JSON to $wsPath" }
    if ($WhatIfOnly) { Ok 'workspace.json would be rewritten' }
    else {
      $null = Backup-File $wsPath
      Write-Text $wsPath $text
      Ok 'workspace.json rewritten'
    }
  } else { Skip 'workspace.json needs no change' }
} else { Skip "no workspace.json at $wsPath" }

Write-Host ''
Write-Host 'Repointing finished.' -ForegroundColor Cyan
if ($portableGitFound) { Say "PortableGit : $PortableGit" }
Say 'Restart DSH (or reload the window) for profile changes to take effect.' 'Yellow'
Write-Host ''
