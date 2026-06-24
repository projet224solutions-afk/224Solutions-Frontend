import { useTranslation } from "@/hooks/useTranslation";
/**
 * MODULE CONSTRUCTION / BTP (réel) — portfolio de projets + détail (journal verrou 24h,
 * budget, jalons escrow). Inspiré de Procore.
 */

import { useState } from 'react';
import { useConstructionProjects, type ConstructionProject } from '@/hooks/useConstruction';
import { ConstructionProjectDetail } from '@/components/professional-services/modules/construction/ConstructionProjectDetail';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { HardHat, Plus, Loader2, Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planification', color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  late: { label: 'En retard', color: 'bg-red-100 text-red-700' },
  completed: { label: t('constructionModule.termine'), color: 'bg-green-100 text-green-700' },
  cancelled: { label: t('constructionModule.annule'), color: 'bg-slate-100 text-slate-500' },
};

export function ConstructionModule({ serviceId, businessName }: { serviceId: string; businessName?: string }) {
  const { t } = useTranslation();
  const { projects, loading, createProject } = useConstructionProjects(serviceId);
  const [selected, setSelected] = useState<ConstructionProject | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', client_name: '', description: '', location: '', budget: 0, deadline: '' });
  const [saving, setSaving] = useState(false);

  if (selected) {
    const fresh = projects.find((p) => p.id === selected.id) || selected;
    return <ConstructionProjectDetail project={fresh} onBack={() => setSelected(null)} />;
  }

  const submit = async () => {
    if (!form.name.trim()) { toast.error(t('constructionModule.nomDuProjetRequis')); return; }
    setSaving(true);
    const created = await createProject({ ...form, budget: Number(form.budget) || 0, deadline: form.deadline || null, status: 'planning' } as any);
    setSaving(false);
    if (created) { setForm({ name: '', client_name: '', description: '', location: '', budget: 0, deadline: '' }); setOpen(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#ff4000] p-3"><HardHat className="h-8 w-8 text-white" /></div>
        <div><h2 className="text-2xl font-bold">{businessName || 'Entreprise BTP'}</h2><p className="text-muted-foreground">{t('constructionModule.gestionDeChantiersDevisJalons')}</p></div>
        <Button className="ml-auto" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />{t('constructionModule.nouveauProjet')}</Button>
      </div>

      {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : (
        <div className="space-y-2">
          {projects.length === 0 && <p className="text-sm text-muted-foreground">{t('constructionModule.aucunProjetCreezVotrePremier')}</p>}
          {projects.map((p) => {
            const st = STATUS[p.status] || STATUS.planning;
            const budgetPct = p.budget ? Math.min(100, (p.spent / p.budget) * 100) : 0;
            const overBudget = p.spent > p.budget;
            const late = p.deadline && new Date(p.deadline) < new Date() && p.status !== 'completed';
            return (
              <Card key={p.id} className="cursor-pointer hover:shadow-md" onClick={() => setSelected(p)}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <Badge className={st.color}>{st.label}</Badge>
                    {p.client_name && <span className="text-xs text-muted-foreground">· {p.client_name}</span>}
                    {late && <Badge className="bg-red-100 text-red-700 text-[10px]">En retard</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {p.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>}
                    {p.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.deadline).toLocaleDateString()}</span>}
                  </div>
                  <div>
                    <div className="mb-0.5 flex justify-between text-[11px]"><span>Budget</span><span className={overBudget ? 'text-red-600' : ''}><Money amount={p.spent} /> / <Money amount={p.budget} /></span></div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${overBudget ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${budgetPct}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-0.5 flex justify-between text-[11px]"><span>Avancement</span><span>{p.progress_percent}%</span></div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#ff4000]" style={{ width: `${p.progress_percent}%` }} /></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('constructionModule.nouveauProjet')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('constructionModule.nomDuProjet')}</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('constructionModule.exVillaR1Kipe')} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('constructionModule.client')}</Label><Input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} /></div>
              <div><Label>Budget (GNF)</Label><Input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: +e.target.value || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Localisation</Label><Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
              <div><Label>{t('constructionModule.livraisonPrevue')}</Label><Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <Button onClick={submit} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Créer le projet</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConstructionModule;
