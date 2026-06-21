/**
 * 🩺 SURVEILLANCE PLATEFORME — interface PDG, temps réel, multi-domaines.
 *
 * Domaines : Escrow & Conversion, Abonnements (extensible). Pour chaque domaine, contrôles d'anomalies
 * + alertes. Détection quasi instantanée : polling 20s + realtime sur les tables concernées.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2, Activity, ChevronRight, User } from 'lucide-react';
import { backendFetch } from '@/services/backendApi';
import { supabase } from '@/integrations/supabase/client';

interface Check { key: string; label: string; severity: 'low' | 'medium' | 'high' | 'critical'; count: number; observed: number; }
interface Report { generated_at: string; checks: Check[]; overall: 'ok' | 'warning' | 'critical'; }
interface Domain { key: string; label: string; report: Report; }
interface AlertRow { id: string; title: string; message: string; severity: string; status: string; module: string; suggested_fix: string; created_at: string; metadata?: { alert_key?: string } | null; }
interface AutoHealingSummary { open: number; detected: number; proposed: number; escalated: number; ingested: number; }
interface PlatformData { domains: Domain[]; alerts: AlertRow[]; autoHealing?: AutoHealingSummary; }

const SEV: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-blue-100 text-blue-700 border-blue-300',
};
const RT_TABLES = ['escrow_transactions', 'wallet_transactions', 'system_alerts', 'subscriptions', 'driver_subscriptions', 'service_subscriptions', 'revenus_pdg', 'agents_management'];

// Libellés lisibles des champs de détail d'anomalie (sinon la clé snake_case est affichée telle quelle).
const FIELD_LABELS: Record<string, string> = {
  order_number: 'N° commande', escrow_amount: 'Montant escrow', order_subtotal: 'Sous-total commande',
  ecart_fuite: 'Écart (fuite)', amount: 'Montant', total: 'Total', subtotal: 'Sous-total',
  paid_amount: 'Payé', remaining_amount: 'Reste dû', commission_amount: 'Commission', net_amount: 'Net',
  currency: 'Devise', status: 'Statut', customer_name: 'Client', customer_phone: 'Téléphone',
  created_at: 'Créé le', released_at: 'Libéré le', due_date: 'Échéance', auto_release_date: 'Libération auto',
  retrieved_at: 'Taux récupéré le', days_overdue: 'Jours de retard', heures_depuis_maj: 'Heures depuis MAJ',
  paire: 'Paire de devises', rate: 'Taux', source_type: 'Source', description: 'Description',
  vendor_id: 'ID vendeur', order_id: 'ID commande', id: 'ID',
};
const MONEY_RE = /(amount|total|subtotal|ecart|montant|solde|paid|remaining|rate|fuite|net|commission)/i;
// Formate une valeur de détail pour un affichage clair (date locale, montant séparé, objet ignoré).
function fmtFieldValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  if (/(_at|_date)$/.test(key) && typeof v === 'string') {
    const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
  if (typeof v === 'number' && MONEY_RE.test(key)) return v.toLocaleString('fr-FR');
  return String(v);
}

export default function EscrowConversionMonitor() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Drill-down d'une anomalie : qui ? quel wallet ? quel montant ? (modale cliquable)
  const [detail, setDetail] = useState<{ module: string; key: string; label: string } | null>(null);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNote, setDetailNote] = useState<string | undefined>(undefined);

  const openDetail = async (module: string, key: string | undefined, label: string) => {
    if (!key) return;
    setDetail({ module, key, label }); setDetailRows([]); setDetailNote(undefined); setDetailLoading(true);
    try {
      const res = await backendFetch<any>(`/api/admin/platform-monitor/details?module=${encodeURIComponent(module)}&key=${encodeURIComponent(key)}`, { method: 'GET' });
      const d = (res as any)?.data;
      if (res.success && d) { setDetailRows(d.rows || []); setDetailNote(d.note); }
      else setDetailNote(res.error || 'Erreur de chargement');
    } catch { setDetailNote('Erreur réseau'); } finally { setDetailLoading(false); }
  };

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['platform-monitor'],
    queryFn: async () => {
      const res = await backendFetch<PlatformData>('/api/admin/platform-monitor');
      if (!res.success || !res.data) throw new Error(res.error || 'Erreur surveillance');
      return res.data;
    },
    refetchInterval: 20000,
    staleTime: 10000,
  });

  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform-monitor'] });
    const channel = supabase.channel('platform-monitor-rt');
    for (const t of RT_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, invalidate);
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const domains = data?.domains || [];
  const alerts = data?.alerts || [];
  const activeAlerts = alerts.filter((a) => a.status === 'active');

  // État global = pire des domaines
  const globalOverall: 'ok' | 'warning' | 'critical' =
    domains.some((d) => d.report.overall === 'critical') ? 'critical'
      : domains.some((d) => d.report.overall === 'warning') ? 'warning' : 'ok';

  const banner = {
    ok: { icon: ShieldCheck, text: 'Plateforme saine', cls: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
    warning: { icon: AlertTriangle, text: 'Anomalies détectées — à vérifier', cls: 'bg-orange-50 border-orange-300 text-orange-800' },
    critical: { icon: ShieldAlert, text: 'ALERTE CRITIQUE — intervention requise', cls: 'bg-red-50 border-red-400 text-red-800' },
  }[globalOverall];
  const BannerIcon = banner.icon;
  const dot = (o: string) => o === 'critical' ? '🔴' : o === 'warning' ? '🟠' : '🟢';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#ff4000]" />
            Surveillance Plateforme
          </h2>
          <p className="text-sm text-muted-foreground">
            Détection temps réel des bugs et attaques — escrow, conversion, abonnements.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </div>

      <Card className={`border-2 ${banner.cls}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <BannerIcon className="w-8 h-8" />
          <div className="flex-1">
            <p className="font-bold text-lg">{banner.text}</p>
            <p className="text-xs opacity-80">{activeAlerts.length} alerte(s) active(s) sur {domains.length} domaine(s) surveillé(s)</p>
          </div>
          {globalOverall !== 'ok' && <Badge className="bg-white/60 text-current border">{globalOverall.toUpperCase()}</Badge>}
        </CardContent>
      </Card>

      {/* Auto-réparation supervisée (dual-IA) — connectée à la surveillance */}
      {data?.autoHealing && data.autoHealing.open > 0 && (
        <Card className="border-2 border-indigo-300 bg-indigo-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-600" />
            <div className="flex-1">
              <p className="font-semibold text-indigo-900">Auto-réparation : {data.autoHealing.open} incident(s) ouvert(s)</p>
              <p className="text-xs text-indigo-700">
                {data.autoHealing.proposed} correction(s) sûre(s) proposée(s) · {data.autoHealing.escalated} à valider · {data.autoHealing.detected} en attente de diagnostic.
                Détail dans l'onglet « Auto-Réparation ».
              </p>
            </div>
            <Badge className="bg-white/70 text-indigo-800 border border-indigo-300">OpenAI → Claude</Badge>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            Surveillance indisponible : {(error as Error).message}. Vérifiez que le backend est déployé et joignable.
          </CardContent>
        </Card>
      )}

      {!error && isLoading && (
        <Card><CardContent className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" /> Chargement de la surveillance…
        </CardContent></Card>
      )}

      {!error && !isLoading && domains.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('escrowConversionMonitor.aucuneDonneeDeSurveillanceDisponible')}</CardContent></Card>
      )}

      {!error && !isLoading && domains.length > 0 && (
      <Tabs defaultValue={domains[0].key} className="w-full">
        <TabsList>
          {domains.map((d) => (
            <TabsTrigger key={d.key} value={d.key} className="gap-1.5">
              {dot(d.report.overall)} {d.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {domains.map((d) => {
          const domainAlerts = activeAlerts.filter((a) => a.module === d.key);
          return (
            <TabsContent key={d.key} value={d.key} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {d.report.checks.map((c) => {
                  const anomaly = c.count > 0;
                  return (
                    <Card key={c.key} className={`${anomaly ? `border-2 ${SEV[c.severity]}` : 'border'} ${anomaly ? 'cursor-pointer transition hover:shadow-md' : ''}`}
                      onClick={anomaly ? () => openDetail(d.key, c.key, c.label) : undefined}
                      title={anomaly ? 'Voir les cas et les utilisateurs concernés' : undefined}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{c.label}</p>
                          {anomaly ? <Badge className={SEV[c.severity]}>{c.severity}</Badge>
                            : <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                        </div>
                        <p className={`mt-2 text-2xl font-bold ${anomaly ? '' : 'text-emerald-600'}`}>{anomaly ? c.count : '0'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {anomaly ? 'cas détecté(s)' : 'aucune anomalie'}
                          {(c.key === 'rapid_ops' || c.key === 'sub_creation_spike' || c.key === 'transfer_rapid') && ` · ${c.observed} en 5min`}
                          {anomaly && <span className="ml-auto inline-flex items-center text-[#ff4000]">{t('escrowConversionMonitor.details')}<ChevronRight className="w-3 h-3" /></span>}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Alertes {d.label} ({domainAlerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {domainAlerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Aucune alerte active.
                    </p>
                  ) : (
                    <ScrollArea className="h-[280px] pr-3">
                      <div className="space-y-3">
                        {domainAlerts.map((a) => (
                          <div key={a.id} className={`p-3 rounded-lg border cursor-pointer transition hover:shadow-md ${SEV[a.severity] || ''}`}
                            onClick={() => openDetail(a.module, a.metadata?.alert_key, a.title)}
                            title="Voir les utilisateurs / lignes concernés">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-sm">{a.title}</p>
                              <Badge className={SEV[a.severity] || ''}>{a.severity}</Badge>
                            </div>
                            <p className="text-sm mt-1">{a.message}</p>
                            {a.suggested_fix && <p className="text-xs mt-2 opacity-80">💡 {a.suggested_fix}</p>}
                            <p className="text-[10px] mt-1 opacity-60 flex items-center gap-1">
                              {new Date(a.created_at).toLocaleString('fr-FR')}
                              <span className="ml-auto inline-flex items-center font-medium text-[#ff4000]">{t('escrowConversionMonitor.voirLesDetails')}<ChevronRight className="w-3 h-3" /></span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
      )}

      {/* Drill-down : qui ? quel wallet ? quel montant ? */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> {detail?.label}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground"><RefreshCw className="w-4 h-4 animate-spin" /> {t('escrowConversionMonitor.chargementDesDetails')}</div>
          ) : (
            <div className="space-y-3">
              {detailNote && <p className="rounded bg-muted p-2 text-xs text-muted-foreground">{detailNote}</p>}
              {detailRows.length === 0 && !detailNote && <p className="text-sm text-muted-foreground">{t('escrowConversionMonitor.aucunEnregistrementAAfficher')}</p>}
              {detailRows.length > 0 && <p className="text-xs text-muted-foreground">{detailRows.length} cas concerné(s)</p>}
              {detailRows.map((r, i) => {
                const u = r.user?.profile; const w = r.user?.wallet;
                const name = u?.full_name || `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || (r.user ? 'Utilisateur' : null);
                return (
                  <div key={i} className="space-y-2 rounded-lg border p-3 text-sm">
                    {r.user && (
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                          <User className="w-4 h-4" /> {name}
                          {u?.role && <Badge variant="outline" className="text-[10px]">{u.role}</Badge>}
                          {w?.is_blocked && <Badge className="bg-red-100 text-red-700 text-[10px]">{t('escrowConversionMonitor.walletBloque')}</Badge>}
                        </div>
                        <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                          <span>ID : <code className="text-foreground">{u?.custom_id || u?.public_id || r.user.user_id}</code></span>
                          <span>Email : {u?.email || '—'}</span>
                          <span>Téléphone : {u?.phone || '—'}</span>
                          <span>Pays : {u?.country || '—'}{u?.city ? ` · ${u.city}` : ''}</span>
                          <span>KYC : niveau {u?.kyc_level ?? '—'}</span>
                          <span>Statut : {u?.status || (u?.is_active === false ? 'inactif' : '—')}</span>
                          {w && <span className="sm:col-span-2">Wallet : <b className="text-foreground">{w.balance} {w.currency}</b>{w.balance_cap_override != null ? ` · plafond perso ${w.balance_cap_override}` : ''}</span>}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      {Object.entries(r).filter(([k]) => k !== 'user').map(([k, v]) => {
                        const highlight = /(ecart|fuite|overdue|days_overdue|heures_depuis)/i.test(k);
                        return (
                          <span key={k} className="truncate">
                            <span className="text-muted-foreground capitalize">{FIELD_LABELS[k] || k.replace(/_/g, ' ')} :</span>{' '}
                            <span className={highlight ? 'font-semibold text-[#ff4000]' : 'text-foreground'}>{fmtFieldValue(k, v)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
