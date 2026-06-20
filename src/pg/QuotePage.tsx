import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🧾 Page DEVIS publique (/devis/:quoteId) — le client consulte et paie le devis.
 * Paiement direct (crédité au prestataire) ou séquestré (libéré après validation).
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { getSharedQuote, payQuote, releaseQuote } from '@/hooks/useServiceQuotes';
import { ArrowLeft, FileText, ShieldCheck, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function QuotePage() {
  const { t } = useTranslation();
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!quoteId) return;
    const data = await getSharedQuote(quoteId);
    setQ(data?.found ? data : null);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [quoteId]);

  const pay = async () => {
    if (!user) { toast.error(t('quotePage.connectezVousPourPayer')); navigate('/auth'); return; }
    if (!quoteId) return;
    setBusy(true);
    const res = await payQuote(quoteId);
    setBusy(false);
    if (res.success) { toast.success((res.data as any)?.escrow ? 'Paiement sécurisé — fonds en séquestre' : 'Paiement effectué ✓'); await load(); }
    else toast.error(res.error || 'Erreur paiement');
  };

  const validate = async () => {
    if (!quoteId) return;
    setBusy(true);
    const res = await releaseQuote(quoteId);
    setBusy(false);
    if (res.success) { toast.success(t('quotePage.prestationValideePrestatairePaye')); await load(); }
    else toast.error(res.error || 'Erreur');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!q) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Devis introuvable.</div>;

  const paid = q.status === 'paid' || q.status === 'completed';
  const items = Array.isArray(q.line_items) ? q.line_items : [];

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('quotePage.retour')}</Button>

      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />{q.business_name}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-[#ff4000]" />{q.title}</h1>
        {q.escrow && <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />{t('quotePage.paiementSecurise')}</Badge>}
        {paid && <Badge className="bg-green-100 text-green-700">{t('quotePage.paye')}</Badge>}
      </div>
      {q.description && <p className="text-sm">{q.description}</p>}

      <Card><CardContent className="p-4 space-y-2">
        {items.map((it: any, i: number) => (
          <div key={i} className="flex justify-between text-sm border-b last:border-0 py-1">
            <span>{it.label} <span className="text-muted-foreground">× {it.qty}</span></span>
            <span><Money amount={(Number(it.qty) || 0) * (Number(it.unit_price) || 0)} from="GNF" /></span>
          </div>
        ))}
        <div className="flex justify-between pt-2 font-bold"><span>Total</span><span className="text-[#ff4000]"><Money amount={q.total_amount} from="GNF" /></span></div>
      </CardContent></Card>

      {q.escrow && q.status === 'paid' && (
        <Card className="border-[#ff4000]/30 bg-[#ff4000]/5"><CardContent className="p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-[#ff4000]" />{t('quotePage.fondsEnSequestre')}</div>
          <p className="text-muted-foreground">{t('quotePage.validezUneFoisLaPrestation')}</p>
          <Button className="w-full" disabled={busy} onClick={validate}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" />{t('quotePage.validerLaPrestation')}</>}</Button>
        </CardContent></Card>
      )}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div><div className="text-xs text-muted-foreground">{t('quotePage.aPayer')}</div><div className="text-lg font-bold text-[#ff4000]"><Money amount={q.total_amount} from="GNF" /></div></div>
          {paid
            ? <Button className="ml-auto" disabled><CheckCircle2 className="h-4 w-4 mr-1" />{q.status === 'completed' ? 'Terminé' : 'Payé'}</Button>
            : <Button className="ml-auto" disabled={busy || q.status === 'cancelled'} onClick={pay}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : q.status === 'cancelled' ? 'Annulé' : 'Payer le devis'}</Button>}
        </div>
      </div>
    </div>
  );
}
