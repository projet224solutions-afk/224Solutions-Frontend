/**
 * 🏠 Mandats immobiliers (property_mandates) — base juridique agent ↔ mandant.
 * Liste, création, alerte d'expiration (mandates_expiring_soon) et génération PDF.
 * Données via supabase (RLS check_service_owner). Additif.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { generateMandate } from '@/lib/realEstatePdf';
import { Loader2, Plus, FileDown, AlertTriangle, FileSignature } from 'lucide-react';

interface Mandate {
  id: string; property_id: string | null; mandant_name: string; mandant_phone: string | null;
  mandant_email: string | null; mandate_type: string; commission_rate: number | null;
  start_date: string; end_date: string | null; status: string; reference: string | null; notes: string | null;
}
interface PropertyLite { id: string; title: string; offer_type?: string }

const TYPE_LABELS: Record<string, string> = { simple: 'Simple', exclusif: 'Exclusif', semi_exclusif: 'Semi-exclusif' };
const STATUS_COLORS: Record<string, string> = { actif: 'bg-green-600', expire: 'bg-slate-400', resilie: 'bg-red-500', conclu: 'bg-blue-600' };

export function RealEstateMandates({ serviceId, properties, agentName }: { serviceId: string; properties: PropertyLite[]; agentName?: string }) {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ mandant_name: '', mandant_phone: '', property_id: '', mandate_type: 'simple', commission_rate: '', start_date: new Date().toISOString().split('T')[0], end_date: '', reference: '', notes: '' });

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    const { data } = await (supabase as any).from('property_mandates').select('*')
      .eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setMandates((data as Mandate[]) || []);
    const { data: exp } = await supabase.rpc('mandates_expiring_soon' as any, { p_service_id: serviceId, p_days: 15 });
    setExpiring((exp as any)?.success ? (exp as any).mandates || [] : []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!form.mandant_name.trim()) { toast.error('Nom du mandant requis'); return; }
    setSaving(true);
    const payload: any = {
      professional_service_id: serviceId, mandant_name: form.mandant_name.trim(),
      mandant_phone: form.mandant_phone || null, property_id: form.property_id || null,
      mandate_type: form.mandate_type, commission_rate: form.commission_rate ? Number(form.commission_rate) : null,
      start_date: form.start_date, end_date: form.end_date || null,
      reference: form.reference || `MDT-${Date.now().toString(36).toUpperCase()}`, notes: form.notes || null,
    };
    const { error } = await (supabase as any).from('property_mandates').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mandat créé'); setOpen(false);
    setForm({ mandant_name: '', mandant_phone: '', property_id: '', mandate_type: 'simple', commission_rate: '', start_date: new Date().toISOString().split('T')[0], end_date: '', reference: '', notes: '' });
    await load();
  };

  const exportPdf = (m: Mandate) => {
    const prop = properties.find((p) => p.id === m.property_id);
    generateMandate({
      mandantName: m.mandant_name, propertyTitle: prop?.title || 'Bien', mandateType: TYPE_LABELS[m.mandate_type] || m.mandate_type,
      offerType: prop?.offer_type, commissionRate: m.commission_rate ?? undefined,
      startDate: m.start_date, endDate: m.end_date || undefined, reference: m.reference || m.id.slice(0, 8), agentName,
    });
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><FileSignature className="h-4 w-4 text-[#04439e]" /> Mandats ({mandates.length})</div>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouveau mandat</Button>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{expiring.length}</strong> mandat(s) expirent dans moins de 15 jours.</span>
        </div>
      )}

      {mandates.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground"><FileSignature className="mx-auto mb-2 h-10 w-10 opacity-40" /> Aucun mandat. Créez-en un.</CardContent></Card>
      ) : mandates.map((m) => {
        const prop = properties.find((p) => p.id === m.property_id);
        return (
          <Card key={m.id}><CardContent className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-medium">{m.mandant_name}</span>
                <Badge className={`${STATUS_COLORS[m.status] || 'bg-slate-400'} text-[10px]`}>{m.status}</Badge>
                <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[m.mandate_type] || m.mandate_type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{prop?.title || 'Bien non lié'}{m.commission_rate != null ? ` · ${m.commission_rate}%` : ''}{m.end_date ? ` · fin ${new Date(m.end_date).toLocaleDateString('fr-FR')}` : ''}</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportPdf(m)}><FileDown className="h-4 w-4" /> Mandat PDF</Button>
          </CardContent></Card>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau mandat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom du mandant *</Label><Input value={form.mandant_name} onChange={(e) => setForm((f: any) => ({ ...f, mandant_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Téléphone</Label><Input value={form.mandant_phone} onChange={(e) => setForm((f: any) => ({ ...f, mandant_phone: e.target.value }))} /></div>
              <div><Label>Commission %</Label><Input type="number" value={form.commission_rate} onChange={(e) => setForm((f: any) => ({ ...f, commission_rate: e.target.value }))} /></div>
            </div>
            <div><Label>Bien lié</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm((f: any) => ({ ...f, property_id: v }))}>
                <SelectTrigger><SelectValue placeholder="— Aucun —" /></SelectTrigger>
                <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Type de mandat</Label>
              <Select value={form.mandate_type} onValueChange={(v) => setForm((f: any) => ({ ...f, mandate_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Début</Label><Input type="date" value={form.start_date} onChange={(e) => setForm((f: any) => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>Fin</Label><Input type="date" value={form.end_date} onChange={(e) => setForm((f: any) => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div><Label>Référence</Label><Input value={form.reference} onChange={(e) => setForm((f: any) => ({ ...f, reference: e.target.value }))} placeholder="Auto si vide" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.mandant_name.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RealEstateMandates;
