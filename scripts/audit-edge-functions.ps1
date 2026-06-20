$invoked = @(
  "advanced-analytics","agent-affiliate-link","agora-token","ai-copilot","ai-error-analyzer","ai-recommend",
  "card-to-orange-money","change-agent-email","change-agent-password","change-bureau-password","cloud-health-proxy",
  "cognito-auth-proxy","cognito-sync-session","communication-handler","convert-audio","create-conversation",
  "create-pdg-agent","create-short-link","create-sub-agent","create-syndicate-member","create-user-by-agent",
  "create-vendor-agent","delete-pdg-agent","detect-anomalies","dispute-ai-arbitrate","dispute-create",
  "dispute-resolve","dispute-respond","escrow-create","escrow-create-stripe",
  "escrow-dispute","escrow-refund","escrow-release","firebase-config","firebase-health-check","fix-error",
  "fraud-detection","gcs-signed-url","gcs-upload-complete","geocode-address","geo-detect","get-user-activity",
  "google-cloud-test","mapbox-proxy","ml-fraud-detection","payment-core","pdg-ai-assistant","pdg-copilot",
  "pdg-mfa-verify","pdg-update-agent-email","process-payment-link","register-with-affiliate","resolve-payment-link",
  "resolve-short-link","secure-payment-init","secure-payment-validate","security-detect-anomaly","security-forensics",
  "security-incident-response","send-bureau-access-email","send-security-alert","sign-contract","taxi-payment-process",
  "translate-audio","translate-message","translate-product","update-vendor-agent-email","vendor-ai-assistant",
  "visual-search","wallet-operations","wallet-transfer",
  # autres vus dans les crochets
  "admin-review-payment","generate-bureau-token","escrow-dispute","notify-vendor-delivery-complete",
  "send-delivery-notification","chapchappay-pull","mobile-money-withdrawal","stripe-withdrawal",
  "paypal-withdrawal","wallet-transfer","confirm-delivery","cancel-order","request-refund",
  "paypal-client-id","paypal-deposit","send-sms","send-email","agent-toggle-user-status","agent-delete-user",
  "agent-get-products","agent-toggle-product-status","agent-delete-product","agent-update-product",
  "get-agent-users","create-sub-agent","calculate-route","google-maps-config","wallet-operations",
  "google-places-autocomplete","competitive-analysis","security-analysis","sync-system-apis",
  "pubsub-publish","pubsub-subscribe","pubsub-manage","taxi-accept-ride","taxi-refuse-ride","taxi-payment",
  "delete-user","change-bureau-password","update-bureau-email","generate-invoice-pdf","restore-user",
  "resolve-dispute","sign-contract","link-escrow-order","escrow-create-stripe","translate-message",
  "taxi-payment-process","verify-vendor","wallet-operations","delivery-payment",
  "paypal-client-id","create-paypal-order","generate-contract-pdf","create-contract",
  "generate-contract-with-ai","ai-contract-assistant","generate-purchase-pdf","validate-purchase",
  "generate-product-description","generate-product-image","chapchappay-ecommerce","chapchappay-push",
  "chapchappay-status","send-otp-email","auth-agent-login","auth-verify-otp","auth-bureau-login",
  "auth-agent-bureau-login","auth-agent-bureau-verify-otp","register-with-affiliate","cognito-sync-session",
  "wallet-audit","change-agent-email","change-agent-password","create-pdg-agent","delete-pdg-agent",
  "create-vendor-agent","send-agent-invitation","create-user-by-agent","generate-unique-id",
  "generate-product-image-openai","generate-similar-image","enhance-product-image","generate-quote-pdf",
  "generate-pdf","short-link","generate-totp","verify-totp","pdg-delete-vendor","pdg-delete-service-product",
  "admin-release-funds","release-scheduled-funds","manual-credit-seller","affiliate-commission-trigger",
  "escrow-auto-release","escrow-stripe-webhook","subscription-webhook","stripe-webhook",
  "chapchappay-webhook","paypal-webhook","stripe-deposit","stripe-pos-payment",
  "stripe-marketplace-payment","marketplace-escrow-payment","freight-payment","restaurant-payment",
  "service-payment","african-fx-collect","african-fx-query","agora-token","og-meta",
  "confirm-order-by-seller","upload-bureau-stamp","create-bureau-with-auth","export-users-for-cognito",
  "migrate-users-to-cognito","subscription-expiry-check","process-digital-renewals","production-cron-jobs",
  "redis-cache","cached-data","task-queue-worker","waap-protect","api-guard-monitor",
  "check-all-services","restart-module","smart-notifications","smart-recommendations",
  "error-monitor","cleanup-cache-errors","detect-surveillance-anomalies","security-analysis",
  "security-block-ip","send-communication-notification","open-dispute","financial-stats",
  "get-google-secret","update-member-email","change-member-password","create-payment-intent",
  "stripe-create-payment-intent","paypal-deposit","audio-translation-webhook","vendor-agent-get-products",
  "confirm-stripe-deposit","payment-diagnostic","secure-payment-init","secure-payment-validate",
  "wallet-payment-api","inventory-api","calculate-delivery-distances","renew-subscription",
  "sync-to-cloudsql","pubsub-manage","test-gemini-api","test-google-cloud-api",
  "google-cloud-test","gcs-upload-complete","gcs-signed-url","geo-detect","geocode-address",
  "mapbox-proxy","cloud-health-proxy","firebase-config","firebase-health-check",
  "cognito-auth-proxy","assess-payment-risk","mobile-money-withdrawal",
  "change-agent-email","change-agent-password","reset-pdg-password",
  "reset-agent-password","update-bureau-email","update-vendor-agent-email","send-bureau-access-email",
  "generate-bureau-token","verify-bureau-token","verify-vendor","create-conversation",
  "communication-handler","translate-product","translate-audio","translate-message",
  "pdg-copilot","client-ai-assistant","vendor-ai-assistant","ai-recommend","ai-copilot",
  "ai-error-analyzer","advanced-analytics"
)

$existing = Get-ChildItem "D:\224Solutions\vista-flows\supabase\functions" -Directory | Select-Object -ExpandProperty Name
$uniqueInvoked = $invoked | Sort-Object -Unique

Write-Host "=== INVOQUEES MAIS INEXISTANTES (ORPHELINES) ===" -ForegroundColor Red
$orphans = $uniqueInvoked | Where-Object { $_ -notin $existing }
$orphans | Sort-Object
Write-Host "Total orphelines: $($orphans.Count)"

Write-Host ""
Write-Host "=== EXISTANTES MAIS JAMAIS INVOQUEES (INUTILISEES / NON REFERENCEES) ===" -ForegroundColor Yellow
$unused = $existing | Where-Object { $_ -notin $uniqueInvoked -and $_ -ne "_shared" }
$unused | Sort-Object
Write-Host "Total non referencees: $($unused.Count)"
