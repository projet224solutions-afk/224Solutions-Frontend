import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🛡️ ÉDITEUR DES PLAFONDS DE TRANSFERT CUMULÉS (par rôle × palier KYC).
 *
 * Édite `pdg_settings.transfer_limits` — la config RÉELLEMENT appliquée (atomiquement) par les RPC
 * `execute_atomic_wallet_transfer(_fx)` via `enforce_transfer_limit`. Plafonds jour/mois en GNF.
 * Vide = illimité. pdg/admin exemptés (non listés).
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Tier = 't0' | 't1' | 't2';
const TIERS: { key: Tier; label: string }[] = [
  { key: 't0', label: 'KYC 0' }, { key: 't1', label: 'KYC 1' }, { key: 't2', label: 'KYC 2' },
];
const ROLES = ['default', 'client', 'vendeur', 'prestataire', 'agent', 'taxi', 'livreur'];

type Caps = Record<string, Record<Tier, { daily: string; monthly: string }>>;

const toStr = (v: any): string => (v === null || v === undefined || v === '' ? '' : String(v));
const toNum = (s: string): number | null => { const n = Number(s); return s.trim() === '' || !Number.isFinite(n) ? null : n; };

export default function TransferZoneLimitsEditor() {
  const { t } = useTranslation();
  const [caps, setCaps] = useState<Caps>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('pdg_settings').select('setting_value').eq('setting_key', 'transfer_limits').maybeSingle();
      let cfg: any = (data as any)?.setting_value ?? {};
      if (cfg && cfg.value) cfg = cfg.value; // déballe {value:{...}} si présent
      const next: Caps = {};
      for (const role of ROLES) {
        next[role] = { t0: { daily: '', monthly: '' }, t1: { daily: '', monthly: '' }, t2: { daily: '', monthly: '' } };
        for (const { key } of TIERS) {
          const node = cfg?.[role]?.[key] || {};
          next[role][key] = { daily: toStr(node.daily), monthly: toStr(node.monthly) };
        }
      }
      setCaps(next);
    } catch { toast.error(t('transferZoneLimitsEditor.erreurDeChargementDesPlafonds')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setCell = (role: string, tier: Tier, field: 'daily' | 'monthly', val: string) => {
    setCaps((c) => ({ ...c, [role]: { ...c[role], [tier]: { ...c[role][tier], [field]: val } } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const cfg: any = {};
      for (const role of ROLES) {
        cfg[role] = {};
        for (const { key } of TIERS) {
          cfg[role][key] = { daily: toNum(caps[role][key].daily), monthly: toNum(caps[role][key].monthly) };
        }
      }
      // Upsert (clé transfer_limits, JSON brut — enforce_transfer_limit gère {value} ou brut).
      const { data: existing } = await supabase.from('pdg_settings').select('setting_key').eq('setting_key', 'transfer_limits').maybeSingle();
      const res = existing
        ? await supabase.from('pdg_settings').update({ setting_value: cfg, updated_at: new Date().toISOString() }).eq('setting_key', 'transfer_limits')
        : await supabase.from('pdg_settings').insert({ setting_key: 'transfer_limits', setting_value: cfg });
      if (res.error) { toast.error(res.error.message); return; }
      toast.success(t('transferZoneLimitsEditor.plafondsDeTransfertParRole'));
      await load();
    } finally { setSaving(false); }
  };

  const fmt = (s: string) => (s.trim() === '' ? '∞' : Number(s).toLocaleString('fr-FR'));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> {t('transferZoneLimitsEditor.plafondsCumulesParRoleKyc')}</CardTitle>
            <CardDescription>Cumul <strong>jour / mois</strong> {t('transferZoneLimitsEditor.enGnfAppliqueAtomiquementA')} <strong>Vide = illimité.</strong> pdg/admin exemptés.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading || saving}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">{t('transferZoneLimitsEditor.role')}</th>
                {TIERS.map((t) => <th key={t.key} className="py-2 px-2 text-center" colSpan={2}>{t.label}</th>)}
              </tr>
              <tr className="border-b text-[11px] text-muted-foreground">
                <th></th>
                {TIERS.map((t) => (
                  <th key={t.key} className="px-2 text-center" colSpan={2}>
                    <span className="inline-flex gap-6"><span>jour</span><span>mois</span></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => (
                <tr key={role} className="border-b">
                  <td className="py-2 pr-3 font-medium">{role}</td>
                  {TIERS.map((t) => (
                    <td key={t.key} className="py-2 px-1">
                      <div className="flex gap-1">
                        <Input className="h-8 w-24" type="number" placeholder="∞"
                          value={caps[role]?.[t.key]?.daily ?? ''}
                          onChange={(e) => setCell(role, t.key, 'daily', e.target.value)} />
                        <Input className="h-8 w-24" type="number" placeholder="∞"
                          value={caps[role]?.[t.key]?.monthly ?? ''}
                          onChange={(e) => setCell(role, t.key, 'monthly', e.target.value)} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-1" /> Enregistrer les plafonds
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          💡 Exemple : vendeur KYC 0 = {fmt(caps['vendeur']?.t0?.daily ?? '')} GNF/jour, {fmt(caps['vendeur']?.t0?.monthly ?? '')} GNF/mois.
        </p>
      </CardContent>
    </Card>
  );
}
