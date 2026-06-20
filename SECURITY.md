# 🔐 Sécurité et Protection du Code - Vista-Flows

> **224Solutions** - Document confidentiel
> Dernière mise à jour: Février 2026

---

## Vue d'ensemble

Ce document décrit les mesures de protection mises en place pour protéger le code source de Vista-Flows contre la reproduction non autorisée et l'ingénierie inverse.

---

## 1. Obfuscation du Code JavaScript

### Configuration (`obfuscator.config.js`)

| Niveau | Usage | Protection |
|--------|-------|------------|
| **Production** | Déploiement | Maximale |
| **Staging** | Tests | Moyenne |
| **Development** | Développement | Désactivée |

### Techniques utilisées

- **Control Flow Flattening**: Rend la logique du code difficile à suivre
- **Dead Code Injection**: Ajoute du code mort pour confondre l'analyse
- **String Array Encryption**: Chiffre toutes les chaînes (RC4)
- **Self-Defending**: Le code détecte les modifications
- **Debug Protection**: Empêche le débogage pas à pas
- **Console Output Disabled**: Désactive `console.log` en production

### Exclusions

Les bibliothèques externes (React, Supabase, Firebase, etc.) sont exclues pour éviter les conflits.

---

## 2. Protection Anti-Débogage

### Module: `src/lib/security/antiDebug.ts`

| Protection | Description |
|------------|-------------|
| **Détection DevTools** | Détecte l'ouverture des outils de développement |
| **Blocage F12** | Empêche l'ouverture via raccourci clavier |
| **Blocage Ctrl+Shift+I** | Empêche l'inspection |
| **Blocage Ctrl+U** | Empêche l'affichage du source |
| **Blocage clic droit** | Empêche le menu contextuel |
| **Détection Proxy** | Détecte les interceptions de fonctions natives |
| **Protection DOM** | Détecte les injections de scripts |

### Activation

La protection est automatiquement activée en production via `initializeSecurity()`.

---

## 3. Watermarking et Traçabilité

### Module: `src/lib/security/watermark.ts`

Chaque build contient un identifiant unique permettant de tracer les fuites de code.

### Informations intégrées

```typescript
{
  buildId: "VF-XXXXXXXX",     // ID unique du build
  buildDate: "2026-02-08...", // Date de compilation
  environment: "production",   // Environnement
  signature: "XXXXXXXX",       // Signature de vérification
  company: "224Solutions",
  product: "Vista-Flows"
}
```

### Marqueurs invisibles

- Commentaires HTML cachés
- Éléments DOM invisibles
- Caractères Unicode Zero-Width
- Headers HTTP personnalisés

---

## 4. Protection des Variables d'Environnement

### Module: `src/lib/security/envValidator.ts`

| Vérification | Description |
|--------------|-------------|
| Variables requises | Bloque le démarrage si manquantes |
| Secrets exposés | Détecte les secrets côté client |
| Patterns suspects | Alerte sur les valeurs suspectes |

### Variables interdites côté client

Ces variables ne doivent **JAMAIS** apparaître dans le code frontend :

- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `INTERNAL_API_KEY`
- `*_SECRET`
- `PRIVATE_KEY`

---

## 5. Configuration Vite/Terser

### Fichier: `vite.config.ts`

```typescript
// Minification agressive
terserOptions: {
  compress: {
    drop_console: true,      // Supprime console.log
    drop_debugger: true,     // Supprime debugger
    passes: 2                // Double passe de compression
  },
  mangle: {
    properties: {
      regex: /^_private_/    // Renomme propriétés privées
    }
  }
}
```

### Désactivation des Source Maps

```typescript
sourcemap: false  // Pas de source maps en production
```

---

## 6. Autres Mesures de Sécurité

### Déjà en place

- ✅ Chiffrement PBKDF2 + AES-GCM
- ✅ Protection CSRF
- ✅ Rate Limiting
- ✅ Headers de sécurité (CSP, HSTS, etc.)
- ✅ Validation et sanitization des entrées
- ✅ Gestion sécurisée des credentials

### .gitignore

Les fichiers suivants sont exclus du dépôt :

```
.env
.env.local
.env.production
*.json (credentials GCP)
service-account-*.json
```

---

## 7. Recommandations Supplémentaires

### Protection légale

1. **Dépôt du code source** auprès d'un huissier ou APP
2. **Marques déposées** pour "Vista-Flows" et "224Solutions"
3. **CGU/Mentions légales** indiquant la propriété du code
4. **NDA** pour les employés et prestataires

### Infrastructure

1. **Repo Git privé** (GitHub/GitLab privé)
2. **Accès limité** (principe du moindre privilège)
3. **Audit logs** des accès au code
4. **2FA obligatoire** pour tous les développeurs

### Monitoring

1. **Surveillance du web** pour détecter les copies
2. **Alertes Sentry** en cas de tentatives de débogage
3. **Analytics** pour détecter les usages anormaux

---

## 8. Scripts de Build

### Build standard (obfusqué)

```bash
npm run build
```

### Build de développement (non obfusqué)

```bash
npm run build:dev
```

---

## 9. Vérification de l'intégrité

### Vérifier le watermark

```typescript
import { verifyWatermark, getWatermarkInfo } from '@/lib/security';

if (verifyWatermark()) {
  console.log('Intégrité vérifiée:', getWatermarkInfo());
}
```

### Vérifier les variables d'environnement

```typescript
import { validateEnvVars } from '@/lib/security';

const result = validateEnvVars();
if (!result.isValid) {
  console.error('Configuration invalide');
}
```

---

## Contact Sécurité

Pour signaler une vulnérabilité ou une fuite de code :

- Email: security@224solutions.com
- Responsable: [Votre nom]

---

**© 2026 224Solutions. Tous droits réservés.**
