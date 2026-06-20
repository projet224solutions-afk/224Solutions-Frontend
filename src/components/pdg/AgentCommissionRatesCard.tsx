import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Percent, Save } from 'lucide-react';

/**
 * Réglage GLOBAL des taux de commission agent (s'applique à tous les agents).
 * La commission agent = un % des FRAIS DE TRANSACTION : sous-agent + agent principal.
 * Stocké dans pdg_settings au format {"value": X} (cohérent avec les autres réglages),
 * lu par la fonction SQL credit_agent_commission.
 */
const KEY_SUB = 'agent_sub_commission_percent';
const KEY_PRINCIPAL = 'agent_principal_commission_percent';

const readNum = (v: any, def: number): number => {
  if (v == null) return def;
  if (typeof v === 'object') return Number(v.value ?? def);
  return Number(v);
};

export default function AgentCommissionRatesCard() {
  const { t } = useTranslation();
  const [sub, setSub] = useState<number>(15);
  const [principal, setPrincipal] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('pdg_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [KEY_SUB, KEY_PRINCIPAL]);
        for (const r of (data as any[]) || []) {
          if (r.setting_key === KEY_SUB) setSub(readNum(r.setting_value, 15));
          if (r.setting_key === KEY_PRINCIPAL) setPrincipal(readNum(r.setting_value, 5));
        }
      } catch { /* défauts conservés */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveOne = async (key: string, val: number) => {
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
  };

  const save = async () => {
    const s = Math.max(0, Math.min(100, Number(sub) || 0));
    const p = Math.max(0, Math.min(100, Number(principal) || 0));
    setSaving(true);
    try {
      await saveOne(KEY_SUB, s);
      await saveOne(KEY_PRINCIPAL, p);
      toast.success(t('agentCommissionRatesCard.tauxDeCommissionAgentMis'));
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const total = (Number(sub) || 0) + (Number(principal) || 0);

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-primary" />
          Taux de commission agent
        </CardTitle>
        <CardDescription>
          Répartition de la commission entre <strong>sous-agent</strong> et <strong>agent principal</strong>
          (s'applique à TOUS les agents). S'applique aux <strong>achats</strong> (% des frais de transaction)
          ET aux <strong>abonnements</strong> (% du prix). Total = somme des deux ; le reste va à la plateforme.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sub-rate">{t('agentCommissionRatesCard.partSousAgentDesFrais')}</Label>
            <Input
              id="sub-rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={sub}
              onChange={(e) => setSub(Number(e.target.value))}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="principal-rate">{t('agentCommissionRatesCard.partAgentPrincipalDesFrais')}</Label>
            <Input
              id="principal-rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              disabled={loading}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Total agents : <span className="font-semibold text-foreground">{total}%</span> des frais
          {' '}(plateforme garde {Math.max(0, 100 - total)}%).
        </p>
        <Button onClick={save} disabled={saving || loading} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </CardContent>
    </Card>
  );
}
