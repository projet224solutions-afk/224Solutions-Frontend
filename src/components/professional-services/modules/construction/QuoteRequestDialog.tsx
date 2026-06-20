import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
  saving: boolean;
}

export function QuoteRequestDialog({ open, onClose, onSubmit, saving }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    client_name: '', client_phone: '', client_email: '',
    project_type: '', description: '', location: '', budget_range: '',
  });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.client_name || !form.description || !form.project_type) return;
    const ok = await onSubmit(form);
    if (ok) {
      setForm({ client_name: '', client_phone: '', client_email: '', project_type: '', description: '', location: '', budget_range: '' });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('quoteRequestDialog.nouvelleDemandeDeDevis')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>{t('quoteRequestDialog.nomDuClient')}</Label>
            <Input placeholder="Nom complet" value={form.client_name} onChange={e => update('client_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('quoteRequestDialog.telephone')}</Label>
              <Input placeholder="+224..." value={form.client_phone} onChange={e => update('client_phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.client_email} onChange={e => update('client_email', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('quoteRequestDialog.typeDeProjet')}</Label>
              <Select value={form.project_type} onValueChange={v => update('project_type', v)}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maison">🏠 Maison</SelectItem>
                  <SelectItem value="immeuble">🏢 Immeuble</SelectItem>
                  <SelectItem value="renovation">{t('quoteRequestDialog.renovation')}</SelectItem>
                  <SelectItem value="route">🛣️ Route</SelectItem>
                  <SelectItem value="autre">📐 Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('quoteRequestDialog.budgetEstime')}</Label>
              <Select value={form.budget_range} onValueChange={v => update('budget_range', v)}>
                <SelectTrigger><SelectValue placeholder="Fourchette" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="< 50M">{t('quoteRequestDialog.moinsDe50mGnf')}</SelectItem>
                  <SelectItem value="50M - 200M">50M - 200M GNF</SelectItem>
                  <SelectItem value="200M - 500M">200M - 500M GNF</SelectItem>
                  <SelectItem value="> 500M">{t('quoteRequestDialog.plusDe500mGnf')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Localisation</Label>
            <Input placeholder="Ville, quartier..." value={form.location} onChange={e => update('location', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('quoteRequestDialog.descriptionDuProjet')}</Label>
            <Textarea placeholder={t('quoteRequestDialog.decrivezVosBesoinsEnDetail')} rows={4} value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>{t('quoteRequestDialog.annuler')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.client_name || !form.description || !form.project_type}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Envoyer la demande
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
