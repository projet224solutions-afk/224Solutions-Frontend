import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Shield, RefreshCw, AlertTriangle, Wrench, CheckCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AgentWalletRow {
  agent_id: string;
  profile_role: string;
  main_balance: number | null;
  agent_balance: number | null;
  currency: string | null;
  divergence: number;
}

export function AgentWalletAudit() {
  const [rows, setRows] = useState<AgentWalletRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Récupérer tous les agents via agents_management
      const { data: agents, error: profErr } = await supabase
        .from('agents_management')
        .select('id, user_id');

      if (profErr) throw profErr;

      const results: AgentWalletRow[] = [];
      for (const p of agents || []) {
        // Wallet principal
        const { data: mainWallet } = await supabase
          .from('wallets')
          .select('balance, currency')
          .eq('user_id', p.id)
          .maybeSingle();

        // Wallet agent
        const { data: agentWallet } = await supabase
          .from('agent_wallets')
          .select('balance, currency')
          .eq('agent_id', p.id)
          .maybeSingle();

        const mainBalance = mainWallet?.balance ?? null;
        const agentBalance = agentWallet?.balance ?? null;
        const currency = mainWallet?.currency || agentWallet?.currency || 'GNF';
        const divergence = (mainBalance !== null && agentBalance !== null) ? (agentBalance - mainBalance) : 0;

        results.push({
          agent_id: p.id,
          profile_role: 'agent',
          main_balance: mainBalance,
          agent_balance: agentBalance,
          currency,
          divergence
        });
      }
      setRows(results);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message || 'Erreur chargement audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = (() => {
    const total = rows.length;
    const incomplets = rows.filter(r => r.main_balance === null || r.agent_balance === null).length;
    const divergents = rows.filter(r => r.main_balance !== null && r.agent_balance !== null && r.divergence !== 0).length;
    const ok = rows.filter(r => r.main_balance !== null && r.agent_balance !== null && r.divergence === 0).length;
    return { total, incomplets, divergents, ok };
  })();

  const fixDivergences = async () => {
    if (fixing) return;
    setFixing(true);
    try {
      // Pour chaque ligne divergente, aligner agent_wallet sur le solde principal
      const divergents = rows.filter(r => r.main_balance !== null && r.agent_balance !== null && r.divergence !== 0);
      for (const row of divergents) {
        await supabase
          .from('agent_wallets')
          .update({ balance: row.main_balance, updated_at: new Date().toISOString() })
          .eq('agent_id', row.agent_id);
        // Log simple dans wallet_transactions avec champs requis
        await supabase
          .from('wallet_transactions' as any)
          .insert({
            transaction_id: `audit_${row.agent_id}_${Date.now()}`,
            sender_wallet_id: row.agent_id,
            receiver_wallet_id: row.agent_id,
            amount: 0,
            net_amount: 0,
            transaction_type: 'commission',
            metadata: { previous_agent_balance: row.agent_balance, new_balance: row.main_balance, operation: 'agent_wallet_resync' }
          });
      }
      await load();
    } catch (e) {
      console.warn('Erreur correction divergences:', e);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Audit Wallet Agents</h2>
          {lastUpdated && (
            <Badge variant="outline">MAJ {lastUpdated}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={load} disabled={loading || fixing} variant="outline" className="gap-2">
            <RefreshCw className={"w-4 h-4 " + (loading ? 'animate-spin' : '')} />
            Rafraîchir
          </Button>
          <Button onClick={fixDivergences} disabled={fixing || stats.divergents === 0} variant="default" className="gap-2">
            {fixing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            Corriger ({stats.divergents})
          </Button>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4 px-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Total Agents</p>
            <div className="flex items-center gap-2 font-semibold"><Shield className="w-3 h-3" /> {stats.total}</div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">OK</p>
            <div className="flex items-center gap-2 font-semibold text-[#ff4000]"><CheckCircle className="w-3 h-3" /> {stats.ok}</div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Divergents</p>
            <div className="flex items-center gap-2 font-semibold text-orange-600"><AlertTriangle className="w-3 h-3" /> {stats.divergents}</div>
          </div>
            <div className="space-y-1">
            <p className="text-muted-foreground">Incomplets</p>
            <div className="flex items-center gap-2 font-semibold text-[#ff4000]"><AlertTriangle className="w-3 h-3" /> {stats.incomplets}</div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-[#ff4000]">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-2">Agent ID</th>
                  <th className="px-4 py-2">Principal</th>
                  <th className="px-4 py-2">Agent</th>
                  <th className="px-4 py-2">Δ</th>
                  <th className="px-4 py-2">Devise</th>
                  <th className="px-4 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const status = (r.main_balance === null || r.agent_balance === null)
                    ? 'Incomplet'
                    : (Math.abs(r.divergence) <= 0 ? 'OK' : 'Divergent');
                  return (
                    <tr key={r.agent_id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{r.agent_id.substring(0, 10)}…</td>
                      <td className="px-4 py-2">{r.main_balance !== null ? r.main_balance : '—'}</td>
                      <td className="px-4 py-2">{r.agent_balance !== null ? r.agent_balance : '—'}</td>
                      <td className="px-4 py-2">{r.main_balance !== null && r.agent_balance !== null ? r.divergence : '—'}</td>
                      <td className="px-4 py-2">{r.currency}</td>
                      <td className="px-4 py-2">
                        {status === 'OK' && <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">OK</Badge>}
                        {status === 'Divergent' && <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Divergence</Badge>}
                        {status === 'Incomplet' && <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">Incomplet</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Aucun agent trouvé.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentWalletAudit;