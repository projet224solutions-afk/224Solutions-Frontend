# 📚 GUIDE DE FORMATION - PDG SURVEILLANCE LOGIQUE GLOBALE

## 🎯 Bienvenue dans le Système de Surveillance

Bonjour PDG! Ce guide vous explique comment utiliser le système de surveillance logique pour monitorer 100% des fonctionnalités de Vista-Flows en temps réel.

---

## 📖 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Accéder au Dashboard](#accéder-au-dashboard)
3. [Comprendre les Anomalies](#comprendre-les-anomalies)
4. [Actions Disponibles](#actions-disponibles)
5. [Cas d'Usage Pratiques](#cas-dusage-pratiques)
6. [FAQ](#faq)
7. [Support](#support)

---

## 🔍 Vue d'ensemble

### Qu'est-ce que le système de surveillance?

Le système de surveillance logique est un **outil de monitoring avancé** qui:

✅ **Détecte** automatiquement les anomalies logiques dans le système
✅ **Alerte** le PDG en cas de problème critique
✅ **Corrige** automatiquement certaines anomalies
✅ **Audite** chaque action pour la traçabilité complète

### 120 Règles Métier Surveillées

Le système monitore **120 règles** réparties sur **8 domaines**:

| Domaine | Règles | Fonction |
|---------|--------|----------|
| 🏪 **POS_SALES** | 8 | Ventes en point de vente |
| 📦 **INVENTORY** | 4 | Gestion des stocks |
| 💳 **PAYMENTS** | 5 | Paiements et transactions |
| 🛒 **ORDERS** | 4 | Commandes et confirmations |
| 🚚 **DELIVERIES** | 4 | Livraisons et suivi |
| 💰 **COMMISSIONS** | 3 | Calcul des commissions |
| 🔐 **SECURITY** | 3 | Sécurité et permissions |
| 👛 **WALLETS** | 3 | Portefeuilles électroniques |

---

## 🚀 Accéder au Dashboard

### Adresse Web

```
https://vista-flows.com/pdg/surveillance
```

### Accès depuis le Menu PDG

1. Aller à: **Dashboard PDG** (`/pdg`)
2. Dans le menu de gauche: **Système**
3. Cliquer: **🔍 Surveillance Logique**

### Vérifier votre Accès

- ✓ Vous êtes connecté en tant que **PDG**
- ✓ Vous voyez le Dashboard avec 4 onglets
- ✓ Vous pouvez cliquer sur les boutons

Si vous voyez "Accès Refusé":
- Vérifier votre rôle: Doit être `pdg`
- Contacter l'administrateur

---

## 🎨 Interface du Dashboard

### 1. En-tête (Header)

```
🔍 Surveillance Logique Globale
Système de monitoring en temps réel de toutes les fonctionnalités Vista-Flows

[État Connexion: 🟢 En ligne]
```

### 2. Barre d'Outils

```
[🔍 Détecter anomalies]  [📊 Exporter analyse]  [⚙️ Auto-refresh ON/OFF]
```

- **Détecter anomalies**: Lance une détection immédiate
- **Exporter**: Télécharge un JSON avec toutes les données
- **Auto-refresh**: Active/désactive le rafraîchissement automatique (5min)

### 3. Quatre Onglets

| Onglet | Fonction |
|--------|----------|
| **📊 Overview** | Vue d'ensemble avec KPIs |
| **🎯 Par Domaine** | Anomalies groupées par domaine |
| **🔧 Détails** | Anomalies non résolues avec correction |
| **📜 Audit** | Historique complet de toutes les actions |

---

## 🚨 Comprendre les Anomalies

### Qu'est-ce qu'une Anomalie?

Une **anomalie** est une **violation d'une règle métier**.

**Exemple:**
- Règle: "Stock doit diminuer lors d'une vente"
- Anomalie: "Vente complétée mais stock n'a pas diminué"

### Les 4 Niveaux de Sévérité

```
🔴 CRITICAL - Impact immédiat sur les données
   ↳ Exemple: Stock négatif
   ↳ Action: Corriger immédiatement

🟠 HIGH - Impact important à court terme
   ↳ Exemple: Paiement non confirmé
   ↳ Action: Corriger dans l'heure

🟡 MEDIUM - Impact modéré, notification
   ↳ Exemple: Notification non envoyée
   ↳ Action: Corriger dans 24h

🟢 LOW - Impact minimal, information
   ↳ Exemple: Métrique de performance
   ↳ Action: Monitorer
```

### Indicateurs Visuels

```
Status Sévérité    Couleur      Urgence
───────────────────────────────────────
CRITICAL           🔴 Rouge     Immédiat
HIGH               🟠 Orange    Urgent
MEDIUM             🟡 Jaune     Normal
LOW                🟢 Vert      Faible
```

---

## ⚙️ Actions Disponibles

### Action 1: Détecter les Anomalies

**Quand l'utiliser:**
- Vous soupçonnez un problème
- Vous voulez une vérification manuelle
- Après une opération critique

**Comment faire:**
1. Cliquer le bouton **🔍 Détecter anomalies**
2. Attendre ~5 secondes
3. Voir les résultats

**Résultat:** Les anomalies sont mises à jour en temps réel

---

### Action 2: Correction Automatique

**Quand l'utiliser:**
- L'anomalie peut être corrigée automatiquement
- Vous faites confiance au système
- Vous avez peu de temps

**Comment faire:**
1. Aller à l'onglet **🔧 Détails**
2. Sélectionner une anomalie
3. Cliquer **✅ Correction auto**
4. Confirmer

**Exemples de corrections auto:**
- Stock négatif → Ramener à 0
- Solde wallet désynchronisé → Recalculer
- Commission manquante → Recalculer

**Avantage:**
✓ Instantané
✓ Pas de raison requise
✓ Automatisé et fiable

**Danger:**
⚠️ Pas de validation manuelle
⚠️ Irréversible (audit trail disponible)

---

### Action 3: Correction Manuelle

**Quand l'utiliser:**
- Vous voulez valider avant de corriger
- L'anomalie est complexe
- Vous devez justifier la correction

**Comment faire:**
1. Aller à l'onglet **🔧 Détails**
2. Sélectionner une anomalie
3. Cliquer **🔧 Correction manuelle**
4. Entrer une **Raison** (requis)
   - Exemple: "Stock déjà ajusté manuellement le 01/02"
5. Cliquer **Appliquer**

**Avantage:**
✓ Vous gardez le contrôle
✓ Raison enregistrée dans l'audit
✓ Tracé pour conformité

**Danger:**
⚠️ Plus lent (vous devez justifier)
⚠️ Pas de validation technique

---

### Action 4: Exporter l'Analyse

**Quand l'utiliser:**
- Vous avez besoin d'un rapport
- Vous voulez partager avec l'équipe
- Vous archivez pour audit

**Comment faire:**
1. Cliquer **📊 Exporter analyse**
2. Sauvegarder le fichier JSON
3. Utiliser dans Excel/Tableau/etc.

**Format du fichier:**
```json
{
  "exported_at": "2026-02-01T10:15:30Z",
  "total_anomalies": 5,
  "critical_count": 1,
  "anomalies": [
    {
      "id": "...",
      "rule_id": "POS_001",
      "domain": "POS_SALES",
      "severity": "CRITICAL",
      "detected_at": "...",
      "resolved_at": null
    }
  ],
  "audit_trail": [...]
}
```

---

## 📊 Onglet 1: Overview

### Vue d'Ensemble du Système

```
Status Global: 🟢 OK
├─ 120 Règles Actives
├─ 2 Anomalies Détectées (dernière détection)
├─ 1 Anomalie CRITICAL 🔴
├─ Taux de Résolution: 95%
└─ Auto-refresh: ACTIVÉ ⚙️
```

### Cartes KPI

**Carte 1: Total Règles**
```
Total: 120
Status: ✓ Toutes actives
```

**Carte 2: Anomalies**
```
Total: 5 anomalies
Historique: 3 cette semaine
```

**Carte 3: CRITICAL**
```
Nombre: 1
Action: ⚠️ Nécessite attention
```

**Carte 4: Dernières 24h**
```
Anomalies: 12
Résolues: 11 (92%)
```

**Carte 5: Santé du Système**
```
Status: OK / WARNING / CRITICAL
Tous les domaines: Vérifiés
```

### Actions depuis Overview

```
[🔍 Détecter]  [📊 Exporter]  [⚙️ Auto-Refresh]
```

---

## 🎯 Onglet 2: Par Domaine

### Voir les anomalies par domaine

```
POS_SALES (2 anomalies)
├─ 🔴 CRITICAL: Stock not decremented [Corriger]
└─ 🟡 MEDIUM: Order status mismatch [Corriger]

INVENTORY (0 anomalies)
└─ ✓ Tous les stocks OK

PAYMENTS (1 anomalie)
└─ 🟠 HIGH: Transaction not confirmed [Corriger]

[Autres domaines...]
```

### Pour chaque anomalie

```
Domaine: INVENTORY
Règle: INV_001 - "Stock cannot be negative"
Sévérité: 🔴 CRITICAL
Détectée: Il y a 1 minute

[Corriger]  [Ignorer]  [Voir détails]
```

---

## 🔧 Onglet 3: Détails

### Anomalies Non Résolues Uniquement

```
Anomalie #1
├─ Règle: POS_001
├─ Domaine: POS_SALES
├─ Sévérité: 🔴 CRITICAL
├─ Détectée: 2026-02-01 10:15:00
│
├─ ❌ Expected: {stock: 9}
└─ ✓ Actual: {stock: 10}
    │
    ├─ Différence: +1 (n'a pas diminué)
    │
    └─ Correction?
       ├─ [✅ Auto] (rapide, pas de raison)
       └─ [🔧 Manuel] (lent, raison requise)
```

### Modal de Correction

**Si vous cliquez "Correction auto":**
```
Confirmer la correction?
Anomalie: POS_001
Type: AUTO (automatique)
New Value: {stock: 9}

[Annuler]  [Confirmer]
```

**Si vous cliquez "Correction manuelle":**
```
Entrez votre raison:
┌─────────────────────────────────┐
│ Stock was already adjusted...   │
└─────────────────────────────────┘

Type: MANUAL (manuel)
Acteur: PDG (vous)
Timestamp: 2026-02-01 10:15:00

[Annuler]  [Appliquer]
```

---

## 📜 Onglet 4: Audit

### Historique Complet

```
Timestamp              Action        Domaine      Acteur     Raison
──────────────────────────────────────────────────────────────────
2026-02-01 10:30      DETECT         POS_SALES    System     -
2026-02-01 10:32      ALERT          POS_SALES    System     Critical
2026-02-01 10:35      CORRECT        POS_SALES    PDG        Stock corrected manually
2026-02-01 10:36      VERIFY         POS_SALES    System     Verification pass
```

### Immuabilité

```
🔒 Ces logs sont IMMUABLES
   - Impossible de les modifier
   - Impossible de les supprimer
   - Conforme à la conformité
```

---

## 💡 Cas d'Usage Pratiques

### Cas 1: Vente POS sans Stock Decremented

**Problème:**
- Un client a acheté un produit en POS
- La vente est marquée complétée
- MAIS le stock n'a pas diminué

**Détection:**
```
1. Cron job détecte: rule POS_001 (Stock must decrease on sale)
2. Anomalie: Expected stock=9, Actual stock=10
3. Sévérité: 🔴 CRITICAL
4. Alerte PDG: "🚨 Stock not decremented!"
```

**Résolution:**
```
Option A - Auto-Correct (2 secondes):
1. Cliquer [✅ Correction auto]
2. Stock est corrigé à 9
3. Anomalie marquée résolue

Option B - Manual Check (5 minutes):
1. Vérifier la vente: A-t-elle vraiment été faite?
2. Vérifier le stock: Est-ce le bon produit?
3. Cliquer [🔧 Correction manuelle]
4. Entrer: "Vérifiée - Stock était mal comptabilisé"
5. Système applique la correction
```

---

### Cas 2: Portefeuille Désynchronisé

**Problème:**
- Un client a un portefeuille avec 50 000 GNF
- Mais la somme des transactions = 40 000 GNF
- Désynchronisation!

**Détection:**
```
1. Cron job détecte: rule WAL_002 (Balance must match sum)
2. Anomalie: Expected balance=40000, Actual balance=50000
3. Sévérité: 🔴 CRITICAL
4. Alerte: "Wallet balance mismatch"
```

**Résolution:**
```
Via Auto-Correct:
1. Cliquer [✅ Correction auto]
2. Système recalcule: balance = SUM(transactions) = 40000
3. Portefeuille corrigé à 40000
4. Tous les transferts futurs fonctionnent normalement
```

---

### Cas 3: Commission Manquante

**Problème:**
- Un agent a effectué 100 ventes
- Commission non calculée pour 5 ventes
- Anomalie modérée

**Détection:**
```
1. Cron détecte: rule COM_001 (Commission calculated)
2. Anomalie: 5 commissions manquantes
3. Sévérité: 🟡 MEDIUM
4. Impact: Faible, vous avez le temps
```

**Résolution:**
```
Via Manual Check (vous êtes prudent):
1. Aller à: Dashboard → Par Domaine → COMMISSIONS
2. Voir: "5 commissions manquantes pour agent X"
3. Vérifier: Toutes les ventes sont validées?
4. Cliquer: [🔧 Correction manuelle]
5. Raison: "5 ventes validées - commission recalculée"
6. Système recalcule automatiquement
```

---

## ❓ FAQ

### Q1: Combien de temps entre la détection et l'alerte?

**R:** Environ **1 minute** (le cron job s'exécute toutes les 1 minute)

Pour une alerte immédiate:
```
1. Aller à /pdg/surveillance
2. Cliquer [🔍 Détecter anomalies]
3. Résultat immédiat
```

---

### Q2: Les corrections automatiques sont-elles sûres?

**R:** Oui, pour les anomalies marquées `auto_correctable = true`

Ces anomalies sont:
- ✓ Faciles à corriger (pas d'ambiguïté)
- ✓ Déjà vérifiées par les tests
- ✓ Tracées dans l'audit

Exemple: "Stock négatif → Ramener à 0" est sûr

Contre-exemple: "Supprimer une commande" n'est PAS auto-correctable (trop dangereux)

---

### Q3: Peut-on ignorer une anomalie?

**R:** Oui, mais c'est tracé

```
1. Cliquer [Ignorer]
2. Raison: Votre justification
3. Audit trail: "2026-02-01 10:35 - PDG ignored anomaly - Reason: Already handled manually"
```

---

### Q4: Est-ce que les anomalies résolues reviennent?

**R:** Non, mais vous pouvez voir l'historique

```
Onglet "Audit":
- Toutes les anomalies (résolues et non résolues)
- Toutes les corrections appliquées
- Qui a corrigé et quand
```

---

### Q5: Peut-on désactiver le cron job?

**R:** Oui, mais ce n'est pas recommandé

Pour arrêter la détection:
```
Supabase Dashboard → Scheduled Functions → Disable
```

Mais vous perdrez:
- ❌ Détections automatiques
- ❌ Alertes en temps réel
- ⚠️ Anomalies non détectées

---

### Q6: Où sont stockées les données d'audit?

**R:** Dans la table `logic_audit` (immuable)

```
SELECT * FROM logic_audit ORDER BY timestamp DESC LIMIT 10;
```

Caractéristiques:
- ✓ Immuable (impossible à supprimer/modifier)
- ✓ Complète (chaque action enregistrée)
- ✓ Conforme (pour audit externe)

---

### Q7: Le système peut-il faux positifs?

**R:** Possible, c'est prévu

```
Si vous pensez que c'est un faux positif:
1. Cliquer [Ignorer]
2. Raison: "False positive - X already handled"
3. Notifier l'équipe technique
```

---

### Q8: Peut-on exporter et importer?

**R:** Oui pour l'export, non pour l'import

```
Export: [📊 Exporter] → JSON file
Import: Non disponible (données lues seules via audit)
```

---

## 📞 Support

### Problème: Accès Refusé

```
Symptôme: "Vous n'avez pas accès à cette page"
Cause probable: Votre rôle n'est pas PDG
Solution: 
  1. Contacter l'administrateur
  2. Vérifier votre profil: role = 'pdg'
  3. Se déconnecter et reconnecter
```

### Problème: Les anomalies n'apparaissent pas

```
Symptôme: Dashboard vide, 0 anomalie
Cause probable: 
  - Migration SQL non déployée
  - Cron job arrêté
  - Pas d'anomalies actuellement
Solution:
  1. Cliquer [🔍 Détecter anomalies]
  2. Attendre ~5 secondes
  3. Si toujours vide: contact support
```

### Problème: Performance lente

```
Symptôme: Dashboard charge lentement (> 5 sec)
Cause probable: Trop d'anomalies (> 1000)
Solution:
  1. Exporter les anciennes anomalies
  2. Archiver l'historique
  3. Contact support pour optimiser
```

### Contacter le Support

```
📧 Email: support@vista-flows.com
💬 Chat: [support chat dans l'app]
🐛 Issues: github.com/vista-flows/issues
📱 Urgence: +224 XXX XX XX XX
```

---

## 📚 Documentation Complète

Pour aller plus loin:

- [Architecture Technique](SURVEILLANCE_ARCHITECTURE.md)
- [Guide de Déploiement](DEPLOYMENT_GUIDE.md)
- [Tests E2E](E2E_TESTING_GUIDE.md)
- [Configuration Cron](CRON_CONFIGURATION.md)

---

## 🎓 Conclusion

Vous êtes maintenant formé au système de surveillance logique!

**Résumé:**
- ✅ 120 règles surveillées automatiquement
- ✅ Détection toutes les 1 minute
- ✅ Alertes en temps réel
- ✅ Corrections auto et manuelles
- ✅ Audit trail complet

**Prochaines étapes:**
1. Accéder au dashboard: `/pdg/surveillance`
2. Cliquer "Détecter anomalies"
3. Observer les résultats
4. Appliquer les corrections
5. Consulter l'audit trail

**Besoin d'aide?** Contactez le support ci-dessus!

---

**📅 Version: 1.0 - 2026-02-01**
**👤 Pour: PDG Vista-Flows**
**📌 Status: Prêt pour utilisation**
