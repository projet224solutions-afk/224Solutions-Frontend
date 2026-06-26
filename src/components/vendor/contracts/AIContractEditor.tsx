import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AIAssistant from './AIAssistant';
import {
  Loader2,
  Save,
  Download,
  Send,
  Edit,
  Eye,
  FileText,
  Sparkles,
  CheckCircle2,
  Mail,
  MessageSquare,
  Share2,
  PenTool
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AIContractEditorProps {
  contract: {
    id: string;
    contract_type: string;
    client_name: string;
    client_phone: string | null;
    client_info: string | null;
    contract_content: string;
    custom_fields: any;
    created_at: string;
    status: string;
  };
  onSaved: () => void;
  onClose: () => void;
}

export default function AIContractEditor({ contract, onSaved, onClose }: AIContractEditorProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [clientName, setClientName] = useState(contract.client_name);
  const [clientPhone, setClientPhone] = useState(contract.client_phone || '');
  const [clientAddress, setClientAddress] = useState(contract.client_info || '');
  const [contractContent, setContractContent] = useState(contract.contract_content);
  const [loading, setLoading] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('contracts')
        .update({
          client_name: clientName,
          client_phone: clientPhone,
          client_info: clientAddress,
          contract_content: contractContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contract.id);

      if (error) throw error;

      toast({
        title: t('aIContractEditor.contratEnregistre'),
        description: t('aIContractEditor.lesModificationsOntEteEnregistrees'),
      });

      setIsEditing(false);
      onSaved();
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

  const handleFinalize = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('contracts')
        .update({
          status: 'finalized',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contract.id);

      if (error) throw error;

      toast({
        title: t('aIContractEditor.contratFinalise'),
        description: t('aIContractEditor.leContratEstMaintenantFinal'),
      });

      onSaved();
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

  const handleGeneratePdf = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('generate-contract-pdf', {
        body: { contract_id: contract.id },
      });

      if (error) throw error;

      toast({
        title: t('aIContractEditor.pdfGenere'),
        description: t('aIContractEditor.lePdfDuContratA'),
      });

      if (data.html) {
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      }
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

  const handleSign = async (signatureType: 'vendor' | 'client') => {
    try {
      setLoading(true);

      toast({
        title: t('aIContractEditor.signatureEnregistree'),
        description: `La signature ${signatureType === 'vendor' ? 'du vendeur' : 'du client'} a été ajoutée`,
      });

      setShowSignDialog(false);
      onSaved();
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

  const handleSend = async (method: 'whatsapp' | 'sms' | 'email' | 'link') => {
    try {
      setLoading(true);

      // Persiste l'envoi (statut 'sent') et récupère le jeton de partage public.
      const { data: row, error } = await supabase
        .from('contracts')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', contract.id)
        .neq('status', 'signed')
        .select('share_token')
        .maybeSingle();
      if (error) throw error;

      // Déjà signé (aucune ligne mise à jour) → on relit le jeton pour pouvoir repartager.
      let token = (row as any)?.share_token as string | undefined;
      if (!token) {
        const { data: t } = await supabase
          .from('contracts').select('share_token').eq('id', contract.id).maybeSingle();
        token = (t as any)?.share_token;
      }
      if (!token) throw new Error('Lien de signature indisponible');

      const signUrl = `${window.location.origin}/contrat/${token}`;
      const phoneDigits = (clientPhone || '').replace(/\D/g, '');
      const msg = `Bonjour ${clientName}, votre contrat est prêt à être signé : ${signUrl}`;

      if (method === 'whatsapp') {
        window.open(
          phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`
                      : `https://wa.me/?text=${encodeURIComponent(msg)}`,
          '_blank',
        );
      } else if (method === 'sms') {
        window.open(`sms:${clientPhone || ''}?&body=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      } else if (method === 'email') {
        window.open(`mailto:?subject=${encodeURIComponent('Votre contrat à signer')}&body=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      } else {
        try { await navigator.clipboard.writeText(signUrl); } catch { /* presse-papier indisponible */ }
      }

      toast({
        title: t('aIContractEditor.contratEnvoye'),
        description: method === 'link'
          ? 'Lien de signature copié dans le presse-papier'
          : 'Lien de signature généré — message prêt à envoyer au client.',
      });

      setShowSendDialog(false);
      onSaved();
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

  const summary = contract.custom_fields?.summary || '';
  const contractNumber = contract.custom_fields?.contract_number || 'N/A';
  const contractTypeLabel = contract.custom_fields?.contract_type_label || 'vente';
  const isFinalized = contract.status === 'finalized';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle>{t('aIContractEditor.contratDeVenteGenerePar')}</CardTitle>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span className="font-mono">{contractNumber}</span>
                </div>
                <div>
                  Créé le {format(new Date(contract.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </div>
              </div>
            </div>
            <Badge variant={isFinalized ? 'default' : 'secondary'} className="gap-1">
              {isFinalized ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  Finalisé
                </>
              ) : (
                'Brouillon'
              )}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('aIContractEditor.resumeDuContrat')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Client Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('aIContractEditor.informationsDuClient')}</CardTitle>
            {!isFinalized && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Aperçu
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label>{t('aIContractEditor.nomDuClient')}</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nom complet"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('aIContractEditor.telephone')}</Label>
                <Input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+224 XXX XX XX XX"
                />
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder={t('aIContractEditor.adresseComplete')}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nom</p>
                <p className="font-medium">{clientName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('aIContractEditor.telephone')}</p>
                <p className="font-medium">{clientPhone || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Adresse</p>
                <p className="font-medium">{clientAddress || 'Non renseignée'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Assistant */}
      {isEditing && (
        <AIAssistant
          currentText={contractContent}
          contractType={contractTypeLabel}
          onTextUpdated={setContractContent}
        />
      )}

      {/* Contract Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('aIContractEditor.contenuDuContrat')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={contractContent}
              onChange={(e) => setContractContent(e.target.value)}
              className="min-h-[500px] font-mono text-sm"
              placeholder={t('aIContractEditor.contenuDuContrat2')}
            />
          ) : (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/30 p-6 rounded-lg">
                {contractContent}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            {isEditing ? (
              <>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer les modifications
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
              </>
            ) : (
              <>
                {!isFinalized && (
                  <>
                    <Button onClick={() => setIsEditing(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier le contrat
                    </Button>
                    <Button onClick={handleFinalize} disabled={loading} variant="default">
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Finaliser le contrat
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={handleGeneratePdf}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Télécharger PDF
                </Button>

                {isFinalized && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowSignDialog(true)}
                      disabled={loading}
                    >
                      <PenTool className="w-4 h-4 mr-2" />
                      Signatures
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowSendDialog(true)}
                      disabled={loading}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer
                    </Button>
                  </>
                )}
                <Button variant="ghost" onClick={onClose}>
                  Retour à la liste
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Signature Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aIContractEditor.signaturesElectroniques')}</DialogTitle>
            <DialogDescription>
              Gérer les signatures du contrat
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Button
              onClick={() => handleSign('vendor')}
              className="w-full"
              disabled={loading}
            >
              <PenTool className="w-4 h-4 mr-2" />
              Signer en tant que vendeur
            </Button>
            <Button
              onClick={() => handleSign('client')}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <PenTool className="w-4 h-4 mr-2" />
              Demander la signature du client
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aIContractEditor.envoyerLeContrat')}</DialogTitle>
            <DialogDescription>
              Choisissez le mode d'envoi
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button
              onClick={() => handleSend('whatsapp')}
              variant="outline"
              className="h-20 flex-col"
              disabled={loading}
            >
              <MessageSquare className="w-6 h-6 mb-2" />
              WhatsApp
            </Button>
            <Button
              onClick={() => handleSend('sms')}
              variant="outline"
              className="h-20 flex-col"
              disabled={loading}
            >
              <Send className="w-6 h-6 mb-2" />
              SMS
            </Button>
            <Button
              onClick={() => handleSend('email')}
              variant="outline"
              className="h-20 flex-col"
              disabled={loading}
            >
              <Mail className="w-6 h-6 mb-2" />
              E-mail
            </Button>
            <Button
              onClick={() => handleSend('link')}
              variant="outline"
              className="h-20 flex-col"
              disabled={loading}
            >
              <Share2 className="w-6 h-6 mb-2" />
              Lien sécurisé
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
