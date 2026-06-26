/**
 * GESTION DE LA CAISSE SYNDICALE ULTRA PROFESSIONNELLE
 * Interface complète pour la gestion des cotisations et de la trésorerie
 * 224Solutions - Bureau Syndicat System
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Users, RefreshCw } from "lucide-react";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface SyndicateTreasuryManagementProps {
    bureauId: string;
}

export default function SyndicateTreasuryManagement({ bureauId }: SyndicateTreasuryManagementProps) {
    const { t } = useTranslation();
    const fc = useFormatCurrency();
    // ✅ Données RÉELLES (RPC get_bureau_treasury) — plus de valeurs en dur
    const [treasuryData, setTreasuryData] = useState({
        balance: 0, monthlyCotis: 0, monthlyExpenses: 0, pendingCount: 0, totalDrivers: 0,
    });
    const [loading, setLoading] = useState(true);

    const loadTreasury = useCallback(async () => {
        if (!bureauId) { setLoading(false); return; }
        setLoading(true);
        try {
            const now = new Date();
            const { data, error } = await supabase.rpc('get_bureau_treasury' as any, {
                p_bureau_id: bureauId,
                p_month: now.getMonth() + 1,
                p_year: now.getFullYear(),
            });
            if (error) throw error;
            const d = data as any;
            setTreasuryData({
                balance:         Number(d?.balance          ?? 0),
                monthlyCotis:    Number(d?.monthly_cotis     ?? 0),
                monthlyExpenses: Number(d?.monthly_expenses  ?? 0),
                pendingCount:    Number(d?.pending_count      ?? 0),
                totalDrivers:    Number(d?.total_drivers      ?? 0),
            });
        } catch (err) {
            // RPC pas encore déployé / erreur réseau → on reste à 0 (pas de fausses données)
            console.error('[Treasury] get_bureau_treasury:', err);
        } finally {
            setLoading(false);
        }
    }, [bureauId]);

    useEffect(() => { loadTreasury(); }, [loadTreasury]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={loadTreasury} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6 text-center">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
                        <div className="text-2xl font-bold text-[#ff4000]">
                            {fc(treasuryData.balance, 'GNF')}
                        </div>
                        <div className="text-sm text-muted-foreground">{t('syndicateTreasuryManagement.soldeDeCaisse')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 text-center">
                        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold text-blue-600">
                            {fc(treasuryData.monthlyCotis, 'GNF')}
                        </div>
                        <div className="text-sm text-muted-foreground">Cotisations ce mois</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 text-center">
                        <TrendingDown className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
                        <div className="text-2xl font-bold text-[#ff4000]">
                            {fc(treasuryData.monthlyExpenses, 'GNF')}
                        </div>
                        <div className="text-sm text-muted-foreground">{t('syndicateTreasuryManagement.depensesCeMois')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                        <div className="text-2xl font-bold text-orange-600">
                            {treasuryData.pendingCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Chauffeurs non à jour{treasuryData.totalDrivers > 0 ? ` / ${treasuryData.totalDrivers}` : ''}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('syndicateTreasuryManagement.gestionDeLaCaisseSyndicale')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">
                            Module de Trésorerie
                        </h3>
                        <p className="text-muted-foreground mb-4">
                            Gestion complète des cotisations, paiements et budget syndical
                        </p>
                        <div className="space-y-2">
                            <Badge variant="outline">Cotisations automatiques</Badge>
                            <Badge variant="outline">{t('syndicateTreasuryManagement.paiementsMobileMoney')}</Badge>
                            <Badge variant="outline">Rapports financiers</Badge>
                            <Badge variant="outline">Audit automatique</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
