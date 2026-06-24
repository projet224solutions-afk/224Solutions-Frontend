import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'ciment', label: '🏗️ Ciment' },
  { value: 'sable', label: '🏖️ Sable' },
  { value: 'briques', label: '🧱 Briques' },
  { value: 'fer', label: '🔩 Fer / Acier' },
  { value: 'peinture', label: '🎨 Peinture' },
  { value: 'bois', label: '🪵 Bois' },
  { value: 'electricite', label: "⚡ Matériel électrique" },
  { value: 'plomberie', label: '🔧 Plomberie' },
  { value: 'carrelage', label: '🔲 Carrelage' },
  { value: 'toiture', label: '🏠 Toiture' },
  { value: 'general', label: '📦 Autre' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
  saving: boolean;
}

export function AddMaterialDialog({ open, onClose, onSubmit, saving }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', category: '', unit: '', unit_price: '',
    quantity_available: '', supplier_name: '', supplier_phone: '', description: '',
  });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.category) return;
    const ok = await onSubmit({
      ...form,
      unit_price: parseFloat(form.unit_price) || 0,
      quantity_available: parseFloat(form.quantity_available) || 0,
    });
    if (ok) {
      setForm({ name: '', category: '', unit: '', unit_price: '', quantity_available: '', supplier_name: '', supplier_phone: '', description: '' });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('addMaterialDialog.ajouterUnMateriau')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input placeholder="Ciment CEM II" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('addMaterialDialog.categorie')}</Label>
              <Select value={form.category} onValueChange={v => update('category', v)}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t('addMaterialDialog.unite')}</Label>
              <Input placeholder="sac, kg, m³..." value={form.unit} onChange={e => update('unit', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prix unitaire (GNF)</Label>
              <Input type="number" placeholder="0" value={form.unit_price} onChange={e => update('unit_price', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('addMaterialDialog.quantiteDispo')}</Label>
              <Input type="number" placeholder="0" value={form.quantity_available} onChange={e => update('quantity_available', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Input placeholder={t('addMaterialDialog.nomDuFournisseur')} value={form.supplier_name} onChange={e => update('supplier_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('addMaterialDialog.telFournisseur')}</Label>
              <Input placeholder="+224..." value={form.supplier_phone} onChange={e => update('supplier_phone', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>{t('addMaterialDialog.annuler')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.name || !form.category}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
