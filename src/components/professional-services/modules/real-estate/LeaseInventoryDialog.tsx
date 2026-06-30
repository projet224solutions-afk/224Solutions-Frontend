/**
 * 🏠 État des lieux (lease_inventories) — entrée/sortie pièce par pièce.
 * Documente l'état du bien pour justifier la décision de caution (release_deposit).
 * Données via supabase (RLS : propriétaire + locataire en lecture). PDF côté client.
 * NB : la capture photo par pièce est prévue par le schéma (rooms[].photos) ;
 *      cette première version saisit nom/état/notes (photos = évolution).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { generateInventoryPdf } from '@/lib/realEstatePdf';
import { Loader2, Plus, Trash2, FileDown, ClipboardList } from 'lucide-react';

interface Room { room: string; condition: string; notes: string; photos: string[] }
interface Inventory { id: string; kind: 'entree' | 'sortie'; rooms: Room[]; general_notes: string | null; done_at: string }

const CONDITIONS = [{ v: 'bon', l: 'Bon' }, { v: 'moyen', l: 'Moyen' }, { v: 'degrade', l: 'Dégradé' }];

export function LeaseInventoryDialog({ open, onClose, lease, serviceId, propertyTitle }: {
  open: boolean; onClose: () => void;
  lease: { id: string; tenant_name: string | null };
  serviceId: string; propertyTitle?: string;
}) {
  const [existing, setExisting] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'entree' | 'sortie'>('entree');
  const [rooms, setRooms] = useState<Room[]>([{ room: '', condition: 'bon', notes: '', photos: [] }]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!lease?.id) return;
    setLoading(true);
    const { data } = await (supabase as any).from('lease_inventories').select('*')
      .eq('lease_id', lease.id).order('done_at', { ascending: true });
    setExisting((data as Inventory[]) || []);
    setLoading(false);
  }, [lease?.id]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const setRoom = (i: number, patch: Partial<Room>) => setRooms((r) => r.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const addRoom = () => setRooms((r) => [...r, { room: '', condition: 'bon', notes: '', photos: [] }]);
  const removeRoom = (i: number) => setRooms((r) => r.length <= 1 ? r : r.filter((_, idx) => idx !== i));

  const save = async () => {
    const cleaned = rooms.filter((r) => r.room.trim());
    if (cleaned.length === 0) { toast.error('Ajoutez au moins une pièce'); return; }
    setSaving(true);
    const { error } = await (supabase as any).from('lease_inventories').insert({
      lease_id: lease.id, professional_service_id: serviceId, kind, rooms: cleaned, general_notes: generalNotes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`État des lieux de ${kind === 'entree' ? "d'entrée" : 'sortie'} enregistré`);
    setRooms([{ room: '', condition: 'bon', notes: '', photos: [] }]); setGeneralNotes('');
    await load();
  };

  const exportPdf = (inv: Inventory) => generateInventoryPdf({
    kind: inv.kind, propertyTitle: propertyTitle || 'Bien loué', tenantName: lease.tenant_name || undefined,
    doneAt: inv.done_at, rooms: inv.rooms || [], generalNotes: inv.general_notes || undefined,
  });

  const entree = existing.find((e) => e.kind === 'entree');
  const sortie = existing.find((e) => e.kind === 'sortie');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#04439e]" /> État des lieux — {lease.tenant_name || 'Locataire'}</DialogTitle></DialogHeader>

        {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
          <div className="space-y-4">
            {/* Existants : comparaison entrée / sortie */}
            {(entree || sortie) && (
              <div className="grid grid-cols-2 gap-2">
                {[entree, sortie].map((inv, i) => (
                  <div key={i} className="rounded-lg border p-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">{i === 0 ? 'Entrée' : 'Sortie'}</Badge>
                      {inv && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => exportPdf(inv)}><FileDown className="h-3.5 w-3.5" /></Button>}
                    </div>
                    {inv ? (
                      <div className="mt-1 space-y-0.5">
                        {(inv.rooms || []).map((r, idx) => (
                          <p key={idx} className="text-[11px]"><b>{r.room}</b> : {CONDITIONS.find((c) => c.v === r.condition)?.l || r.condition}</p>
                        ))}
                        <p className="text-[10px] text-muted-foreground">{new Date(inv.done_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                    ) : <p className="mt-1 text-[11px] text-muted-foreground">Non réalisé</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Nouveau */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Nouvel état :</span>
                <Select value={kind} onValueChange={(v) => setKind(v as 'entree' | 'sortie')}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="entree">Entrée</SelectItem><SelectItem value="sortie">Sortie</SelectItem></SelectContent>
                </Select>
              </div>
              {rooms.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Input value={r.room} onChange={(e) => setRoom(i, { room: e.target.value })} placeholder="Pièce (ex: Salon)" className="h-8 text-sm" />
                  <Select value={r.condition} onValueChange={(v) => setRoom(i, { condition: v })}>
                    <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c.v} value={c.v} className="text-xs">{c.l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={r.notes} onChange={(e) => setRoom(i, { notes: e.target.value })} placeholder="Notes" className="h-8 text-sm" />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeRoom(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="gap-1" onClick={addRoom}><Plus className="h-3.5 w-3.5" /> Pièce</Button>
              <Textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Observations générales" rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LeaseInventoryDialog;
