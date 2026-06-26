import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏗️ Corps d'État / Lots — Gestion par métier (BTP professionnel)
 * Liste les lots (gros œuvre, électricité, plomberie...) avec budget et avancement.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Money } from '@/components/Money';
import {
  Plus, Pencil, Trash2, Building2, Loader2,
  TrendingUp, AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useConstructionLots,
  TRADE_LABELS,
  type ConstructionLot,
  type TradeType,
} from '@/hooks/useConstructionExtended';
import type { ConstructionProject } from '@/hooks/useConstruction';

const LOT_STATUS_COLORS = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-[#04439e]/10 text-[#04439e]',
  completed: 'bg-[#16a34a]/10 text-[#16a34a]',
  cancelled: 'bg-red-100 text-red-600',
};
const LOT_STATUS_LABELS = {
  not_started: 'Non démarré',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const EMPTY_FORM = {
  name: '',
  trade_type: 'autre' as TradeType,
  company_name: '',
  company_phone: '',
  budget_amount: 0,
  spent_amount: 0,
  status: 'not_started' as ConstructionLot['status'],
  progress_percent: 0,
};

interface Props {
  project: ConstructionProject;
}

export function ConstructionLots({ project }: Props) {
  const { t } = useTranslation();
  const { lots, loading, addLot, updateLot, deleteLot, lotStats } = useConstructionLots(project.id);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConstructionLot | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (lot: ConstructionLot) => {
    setEditing(lot);
    setForm({
      name: lot.name,
      trade_type: lot.trade_type,
      company_name: lot.company_name || '',
      company_phone: lot.company_phone || '',
      budget_amount: lot.budget_amount,
      spent_amount: lot.spent_amount,
      status: lot.status,
      progress_percent: lot.progress_percent,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('constructionLots.leNomDuLotEst')); return; }
    setSaving(true);
    const payload = { ...form, budget_amount: Number(form.budget_amount), spent_amount: Number(form.spent_amount) };
    if (editing) {
      await updateLot(editing.id, payload);
    } else {
      await addLot(payload);
    }
    setSaving(false);
    setOpen(false);
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#04439e]" /></div>;

  return (
    <div className="space-y-4">
      {/* Résumé global */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Budget total lots', value: <Money amount={lotStats.totalBudget} />, icon: Building2, color: 'text-[#04439e]' },
          { label: t('constructionLots.depense'), value: <Money amount={lotStats.totalSpent} />, icon: TrendingUp, color: 'text-[#ff4000]' },
          { label: 'En cours', value: lotStats.inProgressLots, icon: AlertCircle, color: 'text-amber-600' },
          { label: t('constructionLots.termines'), value: lotStats.completedLots, icon: CheckCircle2, color: 'text-[#16a34a]' },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-lg font-semibold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* En-tête + bouton */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{lots.length} corps d'état</h3>
        <Button size="sm" onClick={openNew} className="bg-[#04439e] text-white hover:bg-[#04439e]/90">
          <Plus className="h-4 w-4 mr-1" />Ajouter un lot
        </Button>
      </div>

      {/* Liste des lots */}
      {lots.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun corps d'état défini. Ajoutez les lots de votre chantier (gros œuvre, électricité, plomberie...).
        </p>
      )}
      {lots.map((lot) => {
        const budgetPct = lot.budget_amount > 0
          ? Math.min(100, (lot.spent_amount / lot.budget_amount) * 100)
          : 0;
        const overBudget = lot.spent_amount > lot.budget_amount;
        return (
          <Card key={lot.id} className="border border-slate-100">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{lot.name}</span>
                    <Badge className={`text-[10px] border-0 ${LOT_STATUS_COLORS[lot.status]}`}>
                      {LOT_STATUS_LABELS[lot.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {TRADE_LABELS[lot.trade_type]}
                    {lot.company_name && ` · ${lot.company_name}`}
                    {lot.company_phone && ` · ${lot.company_phone}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(lot)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    onClick={() => deleteLot(lot.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Budget */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Budget</span>
                  <span className={overBudget ? 'text-red-600 font-medium' : ''}>
                    <Money amount={lot.spent_amount} /> / <Money amount={lot.budget_amount} />
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${overBudget ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-[#04439e]'}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>

              {/* Avancement */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Avancement</span>
                  <span>{lot.progress_percent}%</span>
                </div>
                <Progress
                  value={lot.progress_percent}
                  className="h-1.5"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog ajout/édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le lot' : 'Ajouter un corps d\'état'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('constructionLots.nomDuLot')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('constructionLots.exLot3Electricite')}
              />
            </div>
            <div>
              <Label>Corps d'état / Métier *</Label>
              <Select value={form.trade_type} onValueChange={(v) => setForm(f => ({ ...f, trade_type: v as TradeType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TRADE_LABELS) as [TradeType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Entreprise</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                  placeholder={t('constructionLots.nomDeLEntreprise')}
                />
              </div>
              <div>
                <Label>{t('constructionLots.telephone')}</Label>
                <Input
                  value={form.company_phone}
                  onChange={(e) => setForm(f => ({ ...f, company_phone: e.target.value }))}
                  placeholder="+224..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Budget (GNF)</Label>
                <Input
                  type="number"
                  value={form.budget_amount}
                  onChange={(e) => setForm(f => ({ ...f, budget_amount: +e.target.value || 0 }))}
                />
              </div>
              {editing && (
                <div>
                  <Label>{t('constructionLots.depenseGnf')}</Label>
                  <Input
                    type="number"
                    value={form.spent_amount}
                    onChange={(e) => setForm(f => ({ ...f, spent_amount: +e.target.value || 0 }))}
                  />
                </div>
              )}
            </div>
            {editing && (
              <div>
                <Label>Avancement (%)</Label>
                <Input
                  type="number"
                  min={0} max={100}
                  value={form.progress_percent}
                  onChange={(e) => setForm(f => ({
                    ...f,
                    progress_percent: Math.min(100, Math.max(0, +e.target.value || 0))
                  }))}
                />
              </div>
            )}
            {editing && (
              <div>
                <Label>Statut</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm(f => ({ ...f, status: v as ConstructionLot['status'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOT_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={save} disabled={saving} className="w-full bg-[#04439e] text-white hover:bg-[#04439e]/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {editing ? 'Mettre à jour' : 'Ajouter le lot'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConstructionLots;
