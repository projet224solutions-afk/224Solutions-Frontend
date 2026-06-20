# Rapport de correction : Uniformisation structure & sécurité

## 1. Correction structure React
- Dossier `src/context` renommé en `src/contexts` (convention React).
- Fichier `CurrencyContext.tsx` déplacé dans `src/contexts/`.
- Tous les imports corrigés dans le codebase (`@/contexts/CurrencyContext`).
- Ancien dossier supprimé (plus de conflit d'import).

## 2. Migration SQL sécurité/robustesse
- Ajout d'une migration SQL :
  - Uniformisation du calcul des frais dans `process_secure_wallet_transfer` (lecture dynamique du taux depuis `pdg_settings`, extraction JSON).
  - Ajout d'une contrainte CHECK ISO 4217 sur la colonne `currency` de la table `wallets` (validation stricte des devises).
  - Création d'une table et fonction d'alerte sur les écarts de taux d'échange (`exchange_rate_alerts`, `check_exchange_rate_alert`).

## 3. Actions réalisées
- Commit et push sur la branche `main` du dépôt GitHub.
- Nettoyage du code et conformité aux standards React et sécurité financière.

## 4. Prochaines étapes
- Appliquer la migration SQL sur la base de données (si ce n'est pas déjà fait).
- Vérifier le build et le fonctionnement du frontend (import context OK).
- Tester la logique de frais dynamiques et la contrainte devise sur les nouveaux transferts.
- Mettre en place un monitoring sur la table d'alertes de taux.

---
*Correction réalisée le 09/04/2026 par GitHub Copilot (GPT-4.1)*
