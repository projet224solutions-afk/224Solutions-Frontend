# Système de Permissions Déléguées PDG → Agents

## 📋 Vue d'ensemble

Ce système permet au **PDG de déléguer des tâches spécifiques aux agents** sans donner accès complet à tous les outils PDG. Il utilise une architecture basée sur:

- **Base de données**: Tables SQL + Politiques RLS Supabase
- **Backend**: Fonctions PostgreSQL sécurisées (SECURITY DEFINER)
- **Frontend**: Hooks React + Composants UI protégés

> Note compatibilite cles permissions:
> - Frontend UI (hooks/guards) utilise les cles canoniques sans prefixe: `manage_*`, `view_*`, `access_*`.
> - Les cles legacy prefixees `pdg_*` restent acceptees en verification pour compatibilite.
> - Pour les nouveaux composants React, utilisez les cles canoniques sans `pdg_`.

---

## 🏗️ Architecture

### 1. Tables Principales

#### `pdg_access_permissions` (Permissions déléguées)
```sql
- id: UUID (clé primaire)
- pdg_id: UUID (PDG qui délègue)
- agent_id: UUID (Agent qui reçoit)
- permission_key: TEXT (clé permission, ex: 'pdg_manage_vendors')
 - permission_key: TEXT (clé permission, ex: 'manage_vendors' ou legacy 'pdg_manage_vendors')
- permission_name: TEXT (nom lisible)
- permission_scope: JSONB (restriction optionnelle, ex: {"vendor_ids": ["id1", "id2"]})
- is_active: BOOLEAN (activé/désactivé)
- expires_at: TIMESTAMP (expiration automatique)
- delegated_by: UUID (qui a accordé)
```

#### `pdg_permission_catalog` (Catalogue centralisé)
```sql
- permission_key: TEXT (clé unique)
- permission_name: TEXT (nom lisible)
- category: TEXT (users, finance, analytics, operations, security, system)
- risk_level: TEXT (low, medium, high, critical)
- requires_2fa: BOOLEAN (exige 2FA)
- requires_audit: BOOLEAN (enregistrer en audit)
```

#### `pdg_permissions_audit` (Journal d'audit)
```sql
- Enregistre toutes les modifications de permissions
- Traçabilité complète: qui a accordé, quand, pourquoi
```

### 2. Fonctions Sécurisées

#### `grant_pdg_permission_to_agent()`
```typescript
// Accorde une permission avec validation
const { data, error } = await supabase.rpc(
  'grant_pdg_permission_to_agent',
  {
    p_pdg_id: pdgId,
    p_agent_id: agentId,
    p_permission_key: 'manage_vendors',
    p_scope: { vendor_ids: ['id1', 'id2'] }, // optionnel
    p_expires_in_days: 30 // optionnel
  }
);
```

#### `revoke_pdg_permission_from_agent()`
```typescript
// Révoque une permission
const { data, error } = await supabase.rpc(
  'revoke_pdg_permission_from_agent',
  {
    p_pdg_id: pdgId,
    p_agent_id: agentId,
    p_permission_key: 'manage_vendors',
    p_reason: 'Fin de contrat'
  }
);
```

#### `agent_has_permission()`
```typescript
// Vérifie rapidement si un agent a une permission
const hasAccess = await supabase.rpc(
  'agent_has_permission',
  {
    p_agent_id: agentId,
    p_permission_key: 'manage_vendors'
  }
);
```

---

## 🔐 Politiques RLS

### Vue PDG
```sql
-- Le PDG voit ses permissions déléguées
CREATE POLICY "PDG can view own delegated permissions"
ON pdg_access_permissions
USING (pdg_id = auth.uid())
```

### Vue Agent
```sql
-- L'agent voit ses permissions ACTIVES et NON EXPIRÉES
CREATE POLICY "Agents can view own permissions"
ON pdg_access_permissions
USING (
  agent_id IN (SELECT id FROM agents_management WHERE user_id = auth.uid())
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > NOW())
)
```

### Audit
```sql
-- Seul le PDG voit l'audit de ses permissions
CREATE POLICY "PDG can view audit logs"
ON pdg_permissions_audit
USING (pdg_id IN (SELECT id FROM pdg_management WHERE user_id = auth.uid()))
```

---

## 💻 Utilisation Frontend

### 1. Hook pour le PDG (gérer permissions)

```typescript
import { usePDGAgentPermissions } from '@/hooks/usePDGAgentPermissions';

function MyComponent() {
  const {
    permissions,           // Permissions déléguées
    permissionCatalog,     // Toutes les permissions disponibles
    loading,               // État de chargement
    grantPermission,       // Accorder une permission
    revokePermission,      // Révoquer une permission
    checkAgentPermission   // Vérifier une permission
  } = usePDGAgentPermissions(pdgId);

  // Accorder une permission
  const handleGrant = async () => {
    const success = await grantPermission(
      agentId,
      'manage_vendors',
      30, // Expire dans 30 jours
      { vendor_ids: ['id1'] } // Scope optionnel
    );
  };
}
```

### 2. Hook pour l'Agent (vérifier permissions)

```typescript
import { useAgentPermissions } from '@/hooks/usePDGAgentPermissions';

function MyComponent() {
  const {
    agentPermissions,      // Set des permissions
    hasPermission,         // (permKey) => boolean
    hasAnyPermission,      // (permKeys[]) => boolean
    hasAllPermissions      // (permKeys[]) => boolean
  } = useAgentPermissions();

  if (hasPermission('manage_vendors')) {
    return <VendorManager />;
  }
}
```

### 3. Composant de Protection

```typescript
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// Usage simple
<PermissionGuard requiredPermission="manage_vendors">
  <VendorManager />
</PermissionGuard>

// Permissions multiples
<PermissionGuard 
  requiredPermission={['manage_vendors', 'manage_drivers']}
  requireAll={false} // OU: requireAll={true} pour TOUS
>
  <AdminPanel />
</PermissionGuard>

// Avec fallback personnalisé
<PermissionGuard 
  requiredPermission="manage_vendors"
  fallback={<ErrorMessage />}
>
  <VendorManager />
</PermissionGuard>
```

### 4. Composant de Gestion

```typescript
import { PDGAgentPermissionManager } from '@/components/pdg/PDGAgentPermissionManager';

function PDGDashboard() {
  return (
    <PDGAgentPermissionManager pdgId={currentUserPDGId} />
  );
}
```

### 5. Analyseur et Diagnostic

```typescript
import { PDGPermissionsAnalyzer } from '@/components/pdg/PDGPermissionsAnalyzer';

function AdminPanel() {
  return <PDGPermissionsAnalyzer />;
}
```

---

## 📋 Liste des Permissions Disponibles

### Gestion des Utilisateurs
| Permission | Nom | Risque |
|-----------|-----|--------|
| `pdg_manage_vendors` | Gestion des vendeurs | HIGH |
| `pdg_manage_drivers` | Gestion des chauffeurs | MEDIUM |
| `pdg_manage_users` | Gestion des utilisateurs | CRITICAL |
| `pdg_ban_unban_users` | Bannissement/débannissement | HIGH |
| `pdg_verify_kyc` | Vérification KYC | HIGH |

### Finance et Paiements
| Permission | Nom | Risque |
|-----------|-----|--------|
| `pdg_access_wallet` | Accès au portefeuille PDG | CRITICAL |
| `pdg_manage_commissions` | Gestion des commissions | HIGH |
| `pdg_manage_escrow` | Gestion du séquestre | HIGH |
| `pdg_refund_transactions` | Remboursements | CRITICAL |
| `pdg_view_financial_dashboard` | Tableau de bord financier | MEDIUM |

### Analytics et Rapports
| Permission | Nom | Risque |
|-----------|-----|--------|
| `pdg_view_analytics` | Accès aux analytiques | LOW |
| `pdg_view_reports` | Rapports système | MEDIUM |
| `pdg_export_data` | Export de données | MEDIUM |

### Opérations
| Permission | Nom | Risque |
|-----------|-----|--------|
| `pdg_manage_orders` | Gestion des commandes | HIGH |
| `pdg_manage_deliveries` | Gestion des livraisons | MEDIUM |
| `pdg_manage_subscriptions` | Gestion des abonnements | MEDIUM |

### Sécurité et Système
| Permission | Nom | Risque |
|-----------|-----|--------|
| `pdg_manage_roles` | Gestion des rôles | CRITICAL |
| `pdg_manage_api_keys` | Gestion des clés API | CRITICAL |
| `pdg_manage_system_config` | Configuration système | CRITICAL |

---

## 🔍 Vérification dans le Code Existant

### Exemple: Protéger une page PDG

```typescript
// Avant (accepte seulement les PDG)
if (user?.role !== 'pdg') {
  return <Unauthorized />;
}

// Après (accepte PDG OU agents avec permission)
const hasAccess = user?.role === 'pdg' || 
  await checkAgentPermission(agentId, 'manage_vendors');

if (!hasAccess) {
  return <Unauthorized />;
}
```

### Exemple: Vérifier plusieurs permissions

```typescript
import { useAgentPermissions } from '@/hooks/usePDGAgentPermissions';

function VendorDashboard() {
  const { hasAnyPermission, hasAllPermissions } = useAgentPermissions();

  // Au moins une permission
  if (!hasAnyPermission(['manage_vendors', 'view_reports'])) {
    return <Forbidden />;
  }

  // Toutes les permissions
  if (!hasAllPermissions(['manage_vendors', 'manage_inventory'])) {
    return <LimitedMode />;
  }

  return <FullDashboard />;
}
```

---

## 🚀 Intégration dans les Composants Existants

### Fichiers à modifier

1. **[src/components/pdg/PDGAgentsManagement.tsx](../src/components/pdg/PDGAgentsManagement.tsx)**
   - Importer `PDGAgentPermissionManager`
   - Ajouter onglet "Permissions"

2. **[src/components/pdg/PDGDashboardHome.tsx](../src/components/pdg/PDGDashboardHome.tsx)**
   - Intégrer `PDGPermissionsAnalyzer`

3. **Tous les composants PDG protégés**
   - Ajouter `<PermissionGuard>` ou `useAgentPermissions()`

### Exemple d'intégration

```typescript
// PDGAgentsManagement.tsx
import { PDGAgentPermissionManager } from '@/components/pdg/PDGAgentPermissionManager';

export function PDGAgentsManagement() {
  return (
    <Tabs>
      <TabsContent value="agents">
        <AgentsList />
      </TabsContent>
      <TabsContent value="permissions">
        <PDGAgentPermissionManager pdgId={pdgId} />
      </TabsContent>
    </Tabs>
  );
}
```

---

## 📊 Audit et Monitoring

Toutes les actions sont enregistrées dans `pdg_permissions_audit`:

```sql
-- Voir tous les changements de permissions pour un PDG
SELECT 
  action,
  agent_id,
  permission_key,
  executed_by,
  executed_at,
  reason
FROM pdg_permissions_audit
WHERE pdg_id = '...'
ORDER BY executed_at DESC;
```

---

## ✅ Checklist d'Implémentation

- [x] Migration SQL créée
- [x] Fonctions RLS et sécurisées
- [x] Hook React `usePDGAgentPermissions`
- [x] Hook React `useAgentPermissions`
- [x] Composant UI `PDGAgentPermissionManager`
- [x] Composant de protection `PermissionGuard`
- [x] Analyseur et diagnostic
- [ ] Intégrer dans PDGAgentsManagement
- [ ] Mettre à jour les composants PDG existants
- [ ] Tests d'intégration
- [ ] Documentation utilisateur

---

## 🐛 Dépannage

### "Permission inexistante"
- Vérifier que la permission existe dans `pdg_permission_catalog`
- Utiliser le composant `PDGPermissionsAnalyzer` pour diagnostiquer

### "Agent n'a pas accès"
- Vérifier que l'agent a la permission ET qu'elle n'est pas expirée
- Vérifier `is_active = true`
- Consulter l'audit: `pdg_permissions_audit`

### Permissions pas mises à jour en temps réel
- Utiliser les subscriptions Supabase pour real-time
- Implémenter un webhook de rafraîchissement

---

## 📝 Notes de Sécurité

1. ✅ **2FA requis** pour les permissions CRITICAL
2. ✅ **Audit complet** de toutes les modifications
3. ✅ **Expiration automatique** des permissions
4. ✅ **Scope optionnel** (ex: limiter à certains vendeurs)
5. ✅ **Révocation rapide** en cas de problème
