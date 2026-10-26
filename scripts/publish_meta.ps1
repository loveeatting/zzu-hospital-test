# Setup GitHub repo metadata (topics + release)
# Usage (run inside F:\zzu-hospital):
#   .\scripts\publish_meta.ps1 -Token "ghp_xxx"
#
# Create token: https://github.com/settings/tokens -> Generate new token (classic)
#   scope: repo
# NOTE: delete the token after use.

param(
    [Parameter(Mandatory = $true)]
    [string]$Token
)

$ErrorActionPreference = 'Stop'
$owner = 'loveeatting'
$repo = 'zzu-hospital-test'
$tag = 'v1.0.0'

$headers = @{
    Authorization          = "Bearer $Token"
    Accept                 = 'application/vnd.github+json'
    'User-Agent'           = $owner
    'X-GitHub-Api-Version' = '2022-11-28'
}

# ---------- 1. topics ----------
Write-Host '[1/3] Setting topics ...' -ForegroundColor Cyan
$topics = @(
    'fastapi', 'python', 'sqlite', 'llm', 'deepseek',
    'function-calling', 'rag', 'knowledge-base', 'healthcare',
    'campus', 'vanilla-js', 'prototype'
)
$body = @{ names = $topics } | ConvertTo-Json -Compress
$res = Invoke-RestMethod -Method Put `
    -Uri "https://api.github.com/repos/$owner/$repo/topics" `
    -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body
Write-Host ('      OK: ' + ($res.names -join ', ')) -ForegroundColor Green

# ---------- 2. push tag ----------
Write-Host '[2/3] Pushing git tag ...' -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $existing = git tag --list $tag
    if (-not $existing) {
        git tag -a $tag -m "prototype v1.0.0"
        Write-Host '      local tag created' -ForegroundColor Gray
    }
    git push origin $tag
    Write-Host '      tag pushed' -ForegroundColor Green
} finally {
    Pop-Location
}

# ---------- 3. release ----------
Write-Host '[3/3] Creating release ...' -ForegroundColor Cyan
$notesPath = Join-Path $PSScriptRoot '..\docs\CHANGELOG.md'
$notes = Get-Content $notesPath -Raw -Encoding UTF8
$start = $notes.IndexOf('## v1.0.0')
$end = $notes.IndexOf('## ')
if ($start -ge 0) {
    $rest = $notes.Substring($start + 3)
    $endRel = $rest.IndexOf("`n## ")
    if ($endRel -gt 0) { $bodyText = $rest.Substring(0, $endRel).Trim() } else { $bodyText = $rest.Trim() }
} else {
    $bodyText = $notes
}

$payload = @{
    tag_name         = $tag
    target_commitish = 'main'
    name             = 'Prototype v1.0.0 - AI Medical Service Platform'
    body             = $bodyText
    draft            = $false
    prerelease       = $false
} | ConvertTo-Json -Depth 5

try {
    $release = Invoke-RestMethod -Method Post `
        -Uri "https://api.github.com/repos/$owner/$repo/releases" `
        -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $payload
    Write-Host ('      release created: ' + $release.html_url) -ForegroundColor Green
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 422) {
        Write-Host '      release already exists, skipped' -ForegroundColor Yellow
    } else {
        throw
    }
}

Write-Host ''
Write-Host 'DONE' -ForegroundColor Cyan
Write-Host "  repo    : https://github.com/$owner/$repo"
Write-Host "  topics  : https://github.com/$owner/$repo"
Write-Host "  releases: https://github.com/$owner/$repo/releases"
Write-Host ''
Write-Host 'Reminder: delete the token on GitHub when finished.' -ForegroundColor Yellow
