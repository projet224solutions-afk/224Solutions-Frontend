/**
 * COMPOSANT: Configuration du système de paiement (Admin)
 * 224SOLUTIONS - Interface pour ajuster les paramètres du système
 */

// build: force-recompile

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Save, RotateCcw, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigItem {
  config_key: string;
  config_value: any;
  description: string;
  updated_at: string;
}

export function PaymentSystemConfig() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_system_config')
        .select('*')
        .order('config_key');

      if (error) throw error;

      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error(t('paymentSystemConfig.erreurLorsDuChargementDe'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setChanges(prev => ({ ...prev, [key]: value }));
  };

  const getValue = (key: string, defaultValue: any) => {
    if (changes[key] !== undefined) {
      return changes[key];
    }
    const config = configs.find(c => c.config_key === key);
    return config ? JSON.parse(config.config_value) : defaultValue;
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      toast.info(t('paymentSystemConfig.aucunChangementASauvegarder'));
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Sauvegarder chaque changement dans la table payment_system_config
      for (const [key, value] of Object.entries(changes)) {
        const { error } = await supabase
          .from('payment_system_config')
          .upsert({
            config_key: key,
            config_value: String(value),
            updated_at: new Date().toISOString(),
            updated_by: user.id
          }, { onConflict: 'config_key' });

        if (error) throw error;
      }

      toast.success(t('paymentSystemConfig.configurationMiseAJour'), {
        description: `${Object.keys(changes).length} paramètre(s) modifié(s)`,
      });

      setChanges({});
      fetchConfigs();

    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error(t('paymentSystemConfig.erreurLorsDeLaSauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setChanges({});
    toast.info(t('paymentSystemConfig.changementsAnnules'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-primary" />
                Configuration du système de paiement
              </CardTitle>
              <CardDescription>
                Ajuster les paramètres du système de déblocage intelligent
              </CardDescription>
            </div>
            {Object.keys(changes).length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} disabled={saving}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Sauvegarde...' : `Sauvegarder (${Object.keys(changes).length})`}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="trust-score" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trust-score">Trust Score</TabsTrigger>
          <TabsTrigger value="delays">{t('paymentSystemConfig.delais')}</TabsTrigger>
          <TabsTrigger value="blocking">Blocages</TabsTrigger>
          <TabsTrigger value="random">{t('paymentSystemConfig.controleAleatoire')}</TabsTrigger>
          <TabsTrigger value="other">Autre</TabsTrigger>
        </TabsList>

        {/* Trust Score Tab */}
        <TabsContent value="trust-score">
          <Card>
            <CardHeader>
              <CardTitle>{t('paymentSystemConfig.parametresDuTrustScore')}</CardTitle>
              <CardDescription>
                Ajuster les seuils et pondérations du calcul de confiance (0-100)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Seuils */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('paymentSystemConfig.seuilsDeDecision')}</h3>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="auto-approve">Seuil auto-approbation</Label>
                    <Input
                      id="auto-approve"
                      type="number"
                      min="0"
                      max="100"
                      value={getValue('trust_score.auto_approve_threshold', 80)}
                      onChange={(e) => handleChange('trust_score.auto_approve_threshold', e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Score minimum pour auto-approbation (défaut: 80)
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="admin-review">Seuil review admin</Label>
                    <Input
                      id="admin-review"
                      type="number"
                      min="0"
                      max="100"
                      value={getValue('trust_score.admin_review_threshold', 50)}
                      onChange={(e) => handleChange('trust_score.admin_review_threshold', e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Score minimum pour review admin, sinon bloqué (défaut: 50)
                    </p>
                  </div>
                </div>
              </div>

              {/* Pondérations */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('paymentSystemConfig.ponderationDesFacteurs')}</h3>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>{t('paymentSystemConfig.ageUtilisateurMaxPoints')}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={getValue('trust_score.user_age_weight', 20)}
                      onChange={(e) => handleChange('trust_score.user_age_weight', e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Historique carte (max points)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={getValue('trust_score.card_history_weight', 20)}
                      onChange={(e) => handleChange('trust_score.card_history_weight', e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{t('paymentSystemConfig.kycVendeurMaxPoints')}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={getValue('trust_score.kyc_weight', 30)}
                      onChange={(e) => handleChange('trust_score.kyc_weight', e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{t('paymentSystemConfig.montantNormalMaxPoints')}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={getValue('trust_score.amount_risk_weight', 20)}
                      onChange={(e) => handleChange('trust_score.amount_risk_weight', e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{t('paymentSystemConfig.pasDeChargebackMaxPoints')}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={getValue('trust_score.chargeback_weight', 10)}
                      onChange={(e) => handleChange('trust_score.chargeback_weight', e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <Shield className="inline h-4 w-4 mr-2" />
                    La somme des pondérations devrait idéalement égaler 100
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delays Tab */}
        <TabsContent value="delays">
          <Card>
            <CardHeader>
              <CardTitle>{t('paymentSystemConfig.delaisDeLiberationSmartDelay')}</CardTitle>
              <CardDescription>
                Configurer les délais selon le Trust Score
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>{t('paymentSystemConfig.trustScore90DelaiEn')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={getValue('release_delay.trust_90_plus', 30)}
                    onChange={(e) => handleChange('release_delay.trust_90_plus', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">{t('paymentSystemConfig.defaut30Minutes')}</p>
                </div>

                <div className="grid gap-2">
                  <Label>{t('paymentSystemConfig.trustScore80DelaiEn')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={getValue('release_delay.trust_80_plus', 60)}
                    onChange={(e) => handleChange('release_delay.trust_80_plus', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">{t('paymentSystemConfig.defaut60Minutes')}</p>
                </div>

                <div className="grid gap-2">
                  <Label>{t('paymentSystemConfig.trustScore70DelaiEn')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={getValue('release_delay.trust_70_plus', 90)}
                    onChange={(e) => handleChange('release_delay.trust_70_plus', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">{t('paymentSystemConfig.defaut90Minutes')}</p>
                </div>

                <div className="grid gap-2">
                  <Label>Trust Score {'<'} 70 (délai en minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={getValue('release_delay.trust_below_70', 120)}
                    onChange={(e) => handleChange('release_delay.trust_below_70', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">{t('paymentSystemConfig.defaut120Minutes')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blocking Tab */}
        <TabsContent value="blocking">
          <Card>
            <CardHeader>
              <CardTitle>Blocages automatiques</CardTitle>
              <CardDescription>
                Configurer les règles de blocage automatique
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Activer blocages automatiques</Label>
                  <p className="text-sm text-muted-foreground">
                    Bloquer automatiquement les transactions suspectes
                  </p>
                </div>
                <Switch
                  checked={getValue('auto_block.enabled', true)}
                  onCheckedChange={(checked) => handleChange('auto_block.enabled', checked)}
                />
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>{t('paymentSystemConfig.vendeurRecentJours')}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={getValue('auto_block.new_seller_days', 7)}
                    onChange={(e) => handleChange('auto_block.new_seller_days', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Bloquer vendeurs créés il y a moins de X jours (défaut: 7)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>{t('paymentSystemConfig.multiplicateurMontant')}</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    value={getValue('auto_block.amount_multiplier', 5)}
                    onChange={(e) => handleChange('auto_block.amount_multiplier', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Bloquer montants {'>'} X fois la moyenne du vendeur (défaut: 5)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Random Review Tab */}
        <TabsContent value="random">
          <Card>
            <CardHeader>
              <CardTitle>{t('paymentSystemConfig.controleAleatoire')}</CardTitle>
              <CardDescription>
                Forcer un pourcentage de paiements en review manuelle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('paymentSystemConfig.activerControleAleatoire')}</Label>
                  <p className="text-sm text-muted-foreground">
                    Forcer des paiements AUTO_APPROVED en ADMIN_REVIEW
                  </p>
                </div>
                <Switch
                  checked={getValue('random_review.enabled', true)}
                  onCheckedChange={(checked) => handleChange('random_review.enabled', checked)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Pourcentage (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={getValue('random_review.percentage', 3)}
                  onChange={(e) => handleChange('random_review.percentage', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Pourcentage de paiements AUTO_APPROVED forcés en review (défaut: 3%)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Tab */}
        <TabsContent value="other">
          <Card>
            <CardHeader>
              <CardTitle>{t('paymentSystemConfig.autresParametres')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Notifications</h3>

                <div className="flex items-center justify-between">
                  <Label>Activer notifications</Label>
                  <Switch
                    checked={getValue('notifications.enabled', true)}
                    onCheckedChange={(checked) => handleChange('notifications.enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>{t('paymentSystemConfig.notifierVendeurFondsEnAttente')}</Label>
                  <Switch
                    checked={getValue('notifications.send_on_hold', true)}
                    onCheckedChange={(checked) => handleChange('notifications.send_on_hold', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>{t('paymentSystemConfig.notifierVendeurLiberation')}</Label>
                  <Switch
                    checked={getValue('notifications.send_on_release', true)}
                    onCheckedChange={(checked) => handleChange('notifications.send_on_release', checked)}
                  />
                </div>
              </div>

              {/* Double vérification */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('paymentSystemConfig.doubleVerificationStripe')}</h3>

                <div className="flex items-center justify-between">
                  <Label>{t('paymentSystemConfig.activerDoubleVerification')}</Label>
                  <Switch
                    checked={getValue('double_verification.enabled', true)}
                    onCheckedChange={(checked) => handleChange('double_verification.enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Mode strict</Label>
                  <Switch
                    checked={getValue('double_verification.strict', true)}
                    onCheckedChange={(checked) => handleChange('double_verification.strict', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
