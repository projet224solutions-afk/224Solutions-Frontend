# 🔐 Guide de Migration AWS Cognito + Google Cloud SQL

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  AWS API Gateway  │────▶│  AWS Lambda      │
│   React/Vite │     │  (HTTP API)       │     │  (Auth Gateway)  │
└──────┬───────┘     └──────────────────┘     └────────┬────────┘
       │                                                │
       │ Cognito SDK                              JWT Verify
       ▼                                                │
┌─────────────┐                                  ┌──────▼────────┐
│ AWS Cognito  │                                  │ Google Cloud   │
│ User Pool    │                                  │ SQL (Postgres) │
└─────────────┘                                  └───────────────┘
```

## Étapes de déploiement

### 1. AWS Cognito User Pool

```bash
# Créer le User Pool (AWS CLI)
aws cognito-idp create-user-pool \
  --pool-name "224Solutions-Users" \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
  --schema '[{"Name":"custom:role","AttributeDataType":"String","Mutable":true}]'

# Créer le App Client (SPA - pas de secret)
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-name "224Solutions-Web" \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --supported-identity-providers COGNITO \
  --callback-urls '["https://vista-flows.lovable.app/auth/callback"]' \
  --logout-urls '["https://vista-flows.lovable.app/auth"]'
```

### 2. Google Cloud SQL

```bash
# Créer l'instance
gcloud sql instances create 224solutions-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-8192 \
  --region=us-central1 \
  --storage-size=50GB \
  --storage-auto-increase

# Créer la base
gcloud sql databases create 224solutions --instance=224solutions-db

# Exécuter le schéma
psql -h CLOUD_SQL_IP -U postgres -d 224solutions -f sql/google-cloud-sql-schema.sql
```

### 3. AWS Lambda (Auth Gateway)

```bash
# Installer les dépendances
cd backend
npm install jsonwebtoken jwks-rsa pg

# Déployer la Lambda
zip -r lambda.zip src/lambda/authGateway.js node_modules/
aws lambda create-function \
  --function-name 224Solutions-AuthGateway \
  --runtime nodejs20.x \
  --handler src/lambda/authGateway.handler \
  --zip-file fileb://lambda.zip \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --environment Variables='{AWS_COGNITO_REGION=us-east-1,AWS_COGNITO_USER_POOL_ID=YOUR_POOL_ID}'
```

### 4. API Gateway

```bash
# Créer l'API HTTP
aws apigatewayv2 create-api \
  --name "224Solutions-Auth-API" \
  --protocol-type HTTP \
  --cors-configuration AllowOrigins="https://vista-flows.lovable.app",AllowMethods="GET,POST,PUT,DELETE"
```

### 5. Variables d'environnement Frontend (Lovable Secrets)

- `VITE_AWS_COGNITO_USER_POOL_ID`
- `VITE_AWS_COGNITO_CLIENT_ID`  
- `VITE_AWS_COGNITO_REGION`
- `VITE_AUTH_GATEWAY_URL` (URL de l'API Gateway)

## Transition Progressive

1. **Phase 1** (Actuelle) : Cognito SDK intégré, Supabase Auth en parallèle
2. **Phase 2** : Nouveaux utilisateurs → Cognito uniquement
3. **Phase 3** : Migration des utilisateurs existants (Supabase → Cognito)
4. **Phase 4** : Suppression de Supabase Auth
