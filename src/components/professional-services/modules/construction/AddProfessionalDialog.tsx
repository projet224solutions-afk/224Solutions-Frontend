import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const SPECIALTIES = [
  { value: 'macon', label: t('addProfessionalDialog.macon') },
  { value: 'electricien', label: t('addProfessionalDialog.electricien') },
  { value: 'plombier', label: '🔧 Plombier' },
  { value: 'architecte', label: '📐 Architecte' },
  { value: 'ingenieur', label: t('addProfessionalDialog.ingenieur') },
  { value: 'menuisier', label: '🪚 Menuisier' },
  { value: 'peintre', label: '🎨 Peintre' },
  { value: 'carreleur', label: '🔲 Carreleur' },
  { value: 'soudeur', label: '🔥 Soudeur' },
  { value: 'chef_chantier', label: t('addProfessionalDialog.chefDeChantier') },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
  saving: boolean;
}

export function AddProfessionalDialog({ open, onClose, onSubmit, saving }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', specialty: '', experience_years: '',
    city: '', hourly_rate: '', description: '',
  });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.specialty) return;
    const ok = await onSubmit({
      ...form,
      experience_years: parseInt(form.experience_years) || 0,
      hourly_rate: parseFloat(form.hourly_rate) || null,
    });
    if (ok) {
      setForm({ name: '', phone: '', email: '', specialty: '', experience_years: '', city: '', hourly_rate: '', description: '' });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('addProfessionalDialog.ajouterUnProfessionnel')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input placeholder="Mamadou Diallo" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('addProfessionalDialog.specialite')}</Label>
              <Select value={form.specialty} onValueChange={v => update('specialty', v)}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('addProfessionalDialog.telephone')}</Label>
              <Input placeholder="+224 6XX XX XX XX" value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="email@exemple.com" value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t('addProfessionalDialog.experienceAns')}</Label>
              <Input type="number" placeholder="5" value={form.experience_years} onChange={e => update('experience_years', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tarif/heure (GNF)</Label>
              <Input type="number" placeholder="50000" value={form.hourly_rate} onChange={e => update('hourly_rate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input placeholder="Conakry" value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder={t('addProfessionalDialog.competencesSpecialites')} rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>{t('addProfessionalDialog.annuler')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.name || !form.specialty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
