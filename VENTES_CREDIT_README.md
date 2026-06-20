# Système de Ventes à Crédit - Vendeur

## 📋 Vue d'ensemble

Ce système permet aux vendeurs d'enregistrer des ventes à crédit avec suivi des paiements.

## ✅ Fonctionnalités

### 1. Créer une vente à crédit
- Nom du client (requis)
- Téléphone (optionnel)
- Articles multiples (produit, quantité, prix)
- Calcul automatique des totaux (sous-total + TVA 10%)
- Date d'échéance
- Notes optionnelles

### 2. Suivi des ventes
- Liste complète avec filtres (nom, numéro, statut)
- Statuts disponibles:
  - **En attente** (`pending`) - Aucun paiement reçu
  - **Partiellement payé** (`partial`) - Paiement partiel reçu
  - **Payé** (`paid`) - Montant complet reçu
  - **En retard** (`overdue`) - Date d'échéance dépassée

### 3. Gestion des paiements
- Enregistrement de paiements partiels ou complets
- Mise à jour automatique du statut
- Calcul du montant restant dû

### 4. Statistiques
- Nombre total de ventes à crédit
- Répartition par statut
- Montant total des créances
- Montant à recevoir

## 🚀 Installation

### 1. Déployer la migration SQL

La table `vendor_credit_sales` doit être créée via Supabase :

```bash
# Connectez-vous à Supabase
cd d:/224Solutions/vista-flows

# Pushez les migrations
supabase db push
```

Ou via l'interface Supabase :
1. Allez dans **SQL Editor**
2. Exécutez le contenu de `supabase/migrations/20260202000002_add_vendor_credit_sales_table.sql`

### 2. Régénérer les types TypeScript

Une fois la migration appliquée :

```bash
npm run generate-types
# ou
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

### 3. Redémarrer le serveur de développement

```bash
npm run dev
```

## 📍 Accès dans l'interface

1. Connexion en tant que **Vendeur**
2. Menu **Ventes & Commandes**
3. Onglet **Ventes à Crédit**

## 🗄️ Structure de la table

```sql
vendor_credit_sales (
  id uuid PRIMARY KEY,
  vendor_id uuid REFERENCES vendors(id),
  order_number text UNIQUE,
  customer_id uuid (optionnel),
  customer_name text,
  customer_phone text (optionnel),
  items jsonb, -- [{product_name, quantity, unit_price}]
  subtotal numeric,
  tax numeric,
  total numeric,
  paid_amount numeric DEFAULT 0,
  remaining_amount numeric,
  status text CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  due_date timestamp,
  notes text (optionnel),
  created_at timestamp,
  updated_at timestamp
)
```

## 🔒 Sécurité (RLS)

Les policies Row Level Security garantissent que:
- Chaque vendeur ne voit que ses propres ventes à crédit
- Les opérations sont limitées au vendeur propriétaire

## 🎯 Utilisation

### Créer une vente à crédit

1. Cliquez sur **Nouvelle vente**
2. Remplissez le formulaire :
   - Nom du client
   - Téléphone (facultatif)
   - Ajoutez des articles (bouton **+ Ajouter**)
   - Sélectionnez la date d'échéance
   - Ajoutez des notes si nécessaire
3. Cliquez sur **Créer la vente**

### Enregistrer un paiement

1. Trouvez la vente à crédit dans la liste
2. Cliquez sur **Enregistrer un paiement**
3. Entrez le montant payé
4. Validez avec **Confirmer le paiement**

Le système met automatiquement à jour :
- Le montant payé
- Le montant restant dû
- Le statut de la vente

### Consulter les statistiques

1. Passez à l'onglet **Statistiques**
2. Visualisez :
   - Nombre de ventes par statut
   - Montant total des créances
   - Montant total à recevoir

## 🔧 Maintenance

### Fonction de mise à jour automatique des retards

Une fonction PostgreSQL `update_overdue_credit_sales()` est disponible pour marquer automatiquement les ventes en retard :

```sql
SELECT update_overdue_credit_sales();
```

Vous pouvez configurer un cron job Supabase pour l'exécuter quotidiennement :

```sql
-- Dans Supabase Dashboard > Database > Cron Jobs
SELECT cron.schedule(
  'update-overdue-credit-sales',
  '0 0 * * *', -- Tous les jours à minuit
  $$SELECT update_overdue_credit_sales()$$
);
```

## 📊 Exemples de requêtes

### Voir toutes les ventes en retard
```sql
SELECT * FROM vendor_credit_sales 
WHERE status = 'overdue' 
ORDER BY due_date;
```

### Calculer le total des créances d'un vendeur
```sql
SELECT 
  SUM(remaining_amount) as total_receivable
FROM vendor_credit_sales
WHERE vendor_id = 'YOUR_VENDOR_ID'
  AND status IN ('pending', 'partial', 'overdue');
```

### Historique des paiements (à implémenter)
Pour une version future, vous pourriez ajouter une table `credit_sale_payments` pour tracer chaque paiement individuel.

## 🐛 Dépannage

### Erreurs TypeScript

Si vous voyez des erreurs TypeScript concernant `vendor_credit_sales` :

1. Vérifiez que la migration est appliquée : `supabase migration list`
2. Régénérez les types : `npm run generate-types`
3. Redémarrez le serveur : `npm run dev`

### La table n'existe pas

```bash
# Vérifier les migrations
supabase migration list

# Appliquer les migrations manquantes
supabase db push
```

## 🚀 Fonctionnalités futures

- [ ] Relances automatiques par email/SMS avant échéance
- [ ] Historique détaillé des paiements
- [ ] Export PDF des factures de crédit
- [ ] Graphiques d'évolution des créances
- [ ] Liens avec le système de dette existant
- [ ] Intégration avec le système de comptabilité

## 📝 Notes

- Le système utilise `@ts-ignore` temporairement pour les appels Supabase jusqu'à ce que les types soient générés
- La TVA est fixée à 10% (modifiable dans `calculateTotals()`)
- Le format de numéro de commande est `CREDIT-{timestamp}`
