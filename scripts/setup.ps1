<#
.SYNOPSIS
    在「另一台电脑」上把这份同步仓库部署成可用的 DSH 插件环境。

.DESCRIPTION
    做四件事（都可单独跳过）：
      1. 按本机实际路径，把 config/ 里的配置模板还原成 ~/.dsh/profiles/desktop 的真实配置
      2. 用 DSH 自带的 pnpm 安装插件依赖（link: 依赖指向本仓库里的源码）
      3. 部署桌面宠物资源到 ~/.dsh/desktop-pet/pets
      4. 设置 DSH_IDE_GIT_BIN（dsh-ide-git 不读 PATH，只认这个环境变量）

.PARAMETER RepoRoot
    本仓库在本机的位置。默认就是脚本所在的仓库。

.PARAMETER DshHome
    DSH 主目录。默认取 $env:DSH_HOME，没有就用 %USERPROFILE%\.dsh。

.PARAMETER SkipInstall
    跳过 pnpm 安装（网络不通或只想先铺配置文件时用）。

.PARAMETER Force
    配置目标已存在时直接覆盖（默认会先备份成 .bak-时间戳）。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = '',
    [string]$DshHome = '',
    [switch]$SkipInstall,
    [switch]$Force
)

. (Join-Path $PSScriptRoot 'common.ps1')

if (-not $RepoRoot) { $RepoRoot = Get-RepoRoot }
$RepoRoot = (Resolve-Path $RepoRoot).Path
if (-not $DshHome) { $DshHome = Get-DshHome }
$DshHome = (Resolve-Path $DshHome).Path

Write-Host ''
Write-Host '  DSH 双机同步 —— 本机部署' -ForegroundColor White
Write-Host ('  仓库:      ' + $RepoRoot)
Write-Host ('  DSH_HOME:  ' + $DshHome)
Write-Host ('  用户目录:  ' + $env:USERPROFILE)
Write-Host ''

# ---------------------------------------------------------------- 1. 配置
Write-Step '1/4 还原 profile 配置'

$configSrc = Join-Path $RepoRoot 'config\profiles'
if (-not (Test-Path $configSrc)) { throw "仓库缺少 config\profiles 目录：$configSrc" }

# 要还原的文件：desktop 的 package.json / cordis.patch.yml，其余 profile 的 package.json
$map = @(
    @{ From = 'desktop\package.json';       To = (Join-Path $DshHome 'profiles\desktop\package.json') },
    @{ From = 'desktop\cordis.patch.yml';   To = (Join-Path $DshHome 'profiles\desktop\cordis.patch.yml') },
    @{ From = 'web\package.json';           To = (Join-Path $DshHome 'profiles\web\package.json') },
    @{ From = 'headless\package.json';      To = (Join-Path $DshHome 'profiles\headless\package.json') }
)

foreach ($item in $map) {
    $src = Join-Path $configSrc $item.From
    if (-not (Test-Path $src)) { Write-Warn2 ("模板不存在，跳过: " + $item.From); continue }

    $dst = $item.To
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }

    if ((Test-Path $dst) -and -not $Force) {
        $bak = $dst + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
        Copy-Item $dst $bak -Force
        Write-Warn2 ("已备份现有文件 -> " + (Split-Path $bak -Leaf))
    }

    $text = [System.IO.File]::ReadAllText($src, [System.Text.UTF8Encoding]::new($false))
    $expanded = Expand-RepoPlaceholders -Text $text -RepoRoot $RepoRoot
    [System.IO.File]::WriteAllText($dst, $expanded, [System.Text.UTF8Encoding]::new($false))
    Write-Ok (($item.From -replace '\\', '/') + '  ->  ' + $dst)
}

# ---------------------------------------------------------------- 2. 依赖
Write-Step '2/4 安装插件依赖'

if ($SkipInstall) {
    Write-Warn2 '已跳过（-SkipInstall）。稍后手动执行：dsh plugin --profile desktop install'
} else {
    $dshCmd = Get-DshExe
    if (-not $dshCmd) {
        Write-Warn2 '没找到随 DSH 安装的 dsh.cmd，跳过安装。'
        Write-Warn2 '如果 DSH 装在别的盘，请手动在 profile 目录执行 pnpm install。'
    } else {
        Write-Ok ('使用 DSH 自带的 pnpm: ' + $dshCmd)
        Push-Location $RepoRoot
        try {
            & $dshCmd plugin --profile desktop install
            if ($LASTEXITCODE -ne 0) {
                Write-Warn2 ("安装返回码 " + $LASTEXITCODE + "，请检查上面的输出。")
            } else {
                Write-Ok '依赖安装完成'
            }
        } finally {
            Pop-Location
        }
    }
}

# ---------------------------------------------------------------- 3. 宠物
Write-Step '3/4 部署桌面宠物资源'

$petSrc = Join-Path $RepoRoot 'assets\desktop-pet\pets'
if (Test-Path $petSrc) {
    $petDst = Join-Path $DshHome 'desktop-pet\pets'
    New-Item -ItemType Directory -Force -Path $petDst | Out-Null
    Get-ChildItem $petSrc -Directory | ForEach-Object {
        $target = Join-Path $petDst $_.Name
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        Copy-Item (Join-Path $_.FullName '*') $target -Recurse -Force
        Write-Ok ('宠物 ' + $_.Name + ' -> ' + $target)
    }
} else {
    Write-Warn2 '仓库没有 assets\desktop-pet\pets，跳过。'
}

# ---------------------------------------------------------------- 4. 环境变量
Write-Step '4/4 设置 DSH_IDE_GIT_BIN'

try {
    $git = Find-Git
    $old = [Environment]::GetEnvironmentVariable('DSH_IDE_GIT_BIN', 'User')
    if ($old -eq $git) {
        Write-Ok ('已是最新: ' + $git)
    } else {
        [Environment]::SetEnvironmentVariable('DSH_IDE_GIT_BIN', $git, 'User')
        $env:DSH_IDE_GIT_BIN = $git
        Write-Ok ('写入用户环境变量: ' + $git)
        Write-Warn2 '需要重启 DSH（或重新登录）才会读到新值。'
    }
} catch {
    Write-Warn2 ('没能设置 DSH_IDE_GIT_BIN：' + $_.Exception.Message)
}

# ---------------------------------------------------------------- 完成
Write-Host ''
Write-Host '  部署完成。' -ForegroundColor Green
Write-Host ''
Write-Host '  接下来：'
Write-Host '    1. 完全退出 DSH 再启动（配置与 bundle 列表在启动时读取）'
Write-Host '    2. 需要把另一台机器的配置改动同步过来：  .\scripts\sync.ps1 pull'
Write-Host '    3. 需要把本机配置改动存回仓库：          .\scripts\capture-profile.ps1'
Write-Host ''
