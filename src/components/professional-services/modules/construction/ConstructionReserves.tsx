import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏗️ Réserves / Punch List — Gestion des non-conformités (style Archipad)
 * Créer, suivre et lever les réserves par corps d'état.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Camera, Loader2, CheckCircle2,
  MapPin, User, CalendarDays, Filter, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import {
  useConstructionReserves,
  useConstructionLots,
  RESERVE_PRIORITY_LABELS,
  RESERVE_STATUS_LABELS,
  type ReservePriority,
  type ReserveStatus,
  type ConstructionReserve,
} from '@/hooks/useConstructionExtended';
import type { ConstructionProject } from '@/hooks/useConstruction';

const EMPTY_FORM = {
  title: '',
  description: '',
  location_note: '',
  priority: 'medium' as ReservePriority,
  assigned_to: '',
  due_date: '',
  lot_id: '',
  photo_urls: [] as string[],
};

interface Props {
  project: ConstructionProject;
}

export function ConstructionReserves({ project }: Props) {
  const { t } = useTranslation();
  const { reserves, loading, addReserve, updateReserve, reserveStats } = useConstructionReserves(project.id);
  const { lots } = useConstructionLots(project.id);
  const { uploadFile } = useStorageUpload();
  const [open, setOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedReserve, setSelectedReserve] = useState<ConstructionReserve | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resolveForm, setResolveForm] = useState({ resolution_note: '', resolution_photos: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | ReserveStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | ReservePriority>('all');

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>, target: 'form' | 'resolve') => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploading(true);
    const res = await uploadFile(file, { folder: 'documents' as any, subfolder: `btp/${project.id}/reserves` });
    setUploading(false);
    if (res.success && res.publicUrl) {
      if (target === 'form') {
        setForm(f => ({ ...f, photo_urls: [...f.photo_urls, res.publicUrl!] }));
      } else {
        setResolveForm(f => ({ ...f, resolution_photos: [...f.resolution_photos, res.publicUrl!] }));
      }
    }
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error(t('constructionReserves.leTitreDeLaReserve')); return; }
    setSaving(true);
    await addReserve({
      ...form,
      lot_id: form.lot_id || null,
      due_date: form.due_date || null,
    });
    setSaving(false);
    setForm(EMPTY_FORM);
    setOpen(false);
  };

  const submitResolve = async () => {
    if (!selectedReserve) return;
    if (!resolveForm.resolution_note.trim()) { toast.error(t('constructionReserves.decrivezCommentLaReserveA')); return; }
    setSaving(true);
    await updateReserve(selectedReserve.id, {
      status: 'resolved',
      resolution_note: resolveForm.resolution_note,
      resolution_photos: resolveForm.resolution_photos,
    });
    setSaving(false);
    setResolveOpen(false);
    setSelectedReserve(null);
    setResolveForm({ resolution_note: '', resolution_photos: [] });
  };

  const openResolve = (reserve: ConstructionReserve) => {
    setSelectedReserve(reserve);
    setResolveForm({ resolution_note: '', resolution_photos: [] });
    setResolveOpen(true);
  };

  const filtered = reserves.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    return true;
  });

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Tableau de bord réserves */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Ouvertes', val: reserveStats.open, color: 'text-red-600' },
          { label: 'En cours', val: reserveStats.inProgress, color: 'text-amber-600' },
          { label: t('constructionReserves.levees'), val: reserveStats.resolved, color: 'text-[#16a34a]' },
          { label: 'Critiques', val: reserveStats.critical, color: 'text-red-700 font-bold' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${s.color}`}>{s.val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions + Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setOpen(true)} className="bg-[#ff4000] text-white hover:bg-[#ff4000]/90">
          <Plus className="h-4 w-4 mr-1" />Nouvelle réserve
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('constructionReserves.tousLesStatuts')}</SelectItem>
              {Object.entries(RESERVE_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as any)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('constructionReserves.toutesPriorites')}</SelectItem>
              {Object.entries(RESERVE_PRIORITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Liste des réserves */}
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {reserves.length === 0
            ? 'Aucune réserve. Créez la première lors de votre prochaine visite de chantier.'
            : 'Aucune réserve ne correspond aux filtres sélectionnés.'}
        </p>
      )}
      {filtered.map((reserve) => {
        const priorityMeta = RESERVE_PRIORITY_LABELS[reserve.priority];
        const statusMeta = RESERVE_STATUS_LABELS[reserve.status];
        const lot = lots.find(l => l.id === reserve.lot_id);
        const isOpen = ['open', 'in_progress'].includes(reserve.status);
        return (
          <Card key={reserve.id} className={`border ${reserve.priority === 'critical' ? 'border-red-200' : 'border-slate-100'}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">
                    #{String(reserve.reserve_number).padStart(3, '0')}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{reserve.title}</p>
                    {reserve.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{reserve.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Badge className={`text-[10px] border-0 ${priorityMeta.color}`}>{priorityMeta.label}</Badge>
                  <Badge className={`text-[10px] border-0 ${statusMeta.color}`}>{statusMeta.label}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {lot && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{lot.name}</span>}
                {reserve.location_note && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{reserve.location_note}</span>}
                {reserve.assigned_to && <span className="flex items-center gap-1"><User className="h-3 w-3" />{reserve.assigned_to}</span>}
                {reserve.due_date && (
                  <span className={`flex items-center gap-1 ${new Date(reserve.due_date) < new Date() && isOpen ? 'text-red-600 font-medium' : ''}`}>
                    <CalendarDays className="h-3 w-3" />
                    {new Date(reserve.due_date).toLocaleDateString('fr-FR')}
                    {new Date(reserve.due_date) < new Date() && isOpen && ' ⚠️ Dépassée'}
                  </span>
                )}
              </div>

              {reserve.photo_urls.length > 0 && (
                <div className="flex gap-1">
                  {reserve.photo_urls.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} alt="" className="h-14 w-14 rounded object-cover border" />
                  ))}
                </div>
              )}

              {/* Résolution (si levée) */}
              {reserve.resolution_note && (
                <div className="rounded-lg border border-[#16a34a]/20 bg-[#16a34a]/5 p-2">
                  <p className="text-xs font-medium text-[#16a34a] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />Réserve levée
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{reserve.resolution_note}</p>
                  {reserve.resolution_photos.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {reserve.resolution_photos.slice(0, 4).map((url, i) => (
                        <img key={i} src={url} alt="" className="h-12 w-12 rounded object-cover border" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {isOpen && (
                  <>
                    {reserve.status === 'open' && (
                      <Button
                        variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => updateReserve(reserve.id, { status: 'in_progress' })}
                      >
                        Démarrer le traitement
                      </Button>
                    )}
                    <Button
                      size="sm" className="h-7 text-xs bg-[#16a34a] text-white hover:bg-[#16a34a]/90"
                      onClick={() => openResolve(reserve)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Lever la réserve
                    </Button>
                  </>
                )}
                {reserve.status === 'resolved' && (
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => updateReserve(reserve.id, { status: 'closed' })}
                  >
                    Clôturer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog création de réserve */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('constructionReserves.nouvelleReserve')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titre *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={t('constructionReserves.exFissureSurCloison')}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('constructionReserves.detailDeLaNonConformite')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('constructionReserves.priorite')}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v as ReservePriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESERVE_PRIORITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('constructionReserves.corpsDEtat')}</Label>
                <Select value={form.lot_id || 'none'} onValueChange={(v) => setForm(f => ({ ...f, lot_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder={t('constructionReserves.aucun')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('constructionReserves.aucun')}</SelectItem>
                    {lots.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Localisation</Label>
              <Input
                value={form.location_note}
                onChange={(e) => setForm(f => ({ ...f, location_note: e.target.value }))}
                placeholder="Ex : Chambre principale, mur nord"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('constructionReserves.assigneeA')}</Label>
                <Input
                  value={form.assigned_to}
                  onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="Entreprise / corps d'état"
                />
              </div>
              <div>
                <Label>{t('constructionReserves.echeance')}</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Photos</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {form.photo_urls.map((p, i) => <img key={i} src={p} alt="" className="h-16 w-16 rounded object-cover" />)}
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border-2 border-dashed hover:border-[#ff4000]">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e, 'form')} />
                </label>
              </div>
            </div>
            <Button onClick={submit} disabled={saving} className="w-full bg-[#ff4000] text-white hover:bg-[#ff4000]/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Créer la réserve
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog levée de réserve */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Lever la réserve {selectedReserve && `#${String(selectedReserve.reserve_number).padStart(3, '0')}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('constructionReserves.commentLaReserveAT')}</Label>
              <Textarea
                rows={3}
                value={resolveForm.resolution_note}
                onChange={(e) => setResolveForm(f => ({ ...f, resolution_note: e.target.value }))}
                placeholder={t('constructionReserves.decrivezLesTravauxDeReprise')}
              />
            </div>
            <div>
              <Label>{t('constructionReserves.photosDeLaReprise')}</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {resolveForm.resolution_photos.map((p, i) => <img key={i} src={p} alt="" className="h-16 w-16 rounded object-cover" />)}
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border-2 border-dashed hover:border-[#16a34a]">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e, 'resolve')} />
                </label>
              </div>
            </div>
            <Button onClick={submitResolve} disabled={saving} className="w-full bg-[#16a34a] text-white hover:bg-[#16a34a]/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Confirmer la levée
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConstructionReserves;
