import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🧾 Espace PROJET réutilisable (Devis + Galerie) — pour Maison, Photo, Freelance,
 * Réparation, Informatique. Le prestataire crée des devis (lignes), partage le lien de
 * paiement, suit l'encaissement (direct ou escrow) et publie ses réalisations.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { FileText, Plus, Trash2, Copy, Image as ImageIcon, Loader2, Wallet, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useServiceQuotes, useServicePortfolio, type QuoteLineItem } from '@/hooks/useServiceQuotes';

interface Props {
  serviceId: string;
  /** Ce métier séquestre-t-il les fonds jusqu'à validation client ? (Freelance/Réparation = oui) */
  escrowDefault?: boolean;
  /** Afficher l'onglet Galerie (Maison/Photo) */
  portfolio?: boolean;
  quoteLabel?: string;
}

export function ServiceProjectWorkspace({ serviceId, escrowDefault = false, portfolio = true, quoteLabel = 'Devis' }: Props) {
  const { t } = useTranslation();
  const { quotes, createQuote, cancelQuote, stats } = useServiceQuotes(serviceId);
  const { items, addItem, removeItem } = useServicePortfolio(serviceId);
  const { uploadFile, isUploading } = useStorageUpload();

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<any>({ escrow: escrowDefault, line_items: [{ label: '', qty: 1, unit_price: 0 }] as QuoteLineItem[] });
  const [pf, setPf] = useState<any>({});

  const total = (form.line_items as QuoteLineItem[]).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);

  const setLine = (i: number, patch: Partial<QuoteLineItem>) =>
    setForm((f: any) => ({ ...f, line_items: f.line_items.map((it: QuoteLineItem, idx: number) => idx === i ? { ...it, ...patch } : it) }));

  const submit = async () => {
    if (!form.title) { toast.error(t('serviceProjectWorkspace.objetDuDevisRequis')); return; }
    const items2 = (form.line_items as QuoteLineItem[]).filter((it) => it.label && it.unit_price > 0);
    if (items2.length === 0) { toast.error(t('serviceProjectWorkspace.ajoutezAuMoinsUneLigne')); return; }
    const q = await createQuote({ title: form.title, description: form.description, client_name: form.client_name, client_phone: form.client_phone, escrow: form.escrow, line_items: items2 });
    if (q) { setShowNew(false); setForm({ escrow: escrowDefault, line_items: [{ label: '', qty: 1, unit_price: 0 }] }); }
  };

  const onPfImage = async (file?: File) => {
    if (!file) return;
    const res = await uploadFile(file, { folder: 'restaurant' as any, subfolder: `portfolio/${serviceId}` });
    if (res.success && res.publicUrl) setPf((p: any) => ({ ...p, image_url: res.publicUrl }));
    else toast.error(res.error || 'Upload échoué');
  };

  return (
    <Tabs defaultValue="quotes" className="space-y-4">
      <TabsList className={`grid w-full ${portfolio ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <TabsTrigger value="quotes"><FileText className="h-4 w-4 mr-1" />{quoteLabel}</TabsTrigger>
        {portfolio && <TabsTrigger value="portfolio"><ImageIcon className="h-4 w-4 mr-1" />Galerie</TabsTrigger>}
      </TabsList>

      {/* DEVIS */}
      <TabsContent value="quotes" className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-[#04439e] text-white"><CardContent className="p-3"><FileText className="h-4 w-4 opacity-80" /><p className="text-xl font-bold mt-1">{stats.sent}</p><p className="text-[11px] opacity-80">En attente</p></CardContent></Card>
          <Card className="bg-[#ff4000] text-white"><CardContent className="p-3"><Wallet className="h-4 w-4 opacity-80" /><p className="text-base font-bold mt-1"><Money amount={stats.revenue} from="GNF" /></p><p className="text-[11px] opacity-80">{t('serviceProjectWorkspace.encaisse')}</p></CardContent></Card>
          <Card className="bg-[#04439e] text-white"><CardContent className="p-3"><ShieldCheck className="h-4 w-4 opacity-80" /><p className="text-base font-bold mt-1"><Money amount={stats.escrowHeld} from="GNF" /></p><p className="text-[11px] opacity-80">{t('serviceProjectWorkspace.enSequestre')}</p></CardContent></Card>
        </div>

        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button className="w-full"><Plus className="h-4 w-4 mr-1" />Nouveau {quoteLabel.toLowerCase()}</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer un {quoteLabel.toLowerCase()}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1"><Label>Objet</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('serviceProjectWorkspace.exRenovationSalon')} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>{t('serviceProjectWorkspace.client')}</Label><Input value={form.client_name || ''} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t('serviceProjectWorkspace.telephone')}</Label><Input value={form.client_phone || ''} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Lignes</Label>
                {(form.line_items as QuoteLineItem[]).map((it, i) => (
                  <div key={i} className="flex gap-1">
                    <Input className="flex-1" placeholder={t('serviceProjectWorkspace.designation')} value={it.label} onChange={(e) => setLine(i, { label: e.target.value })} />
                    <Input className="w-14" type="number" placeholder={t('serviceProjectWorkspace.qte')} value={it.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />
                    <Input className="w-24" type="number" placeholder="PU" value={it.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} />
                    <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setForm((f: any) => ({ ...f, line_items: f.line_items.filter((_: any, idx: number) => idx !== i) }))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setForm((f: any) => ({ ...f, line_items: [...f.line_items, { label: '', qty: 1, unit_price: 0 }] }))}><Plus className="h-4 w-4 mr-1" />Ligne</Button>
              </div>
              <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#ff4000]" /><div><Label className="text-sm">{t('serviceProjectWorkspace.paiementSecuriseSequestre')}</Label><p className="text-[11px] text-muted-foreground">{t('serviceProjectWorkspace.fondsLiberesApresValidationDu')}</p></div></div>
                <Switch checked={!!form.escrow} onCheckedChange={(v) => setForm({ ...form, escrow: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted p-3"><span className="text-sm font-medium">Total</span><span className="text-lg font-bold text-[#ff4000]"><Money amount={total} from="GNF" /></span></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>{t('serviceProjectWorkspace.annuler')}</Button>
              <Button onClick={submit}>{t('serviceProjectWorkspace.creerPartager')}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {quotes.map((q) => (
          <Card key={q.id}><CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm">{q.title}</h4>
                  <Badge className={q.status === 'completed' ? 'bg-green-100 text-green-700' : q.status === 'paid' ? 'bg-blue-100 text-blue-700' : q.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-orange-100 text-[#ff4000]'}>
                    {q.status === 'sent' ? 'Envoyé' : q.status === 'paid' ? (q.escrow_status === 'held' ? 'Payé (séquestre)' : 'Payé') : q.status === 'completed' ? 'Terminé' : q.status === 'cancelled' ? 'Annulé' : 'Brouillon'}
                  </Badge>
                  {q.escrow && <Badge variant="outline" className="gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" />{t('serviceProjectWorkspace.sequestre')}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{q.client_name} · {q.line_items.length} ligne(s)</p>
                <p className="font-bold text-[#ff4000] text-sm mt-1"><Money amount={q.total_amount} from="GNF" /></p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/devis/${q.id}`); toast.success(t('serviceProjectWorkspace.lienDuDevisCopie')); }}><Copy className="h-4 w-4 mr-1" />Lien</Button>
                {q.status === 'sent' && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelQuote(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            </div>
          </CardContent></Card>
        ))}
        {quotes.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">{t('serviceProjectWorkspace.aucunDevisCreezEnUn')}</p>}
      </TabsContent>

      {/* GALERIE */}
      {portfolio && (
        <TabsContent value="portfolio" className="space-y-3">
          <div className="flex items-end gap-2 rounded-lg border p-3">
            <div className="flex-1 space-y-1"><Label className="text-xs">Titre</Label><Input value={pf.title || ''} onChange={(e) => setPf({ ...pf, title: e.target.value })} placeholder={t('serviceProjectWorkspace.realisation')} /></div>
            <div className="space-y-1"><Label className="text-xs">Photo</Label><div className="flex items-center gap-2"><Input type="file" accept="image/*" onChange={(e) => onPfImage(e.target.files?.[0])} disabled={isUploading} />{isUploading && <Loader2 className="h-4 w-4 animate-spin" />}</div></div>
            <Button size="sm" disabled={!pf.image_url || !pf.title} onClick={() => { addItem({ title: pf.title, image_url: pf.image_url, category: pf.category }); setPf({}); }}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((it) => (
              <Card key={it.id} className="group relative overflow-hidden">
                <img src={it.image_url} alt={it.title} className="h-32 w-full object-cover" />
                <div className="p-2"><p className="text-xs font-medium truncate">{it.title}</p></div>
                <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeItem(it.id)}><Trash2 className="h-3 w-3" /></Button>
              </Card>
            ))}
          </div>
          {items.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">{t('serviceProjectWorkspace.ajoutezVosPlusBellesRealisations')}</p>}
        </TabsContent>
      )}
    </Tabs>
  );
}

export default ServiceProjectWorkspace;
