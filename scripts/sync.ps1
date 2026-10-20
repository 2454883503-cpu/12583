<#
.SYNOPSIS
    DSH 双机同步仓库的日常同步命令：拉取 / 推送 / 查看状态。

.DESCRIPTION
    pull   —— 取回另一台机器推到远端的改动，并自动还原成本机路径、按需重装依赖
    push   —— 提交本机所有改动（插源码、文档、配置模板）并推送到远端
    status —— 只看有没有未提交/未推送的内容

    典型动线：
        电脑 A：capture-profile.ps1  →  sync.ps1 push
        电脑 B：sync.ps1 pull
        改了插件源码后，两边都是 sync.ps1 push

.PARAMETER Action
    pull（默认）/ push / status

.PARAMETER Message
    push 时的提交说明。不填会自动生成。

.PARAMETER Remote / Branch
    远端名与分支名，默认 origin / main。

.PARAMETER NoInstall
    pull 后即使依赖清单变了也不自动安装。

.EXAMPLE
    .\scripts\sync.ps1 pull

.EXAMPLE
    .\scripts\sync.ps1 push -Message "更新 GPT 配额浮窗"
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('pull', 'push', 'status')]
    [string]$Action = 'pull',

    [string]$Message = '',
    [string]$Remote = '',
    [string]$Branch = 'main',
    [switch]$NoInstall
)

. (Join-Path $PSScriptRoot 'common.ps1')

$RepoRoot = Get-RepoRoot
$git = Find-Git
$DshHome = Get-DshHome

# ---- 远端地址：命令行 > remote.conf > 已配置的 origin ----
if (-not $Remote) { $Remote = Get-ConfiguredRemote -RepoRoot $RepoRoot }

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
    & $git -C $RepoRoot @GitArgs
    if ($LASTEXITCODE -ne 0) { throw ("git " + ($GitArgs -join ' ') + " 失败（返回码 " + $LASTEXITCODE + "）") }
}

function Assert-Remote {
    if (-not $Remote) {
        throw @"
还没有配置远端。三选一：
  1) 编辑 scripts\remote.conf，把 ORIGIN= 后面填成仓库地址
  2) git remote add origin <地址>
  3) 命令行指定： .\scripts\sync.ps1 $Action -Remote <地址>
"@
    }
    $existing = (& $git -C $RepoRoot remote) -split "`n" | Where-Object { $_.Trim() }
    if ($existing -notcontains $Remote) {
        # $Remote 既可能是名字（origin），也可能直接给了地址；给了地址就顺手建成 origin
        if ($Remote -match '^(https?://|git@|ssh://|file://|[A-Za-z]:[\\/]|\\\\|\.{0,2}[\\/])') {
            $addr = $Remote
            $Remote = 'origin'
            Write-Step ('添加远端 origin -> ' + $addr)
            Invoke-Git remote add $Remote $addr
        }
    }
}

# ================================================================ status
if ($Action -eq 'status') {
    Write-Host ''
    Write-Host ('  仓库: ' + $RepoRoot) -ForegroundColor White
    Write-Host ''

    Write-Step '未提交的改动'
    $changes = & $git -C $RepoRoot status --short
    if ($changes) { $changes | Select-Object -First 40 | ForEach-Object { Write-Host ('    ' + $_) } }
    else { Write-Ok '工作区干净' }

    Write-Step '未推送的提交'
    if ($Remote) {
        $ahead = & $git -C $RepoRoot log --oneline ("{0}/{1}..HEAD" -f $Remote, $Branch) 2>$null
        if ($ahead) { $ahead | ForEach-Object { Write-Host ('    ' + $_) } } else { Write-Ok '与远端一致' }
    } else {
        Write-Warn2 '尚未配置远端（scripts\remote.conf）'
    }

    Write-Step '最近 5 次提交'
    & $git -C $RepoRoot log --oneline -5 2>$null | ForEach-Object { Write-Host ('    ' + $_) }
    Write-Host ''
    return
}

# ================================================================ pull
if ($Action -eq 'pull') {
    Assert-Remote
    Write-Host ''
    Write-Host ('  拉取 ' + $Remote + '/' + $Branch + ' 到 ' + $RepoRoot) -ForegroundColor White
    Write-Host ''

    # 本地未提交改动先 stash，否则 rebase 会拒绝执行
    $dirty = & $git -C $RepoRoot status --porcelain
    if ($dirty) {
        Write-Step '本地有未提交改动，先 stash'
        Invoke-Git stash push -u -m ('sync-pull ' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        $stashed = $true
        Write-Ok '已暂存'
    } else {
        $stashed = $false
    }

    $depFile = Join-Path $RepoRoot 'config\profiles\desktop\package.json'
    $before = if (Test-Path $depFile) { (Get-FileHash $depFile -Algorithm SHA256).Hash } else { '' }

    Write-Step 'git pull --rebase'
    Invoke-Git pull --rebase $Remote $Branch
    Write-Ok '已更新'

    Write-Step '把模板还原成本机路径并写回 DSH'
    $map = @(
        @{ From = 'desktop\package.json';     To = (Join-Path $DshHome 'profiles\desktop\package.json') },
        @{ From = 'desktop\cordis.patch.yml'; To = (Join-Path $DshHome 'profiles\desktop\cordis.patch.yml') },
        @{ From = 'web\package.json';         To = (Join-Path $DshHome 'profiles\web\package.json') },
        @{ From = 'headless\package.json';    To = (Join-Path $DshHome 'profiles\headless\package.json') }
    )
    foreach ($item in $map) {
        $src = Join-Path (Join-Path $RepoRoot 'config\profiles') $item.From
        if (-not (Test-Path $src)) { continue }
        $dst = $item.To
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }

        $text = [System.IO.File]::ReadAllText($src, [System.Text.UTF8Encoding]::new($false))
        $expanded = Expand-RepoPlaceholders -Text $text -RepoRoot $RepoRoot
        $current = if (Test-Path $dst) { [System.IO.File]::ReadAllText($dst, [System.Text.UTF8Encoding]::new($false)) } else { $null }

        if ($current -ne $expanded) {
            if ($null -ne $current) { Copy-Item $dst ($dst + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) -Force }
            [System.IO.File]::WriteAllText($dst, $expanded, [System.Text.UTF8Encoding]::new($false))
            Write-Ok (($item.From -replace '\\', '/') + ' 已更新')
        } else {
            Write-Ok (($item.From -replace '\\', '/') + ' 无变化')
        }
    }

    $after = if (Test-Path $depFile) { (Get-FileHash $depFile -Algorithm SHA256).Hash } else { '' }
    if (-not $NoInstall -and $before -ne $after) {
        Write-Step '插件依赖清单有变化，重新安装'
        $dshCmd = Get-DshExe
        if ($dshCmd) {
            Push-Location $RepoRoot
            try { & $dshCmd plugin --profile desktop install } finally { Pop-Location }
            Write-Ok '依赖已重装'
        } else {
            Write-Warn2 '找不到 dsh.cmd，请手动执行：dsh plugin --profile desktop install'
        }
    } else {
        Write-Ok '依赖清单无变化，跳过安装'
    }

    if ($stashed) {
        Write-Step '恢复本地未提交改动'
        & $git -C $RepoRoot stash pop
        if ($LASTEXITCODE -ne 0) {
            Write-Warn2 'stash 恢复有冲突，改动仍在 git stash 里，用 git stash list / git stash pop 手动处理。'
        } else {
            Write-Ok '已恢复'
        }
    }

    Write-Host ''
    Write-Host '  拉取完成。重启 DSH 让配置生效。' -ForegroundColor Green
    Write-Host ''
    return
}

# ================================================================ push
Assert-Remote
Write-Host ''
Write-Host ('  提交并推送到 ' + $Remote + '/' + $Branch) -ForegroundColor White
Write-Host ''

Write-Step '检查会被提交的内容'
& $git -C $RepoRoot add -A
$staged = & $git -C $RepoRoot diff --cached --stat
if (-not $staged) {
    Write-Ok '没有需要提交的改动'
} else {
    $staged | Select-Object -Last 20 | ForEach-Object { Write-Host ('    ' + $_) }

    # 提交前兜底：命中的密钥文件一律拦下（.env.example 这类模板不算）
    $blocked = @(& $git -C $RepoRoot diff --cached --name-only) | Where-Object {
        ($_ -notmatch '\.(example|sample|template)$') -and (
            $_ -match '(^|/)(\.credentials|\.env|secrets/|auth\.json|codex-auth\.json|\.bridge-token)' -or
            $_ -match '\.(pem|key)$'
        )
    }
    if ($blocked) {
        Write-Host ''
        Write-Warn2 '检测到疑似密钥文件，已取消本次提交：'
        $blocked | ForEach-Object { Write-Host ('      ' + $_) -ForegroundColor Red }
        & $git -C $RepoRoot reset | Out-Null
        throw '请把这些文件从仓库中移除（或加进 .gitignore）后重试。'
    }

    if (-not $Message) {
        $count = (@(& $git -C $RepoRoot diff --cached --name-only) | Measure-Object).Count
        $Message = ('同步: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ' (' + $count + ' 个文件)')
    }
    Write-Step ('提交: ' + $Message)
    Invoke-Git commit -m $Message
    Write-Ok '已提交'
}

Write-Step '推送到远端'
& $git -C $RepoRoot push -u $Remote $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Warn2 '推送失败：远端可能有另一台机器的新提交，先执行 sync.ps1 pull 再推。'
} else {
    Write-Ok '已推送'
}

Write-Host ''
