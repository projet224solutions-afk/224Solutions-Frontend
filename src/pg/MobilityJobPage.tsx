import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🚗 Page COURSE / LIVRAISON publique (/course/:jobId) — le client paie en wallet.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { getSharedMobilityJob, settleMobilityJob } from '@/hooks/useMobilityJobs';
import { ArrowLeft, MapPin, Loader2, CheckCircle2, Building2, Car, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function MobilityJobPage() {
  const { t } = useTranslation();
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [j, setJ] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!jobId) return;
    const data = await getSharedMobilityJob(jobId);
    setJ(data?.found ? data : null);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [jobId]);

  const pay = async () => {
    if (!user) { toast.error(t('mobilityJobPage.connectezVousPourPayer')); navigate('/auth'); return; }
    if (!jobId) return;
    setBusy(true);
    const res = await settleMobilityJob(jobId);
    setBusy(false);
    if (res.success) { toast.success(t('mobilityJobPage.paiementEffectue')); await load(); }
    else toast.error(res.error || 'Erreur paiement');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!j) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Introuvable.</div>;

  const isCourse = j.job_type === 'course';
  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('mobilityJobPage.retour')}</Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />{j.business_name}</div>
      <h1 className="text-xl font-bold flex items-center gap-2">{isCourse ? <Car className="h-5 w-5 text-[#ff4000]" /> : <Package className="h-5 w-5 text-[#ff4000]" />}{isCourse ? 'Course VTC' : 'Livraison'}{j.paid && <Badge className="bg-green-100 text-green-700">{t('mobilityJobPage.paye')}</Badge>}</h1>

      <Card><CardContent className="p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-green-600" /><span>{j.pickup}</span></div>
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#ff4000]" /><span>{j.destination}</span></div>
        {j.package_label && <p className="text-muted-foreground">Colis : {j.package_label}</p>}
      </CardContent></Card>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div><div className="text-xs text-muted-foreground">{t('mobilityJobPage.aPayer')}</div><div className="text-lg font-bold text-[#ff4000]"><Money amount={j.price} from="GNF" /></div></div>
          {j.paid
            ? <Button className="ml-auto" disabled><CheckCircle2 className="h-4 w-4 mr-1" />{t('mobilityJobPage.paye')}</Button>
            : <Button className="ml-auto" disabled={busy || j.status === 'cancelled'} onClick={pay}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Payer en wallet'}</Button>}
        </div>
      </div>
    </div>
  );
}
