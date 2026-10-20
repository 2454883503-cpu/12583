# 双击即可把本机改动提交并推到远端
& (Join-Path $PSScriptRoot 'sync.ps1') push
Write-Host ''
Read-Host '按回车关闭'
