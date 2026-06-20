import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🎓 Vérification PUBLIQUE de certificat (/certificat/:code).
 * Scanné via QR, accessible à tous (anon). Appelle le RPC verify_certificate qui ne
 * renvoie que des champs publics (nom élève, cours, institution, date).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldX, Loader2, Award } from 'lucide-react';

interface CertInfo { valid: boolean; student_name?: string; course_title?: string; level?: string; institution?: string; issued_at?: string; }

export default function CertificateVerify() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const [info, setInfo] = useState<CertInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!code) return;
      const { data } = await supabase.rpc('verify_certificate', { p_code: code });
      setInfo((data as unknown as CertInfo) ?? { valid: false });
      setLoading(false);
    })();
  }, [code]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;

  const valid = info?.valid;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6">
      <Card className={`w-full ${valid ? 'border-green-500/40' : 'border-destructive/40'}`}>
        <CardContent className="space-y-4 p-6 text-center">
          {valid ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><ShieldCheck className="h-9 w-9 text-green-600" /></div>
              <div>
                <Badge className="bg-green-100 text-green-700">Certificat authentique</Badge>
                <div className="mt-3 flex items-center justify-center gap-2 text-[#ff4000]"><Award className="h-5 w-5" /><span className="font-semibold">{info?.institution}</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold">{info?.student_name}</p>
                <p className="text-sm text-muted-foreground">{t('certificateVerify.aCompleteAvecSucces')}</p>
                <p className="font-medium">{info?.course_title}</p>
                {info?.level && <p className="text-xs text-muted-foreground capitalize">Niveau {info.level}</p>}
              </div>
              {info?.issued_at && <p className="text-xs text-muted-foreground">Délivré le {new Date(info.issued_at).toLocaleDateString()}</p>}
              <div className="flex justify-center pt-2"><QRCodeSVG value={`${window.location.origin}/certificat/${code}`} size={96} /></div>
              <p className="font-mono text-xs text-muted-foreground">{code}</p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"><ShieldX className="h-9 w-9 text-destructive" /></div>
              <p className="font-semibold">Certificat introuvable</p>
              <p className="text-sm text-muted-foreground">{t('certificateVerify.ceCodeDeCertificatN')}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
