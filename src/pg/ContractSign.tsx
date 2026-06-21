import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { backendFetch } from '@/services/backendApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, PenLine, Eraser } from 'lucide-react';

interface PublicContract {
  id: string;
  contract_type: string;
  client_name: string;
  contract_content: string;
  status: string;
  client_signature_url: string | null;
  signed_at: string | null;
}

type ApiResp<T> = { success: boolean; data?: T; error?: string; already_signed?: boolean };

export default function ContractSign() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    (async () => {
      if (!token) { setError('Lien invalide'); setLoading(false); return; }
      try {
        const res = await backendFetch<ApiResp<PublicContract>>(`/api/contracts/public/${token}`, {
          allowAnonymous: true,
        });
        if (!res.success || !res.data) { setError(res.error || 'Contrat introuvable'); }
        else { setContract(res.data); setSigned(res.data.status === 'signed'); }
      } catch {
        setError('Impossible de charger le contrat');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ─── Canvas (souris + tactile) ───
  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const p = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasInk = data ? data.some((_, i) => i % 4 === 3 && data[i] !== 0) : false;
    if (!hasInk) { toast.error(t('contractSign.veuillezSignerAvantDeValider')); return; }

    setSigning(true);
    try {
      const res = await backendFetch<ApiResp<unknown>>(`/api/contracts/public/${token}/sign`, {
        method: 'POST',
        allowAnonymous: true,
        body: { signature_data: canvas.toDataURL('image/png') },
      });
      if (res.success) {
        setSigned(true);
        toast.success(t('contractSign.contratSigneAvecSuccesMerci'));
      } else {
        toast.error(res.error || 'Échec de la signature');
      }
    } catch {
      toast.error(t('contractSign.erreurReseau'));
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full"><CardContent className="p-6 text-center text-muted-foreground">{error || 'Contrat introuvable'}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PenLine className="w-5 h-5" /> {t('contractSign.contratASigner')}</CardTitle>
            <p className="text-sm text-muted-foreground">Destinataire : {contract.client_name}</p>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm border rounded-lg p-4 bg-background max-h-[50vh] overflow-y-auto">
              {contract.contract_content}
            </div>
          </CardContent>
        </Card>

        {signed ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
              <p className="font-medium">{t('contractSign.ceContratAEteSigne')}</p>
              {contract.signed_at && (
                <p className="text-xs text-muted-foreground">Le {new Date(contract.signed_at).toLocaleString('fr-FR')}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">{t('contractSign.votreSignature')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <canvas
                ref={canvasRef}
                width={500}
                height={180}
                className="border rounded-lg w-full touch-none bg-white"
                onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
                onTouchStart={start} onTouchMove={move} onTouchEnd={end}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={clear} disabled={signing} className="flex-1">
                  <Eraser className="w-4 h-4 mr-2" /> Effacer
                </Button>
                <Button onClick={submit} disabled={signing} className="flex-1">
                  {signing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}
                  Signer le contrat
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
