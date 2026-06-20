/**
 * Paramètres du module Dropshipping
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Bell, DollarSign, RefreshCw, Save } from 'lucide-react';
import type { DropshipSettings as DropshipSettingsType } from '@/types/dropshipping';

interface DropshipSettingsProps {
  settings: DropshipSettingsType | null;
  loading: boolean;
  onSave: (settings: Partial<DropshipSettingsType>) => Promise<boolean>;
}

export function DropshipSettings({ settings, loading, onSave }: DropshipSettingsProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    is_enabled: true,
    default_margin_percent: 20,
    min_margin_percent: 10,
    auto_sync_enabled: true,
    sync_frequency_hours: 6,
    notify_low_stock: true,
    notify_price_changes: true,
    notify_supplier_issues: true,
    low_stock_threshold: 5,
    hold_payment_days: 7,
    auto_release_on_delivery: true,
    show_supplier_name: false,
    show_estimated_delivery: true
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        is_enabled: settings.is_enabled ?? true,
        default_margin_percent: settings.default_margin_percent ?? 20,
        min_margin_percent: settings.min_margin_percent ?? 10,
        auto_sync_enabled: settings.auto_sync_enabled ?? true,
        sync_frequency_hours: settings.sync_frequency_hours ?? 6,
        notify_low_stock: settings.notify_low_stock ?? true,
        notify_price_changes: settings.notify_price_changes ?? true,
        notify_supplier_issues: settings.notify_supplier_issues ?? true,
        low_stock_threshold: settings.low_stock_threshold ?? 5,
        hold_payment_days: settings.hold_payment_days ?? 7,
        auto_release_on_delivery: settings.auto_release_on_delivery ?? true,
        show_supplier_name: settings.show_supplier_name ?? false,
        show_estimated_delivery: settings.show_estimated_delivery ?? true
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Activation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration Générale
          </CardTitle>
          <CardDescription>
            Activez ou désactivez le module dropshipping
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled" className="font-medium">Module Dropshipping</Label>
              <p className="text-sm text-muted-foreground">
                Activer les fonctionnalités dropshipping
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formData.is_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Marges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Gestion des Marges
          </CardTitle>
          <CardDescription>
            Configurez vos marges par défaut sur les produits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_margin">{t('dropshipSettings.margeParDefaut')}</Label>
              <Input
                id="default_margin"
                type="number"
                min="0"
                max="100"
                value={formData.default_margin_percent}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  default_margin_percent: parseFloat(e.target.value)
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_margin">Marge minimum (%)</Label>
              <Input
                id="min_margin"
                type="number"
                min="0"
                max="100"
                value={formData.min_margin_percent}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  min_margin_percent: parseFloat(e.target.value)
                }))}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hold_days">{t('dropshipSettings.retentionPaiementJours')}</Label>
              <p className="text-xs text-muted-foreground">
                Nombre de jours avant libération du paiement au vendeur
              </p>
              <Input
                id="hold_days"
                type="number"
                min="0"
                max="30"
                value={formData.hold_payment_days}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  hold_payment_days: parseInt(e.target.value)
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto_release">{t('dropshipSettings.liberationAutoALaLivraison')}</Label>
                <p className="text-sm text-muted-foreground">
                  Libérer automatiquement les fonds quand le client confirme réception
                </p>
              </div>
              <Switch
                id="auto_release"
                checked={formData.auto_release_on_delivery}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  auto_release_on_delivery: checked
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Synchronisation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Synchronisation
          </CardTitle>
          <CardDescription>
            Configurez la synchronisation automatique avec les fournisseurs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto_sync">Synchronisation automatique</Label>
              <p className="text-sm text-muted-foreground">
                Mettre à jour automatiquement les prix et stocks
              </p>
            </div>
            <Switch
              id="auto_sync"
              checked={formData.auto_sync_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                auto_sync_enabled: checked
              }))}
            />
          </div>

          {formData.auto_sync_enabled && (
            <div className="space-y-2">
              <Label htmlFor="sync_freq">{t('dropshipSettings.frequenceHeures')}</Label>
              <Input
                id="sync_freq"
                type="number"
                min="1"
                max="24"
                value={formData.sync_frequency_hours}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  sync_frequency_hours: parseInt(e.target.value)
                }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choisissez les alertes à recevoir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Stock faible</Label>
              <p className="text-sm text-muted-foreground">
                Alerter quand le stock fournisseur est bas
              </p>
            </div>
            <Switch
              checked={formData.notify_low_stock}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                notify_low_stock: checked
              }))}
            />
          </div>

          {formData.notify_low_stock && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="threshold">{t('dropshipSettings.seuilDAlerteUnites')}</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  low_stock_threshold: parseInt(e.target.value)
                }))}
                className="w-32"
              />
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('dropshipSettings.changementsDePrix')}</Label>
              <p className="text-sm text-muted-foreground">
                Notifier des variations de prix fournisseur
              </p>
            </div>
            <Switch
              checked={formData.notify_price_changes}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                notify_price_changes: checked
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('dropshipSettings.problemesFournisseur')}</Label>
              <p className="text-sm text-muted-foreground">
                Alerter en cas d'incident avec un fournisseur
              </p>
            </div>
            <Switch
              checked={formData.notify_supplier_issues}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                notify_supplier_issues: checked
              }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Affichage client */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dropshipSettings.affichageClient')}</CardTitle>
          <CardDescription>
            Configurez ce que vos clients voient
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('dropshipSettings.afficherLeNomDuFournisseur')}</Label>
              <p className="text-sm text-muted-foreground">
                Montrer d'où vient le produit
              </p>
            </div>
            <Switch
              checked={formData.show_supplier_name}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                show_supplier_name: checked
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('dropshipSettings.afficherDelaisDeLivraison')}</Label>
              <p className="text-sm text-muted-foreground">
                Montrer l'estimation de livraison
              </p>
            </div>
            <Switch
              checked={formData.show_estimated_delivery}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                show_estimated_delivery: checked
              }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bouton sauvegarder */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
      </div>
    </form>
  );
}
