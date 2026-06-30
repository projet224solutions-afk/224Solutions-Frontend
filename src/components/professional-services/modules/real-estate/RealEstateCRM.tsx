/**
 * 🏠 CRM immobilier — pipeline commercial des prospects (property_contacts enrichi).
 * Colonnes par étape, déplacement via menu (mobile-friendly), bannière de relances
 * (my_followups_due) et historique d'interactions (contact_interactions).
 * Données via supabase (RLS check_service_owner). Additif.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Money } from '@/components/Money';
import { toast } from 'sonner';
import { Loader2, Phone, BellRing, Plus, MessageSquarePlus, CalendarClock } from 'lucide-react';

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'nouveau', label: 'Nouveau', color: 'bg-slate-100 text-slate-700' },
  { key: 'contacte', label: 'Contacté', color: 'bg-blue-100 text-blue-700' },
  { key: 'visite_planifiee', label: 'Visite planifiée', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'visite_faite', label: 'Visite faite', color: 'bg-violet-100 text-violet-700' },
  { key: 'offre', label: 'Offre', color: 'bg-amber-100 text-amber-700' },
  { key: 'negociation', label: 'Négociation', color: 'bg-orange-100 text-orange-700' },
  { key: 'conclu', label: 'Conclu', color: 'bg-green-100 text-green-700' },
  { key: 'perdu', label: 'Perdu', color: 'bg-red-100 text-red-700' },
];
const STAGE_LABEL = (k: string) => STAGES.find((s) => s.key === k)?.label || k;

interface Contact {
  id: string; name: string; phone: string | null; email: string | null;
  contact_type: string | null; pipeline_stage: string; budget_min: number | null;
  budget_max: number | null; next_followup_date: string | null; property_id: string | null; notes: string | null;
}
interface Interaction { id: string; type: string; content: string | null; created_at: string; }

export function RealEstateCRM({ serviceId }: { serviceId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [followups, setFollowups] = useState<any[]>([]);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [noteType, setNoteType] = useState('note');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    const { data } = await (supabase as any).from('property_contacts').select('*')
      .eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setContacts((data as Contact[]) || []);
    const { data: fu } = await supabase.rpc('my_followups_due' as any, { p_service_id: serviceId });
    setFollowups((fu as any)?.success ? (fu as any).followups || [] : []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const moveStage = async (c: Contact, stage: string) => {
    const patch: any = { pipeline_stage: stage, last_contact_at: new Date().toISOString() };
    const { error } = await (supabase as any).from('property_contacts').update(patch).eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    setContacts((prev) => prev.map((x) => x.id === c.id ? { ...x, pipeline_stage: stage } : x));
    toast.success(`${c.name} → ${STAGE_LABEL(stage)}`);
  };

  const openDetail = async (c: Contact) => {
    setDetail(c); setInteractions([]); setNoteContent(''); setNoteType('note');
    const { data } = await (supabase as any).from('contact_interactions').select('*')
      .eq('contact_id', c.id).order('created_at', { ascending: false });
    setInteractions((data as Interaction[]) || []);
  };

  const addInteraction = async () => {
    if (!detail || !noteContent.trim()) return;
    setSavingNote(true);
    const { error } = await (supabase as any).from('contact_interactions').insert({
      contact_id: detail.id, professional_service_id: serviceId, type: noteType, content: noteContent.trim(),
    });
    setSavingNote(false);
    if (error) { toast.error(error.message); return; }
    setNoteContent('');
    await openDetail(detail);
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      {followups.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <BellRing className="h-4 w-4 shrink-0" />
          <span><strong>{followups.length}</strong> prospect(s) à relancer aujourd'hui.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s) => {
          const col = contacts.filter((c) => (c.pipeline_stage || 'nouveau') === s.key);
          return (
            <div key={s.key} className="space-y-2">
              <div className={`rounded-md px-2 py-1 text-xs font-semibold ${s.color}`}>{s.label} ({col.length})</div>
              {col.map((c) => {
                const due = c.next_followup_date && new Date(c.next_followup_date) <= new Date();
                return (
                  <Card key={c.id} className="cursor-pointer hover:shadow-md" onClick={() => openDetail(c)}>
                    <CardContent className="space-y-1.5 p-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        {c.contact_type && <Badge variant="outline" className="text-[9px] shrink-0">{c.contact_type}</Badge>}
                      </div>
                      {c.phone && <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-blue-700"><Phone className="h-3 w-3" />{c.phone}</a>}
                      {(c.budget_min || c.budget_max) && (
                        <p className="text-[11px] text-muted-foreground">
                          Budget : {c.budget_min ? <Money amount={c.budget_min} /> : '—'} – {c.budget_max ? <Money amount={c.budget_max} /> : '—'}
                        </p>
                      )}
                      {c.next_followup_date && (
                        <p className={`flex items-center gap-1 text-[11px] ${due ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>
                          <CalendarClock className="h-3 w-3" />{new Date(c.next_followup_date).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      <Select value={c.pipeline_stage || 'nouveau'} onValueChange={(v) => moveStage(c, v)}>
                        <SelectTrigger className="h-7 text-[11px]" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((st) => <SelectItem key={st.key} value={st.key} className="text-xs">{st.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Détail prospect : interactions */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.name}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {detail.phone && <a href={`tel:${detail.phone}`} className="flex items-center gap-1 text-blue-700"><Phone className="h-3 w-3" />{detail.phone}</a>}
                <Badge className={STAGES.find((s) => s.key === detail.pipeline_stage)?.color}>{STAGE_LABEL(detail.pipeline_stage)}</Badge>
              </div>
              <div className="space-y-1.5 rounded-lg border p-2">
                <div className="flex items-center gap-2">
                  <Select value={noteType} onValueChange={setNoteType}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['note', 'appel', 'message', 'visite', 'email'].map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Ajouter une note / un appel…" className="h-8 text-sm" />
                  <Button size="icon" className="h-8 w-8 shrink-0" disabled={savingNote || !noteContent.trim()} onClick={addInteraction}>
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><MessageSquarePlus className="h-3.5 w-3.5" /> Historique</p>
                {interactions.length === 0 ? <p className="text-xs text-muted-foreground">Aucune interaction.</p> :
                  interactions.map((it) => (
                    <div key={it.id} className="rounded-md bg-muted/50 p-2 text-xs">
                      <div className="flex justify-between"><Badge variant="outline" className="text-[9px]">{it.type}</Badge><span className="text-muted-foreground">{new Date(it.created_at).toLocaleString('fr-FR')}</span></div>
                      {it.content && <p className="mt-1">{it.content}</p>}
                    </div>
                  ))}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RealEstateCRM;
