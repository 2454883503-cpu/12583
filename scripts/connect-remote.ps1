<#
.SYNOPSIS
    把本仓库接到一个真正的远端（GitHub / Gitee / 任意 git 服务器），一条命令搞定。

.DESCRIPTION
    仓库当前 origin 指向本地离线备份库（D:\AA12583\dsh-backup\dsh-components.git），
    换电脑带不走。本脚本做四件事：

      1. 配好 github.com 的本地代理（这台机器直连不通，必须走 127.0.0.1:7892）
      2. 把 origin 改指向你给的地址，原离线库改名为 backup 继续保留
      3. 首次推送全部分支与标签
      4. 把地址写回 scripts\remote.conf，之后 sync.ps1 直接用

.PARAMETER Url
    远端地址。GitHub 形如 https://github.com/<你>/dsh-components.git
    （私有仓库！仓库里含完整安装快照与文档）

.PARAMETER Token
    可选。GitHub PAT（classic 需 repo 权限）。给了就写进本机凭据管理器，
    不用每次输密码；不给就走交互式登录。

.EXAMPLE
    .\scripts\connect-remote.ps1 -Url https://github.com/yourname/dsh-components.git

.EXAMPLE
    .\scripts\connect-remote.ps1 -Url https://gitee.com/yourname/dsh-components.git
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [string]$Token = ''
)

. (Join-Path $PSScriptRoot 'common.ps1')

$RepoRoot = Get-RepoRoot
$git = Find-Git
$backupUrl = 'D:\AA12583\dsh-backup\dsh-components.git'

Write-Host ''
Write-Host ('  接入远端: ' + $Url) -ForegroundColor White
Write-Host ''

# ---------------------------------------------------------------- 1. 代理
Write-Step '1/4 配置 github 代理'
& $git -C $RepoRoot config 'http.https://github.com.proxy' 'http://127.0.0.1:7892'
& $git -C $RepoRoot config 'http.https://api.github.com.proxy' 'http://127.0.0.1:7892'
Write-Ok 'github.com -> 127.0.0.1:7892（本机代理，实测直连不通）'
Write-Warn2 '如果代理端口不是 7892，改本脚本第 1 步或 git config 手动调'

# ---------------------------------------------------------------- 2. 换 origin
Write-Step '2/4 调整远端'
$remotes = (& $git -C $RepoRoot remote) -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }

if ($remotes -contains 'origin') {
    $cur = (& $git -C $RepoRoot remote get-url origin).Trim()
    if ($cur -ne $Url) {
        & $git -C $RepoRoot remote remove origin
        Write-Ok ('旧 origin 已移除: ' + $cur)
    }
}
if (-not ((& $git -C $RepoRoot remote) -match 'backup')) {
    if (Test-Path $backupUrl) {
        & $git -C $RepoRoot remote add backup $backupUrl
        Write-Ok ('离线备份库保留为 backup: ' + $backupUrl)
    }
}
& $git -C $RepoRoot remote add origin $Url
Write-Ok ('origin -> ' + $Url)

# ---------------------------------------------------------------- 3. 凭据
Write-Step '3/4 凭据'
$host_ = ([System.Uri]$Url).Host
if ($Token) {
    # 写进本机凭据管理器（不进仓库、不进 shell 历史）
    $helper = (& $git config --global credential.helper)
    if (-not $helper) {
        & $git config --global credential.helper manager
        Write-Ok '已启用 Git Credential Manager'
    }
    $basic = 'x-access-token:' + $Token
    $enc = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($basic))
    $env:GIT_TERMINAL_PROMPT = '0'
    $pushUrl = $Url -replace '^https://', ('https://x-access-token:' + $Token + '@')
    & $git -C $RepoRoot remote set-url origin $pushUrl
    Write-Ok '已把 token 写入 origin URL（仅存储在本机 .git/config，未进版本库）'
} else {
    Write-Ok '未提供 -Token，推送时按提示登录即可'
}

# ---------------------------------------------------------------- 4. 推送
Write-Step '4/4 推送全部分支'
& $git -C $RepoRoot push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Warn2 '推送失败。常见原因：'
    Write-Warn2 '  · 仓库还没在网页上建（先 Create repository，不要初始化 README）'
    Write-Warn2 '  · token 权限不够（classic PAT 需要 repo 权限）'
    Write-Warn2 '  · 代理端口不对'
    Write-Host ''
    return
}
& $git -C $RepoRoot push --tags 2>$null
Write-Ok '已推送'

# 写回 remote.conf
$conf = Join-Path $RepoRoot 'scripts\remote.conf'
$safeUrl = ($Url -replace '//[^@]*@', '//')    # 不把 token 写进明文配置
$content = @(
    '# 由 connect-remote.ps1 自动写入',
    '# 这里只存不含凭据的地址；密码/token 由 git 凭据管理器保管',
    ('ORIGIN=' + $safeUrl)
)
[System.IO.File]::WriteAllText($conf, (($content -join "`r`n") + "`r`n"), [System.Text.UTF8Encoding]::new($false))
Write-Ok ('写入 ' + $conf)

Write-Host ''
Write-Host '  完成。另一台电脑上：' -ForegroundColor Green
Write-Host ('    git clone ' + $safeUrl + ' D:\AA12583\dsh\组件')
Write-Host '    cd D:\AA12583\dsh\组件'
Write-Host '    powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1'
Write-Host ''
