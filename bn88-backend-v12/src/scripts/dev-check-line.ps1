param(
  [string]$Base   = "http://127.0.0.1:3000/api",  # ฐาน API
  [string]$Tenant = "bn9",                        # tenant ปัจจุบัน
  [string]$BotId  = ""                            # ถ้าว่าง จะเลือกบอท LINE ตัวแรกที่ active ให้เอง
)

Write-Host "=== BN9 LINE CHECK ===" -ForegroundColor Cyan

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
# 3) เลือกบอท LINE
# --------------------------------------------------------------------
Write-Host "`n#3) GET /bots (เลือกบอท LINE)" -ForegroundColor Yellow
$bots = Invoke-RestMethod "$Base/bots" -Headers $H
$bots.items | Format-Table id,name,platform,active

if ([string]::IsNullOrWhiteSpace($BotId)) {
  $BotId = ($bots.items | Where-Object { $_.platform -eq "line" -and $_.active } | Select-Object -First 1).id
}

if (-not $BotId) { throw "no line bot found" }
Write-Host "use botId = $BotId" -ForegroundColor Green

# --------------------------------------------------------------------
# 4) ตรวจ secrets ของบอท
# --------------------------------------------------------------------
Write-Host "`n#4) GET /admin/bots/$BotId/secrets" -ForegroundColor Yellow
$secrets = Invoke-RestMethod "$Base/admin/bots/$BotId/secrets" -Headers $H
$secrets | Format-List

if (-not $secrets.lineAccessToken -or -not $secrets.lineChannelSecret) {
  Write-Host "⚠ ยังไม่ได้ตั้ง LINE Access Token หรือ Channel Secret ให้บอทนี้" -ForegroundColor Red
} else {
  Write-Host "secrets ok (masked) ✅" -ForegroundColor Green
}

# --------------------------------------------------------------------
# 5) ยิง /dev/line-ping/:botId
# --------------------------------------------------------------------
Write-Host "`n#5) GET /dev/line-ping/$BotId" -ForegroundColor Yellow
try {
  $ping = Invoke-RestMethod "$Base/dev/line-ping/$BotId" -Headers $H
  $ping | Format-List

  if ($ping.ok -and $ping.status -eq 200) {
    Write-Host "LINE ping OK (status 200) ✅" -ForegroundColor Green
  } else {
    Write-Host "LINE ping FAILED ❌ -> $($ping | ConvertTo-Json -Compress)" -ForegroundColor Red
  }
}
catch {
  Write-Host "LINE ping ERROR ❌" -ForegroundColor Red
  Write-Host $_.Exception.Message
}

Write-Host "`n=== LINE CHECK DONE ===" -ForegroundColor Cyan
