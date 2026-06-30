import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏗️ Détail projet BTP (prestataire) — Vue générale, Journal de chantier (verrou 24h),
 * Budget, Jalons (escrow). Le client finance/valide les jalons depuis son espace.
 */

import { useState } from 'react';
import { useProjectDetail, isLogLocked, type ConstructionProject } from '@/hooks/useConstruction';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Money, useMoneyFormat } from '@/components/Money';
import { ArrowLeft, Plus, Camera, Lock, Loader2, CheckCircle2, Circle, Wallet, Share2, FileDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ConstructionLots } from './ConstructionLots';
import { ConstructionReserves } from './ConstructionReserves';
import { ConstructionMeetings } from './ConstructionMeetings';
import { ConstructionIntervenants } from './ConstructionIntervenants';
import { exportProjectReportPdf } from '@/lib/constructionPdf';

const WEATHER = ['☀️', '⛅', '🌧️', '⛈️', '🌬️', '❄️'];

export function ConstructionProjectDetail({ project, onBack }: { project: ConstructionProject; onBack: () => void }) {
  const { t } = useTranslation();
  const { logs, milestones, loading, addLog, addMilestone, openDispute } = useProjectDetail(project.id);
  const [disputeFor, setDisputeFor] = useState<{ id: string; title: string } | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeBusy, setDisputeBusy] = useState(false);
  const submitDispute = async () => {
    if (!disputeFor || disputeReason.trim().length < 5) { toast.error('Motif trop court (5 caractères min.)'); return; }
    setDisputeBusy(true);
    const ok = await openDispute(disputeFor.id, disputeReason.trim());
    setDisputeBusy(false);
    if (ok) { setDisputeFor(null); setDisputeReason(''); }
  };
  const { uploadFile } = useStorageUpload();
  const [log, setLog] = useState({ weather: '☀️', description: '', incidents: '', workers: '', photos: [] as string[] });
  const [uploading, setUploading] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [ms, setMs] = useState({ title: '', amount: 0 });
  const [exporting, setExporting] = useState(false);
  const { format: moneyFmt } = useMoneyFormat();

  const exportReport = async () => {
    setExporting(true);
    try { await exportProjectReportPdf(project, (n) => moneyFmt(n)); }
    catch { toast.error(t('constructionProjectDetail.erreurLorsDeLaGeneration')); }
    finally { setExporting(false); }
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploading(true);
    const res = await uploadFile(file, { folder: 'documents' as any, subfolder: `btp/${project.id}` });
    setUploading(false);
    if (res.success && res.publicUrl) setLog((l) => ({ ...l, photos: [...l.photos, res.publicUrl!] }));
  };

  const saveLog = async () => {
    if ((log.description || '').trim().length < 100) { toast.error(t('constructionProjectDetail.descriptionMinimum100CaracteresValeur')); return; }
    if (log.photos.length < 2) { toast.error('Au moins 2 photos requises'); return; }
    setSavingLog(true);
    const ok = await addLog({ weather: log.weather, description: log.description, incidents: log.incidents || null, photos: log.photos, workers: log.workers ? [{ note: log.workers }] : [] });
    setSavingLog(false);
    if (ok) setLog({ weather: '☀️', description: '', incidents: '', workers: '', photos: [] });
  };

  const fundedTotal = milestones.filter((m) => m.status === 'released').reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Projets</Button>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">{project.name}</h2>
        <Badge variant="outline" className="capitalize">{project.status.replace('_', ' ')}</Badge>
        <span className="ml-auto text-sm text-muted-foreground">{project.client_name}</span>
        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/chantier/${project.id}`); toast.success(t('constructionProjectDetail.lienClientCopie')); }}><Share2 className="h-4 w-4 mr-1" />{t('constructionProjectDetail.lienClient')}</Button>
        <Button size="sm" variant="outline" onClick={exportReport} disabled={exporting}>{exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}Rapport PDF</Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="overview">{t('constructionProjectDetail.vueGenerale')}</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="lots">{t('constructionProjectDetail.corpsDEtat')}</TabsTrigger>
          <TabsTrigger value="reserves">{t('constructionProjectDetail.reserves')}</TabsTrigger>
          <TabsTrigger value="meetings">{t('constructionProjectDetail.reunions')}</TabsTrigger>
          <TabsTrigger value="intervenants">Intervenants</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="milestones">Jalons</TabsTrigger>
        </TabsList>

        {/* Vue générale : timeline jalons */}
        <TabsContent value="overview" className="mt-4 space-y-3">
          <Card><CardContent className="p-4">
            <div className="mb-1 flex justify-between text-sm"><span>Avancement</span><b>{project.progress_percent}%</b></div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#ff4000]" style={{ width: `${project.progress_percent}%` }} /></div>
            <div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>Budget : <b className="text-foreground"><Money amount={project.budget} /></b></span><span>{t('constructionProjectDetail.encaisse')} <b className="text-green-600"><Money amount={fundedTotal} /></b></span></div>
          </CardContent></Card>
          <div className="space-y-1">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                {m.status === 'released' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : m.status === 'funded' ? <Wallet className="h-5 w-5 text-[#ff4000]" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <span className="text-sm">{m.title}</span>
                <span className="ml-auto text-sm font-medium"><Money amount={m.amount} /></span>
                <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
              </div>
            ))}
            {milestones.length === 0 && <p className="text-sm text-muted-foreground">{t('constructionProjectDetail.aucunJalonAjoutezEnDans')}</p>}
          </div>
        </TabsContent>

        {/* Journal de chantier (verrou 24h) */}
        <TabsContent value="journal" className="mt-4 space-y-3">
          <Card><CardContent className="space-y-3 pt-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{t('constructionProjectDetail.nouveauRapportDuJour')}</div>
            <div className="flex items-center gap-2"><Label>{t('constructionProjectDetail.meteo')}</Label>{WEATHER.map((w) => <button key={w} onClick={() => setLog((l) => ({ ...l, weather: w }))} className={`rounded p-1 text-lg ${log.weather === w ? 'bg-[#ff4000]/10 ring-1 ring-[#ff4000]' : ''}`}>{w}</button>)}</div>
            <div><Label>{t('constructionProjectDetail.ouvriersPresentsParCorpsDe')}</Label><Input value={log.workers} onChange={(e) => setLog((l) => ({ ...l, workers: e.target.value }))} placeholder={t('constructionProjectDetail.ex3Macons2Ferrailleurs')} /></div>
            <div><Label>{t('constructionProjectDetail.travauxDuJourMin100')}</Label><Textarea rows={3} value={log.description} onChange={(e) => setLog((l) => ({ ...l, description: e.target.value }))} /><div className="text-[11px] text-muted-foreground">{log.description.length}/100</div></div>
            <div><Label>Incidents (optionnel)</Label><Input value={log.incidents} onChange={(e) => setLog((l) => ({ ...l, incidents: e.target.value }))} /></div>
            <div>
              <Label>Photos (min 2)</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {log.photos.map((p, i) => <img key={i} src={p} alt="" className="h-16 w-16 rounded object-cover" />)}
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border-2 border-dashed hover:border-[#ff4000]">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}<input type="file" accept="image/*" className="hidden" onChange={onPhoto} /></label>
              </div>
            </div>
            <Button onClick={saveLog} disabled={savingLog}>{savingLog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Publier le rapport</Button>
            <p className="text-[11px] text-amber-700">{t('constructionProjectDetail.modifiable24hPuisVerrouilleDefinitivemen')}</p>
          </CardContent></Card>

          {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : logs.map((l) => (
            <Card key={l.id}><CardContent className="space-y-2 p-3">
              <div className="flex items-center gap-2 text-sm"><span className="text-lg">{l.weather}</span><b>{new Date(l.log_date).toLocaleDateString()}</b>{isLogLocked(l) && <Badge variant="outline" className="gap-1 text-[10px]"><Lock className="h-3 w-3" />{t('constructionProjectDetail.verrouille')}</Badge>}<span className="ml-auto text-xs text-muted-foreground">{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
              {l.description && <p className="text-sm">{l.description}</p>}
              {l.incidents && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">⚠️ {l.incidents}</p>}
              {l.photos.length > 0 && <div className="flex gap-1">{l.photos.slice(0, 5).map((p, i) => <img key={i} src={p} alt="" className="h-14 w-14 rounded object-cover" />)}</div>}
            </CardContent></Card>
          ))}
        </TabsContent>

        {/* Budget */}
        <TabsContent value="budget" className="mt-4">
          <Card><CardContent className="space-y-2 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Budget contractuel</span><b><Money amount={project.budget} /></b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('constructionProjectDetail.depense')}</span><b><Money amount={project.spent} /></b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reste</span><b className={project.budget - project.spent < 0 ? 'text-red-600' : 'text-green-600'}><Money amount={project.budget - project.spent} /></b></div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${project.spent > project.budget * 0.95 ? 'bg-red-500' : project.spent > project.budget * 0.8 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, project.budget ? (project.spent / project.budget) * 100 : 0)}%` }} /></div>
            <p className="pt-1 text-[11px] text-muted-foreground">{t('constructionProjectDetail.encaisseViaJalons')} <b className="text-green-600"><Money amount={fundedTotal} /></b></p>
          </CardContent></Card>
        </TabsContent>

        {/* Jalons (escrow) */}
        <TabsContent value="milestones" className="mt-4 space-y-3">
          <Card><CardContent className="flex flex-wrap items-end gap-2 pt-4">
            <div className="flex-1 min-w-[140px]"><Label>Jalon</Label><Input value={ms.title} onChange={(e) => setMs((m) => ({ ...m, title: e.target.value }))} placeholder="Ex : Fondations" /></div>
            <div><Label>{t('constructionProjectDetail.montant')}</Label><Input type="number" value={ms.amount} onChange={(e) => setMs((m) => ({ ...m, amount: +e.target.value || 0 }))} /></div>
            <Button onClick={async () => { if (!ms.title.trim() || ms.amount <= 0) { toast.error(t('constructionProjectDetail.titreMontantRequis')); return; } await addMilestone(ms.title, ms.amount, milestones.length); setMs({ title: '', amount: 0 }); }}><Plus className="h-4 w-4 mr-1" />{t('constructionProjectDetail.ajouter')}</Button>
          </CardContent></Card>
          {milestones.map((m) => (
            <Card key={m.id}><CardContent className="flex items-center gap-3 py-3">
              <span className="font-medium">{m.title}</span>
              <Badge className={m.status === 'released' ? 'bg-green-600' : m.status === 'funded' ? 'bg-[#ff4000]' : 'bg-slate-400'}>{m.status}</Badge>
              <span className="ml-auto font-bold text-[#ff4000]"><Money amount={m.amount} /></span>
              {m.status === 'funded' && <Button size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={() => { setDisputeFor({ id: m.id, title: m.title }); setDisputeReason(''); }}><AlertTriangle className="h-4 w-4 mr-1" />Litige</Button>}
            </CardContent></Card>
          ))}
          <p className="text-[11px] text-muted-foreground">{t('constructionProjectDetail.leClientFinancePuisValide')}</p>
        </TabsContent>

        {/* Corps d'état / Lots par métier */}
        <TabsContent value="lots" className="mt-4">
          <ConstructionLots project={project} />
        </TabsContent>

        {/* Réserves / Punch list */}
        <TabsContent value="reserves" className="mt-4">
          <ConstructionReserves project={project} />
        </TabsContent>

        {/* Réunions OPC */}
        <TabsContent value="meetings" className="mt-4">
          <ConstructionMeetings project={project} />
        </TabsContent>

        {/* Intervenants */}
        <TabsContent value="intervenants" className="mt-4">
          <ConstructionIntervenants project={project} />
        </TabsContent>
      </Tabs>

      {/* Litige sur un jalon financé (prestataire) */}
      <Dialog open={!!disputeFor} onOpenChange={(o) => { if (!o && !disputeBusy) { setDisputeFor(null); setDisputeReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Signaler un litige</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Jalon : <b>{disputeFor?.title}</b>. Décrivez le désaccord (ex : travail réalisé mais le client ne valide pas). Un administrateur tranchera ; les fonds restent sous séquestre jusqu'à la décision.</p>
            <Textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Motif du litige (5 caractères min.)" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={disputeBusy} onClick={() => { setDisputeFor(null); setDisputeReason(''); }}>Annuler</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" disabled={disputeBusy || disputeReason.trim().length < 5} onClick={submitDispute}>{disputeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ouvrir le litige'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConstructionProjectDetail;
