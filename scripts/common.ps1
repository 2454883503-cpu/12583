<#
.SYNOPSIS
    DSH 双机同步仓库 —— 公共函数库（由 setup.ps1 / sync.ps1 / capture-profile.ps1 点引用）

.NOTES
    只做四件事：定位仓库根、定位 DSH_HOME、找 git、处理占位符。
    兼容 Windows PowerShell 5.1 与 PowerShell 7。
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------- 仓库与路径 ----------

function Get-RepoRoot {
    # scripts/ 的上一级就是仓库根
    return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function To-PosixPath {
    param([Parameter(Mandatory)][string]$Path)
    return ($Path -replace '\\', '/')
}

function Get-ComponentUri {
    param([Parameter(Mandatory)][string]$Path)
    # 转成 file:///D:/xxx/%E7%BB%84... 这种可直接写进 YAML 的绝对 URI
    return ([System.Uri]$Path).AbsoluteUri.TrimEnd('/')
}

function Get-DshHome {
    if ($env:DSH_HOME -and (Test-Path $env:DSH_HOME)) { return $env:DSH_HOME }
    $fallback = Join-Path $env:USERPROFILE '.dsh'
    if (Test-Path $fallback) { return $fallback }
    throw "找不到 DSH 主目录：既没有设置 DSH_HOME，也不存在 $fallback。(DSH 是否已安装？)"
}

function Get-DshExe {
    # 依次从注册表安装目录里找 DeepSeek Harness.exe 与随包的 runtime\cli\bin\dsh.cmd
    $roots = @()
    $uninstallKeys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    foreach ($k in $uninstallKeys) {
        Get-ItemProperty $k -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -like 'DeepSeek Harness*' -and $_.InstallLocation } |
            ForEach-Object { $roots += $_.InstallLocation }
    }
    $roots += 'D:\AA12583\dsh'
    foreach ($r in ($roots | Select-Object -Unique)) {
        $cmd = Join-Path $r 'resources\runtime\cli\bin\dsh.cmd'
        if (Test-Path $cmd) { return $cmd }
    }
    return $null
}

# ---------- git ----------

function Find-Git {
    <# 这台机器上 git 可能没进 PATH：依次试环境变量、PATH、PortableGit、Fork 内置、常见安装位置 #>
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:DSH_SYNC_GIT) { $candidates.Add($env:DSH_SYNC_GIT) }
    $onPath = Get-Command git -ErrorAction SilentlyContinue
    if ($onPath) { $candidates.Add($onPath.Source) }
    $candidates.Add((Join-Path $env:USERPROFILE '.workbuddy\binaries\PortableGit\versions\1.2.0\cmd\git.exe'))
    $candidates.Add((Join-Path $env:ProgramFiles 'Git\cmd\git.exe'))
    $candidates.Add((Join-Path ${env:ProgramFiles(x86)} 'Git\cmd\git.exe'))
    $candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe'))
    # Fork 自带的 git：版本目录名不固定，取最新的
    $forkRoot = Join-Path $env:LOCALAPPDATA 'Fork\gitInstance'
    if (Test-Path $forkRoot) {
        Get-ChildItem $forkRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { $candidates.Add((Join-Path $_.FullName 'cmd\git.exe')) }
    }
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    throw @"
找不到 git 可执行文件。请先安装 git（https://git-scm.com/download/win），
或用环境变量指定：
    setx DSH_SYNC_GIT "C:\Program Files\Git\cmd\git.exe"
然后重开终端再运行本脚本。
"@
}

# ---------- 占位符 ----------

function Get-WorkbuddyPluginDir {
    <# WorkBuddy 插件目录：环境变量 > 仓库内副本 > 用户目录下的独立开发目录 #>
    param([Parameter(Mandatory)][string]$RepoRoot)
    if ($env:DSH_WORKBUDDY_PLUGIN -and (Test-Path $env:DSH_WORKBUDDY_PLUGIN)) { return $env:DSH_WORKBUDDY_PLUGIN }
    $inRepo = Join-Path $RepoRoot 'workbuddy-to-dsh\dsh-plugin'
    if (Test-Path $inRepo) { return $inRepo }
    return (Join-Path $env:USERPROFILE 'workbuddy-to-dsh\dsh-plugin')
}

function Expand-RepoPlaceholders {
    <# 把仓库模板里的 @DSH_COMPONENTS@ / @COMPONENT_URI@ / @USERPROFILE@ 换成本机实际路径 #>
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][string]$RepoRoot
    )
    $posix = To-PosixPath $RepoRoot
    $uri = Get-ComponentUri $RepoRoot
    $profile = To-PosixPath $env:USERPROFILE
    $wb = To-PosixPath (Get-WorkbuddyPluginDir -RepoRoot $RepoRoot)
    $out = $Text
    $out = $out.Replace('@COMPONENT_URI@', $uri)      # 先换更长的 URI，避免和 @DSH_COMPONENTS@ 混淆
    $out = $out.Replace('@WORKBUDDY_PLUGIN@', $wb)
    $out = $out.Replace('@DSH_COMPONENTS@', $posix)
    $out = $out.Replace('@USERPROFILE@', $profile)
    return $out
}

function Compress-RepoPlaceholders {
    <# 反向操作：把本机绝对路径换回占位符，用于把 live 配置回填成模板 #>
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][string]$RepoRoot
    )
    $posix = To-PosixPath $RepoRoot
    $uri = Get-ComponentUri $RepoRoot
    $profile = To-PosixPath $env:USERPROFILE
    $wb = To-PosixPath (Get-WorkbuddyPluginDir -RepoRoot $RepoRoot)
    $out = $Text

    # 1) 先处理注释行里的机器路径：换成与位置无关的描述，而不是占位符。
    #    注释不参与执行，换机器后也不该产生「假差异」。
    #    同一路径可能以正斜杠或反斜杠出现，两种都要覆盖。
    foreach ($p in @($RepoRoot, $posix)) {
        if ($p) { $out = $out -replace ('(?m)^(\s*#.*?)' + [regex]::Escape($p)), '$1<本仓库>' }
    }
    foreach ($p in @($env:USERPROFILE, $profile)) {
        if ($p) { $out = $out -replace ('(?m)^(\s*#.*?)' + [regex]::Escape($p)), '$1<用户目录>' }
    }

    # 2) 真正的配置值：按「长的先换」避免前缀互相吃掉
    $out = $out.Replace('file://' + $uri + '/', '@COMPONENT_URI@/')   # 兼容旧写法
    $out = $out.Replace($uri + '/', '@COMPONENT_URI@/')
    $out = $out.Replace($uri, '@COMPONENT_URI@')
    $out = $out.Replace($wb, '@WORKBUDDY_PLUGIN@')
    $out = $out.Replace($posix, '@DSH_COMPONENTS@')
    $out = $out.Replace($RepoRoot, '@DSH_COMPONENTS@')
    $out = $out.Replace($profile, '@USERPROFILE@')
    $out = $out.Replace($env:USERPROFILE, '@USERPROFILE@')
    return $out
}

# ---------- 远端配置 ----------

function Get-ConfiguredRemote {
    <# 从 scripts\remote.conf 读 ORIGIN=；没配返回空串 #>
    param([Parameter(Mandatory)][string]$RepoRoot)
    $conf = Join-Path $RepoRoot 'scripts\remote.conf'
    if (-not (Test-Path $conf)) { return '' }
    foreach ($line in (Get-Content $conf -Encoding UTF8)) {
        if ($line -match '^\s*ORIGIN\s*=\s*(.+?)\s*$') {
            $val = $Matches[1].Trim('"', "'")
            if ($val) { return $val }
        }
    }
    return ''
}

# ---------- 输出小工具 ----------

function Write-Step([string]$Text) { Write-Host ("==> " + $Text) -ForegroundColor Cyan }
function Write-Ok([string]$Text)   { Write-Host ("    OK  " + $Text) -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host ("    !   " + $Text) -ForegroundColor Yellow }
