/**
 * 🏗️ Litiges BTP sur jalon (PDG/admin) — liste les litiges ouverts et tranche :
 * Libérer (→ prestataire) ou Rembourser (→ client). Mouvement d'argent via les RPC
 * backend (resolve_construction_milestone_dispute), réservé admin/pdg/ceo.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Undo2, Loader2, HardHat } from 'lucide-react';

interface BtpDispute {
  id: string;
  milestone_id: string;
  project_id: string;
  opener_role: 'client' | 'provider';
  reason: string;
  status: string;
  created_at: string;
  construction_milestones?: { title: string; amount: number; status: string } | null;
  construction_projects?: { name: string; location: string | null } | null;
}

export default function PDGConstructionDisputes() {
  const [disputes, setDisputes] = useState<BtpDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await backendFetch<any>('/api/v2/construction/disputes', { method: 'GET' });
    setDisputes((res as any)?.success ? (res as any).disputes || [] : []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: string, decision: 'release' | 'refund') => {
    const label = decision === 'release' ? 'libérer les fonds au prestataire' : 'rembourser le client';
    if (!window.confirm(`Confirmer : ${label} ?`)) return;
    setBusy(id);
    const res = await backendFetch(`/api/v2/construction/dispute/${id}/resolve`, { method: 'POST', body: { decision } });
    setBusy(null);
    if ((res as any)?.success) { toast.success(decision === 'release' ? 'Fonds libérés au prestataire' : 'Client remboursé'); await load(); }
    else toast.error((res as any)?.error || 'Erreur');
  };

  if (loading) return <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><HardHat className="h-4 w-4 text-[#ff4000]" /> Litiges BTP — jalons ({disputes.length})</div>
      {disputes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-9 w-9 opacity-40" /> Aucun litige BTP ouvert.</CardContent></Card>
      ) : disputes.map((d) => (
        <Card key={d.id} className="border-amber-300">
          <CardContent className="space-y-2 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-medium">{d.construction_projects?.name || 'Chantier'}</span>
              <span className="text-sm text-muted-foreground">· {d.construction_milestones?.title || 'Jalon'}</span>
              <Badge variant="outline" className="text-[10px]">{d.opener_role === 'client' ? 'Ouvert par le client' : 'Ouvert par le prestataire'}</Badge>
              <span className="ml-auto font-bold text-[#ff4000]"><Money amount={d.construction_milestones?.amount || 0} /></span>
            </div>
            <p className="text-sm">{d.reason}</p>
            <p className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString('fr-FR')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={busy === d.id} onClick={() => resolve(d.id, 'release')}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Libérer (prestataire)
              </Button>
              <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => resolve(d.id, 'refund')}>
                <Undo2 className="h-4 w-4 mr-1" /> Rembourser (client)
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
