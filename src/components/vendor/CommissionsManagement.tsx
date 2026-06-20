import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, AlertCircle, TrendingUp, Users, Percent, RefreshCw, Save, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAgent } from '@/contexts/AgentContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CommissionSetting {
  id: string;
  setting_key: string;
  setting_value: number;
  description: string | null;
  min_value: number | null;
  max_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CommissionLog {
  id: string;
  agent_id: string;
  amount: number;
  source_type: string;
  description: string | null;
  created_at: string;
  related_user_id: string | null;
}

interface CommissionStats {
  totalEarned: number;
  pendingAmount: number;
  paidAmount: number;
  currentRate: number;
  thisMonthEarned: number;
  totalTransactions: number;
}

export default function CommissionsManagement() {
  const { t } = useTranslation();
  const { agent } = useAgent();
  const [settings, setSettings] = useState<CommissionSetting[]>([]);
  const [commissionLogs, setCommissionLogs] = useState<CommissionLog[]>([]);
  const [stats, setStats] = useState<CommissionStats>({
    totalEarned: 0,
    pendingAmount: 0,
    paidAmount: 0,
    currentRate: 0,
    thisMonthEarned: 0,
    totalTransactions: 0
  });
  const [loading, setLoading] = useState(true);
  const [editedSettings, setEditedSettings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [isPDG, setIsPDG] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      if (agent) {
        const { data: vendorAgent } = await supabase
          .from('vendor_agents')
          .select('id, commission_rate, total_commissions_earned')
          .eq('id', agent.id)
          .maybeSingle();

        const totalEarned = Number(vendorAgent?.total_commissions_earned || 0);
        const currentRate = Number(vendorAgent?.commission_rate || 0);

        setSettings([]);
        setCommissionLogs([]);
        setIsPDG(false);
        setStats({
          totalEarned,
          pendingAmount: 0,
          paidAmount: totalEarned,
          currentRate,
          thisMonthEarned: totalEarned,
          totalTransactions: 0
        });
        return;
      }

      // Vérifier si l'utilisateur est PDG
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pdgData } = await supabase
          .from('pdg_management')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        setIsPDG(!!pdgData);

        // Charger les paramètres de commission
        const { data: settingsData, error: settingsError } = await supabase
          .from('commission_settings')
          .select('*')
          .order('setting_key');

        if (settingsError) throw settingsError;
        setSettings(settingsData || []);

        // Charger les logs de commission (pour les agents)
        const { data: agentData } = await supabase
          .from('agents_management')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (agentData) {
          const { data: logsData, error: logsError } = await supabase
            .from('agent_commissions_log')
            .select('*')
            .eq('agent_id', agentData.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (logsError) throw logsError;
          setCommissionLogs(logsData || []);

          // Calculer les statistiques
          const totalEarned = (logsData || []).reduce((sum, log) => sum + (log.amount || 0), 0);
          const thisMonth = new Date();
          thisMonth.setDate(1);
          thisMonth.setHours(0, 0, 0, 0);

          const thisMonthEarned = (logsData || [])
            .filter(log => new Date(log.created_at) >= thisMonth)
            .reduce((sum, log) => sum + (log.amount || 0), 0);

          // Récupérer le taux de commission actuel
          const baseCommissionSetting = (settingsData || []).find(s => s.setting_key === 'base_user_commission');
          const currentRate = baseCommissionSetting ? Number(baseCommissionSetting.setting_value) * 100 : 20;

          setStats({
            totalEarned,
            pendingAmount: 0,
            paidAmount: totalEarned,
            currentRate,
            thisMonthEarned,
            totalTransactions: (logsData || []).length
          });
        } else if (pdgData) {
          // Pour PDG, charger toutes les commissions
          const { data: allLogsData } = await supabase
            .from('agent_commissions_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

          setCommissionLogs(allLogsData || []);

          const totalEarned = (allLogsData || []).reduce((sum, log) => sum + (log.amount || 0), 0);
          const baseCommissionSetting = (settingsData || []).find(s => s.setting_key === 'base_user_commission');
          const currentRate = baseCommissionSetting ? Number(baseCommissionSetting.setting_value) * 100 : 20;

          setStats({
            totalEarned,
            pendingAmount: 0,
            paidAmount: totalEarned,
            currentRate,
            thisMonthEarned: totalEarned,
            totalTransactions: (allLogsData || []).length
          });
        }
      }
    } catch (error) {
      console.error('Erreur chargement données commission:', error);
      toast.error(t('commissionsManagement.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateSetting = async (settingKey: string, newValue: number) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('commission_settings')
        .update({ setting_value: newValue })
        .eq('setting_key', settingKey);

      if (error) throw error;

      toast.success(`Taux mis à jour: ${(newValue * 100).toFixed(1)}%`);
      await loadData();
      setEditedSettings(prev => {
        const updated = { ...prev };
        delete updated[settingKey];
        return updated;
      });
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      toast.error(t('commissionsManagement.erreurLorsDeLaMise'));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = useFormatCurrency();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSettingLabel = (key: string) => {
    const labels: Record<string, { title: string; icon: React.ReactNode }> = {
      'base_user_commission': { title: 'Commission Agent Principal', icon: <DollarSign className="w-4 h-4" /> },
      'sub_agent_commission': { title: 'Commission Sous-Agent', icon: <Users className="w-4 h-4" /> },
      'referral_bonus': { title: 'Bonus Parrainage', icon: <TrendingUp className="w-4 h-4" /> },
      'platform_fee': { title: 'Frais Plateforme', icon: <Percent className="w-4 h-4" /> }
    };
    return labels[key] || { title: key, icon: <Settings className="w-4 h-4" /> };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('commissionsManagement.totalGagne')}</CardTitle>
            <DollarSign className="w-4 h-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {formatCurrency(stats.totalEarned)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalTransactions} transactions
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ce Mois</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.thisMonthEarned)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Commissions du mois
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taux Actuel</CardTitle>
            <Percent className="w-4 h-4 text-[#04439e]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#04439e]">
              {stats.currentRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Commission par vente
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Users className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.totalTransactions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Achats clients
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList>
          <TabsTrigger value="history">Historique</TabsTrigger>
          {isPDG && <TabsTrigger value="settings">Configuration</TabsTrigger>}
        </TabsList>

        {/* Historique des commissions */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Historique des Commissions
              </CardTitle>
              <CardDescription>
                Liste des commissions reçues sur les achats de vos clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissionLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">{t('commissionsManagement.montant')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.description || 'Commission sur achat'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-[#ff4000]">
                          +{formatCurrency(log.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('commissionsManagement.aucuneCommissionEnregistree')}</p>
                  <p className="text-sm mt-2">
                    Les commissions apparaîtront ici lorsque vos clients effectueront des achats
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration (PDG uniquement) */}
        {isPDG && (
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuration des Commissions
                </CardTitle>
                <CardDescription>
                  Modifiez les taux de commission pour les agents et sous-agents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-900">{t('commissionsManagement.impactEnTempsReel')}</AlertTitle>
                  <AlertDescription className="text-blue-800">
                    Les modifications s'appliquent immédiatement aux prochaines transactions.
                    Les commissions existantes ne sont pas affectées.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  {settings.map((setting) => {
                    const { title, icon } = getSettingLabel(setting.setting_key);
                    const currentEditValue = editedSettings[setting.setting_key];
                    const displayValue = currentEditValue !== undefined
                      ? currentEditValue
                      : Number(setting.setting_value) * 100;
                    const hasChanges = currentEditValue !== undefined;

                    return (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-gray-50 to-white"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10 text-primary">
                            {icon}
                          </div>
                          <div>
                            <h4 className="font-medium">{title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {setting.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={displayValue.toFixed(1)}
                              onChange={(e) => {
                                const newPercent = parseFloat(e.target.value);
                                if (!isNaN(newPercent)) {
                                  setEditedSettings(prev => ({
                                    ...prev,
                                    [setting.setting_key]: newPercent
                                  }));
                                }
                              }}
                              className="w-20 text-right font-bold"
                              step="0.5"
                              min={(setting.min_value || 0) * 100}
                              max={(setting.max_value || 1) * 100}
                            />
                            <span className="text-sm font-medium">%</span>
                          </div>

                          {hasChanges && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateSetting(setting.setting_key, currentEditValue / 100)}
                              disabled={saving}
                            >
                              {saving ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Aperçu des calculs */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                  <h5 className="font-medium mb-3">{t('commissionsManagement.exempleDeCalcul')}</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('commissionsManagement.achatClient')}</p>
                      <p className="font-bold">100,000 GNF</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission Agent</p>
                      <p className="font-bold text-[#ff4000]">
                        {formatCurrency(100000 * (Number(settings.find(s => s.setting_key === 'base_user_commission')?.setting_value) || 0.2))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission Sous-Agent</p>
                      <p className="font-bold text-blue-600">
                        {formatCurrency(100000 * (Number(settings.find(s => s.setting_key === 'sub_agent_commission')?.setting_value) || 0.1))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Frais Plateforme</p>
                      <p className="font-bold text-orange-600">
                        {formatCurrency(100000 * (Number(settings.find(s => s.setting_key === 'platform_fee')?.setting_value) || 0.025))}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
