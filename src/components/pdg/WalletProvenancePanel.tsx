/**
 * 🛡️ PROVENANCE & PLAFONDS WALLET — interface PDG (AML)
 *
 * Trois onglets :
 *  - Wallets à examiner : ceux qui dépassent leur plafond de détention (rôle × palier KYC).
 *    Actions : régler le palier KYC, fixer un plafond manuel (override).
 *  - Quarantaine : fonds crédités au-delà du plafond, en attente de décision. Libérer / Rejeter.
 *  - Plafonds : édition de la grille des plafonds (GNF) par rôle × palier KYC.
 * Données live (polling 20s) + temps réel sur les tables concernées.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, ShieldAlert, RefreshCw, Lock, Unlock, XCircle, Save } from 'lucide-react';
import { backendFetch } from '@/services/backendApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FlaggedWallet {
  user_id: string; role: string | null; full_name: string | null; kyc_level: number;
  balance: number; currency: string; balance_gnf: number; effective_cap: number | null;
  over_cap: boolean; is_blocked?: boolean; quarantined_pending: number;
}
interface QuarantineRow {
  id: string; user_id: string; amount: number; currency: string; source_type: string | null;
  reason: string; status: string; created_at: string;
  holder?: { role: string; kyc_level: number; name: string | null } | null;
}
interface Overview {
  caps: Record<string, { t0: number | null; t1: number | null; t2: number | null }>;
  counts: { wallets_over_cap: number; quarantine_pending: number; quarantine_pending_total: number };
  flagged_wallets: FlaggedWallet[];
  quarantine: QuarantineRow[];
}

const fmt = (n: number | null | undefined, cur = 'GNF') =>
  n === null || n === undefined ? '∞' : `${Math.round(Number(n)).toLocaleString('fr-FR')} ${cur}`;
const KNOWN_ROLES = ['client', 'vendeur', 'vendor_agent', 'agent', 'livreur', 'taxi', 'prestataire', 'actionnaire', 'default'];

export default function WalletProvenancePanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [capsDraft, setCapsDraft] = useState<Record<string, any> | null>(null);
  const [capInputs, setCapInputs] = useState<Record<string, string>>({});
  const [qInputs, setQInputs] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['aml-overview'],
    queryFn: async () => {
      const res = await backendFetch<Overview>('/api/admin/aml/overview');
      if (!res.success || !res.data) throw new Error(res.error || 'Erreur AML');
      return res.data;
    },
    refetchInterval: 20000,
    staleTime: 10000,
  });

  // Liste des wallets pour l'onglet « Wallets à examiner » : signalés seuls, ou tous (toggle).
  const { data: walletRows, refetch: refetchWallets } = useQuery({
    queryKey: ['aml-wallets', showAll],
    queryFn: async () => {
      const res = await backendFetch<FlaggedWallet[]>(`/api/admin/aml/wallets?flagged=${showAll ? 0 : 1}`);
      if (!res.success || !res.data) throw new Error(res.error || 'Erreur wallets');
      return res.data;
    },
    refetchInterval: 20000,
    staleTime: 10000,
  });

  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ['aml-overview'] });
      qc.invalidateQueries({ queryKey: ['aml-wallets'] });
    };
    const ch = supabase.channel('aml-rt');
    for (const t of ['wallets', 'wallet_quarantined_funds', 'wallet_balance_audit', 'profiles']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, invalidate);
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  useEffect(() => { if (data?.caps && !capsDraft) setCapsDraft(structuredClone(data.caps)); }, [data?.caps, capsDraft]);

  const counts = data?.counts;
  const flagged = walletRows || [];
  const quarantine = data?.quarantine || [];
  const healthy = (counts?.wallets_over_cap || 0) === 0 && (counts?.quarantine_pending || 0) === 0;

  const action = async (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    try {
      const res = await fn();
      if (!res.success) throw new Error(res.error || 'Échec');
      toast.success(label);
      refetch(); refetchWallets();
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
  };

  const toggleFreeze = (userId: string, frozen: boolean) =>
    action(frozen ? 'Wallet gelé' : 'Wallet dégelé', () =>
      backendFetch('/api/admin/aml/freeze', { method: 'POST', body: { user_id: userId, frozen } }));

  const quarantineAmount = (userId: string) => {
    const raw = qInputs[userId];
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) { toast.error(t('walletProvenancePanel.montantInvalide')); return; }
    action('Montant mis en quarantaine', () =>
      backendFetch('/api/admin/aml/quarantine-amount', { method: 'POST', body: { user_id: userId, amount } }))
      .then(() => setQInputs((p) => ({ ...p, [userId]: '' })));
  };

  const setKyc = (userId: string, level: number) =>
    action('Palier KYC mis à jour', () => backendFetch('/api/admin/aml/kyc', { method: 'POST', body: { user_id: userId, level } }));

  const setOverride = (userId: string) => {
    const raw = capInputs[userId];
    const amount = raw === undefined || raw.trim() === '' ? null : Number(raw);
    return action('Plafond manuel enregistré', () =>
      backendFetch('/api/admin/aml/cap-override', { method: 'POST', body: { user_id: userId, amount } }));
  };

  const releaseQ = (id: string) =>
    action('Fonds libérés', () => backendFetch(`/api/admin/aml/quarantine/${id}/release`, { method: 'POST', body: {} }));
  const rejectQ = (id: string) =>
    action('Fonds rejetés', () => backendFetch(`/api/admin/aml/quarantine/${id}/reject`, { method: 'POST', body: {} }));

  const saveCaps = () =>
    action('Plafonds enregistrés', () => backendFetch('/api/admin/aml/caps', { method: 'PUT', body: { config: capsDraft } }));

  const capRoles = useMemo(() => {
    const keys = new Set([...KNOWN_ROLES, ...Object.keys(capsDraft || {})]);
    return [...keys];
  }, [capsDraft]);

  const updateCap = (role: string, tier: 't0' | 't1' | 't2', val: string) => {
    setCapsDraft((prev) => {
      const next = structuredClone(prev || {});
      if (!next[role]) next[role] = { t0: null, t1: null, t2: null };
      next[role][tier] = val.trim() === '' ? null : Number(val);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#ff4000]" />
            Provenance &amp; Plafonds Wallet
          </h2>
          <p className="text-sm text-muted-foreground">
            Contrôle anti-blanchiment : plafond de détention par rôle × KYC, quarantaine de l'excédent, détection des fonds non tracés.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Rafraîchir
        </Button>
      </div>

      {/* Bandeau état */}
      <div className={`flex items-center gap-3 rounded-lg border p-4 ${healthy ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-orange-50 border-orange-300 text-orange-800'}`}>
        {healthy ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        <div className="text-sm font-medium">
          {healthy ? 'Aucune anomalie : tous les wallets sont sous leur plafond, aucune quarantaine en attente.'
            : `${counts?.wallets_over_cap || 0} wallet(s) au-dessus du plafond · ${counts?.quarantine_pending || 0} quarantaine(s) en attente (${fmt(counts?.quarantine_pending_total)}).`}
        </div>
      </div>

      <Tabs defaultValue="wallets">
        <TabsList>
          <TabsTrigger value="wallets">Wallets à examiner {flagged.length ? `(${flagged.length})` : ''}</TabsTrigger>
          <TabsTrigger value="quarantine">Quarantaine {quarantine.length ? `(${quarantine.length})` : ''}</TabsTrigger>
          <TabsTrigger value="caps">Plafonds</TabsTrigger>
        </TabsList>

        {/* ───── Wallets à examiner ───── */}
        <TabsContent value="wallets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{showAll ? 'Tous les wallets' : 'Wallets à examiner (au-dessus du plafond ou gelés)'}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Voir seulement les signalés' : 'Afficher tous les wallets'}
              </Button>
            </CardHeader>
            <CardContent>
              {flagged.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{t('walletProvenancePanel.aucunWalletAExaminer')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead><TableHead>{t('walletProvenancePanel.role')}</TableHead>
                      <TableHead>{t('walletProvenancePanel.soldeGnf')}</TableHead><TableHead>Plafond</TableHead>
                      <TableHead>Palier KYC</TableHead><TableHead>Plafond manuel</TableHead>
                      <TableHead>Mettre en quarantaine</TableHead><TableHead>Gel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flagged.map((w) => (
                      <TableRow key={w.user_id}>
                        <TableCell className="font-medium">
                          {w.full_name || w.user_id.slice(0, 8)}
                          {w.is_blocked && <Badge className="ml-2 bg-red-100 text-red-700 border-red-300">{t('walletProvenancePanel.gele')}</Badge>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{w.role || '?'}</Badge></TableCell>
                        <TableCell className={w.over_cap ? 'text-red-600 font-semibold' : 'font-medium'}>{fmt(w.balance_gnf)}</TableCell>
                        <TableCell>{fmt(w.effective_cap)}</TableCell>
                        <TableCell>
                          <Select value={String(w.kyc_level)} onValueChange={(v) => setKyc(w.user_id, Number(v))}>
                            <SelectTrigger className="w-[118px] h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">{t('walletProvenancePanel.t0NonVerifie')}</SelectItem>
                              <SelectItem value="1">{t('walletProvenancePanel.t1TelPiece')}</SelectItem>
                              <SelectItem value="2">2 — complet</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input className="w-[110px] h-8" placeholder="auto" type="number"
                              onChange={(e) => setCapInputs((p) => ({ ...p, [w.user_id]: e.target.value }))} />
                            <Button size="sm" variant="outline" className="h-8" title={t('walletProvenancePanel.enregistrerLePlafondManuel')} onClick={() => setOverride(w.user_id)}>
                              <Save className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input className="w-[110px] h-8" placeholder="montant" type="number"
                              value={qInputs[w.user_id] ?? ''}
                              onChange={(e) => setQInputs((p) => ({ ...p, [w.user_id]: e.target.value }))} />
                            <Button size="sm" variant="outline" className="h-8 text-amber-700 border-amber-300" title={t('walletProvenancePanel.mettreCeMontantEnQuarantaine')} onClick={() => quarantineAmount(w.user_id)}>
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {w.is_blocked ? (
                            <Button size="sm" variant="outline" className="h-8 text-emerald-700 border-emerald-300" onClick={() => toggleFreeze(w.user_id, false)}>
                              <Unlock className="w-3.5 h-3.5 mr-1" /> Dégeler
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-8 text-red-700 border-red-300" onClick={() => toggleFreeze(w.user_id, true)}>
                              <Lock className="w-3.5 h-3.5 mr-1" /> Geler
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Quarantaine ───── */}
        <TabsContent value="quarantine">
          <Card>
            <CardHeader><CardTitle className="text-base">{t('walletProvenancePanel.fondsEnQuarantaineEnAttente')}</CardTitle></CardHeader>
            <CardContent>
              {quarantine.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{t('walletProvenancePanel.aucunFondsEnQuarantaine')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('walletProvenancePanel.detenteur')}</TableHead><TableHead>{t('walletProvenancePanel.montant')}</TableHead>
                      <TableHead>Source</TableHead><TableHead>Date</TableHead><TableHead className="text-right">{t('walletProvenancePanel.decision')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarantine.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">
                          {q.holder?.name || q.user_id.slice(0, 8)}
                          {q.holder?.role && <Badge variant="outline" className="ml-2">{q.holder.role}</Badge>}
                        </TableCell>
                        <TableCell className="font-semibold">{fmt(q.amount, q.currency)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{q.source_type || q.reason}</TableCell>
                        <TableCell className="text-xs">{new Date(q.created_at).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 text-emerald-700 border-emerald-300" onClick={() => releaseQ(q.id)}>
                              <Unlock className="w-3.5 h-3.5 mr-1" /> Libérer
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-red-700 border-red-300" onClick={() => rejectQ(q.id)}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeter
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Plafonds ───── */}
        <TabsContent value="caps">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4" /> {t('walletProvenancePanel.plafondsDeDetentionGnfPar')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Laisser vide = illimité. t0 = non vérifié · t1 = tél+pièce · t2 = KYC complet. PDG/système toujours exemptés.</p>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>{t('walletProvenancePanel.role')}</TableHead><TableHead>{t('walletProvenancePanel.t0NonVerifie2')}</TableHead><TableHead>{t('walletProvenancePanel.t1TelPiece2')}</TableHead><TableHead>t2 (complet)</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {capRoles.map((role) => (
                    <TableRow key={role}>
                      <TableCell className="font-medium">{role}</TableCell>
                      {(['t0', 't1', 't2'] as const).map((tier) => (
                        <TableCell key={tier}>
                          <Input
                            type="number" className="w-[150px] h-8" placeholder={t('walletProvenancePanel.illimite')}
                            value={capsDraft?.[role]?.[tier] ?? ''}
                            onChange={(e) => updateCap(role, tier, e.target.value)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={saveCaps} className="bg-[#ff4000] hover:bg-[#e03900]">
                <Save className="w-4 h-4 mr-2" /> Enregistrer les plafonds
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
