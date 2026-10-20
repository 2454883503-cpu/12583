# Windows 资源管理器里双击即可（右键 → 使用 PowerShell 运行）

<#
  双击快捷入口：默认执行 pull（把另一台电脑的改动取回来并应用到本机）。
  需要别的动作就开终端手敲：
      .\scripts\sync.ps1 push
      .\scripts\sync.ps1 status
#>

$script = Join-Path $PSScriptRoot 'sync.ps1'
& $script pull
Write-Host ''
Read-Host '按回车关闭'
