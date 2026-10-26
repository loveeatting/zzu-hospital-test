# 触发 Render 重新部署
# 用法：.\scripts\deploy.ps1            （读取 ../.render-hook）
#       .\scripts\deploy.ps1 -Wait      （触发后等待服务恢复）

param([switch]$Wait)

$ErrorActionPreference = 'Stop'
$hookFile = Join-Path $PSScriptRoot '..\.render-hook'

if (-not (Test-Path $hookFile)) {
    Write-Host "找不到 .render-hook 文件：" -ForegroundColor Red
    Write-Host "  $hookFile" -ForegroundColor Gray
    Write-Host "请把 Render 的 Deploy Hook 地址写进该文件（一行）" -ForegroundColor Gray
    exit 1
}

$hook = (Get-Content $hookFile -Raw).Trim()
Write-Host '触发 Render 部署 ...' -ForegroundColor Cyan

try {
    $resp = Invoke-RestMethod -Uri $hook -Method Post -TimeoutSec 30
    Write-Host ('  部署已开始，deploy id: ' + $resp.deploy.id) -ForegroundColor Green
} catch {
    Write-Host ('  触发失败：' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}

if (-not $Wait) {
    Write-Host '提示：加 -Wait 参数可等待部署完成（约 2-5 分钟）' -ForegroundColor Gray
    exit 0
}

Write-Host ''
Write-Host '等待服务恢复（每 20 秒探测一次）...' -ForegroundColor Cyan
$url = 'https://zzu-xiaoyitong.top/api/departments'
for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Seconds 20
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        if ($r.StatusCode -eq 200) {
            Write-Host ("  第 {0} 次：服务已恢复 ✅" -f $i) -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host ("  第 {0} 次：构建/重启中..." -f $i) -ForegroundColor Gray
    }
}
Write-Host '等待超时，请到 Render 后台查看部署状态' -ForegroundColor Yellow