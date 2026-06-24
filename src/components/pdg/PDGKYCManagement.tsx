/**
 * GESTION KYC - INTERFACE PDG
 * Permet au PDG d'activer/désactiver le KYC pour chaque type d'utilisateur
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, ShieldCheck, Users, Store, Truck, Car, Building2, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface KYCSettings {
  vendeur: boolean;
  client: boolean;
  livreur: boolean;
  taxi_moto: boolean;
  bureau_syndicat: boolean;
  transitaire: boolean;
  agent: boolean;
}

const userTypes = [
  { key: 'vendeur', label: 'Vendeurs', icon: Store, description: "Vérification des marchands" },
  { key: 'client', label: 'Clients', icon: Users, description: "Vérification des acheteurs" },
  { key: 'livreur', label: 'Livreurs', icon: Truck, description: "Vérification des chauffeurs livreurs" },
  { key: 'taxi_moto', label: 'Taxi-Moto', icon: Car, description: "Vérification des chauffeurs taxi-moto" },
  { key: 'bureau_syndicat', label: 'Bureaux Syndicaux', icon: Building2, description: "Vérification des bureaux" },
  { key: 'transitaire', label: 'Transitaires', icon: Globe, description: "Vérification des transitaires" },
  { key: 'agent', label: 'Agents', icon: Users, description: "Vérification des agents" },
] as const;

export default function PDGKYCManagement() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<KYCSettings>({
    vendeur: false,
    client: false,
    livreur: false,
    taxi_moto: false,
    bureau_syndicat: false,
    transitaire: false,
    agent: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // La table system_settings utilise setting_key et setting_value
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'kyc_settings')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur chargement settings KYC:', error);
      }

      if (data?.setting_value) {
        try {
          const parsed = JSON.parse(data.setting_value);
          setSettings(parsed as KYCSettings);
        } catch (parseErr) {
          console.error('Erreur parsing settings:', parseErr);
        }
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof KYCSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Vérifier si le setting existe déjà
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'kyc_settings')
        .maybeSingle();

      const settingsJson = JSON.stringify(settings);

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: settingsJson,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', 'kyc_settings');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'kyc_settings',
            setting_value: settingsJson,
            description: t('pDGKYCManagement.parametresKycParTypeUtilisateur')
          });

        if (error) throw error;
      }

      toast.success(t('pDGKYCManagement.parametresKycEnregistres'));
    } catch (err: any) {
      console.error('Erreur sauvegarde:', err);
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(settings).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{t('pDGKYCManagement.gestionKyc')}</CardTitle>
                <CardDescription>
                  Activer ou désactiver la vérification KYC par type d'utilisateur
                </CardDescription>
              </div>
            </div>
            <Badge variant={enabledCount > 0 ? "default" : "secondary"} className="text-sm">
              {enabledCount} / {userTypes.length} actif(s)
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {userTypes.map(({ key, label, icon: Icon, description }) => (
          <Card
            key={key}
            className={`transition-all duration-200 ${
              settings[key as keyof KYCSettings]
                ? 'border-[#ff4000]/50 bg-[#ff4000]/5'
                : 'border-muted'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    settings[key as keyof KYCSettings]
                      ? 'bg-[#ff4000]/20 text-[#ff4000]'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <Label htmlFor={key} className="font-medium cursor-pointer">
                      {label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {settings[key as keyof KYCSettings] && (
                    <ShieldCheck className="w-4 h-4 text-[#ff4000]" />
                  )}
                  <Switch
                    id={key}
                    checked={settings[key as keyof KYCSettings]}
                    onCheckedChange={() => handleToggle(key as keyof KYCSettings)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Les modifications seront appliquées immédiatement après l'enregistrement.
            </p>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Enregistrer les paramètres
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">{t('pDGKYCManagement.aProposDuKyc')}</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>{t('pDGKYCManagement.quandLeKycEstActive')}</li>
            <li>{t('pDGKYCManagement.lesUtilisateursNonVerifiesPeuvent')}</li>
            <li>• Vous pouvez activer/désactiver le KYC à tout moment</li>
            <li>{t('pDGKYCManagement.lesStatutsKycExistantsSont')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
