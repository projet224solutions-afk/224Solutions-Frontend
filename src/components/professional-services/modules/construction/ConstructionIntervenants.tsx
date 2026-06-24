import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏗️ Intervenants — Multi-stakeholders du chantier (BTP professionnel)
 * Maître d'ouvrage, maître d'œuvre, architecte, BET, bureau de contrôle,
 * entreprises, sous-traitants... regroupés par rôle.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Phone, Mail, Building2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useConstructionIntervenants,
  useConstructionLots,
  INTERVENANT_ROLE_LABELS,
  type IntervenantRole,
} from '@/hooks/useConstructionExtended';
import type { ConstructionProject } from '@/hooks/useConstruction';

const EMPTY_FORM = {
  name: '',
  role: 'entreprise_generale' as IntervenantRole,
  company: '',
  phone: '',
  email: '',
  lot_id: '',
  notes: '',
};

interface Props {
  project: ConstructionProject;
}

export function ConstructionIntervenants({ project }: Props) {
  const { t } = useTranslation();
  const { intervenants, loading, addIntervenant, removeIntervenant } = useConstructionIntervenants(project.id);
  const { lots } = useConstructionLots(project.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) { toast.error(t('constructionIntervenants.leNomDeLIntervenant')); return; }
    setSaving(true);
    await addIntervenant({ ...form, lot_id: form.lot_id || null });
    setSaving(false);
    setForm(EMPTY_FORM);
    setOpen(false);
  };

  // Regrouper par rôle
  const grouped = intervenants.reduce<Record<string, typeof intervenants>>((acc, i) => {
    (acc[i.role] ||= []).push(i);
    return acc;
  }, {});

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{intervenants.length} intervenant(s)</h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-[#04439e] text-white hover:bg-[#04439e]/90">
          <UserPlus className="h-4 w-4 mr-1" />Ajouter
        </Button>
      </div>

      {intervenants.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun intervenant. Ajoutez le maître d'ouvrage, l'architecte, les BET, les entreprises...
        </p>
      )}

      {Object.entries(grouped).map(([role, list]) => (
        <div key={role} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {INTERVENANT_ROLE_LABELS[role as IntervenantRole] || role}
          </p>
          {list.map((i) => {
            const lot = lots.find(l => l.id === i.lot_id);
            return (
              <Card key={i.id} className="border border-slate-100">
                <CardContent className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{i.name}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                      {i.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{i.company}</span>}
                      {i.phone && <a href={`tel:${i.phone}`} className="flex items-center gap-1 hover:text-[#04439e]"><Phone className="h-3 w-3" />{i.phone}</a>}
                      {i.email && <a href={`mailto:${i.email}`} className="flex items-center gap-1 hover:text-[#04439e]"><Mail className="h-3 w-3" />{i.email}</a>}
                      {lot && <span className="flex items-center gap-1">· {lot.name}</span>}
                    </div>
                    {i.notes && <p className="text-xs text-muted-foreground mt-1">{i.notes}</p>}
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700 flex-shrink-0"
                    onClick={() => removeIntervenant(i.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      {/* Dialog ajout */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('constructionIntervenants.ajouterUnIntervenant')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('constructionIntervenants.nomDeLaPersonneOu')}
              />
            </div>
            <div>
              <Label>{t('constructionIntervenants.role')}</Label>
              <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v as IntervenantRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(INTERVENANT_ROLE_LABELS) as [IntervenantRole, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Société / Organisme</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="Raison sociale"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('constructionIntervenants.telephone')}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+224..."
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="contact@..."
                />
              </div>
            </div>
            <div>
              <Label>{t('constructionIntervenants.corpsDEtatLie')}</Label>
              <Select value={form.lot_id || 'none'} onValueChange={(v) => setForm(f => ({ ...f, lot_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder={t('constructionIntervenants.aucun')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('constructionIntervenants.aucun')}</SelectItem>
                  {lots.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <Button onClick={submit} disabled={saving} className="w-full bg-[#04439e] text-white hover:bg-[#04439e]/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Ajouter l'intervenant
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConstructionIntervenants;
