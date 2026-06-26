import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Eye, Loader2, PenTool } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Contract {
  id: string;
  contract_type: string;
  vendor_id: string;
  client_name: string;
  amount: number | null;
  status: string;
  contract_content: string;
  created_at: string;
  pdf_url: string | null;
  client_signature_url: string | null;
}

const CONTRACT_LABELS: Record<string, string> = {
  vente_achat: 'Vente/Achat',
  livraison: 'Livraison',
  prestation: 'Prestation',
  agent_sous_agent: 'Agent/Sous-agent',
  service: 'Service',
  entreprise_partenaire: 'Partenariat',
};

const STATUS_LABELS: Record<string, string> = {
  created: 'Créé',
  sent: 'Envoyé',
  signed: 'Signé',
  archived: 'Archivé',
};

export default function ClientContracts() {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [signing, setSigning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadContracts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContracts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContracts(data || []);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async () => {
    if (!selectedContract) return;

    try {
      setSigning(true);

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas non disponible');
      }

      // Vérifier si la signature n'est pas vide
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context non disponible');
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      let hasPixels = false;

      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] !== 0) {
          hasPixels = true;
          break;
        }
      }

      if (!hasPixels) {
        toast({
          title: 'Signature requise',
          description: t('clientContracts.veuillezSignerAvantDeValider'),
          variant: 'destructive',
        });
        return;
      }

      const signatureData = canvas.toDataURL('image/png');

      const { data, error } = await supabase.functions.invoke('sign-contract', {
        body: {
          contract_id: selectedContract.id,
          signature_data: signatureData,
          role: 'client',
        },
      });

      if (error) throw error;

      toast({
        title: t('clientContracts.contratSigne'),
        description: t('clientContracts.votreSignatureAEteEnregistree'),
      });

      setSelectedContract(null);
      clearSignature();
      loadContracts();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <Card className="max-w-4xl mx-auto mt-8">
        <CardContent className="flex flex-col items-center justify-center p-8">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('clientContracts.aucunContratPourLeMoment')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Mes Contrats</h1>
        <p className="text-muted-foreground">
          Consultez et signez vos contrats
        </p>
      </div>

      <div className="space-y-4">
        {contracts.map(contract => (
          <Card key={contract.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {CONTRACT_LABELS[contract.contract_type] || contract.contract_type}
                </CardTitle>
                <Badge variant={contract.status === 'signed' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[contract.status] || contract.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('clientContracts.montant')}</p>
                  <p className="font-medium">
                    {contract.amount ? formatCurrency(contract.amount) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('clientContracts.dateDeCreation')}</p>
                  <p className="font-medium">
                    {format(new Date(contract.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('clientContracts.reference')}</p>
                  <p className="font-medium font-mono text-sm">
                    {contract.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContract(contract)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Voir le contrat
                </Button>
                {!contract.client_signature_url && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setSelectedContract(contract)}
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    Signer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog pour visualiser et signer */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedContract && CONTRACT_LABELS[selectedContract.contract_type]}
            </DialogTitle>
            <DialogDescription>
              Référence: {selectedContract?.id.substring(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-6">
              <div className="whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono text-sm">
                {selectedContract.contract_content}
              </div>

              {!selectedContract.client_signature_url && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">{t('clientContracts.votreSignature')}</h4>
                    <div className="border-2 border-dashed rounded-lg p-2">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={200}
                        className="border rounded bg-white cursor-crosshair w-full"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSignature}
                      >
                        Effacer
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleSign}
                    disabled={signing}
                    className="w-full"
                  >
                    {signing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Signer le contrat
                  </Button>
                </div>
              )}

              {selectedContract.client_signature_url && (
                <div className="text-center">
                  <Badge variant="default" className="text-lg py-2 px-4">
                    ✓ Contrat déjà signé
                  </Badge>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
