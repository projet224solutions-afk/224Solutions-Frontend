/**
 * 🔄 SERVICE DE SYNCHRONISATION PDG - 224SOLUTIONS
 *
 * Service centralisé pour garantir la cohérence des données entre:
 * - Interface PDG
 * - Module Agents
 * - Module Bureaux/Syndicats
 * - Module Finance
 * - Module Utilisateurs
 *
 * PRINCIPE: profiles.public_id est la SOURCE UNIQUE DE VÉRITÉ pour tous les identifiants
 */

import { supabase } from '@/integrations/supabase/client';

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
  details?: Record<string, any>;
}

export interface DataConsistencyCheck {
  table: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  count?: number;
  discrepancies?: number;
}

class PDGSyncService {
  private static instance: PDGSyncService;

  private constructor() {}

  public static getInstance(): PDGSyncService {
    if (!PDGSyncService.instance) {
      PDGSyncService.instance = new PDGSyncService();
    }
    return PDGSyncService.instance;
  }

  /**
   * Vérifie la cohérence des données entre les différentes tables
   */
  async checkDataConsistency(): Promise<DataConsistencyCheck[]> {
    const checks: DataConsistencyCheck[] = [];

    try {
      // 1. Vérifier synchronisation profiles.public_id ↔ user_ids.custom_id
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, public_id');

      const { data: userIds } = await supabase
        .from('user_ids')
        .select('user_id, custom_id');

      const userIdMap = new Map((userIds || []).map(u => [u.user_id, u.custom_id]));
      const profilesWithoutMatch = (profiles || []).filter(p =>
        p.public_id && userIdMap.get(p.id) !== p.public_id
      );

      checks.push({
        table: 'profiles ↔ user_ids',
        status: profilesWithoutMatch.length === 0 ? 'ok' : 'warning',
        message: profilesWithoutMatch.length === 0
          ? 'IDs synchronisés'
          : `${profilesWithoutMatch.length} IDs désynchronisés`,
        discrepancies: profilesWithoutMatch.length
      });

      // 2. Vérifier synchronisation vendors.vendor_code ↔ profiles.public_id
      const { data: vendorDesync, count: vendorCount } = await supabase
        .from('vendors')
        .select('id, vendor_code, user_id', { count: 'exact' })
        .not('vendor_code', 'is', null);

      const { data: vendorProfiles } = await supabase
        .from('profiles')
        .select('id, public_id')
        .eq('role', 'vendeur');

      const vendorProfileMap = new Map(vendorProfiles?.map(p => [p.id, p.public_id]) || []);
      const vendorMismatches = (vendorDesync || []).filter(v =>
        vendorProfileMap.get(v.user_id) !== v.vendor_code
      );

      checks.push({
        table: 'vendors ↔ profiles',
        status: vendorMismatches.length === 0 ? 'ok' : 'warning',
        message: vendorMismatches.length === 0
          ? 'Codes vendeurs synchronisés'
          : `${vendorMismatches.length} vendeurs désynchronisés`,
        count: vendorCount || 0,
        discrepancies: vendorMismatches.length
      });

      // 3. Vérifier les agents sans wallet
      const { data: agentsWithoutWallet } = await supabase
        .from('agents_management')
        .select('id, agent_code, name')
        .is('user_id', null);

      checks.push({
        table: 'agents_management (wallets)',
        status: (agentsWithoutWallet?.length || 0) === 0 ? 'ok' : 'warning',
        message: (agentsWithoutWallet?.length || 0) === 0
          ? 'Tous les agents ont un compte utilisateur'
          : `${agentsWithoutWallet?.length} agents sans compte Supabase Auth`,
        discrepancies: agentsWithoutWallet?.length || 0
      });

      // 4. Vérifier les wallets orphelins (sans profil correspondant)
      const { data: allWallets } = await supabase
        .from('wallets')
        .select('id, user_id');

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id');

      const profileIds = new Set(allProfiles?.map(p => p.id) || []);
      const orphanWallets = (allWallets || []).filter(w => !profileIds.has(w.user_id));

      checks.push({
        table: 'wallets (orphelins)',
        status: orphanWallets.length === 0 ? 'ok' : 'error',
        message: orphanWallets.length === 0
          ? 'Aucun wallet orphelin'
          : `${orphanWallets.length} wallets sans profil associé`,
        discrepancies: orphanWallets.length
      });

      // 5. Vérifier les transactions avec des wallets inexistants
      const { data: recentTransactions } = await supabase
        .from('wallet_transactions')
        .select('id, sender_wallet_id, receiver_wallet_id')
        .limit(1000);

      const walletIds = new Set(allWallets?.map(w => w.id) || []);
      const invalidTransactions = (recentTransactions || []).filter(t =>
        (t.sender_wallet_id && !walletIds.has(t.sender_wallet_id)) ||
        (t.receiver_wallet_id && !walletIds.has(t.receiver_wallet_id))
      );

      checks.push({
        table: 'wallet_transactions (intégrité)',
        status: invalidTransactions.length === 0 ? 'ok' : 'error',
        message: invalidTransactions.length === 0
          ? 'Toutes les transactions référencent des wallets valides'
          : `${invalidTransactions.length} transactions avec wallets invalides`,
        discrepancies: invalidTransactions.length
      });

    } catch (error) {
      console.error('Erreur vérification cohérence:', error);
      checks.push({
        table: 'system',
        status: 'error',
        message: `Erreur système: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      });
    }

    return checks;
  }

  /**
   * Synchronise profiles.public_id avec user_ids.custom_id
   * Gère les conflits de clés uniques en procédant en deux phases
   */
  async syncPublicIds(): Promise<SyncResult> {
    const errors: string[] = [];
    let synced = 0;

    try {
      // Récupérer tous les profils et user_ids
      const [{ data: profiles }, { data: userIds }] = await Promise.all([
        supabase.from('profiles').select('id, public_id, role'),
        supabase.from('user_ids').select('user_id, custom_id')
      ]);

      const userIdMap = new Map(userIds?.map(u => [u.user_id, u.custom_id]) || []);
      const customIdToUserMap = new Map(userIds?.map(u => [u.custom_id, u.user_id]) || []);

      // Phase 1: Identifier les profils à synchroniser
      const profilesToSync = (profiles || []).filter(profile => {
        const existingCustomId = userIdMap.get(profile.id);
        return profile.public_id && existingCustomId !== profile.public_id;
      });

      // Phase 2: Synchroniser en vérifiant les conflits
      for (const profile of profilesToSync) {
        // Vérifier si le public_id est déjà utilisé par un autre utilisateur
        const conflictUserId = customIdToUserMap.get(profile.public_id);

        if (conflictUserId && conflictUserId !== profile.id) {
          // Il y a un conflit - quelqu'un d'autre utilise déjà ce custom_id
          errors.push(`Conflit: ${profile.public_id} est déjà assigné à un autre utilisateur`);
          continue;
        }

        // Pas de conflit, on peut synchroniser
        const { error } = await supabase
          .from('user_ids')
          .upsert({
            user_id: profile.id,
            custom_id: profile.public_id
          }, { onConflict: 'user_id' });

        if (error) {
          if (error.message.includes('duplicate key')) {
            errors.push(`Conflit clé unique pour ${profile.public_id}`);
          } else {
            errors.push(`Erreur sync ${profile.id}: ${error.message}`);
          }
        } else {
          synced++;
          // Mettre à jour notre map locale
          customIdToUserMap.set(profile.public_id, profile.id);
        }
      }

      return {
        success: errors.length === 0,
        synced,
        errors,
        details: {
          totalChecked: profilesToSync.length,
          conflicts: errors.filter(e => e.includes('Conflit')).length
        }
      };
    } catch (error) {
      return {
        success: false,
        synced,
        errors: [...errors, error instanceof Error ? error.message : 'Erreur inconnue']
      };
    }
  }

  /**
   * Synchronise les vendor_code avec profiles.public_id
   */
  async syncVendorCodes(): Promise<SyncResult> {
    const errors: string[] = [];
    let synced = 0;

    try {
      // Récupérer les vendeurs et leurs profils
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, user_id, vendor_code');

      const { data: vendorProfiles } = await supabase
        .from('profiles')
        .select('id, public_id')
        .eq('role', 'vendeur');

      const profileMap = new Map(vendorProfiles?.map(p => [p.id, p.public_id]) || []);

      for (const vendor of vendors || []) {
        const correctPublicId = profileMap.get(vendor.user_id);

        if (correctPublicId && vendor.vendor_code !== correctPublicId) {
          const { error } = await supabase
            .from('vendors')
            .update({ vendor_code: correctPublicId })
            .eq('id', vendor.id);

          if (error) {
            errors.push(`Erreur sync vendor ${vendor.id}: ${error.message}`);
          } else {
            synced++;
          }
        }
      }

      return { success: errors.length === 0, synced, errors };
    } catch (error) {
      return {
        success: false,
        synced,
        errors: [...errors, error instanceof Error ? error.message : 'Erreur inconnue']
      };
    }
  }

  /**
   * Génère un rapport complet de synchronisation
   */
  async generateSyncReport(): Promise<{
    timestamp: string;
    consistency: DataConsistencyCheck[];
    recommendations: string[];
  }> {
    const consistency = await this.checkDataConsistency();
    const recommendations: string[] = [];

    // Analyser les résultats et générer des recommandations
    for (const check of consistency) {
      if (check.status === 'warning' && check.discrepancies && check.discrepancies > 0) {
        if (check.table.includes('profiles')) {
          recommendations.push(`Exécuter syncPublicIds() pour synchroniser ${check.discrepancies} IDs`);
        }
        if (check.table.includes('vendors')) {
          recommendations.push(`Exécuter syncVendorCodes() pour synchroniser ${check.discrepancies} codes vendeurs`);
        }
      }
      if (check.status === 'error') {
        recommendations.push(`⚠️ CRITIQUE: ${check.message} - Investigation manuelle requise`);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      consistency,
      recommendations
    };
  }

  /**
   * Exécute une synchronisation complète
   */
  async runFullSync(): Promise<{
    publicIds: SyncResult;
    vendorCodes: SyncResult;
    totalSynced: number;
    totalErrors: number;
  }> {
    const publicIds = await this.syncPublicIds();
    const vendorCodes = await this.syncVendorCodes();

    return {
      publicIds,
      vendorCodes,
      totalSynced: publicIds.synced + vendorCodes.synced,
      totalErrors: publicIds.errors.length + vendorCodes.errors.length
    };
  }
}

export const pdgSyncService = PDGSyncService.getInstance();
export default PDGSyncService;
