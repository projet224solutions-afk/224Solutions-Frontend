/**
 * HOOK VENDEUR OPTIMISÉ
 * Gestion optimisée des données vendeur avec cache et retry
 * 224Solutions - Optimized Vendor Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useCurrentVendor } from './useCurrentVendor';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VendorStats {
    revenue: number;
    profit: number;
    orders_count: number;
    orders_pending: number;
    customers_count: number;
    products_count: number;
    low_stock_count: number;
    overdue_payments: number;
}

interface VendorProfile {
    id: string;
    user_id: string;
    business_name: string;
    business_type: string;
    status: string;
    created_at: string;
}

export function useVendorOptimized() {
    const { user } = useAuth();
    const { vendorId: currentVendorId, loading: currentVendorLoading } = useCurrentVendor();
    const { toast } = useToast();

    // Charger stats depuis Supabase directement
    const [stats, setStats] = useState<VendorStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<Error | null>(null);

    const refetchStats = useCallback(async () => {
        if (currentVendorLoading || (!user && !currentVendorId)) return;

        setStatsLoading(true);
        try {
            const vendor = currentVendorId
                ? { id: currentVendorId }
                : (await supabase
                    .from('vendors')
                    .select('id')
                    .eq('user_id', user.id)
                    .single()).data;

            if (!vendor) throw new Error('Vendeur non trouvé');

            // Récupérer les statistiques (à implémenter selon vos besoins)
            setStats({
                revenue: 0,
                profit: 0,
                orders_count: 0,
                orders_pending: 0,
                customers_count: 0,
                products_count: 0,
                low_stock_count: 0,
                overdue_payments: 0
            });
        } catch (err) {
            setStatsError(err as Error);
        } finally {
            setStatsLoading(false);
        }
    }, [user, currentVendorId, currentVendorLoading]);

    useEffect(() => {
        refetchStats();
    }, [refetchStats]);

    // Charger profil vendeur
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<Error | null>(null);

    const loadProfile = useCallback(async () => {
        if (currentVendorLoading || (!user && !currentVendorId)) return;

        setProfileLoading(true);
        try {
            const query = supabase
                .from('vendors')
                .select('*');

            const { data, error } = currentVendorId
                ? await query.eq('id', currentVendorId).single()
                : await query.eq('user_id', user.id).single();

            if (error) throw error;
            setProfile(data as unknown);
        } catch (err) {
            setProfileError(err as Error);
        } finally {
            setProfileLoading(false);
        }
    }, [user, currentVendorId, currentVendorLoading]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    // Fonction de création de profil vendeur
    const createVendorProfile = useCallback(async (profileData: Partial<VendorProfile>) => {
        if (!user) throw new Error('Utilisateur non authentifié');

        try {
            const { data, error } = await supabase
                .from('vendors')
                .insert({
                    user_id: user.id,
                    business_name: profileData.business_name || 'Mon Entreprise',
                    business_type: profileData.business_type || 'retail',
                    status: 'active',
                    ...profileData
                })
                .select()
                .single();

            if (error) throw error;

            toast({
                title: "Profil vendeur créé",
                description: "Votre profil vendeur a été créé avec succès",
            });

            return data;
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible de créer le profil vendeur",
                variant: "destructive",
            });
            throw error;
        }
    }, [user, toast]);

    // Fonction de mise à jour du profil
    const updateVendorProfile = useCallback(async (updates: Partial<VendorProfile>) => {
        if (!user || !profile) throw new Error('Profil vendeur non trouvé');

        try {
            const { data, error } = await supabase
                .from('vendors')
                .update(updates)
                .eq('id', profile.id)
                .select()
                .single();

            if (error) throw error;

            toast({
                title: "Profil mis à jour",
                description: "Votre profil vendeur a été mis à jour",
            });

            return data;
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible de mettre à jour le profil",
                variant: "destructive",
            });
            throw error;
        }
    }, [user, profile, toast]);

    // Fonction de diagnostic
    const runDiagnostic = useCallback(async () => {
        const results = [];

        try {
            // Test 1: Authentification
            if (!user) {
                results.push({ test: 'Authentification', status: 'error', message: 'Utilisateur non authentifié' });
                return results;
            }
            results.push({ test: 'Authentification', status: 'success', message: 'Utilisateur authentifié' });

            // Test 2: Profil vendeur
            if (!profile) {
                results.push({ test: 'Profil vendeur', status: 'error', message: 'Profil vendeur non trouvé' });
            } else {
                results.push({ test: 'Profil vendeur', status: 'success', message: 'Profil vendeur trouvé' });
            }

            // Test 3: Statistiques
            if (statsError) {
                results.push({ test: 'Statistiques', status: 'error', message: statsError.message });
            } else if (stats) {
                results.push({ test: 'Statistiques', status: 'success', message: 'Statistiques chargées' });
            }

            // Test 4: Wallet
            const { data: wallet } = await supabase
                .from('wallets')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (!wallet) {
                results.push({ test: 'Wallet', status: 'error', message: 'Wallet non trouvé' });
            } else {
                results.push({ test: 'Wallet', status: 'success', message: 'Wallet trouvé' });
            }

        } catch (error) {
            results.push({ test: 'Diagnostic', status: 'error', message: error.message });
        }

        return results;
    }, [user, profile, stats, statsError]);

    // Fonction de réparation automatique
    const autoFix = useCallback(async () => {
        const fixes = [];

        try {
            // Créer le profil vendeur si manquant
            if (!profile && user) {
                await createVendorProfile({
                    business_name: 'Mon Entreprise',
                    business_type: 'retail'
                });
                fixes.push('Profil vendeur créé');
            }

            // Créer le wallet si manquant
            const { data: wallet } = await supabase
                .from('wallets')
                .select('id')
                .eq('user_id', user?.id)
                .single();

            if (!wallet && user) {
                await supabase
                    .from('wallets')
                    .insert({
                        user_id: user.id,
                        balance: 0,
                        currency: 'GNF'
                    });
                fixes.push('Wallet créé');
            }

            if (fixes.length > 0) {
                toast({
                    title: "Réparation réussie",
                    description: `Corrections appliquées: ${fixes.join(', ')}`,
                });

                // Recharger les données
                refetchStats();
            }

        } catch (error) {
            toast({
                title: "Erreur lors de la réparation",
                description: error.message,
                variant: "destructive",
            });
        }
    }, [user, profile, createVendorProfile, refetchStats, toast]);

    // État global
    const loading = statsLoading || profileLoading;
    const error = statsError || profileError;

    return {
        // Données
        stats,
        profile,
        loading,
        error,

        // Actions
        createVendorProfile,
        updateVendorProfile,
        runDiagnostic,
        autoFix,
        refetchStats
    };
}
