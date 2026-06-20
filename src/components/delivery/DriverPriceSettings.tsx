/**
 * PARAMÈTRES DE TARIFICATION LIVREUR
 * Permet au livreur de configurer son tarif par km et bonus
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  DollarSign,
  Loader2,
  Save,
  TrendingUp,
  Clock,
  Zap,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DriverPriceSettingsProps {
  driverId: string;
  onSave?: () => void;
}

interface PriceConfig {
  pricePerKm: number;
  basePrice: number;
  rushHourBonus: number;
  expressBonus: number;
  fragileBonus: number;
  rushHourEnabled: boolean;
  expressEnabled: boolean;
}

const DEFAULT_CONFIG: PriceConfig = {
  pricePerKm: 2000,
  basePrice: 5000,
  rushHourBonus: 1500,
  expressBonus: 3000,
  fragileBonus: 2000,
  rushHourEnabled: true,
  expressEnabled: true
};

export function DriverPriceSettings({ driverId, onSave }: DriverPriceSettingsProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<PriceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger la configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('metadata')
          .eq('id', driverId)
          .single();

        if (data) {
          const driverData = data as any;
          const metadata = driverData.metadata || {};
          setConfig({
            pricePerKm: metadata.pricePerKm || DEFAULT_CONFIG.pricePerKm,
            basePrice: metadata.basePrice || DEFAULT_CONFIG.basePrice,
            rushHourBonus: metadata.rushHourBonus || DEFAULT_CONFIG.rushHourBonus,
            expressBonus: metadata.expressBonus || DEFAULT_CONFIG.expressBonus,
            fragileBonus: metadata.fragileBonus || DEFAULT_CONFIG.fragileBonus,
            rushHourEnabled: metadata.rushHourEnabled ?? DEFAULT_CONFIG.rushHourEnabled,
            expressEnabled: metadata.expressEnabled ?? DEFAULT_CONFIG.expressEnabled
          });
        }
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      loadConfig();
    }
  }, [driverId]);

  // Sauvegarder la configuration
  const saveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          metadata: {
            pricePerKm: config.pricePerKm,
            basePrice: config.basePrice,
            rushHourBonus: config.rushHourBonus,
            expressBonus: config.expressBonus,
            fragileBonus: config.fragileBonus,
            rushHourEnabled: config.rushHourEnabled,
            expressEnabled: config.expressEnabled
          }
        } as any)
        .eq('id', driverId);

      if (error) throw error;

      toast.success(t('driverPriceSettings.tarificationMiseAJour'));
      onSave?.();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(t('driverPriceSettings.erreurLorsDeLaSauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  // Calculer exemple de gain
  const calculateExample = (distance: number) => {
    const total = config.basePrice + (distance * config.pricePerKm);
    return total;
  };

  const formatCurrency = useFormatCurrency();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#ff4000]" />
            Configuration des tarifs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prix de base */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Prix de base (minimum par course)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.basePrice}
                onChange={(e) => setConfig({ ...config, basePrice: Number(e.target.value) })}
                className="w-32"
              />
              <span className="text-muted-foreground">GNF</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Montant minimum garanti par livraison
            </p>
          </div>

          {/* Prix par km */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              Prix par kilomètre: {formatCurrency(config.pricePerKm)}
            </Label>
            <Slider
              value={[config.pricePerKm]}
              onValueChange={([value]) => setConfig({ ...config, pricePerKm: value })}
              min={500}
              max={5000}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>500 GNF</span>
              <span>5 000 GNF</span>
            </div>
          </div>

          {/* Bonus heures de pointe */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">{t('driverPriceSettings.bonusHeuresDePointe')}</p>
                <p className="text-sm text-muted-foreground">
                  +{formatCurrency(config.rushHourBonus)} (7h-9h, 17h-20h)
                </p>
              </div>
            </div>
            <Switch
              checked={config.rushHourEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, rushHourEnabled: checked })}
            />
          </div>

          {/* Bonus express */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-[#ff4000]" />
              <div>
                <p className="font-medium">Livraisons express</p>
                <p className="text-sm text-muted-foreground">
                  +{formatCurrency(config.expressBonus)} par livraison urgente
                </p>
              </div>
            </div>
            <Switch
              checked={config.expressEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, expressEnabled: checked })}
            />
          </div>

          {/* Bonus colis fragile */}
          <div className="space-y-2">
            <Label>{t('driverPriceSettings.supplementColisFragile')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.fragileBonus}
                onChange={(e) => setConfig({ ...config, fragileBonus: Number(e.target.value) })}
                className="w-32"
              />
              <span className="text-muted-foreground">GNF</span>
            </div>
          </div>

          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer les tarifs
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Exemples de gains */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-[#ff4000]" />
            Exemples de gains
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="text-center p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
              <p className="text-xs text-muted-foreground">3 km</p>
              <p className="font-bold text-[#ff4000]">{formatCurrency(calculateExample(3))}</p>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
              <p className="text-xs text-muted-foreground">5 km</p>
              <p className="font-bold text-[#ff4000]">{formatCurrency(calculateExample(5))}</p>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
              <p className="text-xs text-muted-foreground">10 km</p>
              <p className="font-bold text-[#ff4000]">{formatCurrency(calculateExample(10))}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Hors bonus (rush, express, fragile)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
