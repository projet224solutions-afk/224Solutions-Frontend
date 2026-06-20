import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const PROJECT_TYPES = [
  { value: 'maison', label: '🏠 Maison' },
  { value: 'immeuble', label: '🏢 Immeuble' },
  { value: 'renovation', label: '🔧 Rénovation' },
  { value: 'route', label: '🛣️ Route' },
  { value: 'pont', label: '🌉 Pont' },
  { value: 'bureau', label: '🏬 Bureau' },
  { value: 'entrepot', label: '🏭 Entrepôt' },
  { value: 'autre', label: '📐 Autre' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
  saving: boolean;
}

export function NewProjectDialog({ open, onClose, onSubmit, saving }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    title: '', description: '', project_type: '', location: '', city: '',
    budget_estimated: '', start_date: '', estimated_duration_days: '',
  });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title || !form.project_type) return;
    const ok = await onSubmit({
      ...form,
      budget_estimated: parseFloat(form.budget_estimated) || 0,
      estimated_duration_days: parseInt(form.estimated_duration_days) || 0,
    });
    if (ok) {
      setForm({ title: '', description: '', project_type: '', location: '', city: '', budget_estimated: '', start_date: '', estimated_duration_days: '' });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('newProjectDialog.nouveauProjetDeConstruction')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('newProjectDialog.typeDeProjet')}</Label>
              <Select value={form.project_type} onValueChange={v => update('project_type', v)}>
                <SelectTrigger><SelectValue placeholder={t('newProjectDialog.selectionner')} /></SelectTrigger>
                <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('newProjectDialog.dateDeDebut')}</Label>
              <Input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('newProjectDialog.titreDuProjet')}</Label>
            <Input placeholder={t('newProjectDialog.exConstructionVilla4Chambres')} value={form.title} onChange={e => update('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('newProjectDialog.budgetEstimeGnf')}</Label>
              <Input type="number" placeholder="0" value={form.budget_estimated} onChange={e => update('budget_estimated', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('newProjectDialog.dureeEstimeeJours')}</Label>
              <Input type="number" placeholder="90" value={form.estimated_duration_days} onChange={e => update('estimated_duration_days', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input placeholder="Conakry" value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Localisation</Label>
              <Input placeholder="Quartier, adresse..." value={form.location} onChange={e => update('location', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder={t('newProjectDialog.decrivezLeProjet')} rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>{t('newProjectDialog.annuler')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.title || !form.project_type}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer le projet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
