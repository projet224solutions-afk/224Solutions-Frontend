# Financial Smoke Tests (Backend Node.js)

Ce guide donne une verification rapide PASS/FAIL des flux financiers critiques migres vers Node.js.
Il est concu pour PowerShell (Windows).

## 1) Pre-requis

Definir les variables de session PowerShell:

```powershell
$env:BASE_URL = "http://localhost:3000"
$env:JWT_USER = "<JWT_USER>"
$env:JWT_ADMIN = "<JWT_ADMIN>"
$env:INTERNAL_API_KEY = "<INTERNAL_API_KEY>"
$env:TRANSACTION_SECRET_KEY = "<TRANSACTION_SECRET_KEY>"
$env:DJOMY_CLIENT_SECRET = "<DJOMY_CLIENT_SECRET>"

# Donnees de test
$env:PAYMENT_ID = "<payment_id_existant>"
$env:RECIPIENT_USER_ID = "<uuid_destinataire_avec_wallet>"
$env:AFFILIATE_TOKEN = "<affiliate_token_valide>"
$env:TEST_USER_ID = "<uuid_user_test>"
```

Helper pour afficher proprement:

```powershell
function Show-Result($name, $statusCode, $body) {
  Write-Host "`n=== $name ==="
  Write-Host "Status: $statusCode"
  try { $body | ConvertTo-Json -Depth 10 } catch { $body }
}
```

## 2) Sante API

```powershell
$r = Invoke-WebRequest -Uri "$env:BASE_URL/health" -Method GET
Show-Result "Health" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200

## 3) Payment Link (lecture + confirmation)

### 3.1 Lecture publique

```powershell
$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/payments/link/$env:PAYMENT_ID" -Method GET
Show-Result "Payment Link GET" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200 (ou 404 si ID inexistant)
- body.success = true en cas 200

### 3.2 Confirmation paiement lien

```powershell
$payload = @{
  payment_method = "OM"
  transaction_id = "txn_smoke_$(Get-Date -Format yyyyMMddHHmmss)"
  client_info = @{
    name = "Smoke User"
    email = "smoke@example.com"
    phone = "620000000"
  }
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/payments/link/$env:PAYMENT_ID/pay" -Method POST -ContentType "application/json" -Body $payload
Show-Result "Payment Link PAY" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200
- body.success = true

## 4) Wallet v2 (initialize, balance, deposit, withdraw, transfer)

### 4.1 Initialize wallet

```powershell
$headersUser = @{ Authorization = "Bearer $env:JWT_USER" }
$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/v2/wallet/initialize" -Method POST -Headers $headersUser
Show-Result "Wallet Initialize" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200 ou 201

### 4.2 Balance avant

```powershell
$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/v2/wallet/balance" -Method GET -Headers $headersUser
$before = ($r.Content | ConvertFrom-Json)
Show-Result "Wallet Balance Before" $r.StatusCode $before
```

PASS attendu:
- HTTP 200

### 4.3 Deposit idempotent (meme key 2 fois)

```powershell
$idem = "smoke-deposit-001"
$depPayload = @{
  amount = 1000
  description = "Smoke deposit"
  idempotency_key = $idem
} | ConvertTo-Json

$r1 = Invoke-WebRequest -Uri "$env:BASE_URL/api/v2/wallet/deposit" -Method POST -Headers $headersUser -ContentType "application/json" -Body $depPayload
Show-Result "Wallet Deposit #1" $r1.StatusCode ($r1.Content | ConvertFrom-Json)

$r2 = Invoke-WebRequest -Uri "$env:BASE_URL/api/v2/wallet/deposit" -Method POST -Headers $headersUser -ContentType "application/json" -Body $depPayload
Show-Result "Wallet Deposit #2 same key" $r2.StatusCode ($r2.Content | ConvertFrom-Json)

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/v2/wallet/balance" -Method GET -Headers $headersUser
$afterDeposit = ($r.Content | ConvertFrom-Json)
Show-Result "Wallet Balance After Deposit" $r.StatusCode $afterDeposit
```

PASS attendu:
- Deposit #1: HTTP 200
- Deposit #2: HTTP 200, sans double credit
- Difference balance attendue: +1000 max

### 4.4 Withdraw

```powershell
$withPayload = @{
  amount = 500
  description = "Smoke withdraw"
  idempotency_key = "smoke-withdraw-001"
} | ConvertTo-Json

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/v2/wallet/withdraw" -Method POST -Headers $headersUser -ContentType "application/json" -Body $withPayload
Show-Result "Wallet Withdraw" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200
- ou HTTP 402 si solde insuffisant (cas negatif attendu)

### 4.5 Transfer

```powershell
$trPayload = @{
  amount = 100
  recipient_id = $env:RECIPIENT_USER_ID
  description = "Smoke transfer"
  idempotency_key = "smoke-transfer-001"
} | ConvertTo-Json

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/v2/wallet/transfer" -Method POST -Headers $headersUser -ContentType "application/json" -Body $trPayload
Show-Result "Wallet Transfer" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200
- ou 404 si destinataire invalide (cas negatif attendu)

## 5) Secure Payment (init + validate)

### 5.1 Init

```powershell
$initPayload = @{
  requested_amount = 2000
  payment_method = "OM"
  transaction_type = "deposit"
  interface_type = "client"
} | ConvertTo-Json

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/payments/secure/init" -Method POST -Headers $headersUser -ContentType "application/json" -Body $initPayload
$init = ($r.Content | ConvertFrom-Json)
Show-Result "Secure Init" $r.StatusCode $init

$txId = $init.transaction_id
$totalAmount = [double]$init.total_amount
```

PASS attendu:
- HTTP 200
- transaction_id et signature retournes

### 5.2 Validate avec mauvaise signature (doit etre refuse)

```powershell
$badValidate = @{
  transaction_id = $txId
  external_transaction_id = "ext-smoke-bad-001"
  amount_paid = $totalAmount
  payment_status = "SUCCESS"
  signature = "bad_signature"
} | ConvertTo-Json

try {
  $r = Invoke-WebRequest -Uri "$env:BASE_URL/api/payments/secure/validate" -Method POST -Headers $headersUser -ContentType "application/json" -Body $badValidate
  Show-Result "Secure Validate BAD SIG" $r.StatusCode ($r.Content | ConvertFrom-Json)
} catch {
  $resp = $_.Exception.Response
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $body = $reader.ReadToEnd() | ConvertFrom-Json
  Show-Result "Secure Validate BAD SIG" [int]$resp.StatusCode $body
}
```

PASS attendu:
- HTTP 403
- error = INVALID_SIGNATURE

### 5.3 Nouveau init puis validate avec bonne signature

```powershell
$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/payments/secure/init" -Method POST -Headers $headersUser -ContentType "application/json" -Body $initPayload
$init2 = ($r.Content | ConvertFrom-Json)
$txId2 = $init2.transaction_id
$totalAmount2 = [double]$init2.total_amount

# signature HMAC SHA256 sur "transactionId + totalAmount"
$raw = "$txId2$totalAmount2"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($env:TRANSACTION_SECRET_KEY)
$bytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw))
$goodSig = -join ($bytes | ForEach-Object { $_.ToString("x2") })

$goodValidate = @{
  transaction_id = $txId2
  external_transaction_id = "ext-smoke-good-001"
  amount_paid = $totalAmount2
  payment_status = "SUCCESS"
  signature = $goodSig
} | ConvertTo-Json

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/payments/secure/validate" -Method POST -Headers $headersUser -ContentType "application/json" -Body $goodValidate
Show-Result "Secure Validate GOOD SIG" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200
- message indique wallet credite

## 6) Affiliate (register + commission + stats)

### 6.1 Register

```powershell
$affPayload = @{
  userId = $env:TEST_USER_ID
  affiliateToken = $env:AFFILIATE_TOKEN
  ipAddress = "127.0.0.1"
  deviceFingerprint = "smoke-fingerprint-1"
} | ConvertTo-Json

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/affiliate/register" -Method POST -Headers $headersUser -ContentType "application/json" -Body $affPayload
Show-Result "Affiliate Register" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 201
- ou 409 si deja affilie (cas negatif attendu)

### 6.2 Commission via internal key

```powershell
$headersInternal = @{ "X-Internal-API-Key" = $env:INTERNAL_API_KEY }
$comPayload = @{
  userId = $env:TEST_USER_ID
  amount = 1000
  transactionType = "smoke_test"
  transactionId = "smoke-commission-001"
} | ConvertTo-Json

$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/affiliate/commission" -Method POST -Headers $headersInternal -ContentType "application/json" -Body $comPayload
Show-Result "Affiliate Commission Internal" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200

### 6.3 Stats affiliate (JWT requis)

```powershell
$r = Invoke-WebRequest -Uri "$env:BASE_URL/api/affiliate/stats" -Method GET -Headers $headersUser
Show-Result "Affiliate Stats" $r.StatusCode ($r.Content | ConvertFrom-Json)
```

PASS attendu:
- HTTP 200

## 7) Djomy Webhook security checks

### 7.1 Sans signature (doit echouer)

```powershell
$body = '{"eventType":"payment.success","eventId":"evt-no-sig","data":{"transactionId":"tx-123"}}'
try {
  $r = Invoke-WebRequest -Uri "$env:BASE_URL/webhooks/djomy" -Method POST -ContentType "application/json" -Body $body
  Show-Result "Djomy Webhook No Signature" $r.StatusCode ($r.Content | ConvertFrom-Json)
} catch {
  $resp = $_.Exception.Response
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $json = $reader.ReadToEnd() | ConvertFrom-Json
  Show-Result "Djomy Webhook No Signature" [int]$resp.StatusCode $json
}
```

PASS attendu:
- HTTP 401
- error = Missing signature

### 7.2 Signature invalide (doit echouer)

```powershell
$headersBadSig = @{ "x-webhook-signature" = "v1:deadbeef" }
try {
  $r = Invoke-WebRequest -Uri "$env:BASE_URL/webhooks/djomy" -Method POST -Headers $headersBadSig -ContentType "application/json" -Body $body
  Show-Result "Djomy Webhook Bad Signature" $r.StatusCode ($r.Content | ConvertFrom-Json)
} catch {
  $resp = $_.Exception.Response
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $json = $reader.ReadToEnd() | ConvertFrom-Json
  Show-Result "Djomy Webhook Bad Signature" [int]$resp.StatusCode $json
}
```

PASS attendu:
- HTTP 401
- error = Invalid signature

## 8) Resultat final PASS/FAIL

Le smoke test est PASS si:
- Health OK
- Payment link GET/PAY fonctionne selon etat des donnees
- Wallet initialize/balance/deposit/withdraw/transfer repond avec statuts attendus
- Secure payment refuse mauvaise signature et accepte la bonne
- Affiliate register/commission/stats repondent avec statuts attendus
- Djomy webhook rejette signature manquante/invalide

Le smoke test est FAIL si:
- une route critique retourne 500
- l idempotence deposit credite 2 fois avec la meme key
- secure validate accepte une signature invalide
- webhook djomy accepte une requete sans signature
