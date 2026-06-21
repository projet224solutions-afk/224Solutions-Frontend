import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowUpDown, Globe, Shield, Save, RefreshCw, AlertTriangle,
  TrendingUp, Banknote, ArrowRightLeft, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TransferZoneLimitsEditor from './TransferZoneLimitsEditor';

interface TransferLimit {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  value: number;
  defaultValue: number;
  category: 'amount' | 'daily';
  color: string;
}

const LIMIT_CONFIG: Omit<TransferLimit, 'value'>[] = [
  {
    key: 'min_transfer_amount',
    label: 'Montant Minimum par Transfert',
    description: 'En GNF — converti automatiquement dans la devise de l\'expéditeur',
    icon: <ArrowUpDown className="w-5 h-5" />,
    defaultValue: 100,
    category: 'amount',
    color: 'text-blue-500',
  },
  {
    key: 'max_transfer_amount',
    label: 'Montant Maximum par Transfert',
    description: 'En GNF — converti automatiquement dans la devise de l\'expéditeur',
    icon: <Banknote className="w-5 h-5" />,
    defaultValue: 50_000_000,
    category: 'amount',
    color: 'text-[#ff4000]',
  },
  {
    key: 'max_daily_transfer_amount',
    label: 'Limite Quotidienne Globale',
    description: 'En GNF — montant cumulé max par jour, converti par devise',
    icon: <TrendingUp className="w-5 h-5" />,
    defaultValue: 50_000_000,
    category: 'daily',
    color: 'text-orange-500',
  },
  {
    key: 'min_international_transfer_amount',
    label: 'Minimum par Transfert International',
    description: 'En GNF — converti dans la devise de l\'expéditeur au taux du jour',
    icon: <Globe className="w-5 h-5" />,
    defaultValue: 500,
    category: 'daily',
    color: 'text-[#04439e]',
  },
  {
    key: 'max_international_transfer_amount',
    label: 'Maximum par Transfert International',
    description: 'En GNF — converti dans la devise de l\'expéditeur au taux du jour',
    icon: <Globe className="w-5 h-5" />,
    defaultValue: 50_000_000,
    category: 'daily',
    color: 'text-[#04439e]',
  },
];

export default function PDGTransferLimits() {
  const { t } = useTranslation();
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const fetchLimits = useCallback(async () => {
    setLoading(true);
    try {
      const keys = LIMIT_CONFIG.map(l => l.key);
      const { data, error } = await supabase
        .from('pdg_settings')
        .select('setting_key, setting_value')
        .in('setting_key', keys);

      if (error) throw error;

      const loaded: Record<string, number> = {};
      for (const cfg of LIMIT_CONFIG) {
        const row = (data || []).find(d => d.setting_key === cfg.key);
        const raw = row?.setting_value;
        const val = typeof raw === 'object' && raw !== null && 'value' in (raw as any)
          ? Number((raw as any).value)
          : raw != null ? Number(raw) : cfg.defaultValue;
        loaded[cfg.key] = isNaN(val) ? cfg.defaultValue : val;
      }

      setLimits(loaded);
      setEditValues(Object.fromEntries(Object.entries(loaded).map(([k, v]) => [k, v.toString()])));
    } catch (err) {
      console.error('Error loading limits:', err);
      toast.error(t('pDGTransferLimits.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLimits(); }, [fetchLimits]);

  const saveSingleLimit = async (key: string) => {
    const val = Number(editValues[key]);
    if (isNaN(val) || val < 0) {
      toast.error('Valeur invalide');
      return;
    }

    setSaving(key);
    try {
      const { data: existing } = await supabase
        .from('pdg_settings')
        .select('id')
        .eq('setting_key', key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('pdg_settings')
          .update({ setting_value: { value: val } as any, updated_at: new Date().toISOString() })
          .eq('setting_key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pdg_settings')
          .insert({ setting_key: key, setting_value: { value: val } as any });
        if (error) throw error;
      }

      setLimits(prev => ({ ...prev, [key]: val }));
      toast.success(t('pDGTransferLimits.limiteMiseAJourAvec'));
    } catch (err) {
      console.error('Error saving limit:', err);
      toast.error(t('pDGTransferLimits.erreurLorsDeLaSauvegarde'));
    } finally {
      setSaving(null);
    }
  };

  const saveAllLimits = async () => {
    // Validate
    const minVal = Number(editValues['min_transfer_amount']);
    const maxVal = Number(editValues['max_transfer_amount']);
    const dailyVal = Number(editValues['max_daily_transfer_amount']);
    const minIntlVal = Number(editValues['min_international_transfer_amount']);
    const maxIntlVal = Number(editValues['max_international_transfer_amount']);

    if (minVal >= maxVal) {
      toast.error(t('pDGTransferLimits.leMinimumDoitEtreInferieur'));
      return;
    }
    if (minIntlVal >= maxIntlVal) {
      toast.error(t('pDGTransferLimits.leMinimumInternationalDoitEtre'));
      return;
    }
    if (maxIntlVal > dailyVal) {
      toast.error(t('pDGTransferLimits.laLimiteInternationaleNePeut'));
      return;
    }

    setSavingAll(true);
    try {
      for (const cfg of LIMIT_CONFIG) {
        const val = Number(editValues[cfg.key]);
        if (isNaN(val) || val < 0) continue;

        const { data: existing } = await supabase
          .from('pdg_settings')
          .select('id')
          .eq('setting_key', cfg.key)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('pdg_settings')
            .update({ setting_value: { value: val } as any, updated_at: new Date().toISOString() })
            .eq('setting_key', cfg.key);
        } else {
          await supabase
            .from('pdg_settings')
            .insert({ setting_key: cfg.key, setting_value: { value: val } as any });
        }

        setLimits(prev => ({ ...prev, [cfg.key]: val }));
      }
      toast.success(t('pDGTransferLimits.toutesLesLimitesOntEte'));
    } catch (err) {
      console.error('Error saving all limits:', err);
      toast.error(t('pDGTransferLimits.erreurLorsDeLaSauvegarde2'));
    } finally {
      setSavingAll(false);
    }
  };

  const hasChanges = (key: string) => {
    return Number(editValues[key]) !== limits[key];
  };

  const hasAnyChanges = LIMIT_CONFIG.some(cfg => hasChanges(cfg.key));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Limites de Transfert
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez les montants min/max autorisés pour les transferts wallet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLimits} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
          {hasAnyChanges && (
            <Button size="sm" onClick={saveAllLimits} disabled={savingAll} className="gap-1.5">
              {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Tout Sauvegarder
            </Button>
          )}
        </div>
      </div>

      {/* Per-Transaction Limits */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Limites par Transaction
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LIMIT_CONFIG.filter(c => c.category === 'amount').map(cfg => (
            <Card key={cfg.key} className="border-border bg-card hover:shadow-lg transition-all">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  {cfg.label}
                  {hasChanges(cfg.key) && (
                    <Badge variant="outline" className="ml-auto text-xs border-[#ff4000]/50 text-[#ff4000]">
                      Modifié
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">{cfg.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      value={editValues[cfg.key] || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [cfg.key]: e.target.value }))}
                      className="pr-14 bg-background font-mono text-base"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                      GNF
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={hasChanges(cfg.key) ? "default" : "outline"}
                    onClick={() => saveSingleLimit(cfg.key)}
                    disabled={!hasChanges(cfg.key) || saving === cfg.key}
                    className="shrink-0"
                  >
                    {saving === cfg.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Actuel: <span className="font-mono font-medium text-foreground">{limits[cfg.key]?.toLocaleString()}</span> GNF
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Daily & International Limits */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Limites Quotidiennes & Internationales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LIMIT_CONFIG.filter(c => c.category === 'daily').map(cfg => (
            <Card key={cfg.key} className="border-border bg-card hover:shadow-lg transition-all">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  {cfg.label}
                  {hasChanges(cfg.key) && (
                    <Badge variant="outline" className="ml-auto text-xs border-[#ff4000]/50 text-[#ff4000]">
                      Modifié
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">{cfg.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      value={editValues[cfg.key] || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [cfg.key]: e.target.value }))}
                      className="pr-14 bg-background font-mono text-base"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                      GNF
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={hasChanges(cfg.key) ? "default" : "outline"}
                    onClick={() => saveSingleLimit(cfg.key)}
                    disabled={!hasChanges(cfg.key) || saving === cfg.key}
                    className="shrink-0"
                  >
                    {saving === cfg.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Actuel: <span className="font-mono font-medium text-foreground">{limits[cfg.key]?.toLocaleString()}</span> GNF
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Validation Warning */}
      {Number(editValues['min_transfer_amount']) >= Number(editValues['max_transfer_amount']) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              Le montant minimum doit être inférieur au montant maximum
            </p>
          </CardContent>
        </Card>
      )}

      {/* Plafonds cumulés par rôle × KYC (réellement appliqués par les RPC de transfert) */}
      <TransferZoneLimitsEditor />
    </div>
  );
}
