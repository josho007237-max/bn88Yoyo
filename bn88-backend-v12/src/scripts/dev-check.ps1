param(
  [string]$Base = "http://127.0.0.1:3000/api",
  [string]$Tenant = "bn9"
)

Write-Host "=== BN9 DEV CHECK ===" -ForegroundColor Cyan

# --------------------------------------------------------------------
# 1) /health
# --------------------------------------------------------------------
Write-Host "`n#1) GET /health" -ForegroundColor Yellow
$health = Invoke-RestMethod "$Base/health"
$health | Format-Table
if (-not $health.ok) { throw "health not ok" }

# --------------------------------------------------------------------
# 2) login admin (JWT)
# --------------------------------------------------------------------
Write-Host "`n#2) POST /auth/login (admin)" -ForegroundColor Yellow
$body = @{ email = "root@bn9.local"; password = "bn9@12345" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$Base/auth/login" `
  -ContentType "application/json" -Body $body

$token = $login.token
if (-not $token) { throw "no token from login" }
$H = @{
  Authorization = "Bearer $token"
  "x-tenant"    = $Tenant
}
Write-Host "login ok, token acquired" -ForegroundColor Green

# --------------------------------------------------------------------
# 3) list bots
# --------------------------------------------------------------------
Write-Host "`n#3) GET /bots" -ForegroundColor Yellow
$bots = Invoke-RestMethod "$Base/bots" -Headers $H
$bots.items | Format-Table id,name,platform

$botId = ($bots.items | Select-Object -First 1).id
if (-not $botId) { throw "no bot found" }
Write-Host "use botId = $botId" -ForegroundColor Green

# --------------------------------------------------------------------
# 4) GET /admin/bots/:id/secrets (ทดสอบ JWT + guard admin)
# --------------------------------------------------------------------
Write-Host "`n#4) GET /admin/bots/$botId/secrets" -ForegroundColor Yellow
$secrets = Invoke-RestMethod "$Base/admin/bots/$botId/secrets" -Headers $H
$secrets | Format-List
Write-Host "secrets ok (masked) ✅" -ForegroundColor Green

# --------------------------------------------------------------------
# 5) GET /dev/line-ping/:botId  (ไม่บังคับต้องผ่าน แค่โชว์สถานะ)
# --------------------------------------------------------------------
Write-Host "`n#5) GET /dev/line-ping/$botId" -ForegroundColor Yellow
try {
  $ping = Invoke-RestMethod "$Base/dev/line-ping/$botId" -Headers $H
  $ping | Format-List
  if ($ping.ok -and $ping.status -eq 200) {
    Write-Host "line ping status = 200 (OK)" -ForegroundColor Green
  } else {
    Write-Host "line ping status = $($ping.status) ($($ping.message))" -ForegroundColor DarkYellow
  }
} catch {
  Write-Host "line ping error: $($_.Exception.Message)" -ForegroundColor Red
}

# --------------------------------------------------------------------
# 6) GET /stats/daily?botId=...
# --------------------------------------------------------------------
Write-Host "`n#6) GET /stats/daily" -ForegroundColor Yellow
$daily = Invoke-RestMethod "$Base/stats/daily?botId=$botId" -Headers $H
$daily | Format-List

# --------------------------------------------------------------------
# 7) GET /cases/recent?botId=...&limit=5
# --------------------------------------------------------------------
Write-Host "`n#7) GET /cases/recent" -ForegroundColor Yellow
$cases = Invoke-RestMethod "$Base/cases/recent?botId=$botId&limit=5" -Headers $H
$cases.items | Format-Table id,userId,text,kind,createdAt

Write-Host "`nALL CHECKS PASSED ✅" -ForegroundColor Green
