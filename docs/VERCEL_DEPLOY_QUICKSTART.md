# Déploiement Vercel rapide

## 1. Pré-requis
- Frontend buildable localement
- Vercel CLI accessible
- Projet lié à Vercel
- Backend public joignable via `https://api-africa.224solution.net`

## 2. Variables importantes
Le frontend prod lit désormais :
- `VITE_BACKEND_URL`
- `VITE_BACKEND_API_URL`
- `VITE_API_URL`
- `VITE_API_BASE_URL`

Valeur attendue :

```env
VITE_BACKEND_URL=https://api-africa.224solution.net
VITE_BACKEND_API_URL=https://api-africa.224solution.net
VITE_API_URL=https://api-africa.224solution.net
VITE_API_BASE_URL=https://api-africa.224solution.net
```

## 3. Déployer
```powershell
cd D:\224Solutions\vista-flows
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vercel-frontend.ps1
```

## 4. Vérifications après déploiement
```text
https://www.224solution.net/
https://www.224solution.net/health
https://www.224solution.net/edge-functions/payments/african-fx-query?base=USD&quote=GNF
```

## 5. Si ça ne marche toujours pas
Si `api-africa.224solution.net` renvoie `DEPLOYMENT_NOT_FOUND`, alors le frontend est prêt mais le backend public n'est pas encore déployé/attaché à ce domaine.
