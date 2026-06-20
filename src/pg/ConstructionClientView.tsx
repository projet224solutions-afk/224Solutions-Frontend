import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏗️ Espace CLIENT chantier (/chantier/:projectId) — suivi + jalons escrow.
 * Le client réclame le chantier (lien partagé), finance chaque jalon (séquestre),
 * puis VALIDE pour libérer le paiement au prestataire. Journal en lecture seule.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { backendFetch } from '@/services/backendApi';
import { useProjectDetail, isLogLocked } from '@/hooks/useConstruction';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { ArrowLeft, Wallet, CheckCircle2, Circle, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ConstructionClientView() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { logs, milestones, fundMilestone, releaseMilestone, reload } = useProjectDetail(projectId);

  const loadProject = async () => {
    if (!projectId) return;
    const { data } = await supabase.from('construction_projects').select('*').eq('id', projectId).maybeSingle();
    setProject(data); setLoading(false);
  };
  useEffect(() => { void loadProject(); /* eslint-disable-next-line */ }, [projectId]);

  const isClient = user && project && project.client_user_id === user.id;
  const unclaimed = project && !project.client_user_id;

  const claim = async () => {
    if (!user) { toast.error(t('constructionClientView.connectezVous')); navigate('/auth'); return; }
    setClaiming(true);
    const res = await backendFetch(`/api/v2/construction/project/${projectId}/claim`, { method: 'POST', body: {} });
    setClaiming(false);
    if (res.success) { toast.success(t('constructionClientView.chantierRattacheAVotreCompte')); await loadProject(); } else toast.error(res.error || 'Erreur');
  };

  const act = async (id: string, fn: () => Promise<boolean>) => { setBusy(id); await fn(); await reload(); setBusy(null); };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!project) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Chantier introuvable.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('constructionClientView.retour')}</Button>

      <div>
        <h1 className="text-xl font-bold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">{project.location} · Budget <Money amount={project.budget} /></p>
      </div>

      {unclaimed && (
        <Card className="border-[#ff4000]/30 bg-[#ff4000]/5"><CardContent className="flex flex-wrap items-center gap-3 py-3">
          <ShieldCheck className="h-5 w-5 text-[#ff4000]" />
          <span className="text-sm">{t('constructionClientView.cEstVotreChantierRattachez')}</span>
          <Button size="sm" className="ml-auto" disabled={claiming} onClick={claim}>{claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rattacher ce chantier'}</Button>
        </CardContent></Card>
      )}

      {/* Avancement */}
      <Card><CardContent className="p-4">
        <div className="mb-1 flex justify-between text-sm"><span>Avancement</span><b>{project.progress_percent}%</b></div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#ff4000]" style={{ width: `${project.progress_percent}%` }} /></div>
      </CardContent></Card>

      {/* Jalons escrow */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{t('constructionClientView.jalonsDePaiementSousSequestre')}</h2>
        {milestones.length === 0 && <p className="text-sm text-muted-foreground">{t('constructionClientView.aucunJalonDefini')}</p>}
        {milestones.map((m) => (
          <Card key={m.id}><CardContent className="flex flex-wrap items-center gap-3 py-3">
            {m.status === 'released' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : m.status === 'funded' ? <Wallet className="h-5 w-5 text-[#ff4000]" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
            <div><div className="font-medium">{m.title}</div><div className="text-xs text-muted-foreground capitalize">{m.status === 'pending' ? 'À financer' : m.status === 'funded' ? 'Financé — à valider' : 'Libéré'}</div></div>
            <span className="ml-auto font-bold text-[#ff4000]"><Money amount={m.amount} /></span>
            {isClient && m.status === 'pending' && <Button size="sm" disabled={busy === m.id} onClick={() => act(m.id, () => fundMilestone(m.id))}><Wallet className="h-4 w-4 mr-1" />Financer</Button>}
            {isClient && m.status === 'funded' && <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={busy === m.id} onClick={() => act(m.id, () => releaseMilestone(m.id))}><CheckCircle2 className="h-4 w-4 mr-1" />{t('constructionClientView.valider')}</Button>}
          </CardContent></Card>
        ))}
        {isClient && <p className="text-[11px] text-muted-foreground">{t('constructionClientView.vosFondsSontConservesSous')}</p>}
      </div>

      {/* Journal de chantier (lecture seule) */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{t('constructionClientView.journalDeChantier')}</h2>
        {logs.length === 0 && <p className="text-sm text-muted-foreground">{t('constructionClientView.pasEncoreDeRapport')}</p>}
        {logs.map((l) => (
          <Card key={l.id}><CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-2 text-sm"><span className="text-lg">{l.weather}</span><b>{new Date(l.log_date).toLocaleDateString()}</b>{isLogLocked(l) && <Badge variant="outline" className="gap-1 text-[10px]"><Lock className="h-3 w-3" />{t('constructionClientView.certifie')}</Badge>}</div>
            {l.description && <p className="text-sm">{l.description}</p>}
            {l.photos.length > 0 && <div className="flex gap-1">{l.photos.slice(0, 5).map((p, i) => <img key={i} src={p} alt="" className="h-14 w-14 rounded object-cover" />)}</div>}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
