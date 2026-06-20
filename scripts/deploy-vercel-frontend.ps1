param(
  [string]$ProdApiUrl = 'https://api-africa.224solution.net'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '== 224Solutions / Vercel deploy ==' -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host "API de prod attendue: $ProdApiUrl"

Write-Host "`n[1/4] Build frontend..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw 'Le build frontend a échoué.'
}

Write-Host "`n[2/4] Vérification Vercel CLI..." -ForegroundColor Yellow
npx.cmd --yes vercel --version
if ($LASTEXITCODE -ne 0) {
  throw 'Impossible d’exécuter Vercel CLI.'
}

Write-Host "`n[3/4] Vérification connexion Vercel..." -ForegroundColor Yellow
npx.cmd --yes vercel whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Connecte-toi d’abord puis relance:' -ForegroundColor Red
  Write-Host '  npx.cmd --yes vercel login'
  exit 1
}

if (-not (Test-Path '.vercel\project.json')) {
  Write-Host "`nProjet non lié. Liaison Vercel..." -ForegroundColor Yellow
  npx.cmd --yes vercel link
  if ($LASTEXITCODE -ne 0) {
    throw 'La liaison Vercel a échoué.'
  }
}

Write-Host "`n[4/4] Déploiement production..." -ForegroundColor Yellow
$deployOutput = & npx.cmd --yes vercel deploy --prod --yes 2>&1
$deployOutput | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
  throw 'Le déploiement Vercel a échoué.'
}

$deploymentUrl = ($deployOutput |
  Select-String -Pattern 'https://[^\s]+\.vercel\.app' -AllMatches |
  ForEach-Object { $_.Matches.Value } |
  Select-Object -Last 1)

if (-not $deploymentUrl) {
  throw 'Impossible de déterminer l’URL du dernier déploiement Vercel.'
}

Write-Host "URL déployée: $deploymentUrl" -ForegroundColor Cyan

$productionDomains = @('www.224solution.net', '224solution.net')
foreach ($domain in $productionDomains) {
  Write-Host "Alias production -> $domain" -ForegroundColor Yellow
  & npx.cmd --yes vercel alias set $deploymentUrl $domain 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) {
    throw "La mise à jour de l’alias Vercel a échoué pour $domain."
  }
}

Write-Host ''
Write-Host 'Déploiement terminé.' -ForegroundColor Green
Write-Host "Production active: https://www.224solution.net" -ForegroundColor Green
Write-Host 'Tests conseillés :' -ForegroundColor Cyan
Write-Host '  https://www.224solution.net/health'
Write-Host '  https://www.224solution.net/edge-functions/payments/african-fx-query?base=USD&quote=GNF'
Write-Host '  https://www.224solution.net/api/payment-links/process'
