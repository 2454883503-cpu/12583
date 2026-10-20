<#
.SYNOPSIS
    把本机 DSH 的实时配置「回填」成仓库里的可移植模板，然后提交。

.DESCRIPTION
    你可能直接在 DSH 界面里改了主题、切换了默认模型、装了新插件。
    这些改动只会落在 %USERPROFILE%\.dsh\profiles 下的真实文件里，仓库不知道。
    本脚本把它反向处理一遍：

        ~/.dsh/profiles/desktop/package.json      ──┐
        ~/.dsh/profiles/desktop/cordis.patch.yml   ──┼─>  config/profiles/...   （绝对路径 → 占位符）
        ~/.dsh/profiles/web|headless/package.json ──┘

    然后（可选）直接 commit + push。

.PARAMETER NoCommit
    只回填文件，不提交。

.PARAMETER Push
    提交后顺便推送。

.EXAMPLE
    .\scripts\capture-profile.ps1 -Push
#>
[CmdletBinding()]
param(
    [switch]$NoCommit,
    [switch]$Push
)

. (Join-Path $PSScriptRoot 'common.ps1')

$RepoRoot = Get-RepoRoot
$DshHome = Get-DshHome

Write-Host ''
Write-Host '  把本机配置回填成仓库模板' -ForegroundColor White
Write-Host ('  来源: ' + $DshHome)
Write-Host ''

$map = @(
    @{ From = (Join-Path $DshHome 'profiles\desktop\package.json');     To = 'desktop\package.json' },
    @{ From = (Join-Path $DshHome 'profiles\desktop\cordis.patch.yml'); To = 'desktop\cordis.patch.yml' },
    @{ From = (Join-Path $DshHome 'profiles\web\package.json');         To = 'web\package.json' },
    @{ From = (Join-Path $DshHome 'profiles\headless\package.json');    To = 'headless\package.json' }
)

$changed = 0
foreach ($item in $map) {
    if (-not (Test-Path $item.From)) {
        Write-Warn2 ('本机不存在，跳过: ' + $item.From)
        continue
    }
    $text = [System.IO.File]::ReadAllText($item.From, [System.Text.UTF8Encoding]::new($false))
    $templated = Compress-RepoPlaceholders -Text $text -RepoRoot $RepoRoot

    $dst = Join-Path (Join-Path $RepoRoot 'config\profiles') $item.To
    if (-not (Test-Path (Split-Path $dst -Parent))) {
        New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
    }
    $old = if (Test-Path $dst) { [System.IO.File]::ReadAllText($dst, [System.Text.UTF8Encoding]::new($false)) } else { $null }

    if ($old -eq $templated) {
        Write-Ok (($item.To -replace '\\', '/') + ' 无变化')
    } else {
        # 兜底：模板里绝不能留下本机绝对路径
        if ($templated -match [regex]::Escape((To-PosixPath $RepoRoot))) {
            Write-Warn2 (($item.To -replace '\\', '/') + ' 里还残留本机路径，请人工检查后再提交')
        }
        [System.IO.File]::WriteAllText($dst, $templated, [System.Text.UTF8Encoding]::new($false))
        Write-Ok (($item.To -replace '\\', '/') + ' 已更新')
        $changed++
    }
}

Write-Host ''
if ($changed -eq 0) {
    Write-Host '  配置模板没有变化。' -ForegroundColor Green
} else {
    Write-Host ('  已更新 ' + $changed + ' 个模板文件。') -ForegroundColor Green
}

if ($NoCommit) {
    Write-Host '  （-NoCommit：不提交）'
    Write-Host ''
    return
}

# 只提交 config 目录，避免把不相干的半成品一起带上
$git = Find-Git
& $git -C $RepoRoot add -- 'config/profiles'
$staged = & $git -C $RepoRoot diff --cached --name-only
if (-not $staged) {
    Write-Host '  没有需要提交的内容。'
    Write-Host ''
    return
}

$msg = '配置同步: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
& $git -C $RepoRoot commit -m $msg
if ($LASTEXITCODE -ne 0) { throw '提交失败，请看上面的 git 输出。' }
Write-Ok ('已提交: ' + $msg)

if ($Push) {
    $remote = Get-ConfiguredRemote -RepoRoot $RepoRoot
    if (-not $remote) { $remote = 'origin' }
    & $git -C $RepoRoot push -u $remote main
    if ($LASTEXITCODE -ne 0) {
        Write-Warn2 '推送失败：远端可能有新提交，先 sync.ps1 pull 再推。'
    } else {
        Write-Ok '已推送到远端'
    }
}

Write-Host ''
