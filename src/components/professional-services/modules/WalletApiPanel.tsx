import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Key, Send, Eye, EyeOff, Copy, CheckCircle, Clock, XCircle,
  Shield, Zap, Activity, AlertTriangle, Code, ExternalLink, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { WalletApiService, WalletApiKey, WalletApiRequest, WalletApiTransaction } from '@/services/walletApiService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WalletApiPanelProps {
  serviceId: string;
  businessName: string;
}

export default function WalletApiPanel({ serviceId, businessName }: WalletApiPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [request, setRequest] = useState<WalletApiRequest | null>(null);
  const [keys, setKeys] = useState<WalletApiKey[]>([]);
  const [transactions, setTransactions] = useState<WalletApiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const [requestForm, setRequestForm] = useState({
    websiteUrl: '',
    useCase: '',
    expectedVolume: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [req, apiKeys, txs] = await Promise.all([
        WalletApiService.getMyRequest(serviceId),
        WalletApiService.getMyKeys(serviceId),
        WalletApiService.getMyTransactions(serviceId),
      ]);
      setRequest(req);
      setKeys(apiKeys);
      setTransactions(txs);
    } catch (error) {
      console.error('Erreur chargement API panel:', error);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitRequest = async () => {
    if (!user || !requestForm.useCase.trim()) {
      toast.error(t('walletApiPanel.decrivezVotreCasDUtilisation'));
      return;
    }
    try {
      setSubmitting(true);
      const id = await WalletApiService.submitRequest({
        userId: user.id,
        serviceId,
        businessName,
        websiteUrl: requestForm.websiteUrl || undefined,
        useCase: requestForm.useCase,
        expectedVolume: requestForm.expectedVolume || undefined,
      });
      if (id) {
        toast.success(t('walletApiPanel.demandeSoumiseAvecSuccesElle'));
        setShowRequestDialog(false);
        loadData();
      } else {
        toast.error(t('walletApiPanel.erreurLorsDeLaSoumission'));
      }
    } catch (_error) {
      toast.error(t('walletApiPanel.erreurLorsDeLaSoumission'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleKey = async (keyId: string, isActive: boolean) => {
    const success = await WalletApiService.toggleKey(keyId, isActive);
    if (success) {
      toast.success(isActive ? 'Clé activée' : 'Clé désactivée');
      loadData();
    }
  };

  const handleToggleTestMode = async (keyId: string, isTestMode: boolean) => {
    if (!isTestMode) {
      if (!confirm(t('walletApiPanel.passerEnModeProductionLes'))) return;
    }
    const success = await WalletApiService.toggleTestMode(keyId, isTestMode);
    if (success) {
      toast.success(isTestMode ? 'Mode test activé' : 'Mode production activé');
      loadData();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Pas encore de demande soumise
  if (!request) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2 border-primary/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Key className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('walletApiPanel.apiDePaiement224wallet')}</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Intégrez les paiements 224Wallet directement dans votre site web ou application.
              Acceptez les paiements de vos clients en toute sécurité.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 w-full max-w-lg">
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{t('walletApiPanel.securise')}</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Zap className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{t('walletApiPanel.instantane')}</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Code className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{t('walletApiPanel.simpleAIntegrer')}</span>
              </div>
            </div>
            <Button onClick={() => setShowRequestDialog(true)} size="lg">
              <Send className="w-4 h-4 mr-2" />
              Demander l'accès API
            </Button>
          </CardContent>
        </Card>

        {/* Request Dialog */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('walletApiPanel.demandeDAccesApi224wallet')}</DialogTitle>
              <DialogDescription>
                Décrivez votre projet pour obtenir vos clés d'API. Votre demande sera examinée sous 24-48h.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Site web / Application (optionnel)</Label>
                <Input
                  value={requestForm.websiteUrl}
                  onChange={e => setRequestForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://monsite.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cas d'utilisation *</Label>
                <Textarea
                  value={requestForm.useCase}
                  onChange={e => setRequestForm(f => ({ ...f, useCase: e.target.value }))}
                  placeholder={t('walletApiPanel.decrivezCommentVousComptezUtiliser')}
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('walletApiPanel.volumeDeTransactionsEstimeOptionnel')}</Label>
                <Input
                  value={requestForm.expectedVolume}
                  onChange={e => setRequestForm(f => ({ ...f, expectedVolume: e.target.value }))}
                  placeholder="Ex: 50-100 transactions/mois"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRequestDialog(false)}>{t('walletApiPanel.annuler')}</Button>
              <Button onClick={handleSubmitRequest} disabled={submitting || !requestForm.useCase.trim()}>
                {submitting ? 'Envoi...' : 'Soumettre la demande'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Demande en attente
  if (request.status === 'pending') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#ff4000]/10 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-[#ff4000]" />
          </div>
          <h3 className="text-xl font-bold mb-2">Demande en cours d'examen</h3>
          <p className="text-muted-foreground max-w-md mb-4">
            Votre demande d'accès API a été soumise le{' '}
            {format(new Date(request.created_at), 'dd MMMM yyyy', { locale: fr })}.
            Elle sera examinée par notre équipe sous 24-48h.
          </p>
          <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]/50">
            <Clock className="w-3 h-3 mr-1" /> En attente d'approbation
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Demande rejetée
  if (request.status === 'rejected') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold mb-2">{t('walletApiPanel.demandeRefusee')}</h3>
          <p className="text-muted-foreground max-w-md mb-2">
            Votre demande d'accès API a été refusée.
          </p>
          {request.rejection_reason && (
            <p className="text-sm bg-destructive/5 border border-destructive/20 rounded-lg p-3 max-w-md mb-4">
              <strong>Raison :</strong> {request.rejection_reason}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Contactez le support pour plus d'informations.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ✅ Demande approuvée - Afficher les clés & dashboard
  return (
    <div className="space-y-6">
      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Key className="w-4 h-4" />
              <span className="text-xs">{t('walletApiPanel.clesActives')}</span>
            </div>
            <p className="text-2xl font-bold">{keys.filter(k => k.is_active).length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-xs">Transactions</span>
            </div>
            <p className="text-2xl font-bold">{transactions.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-xs">Volume total</span>
            </div>
            <p className="text-lg font-bold">
              {WalletApiService.formatAmount(transactions.reduce((s, t) => s + t.amount_gnf, 0))}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">{t('walletApiPanel.reussies')}</span>
            </div>
            <p className="text-2xl font-bold text-[#ff4000]">
              {transactions.filter(t => t.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clés API */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Vos Clés API
              </CardTitle>
              <CardDescription>{t('walletApiPanel.utilisezCesClesPourIntegrer')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {keys.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">{t('walletApiPanel.aucuneCleApiGeneree')}</p>
          ) : (
            keys.map(key => (
              <div key={key.id} className={cn(
                "border rounded-xl p-4 space-y-3",
                key.is_active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30 opacity-60"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{key.key_name}</span>
                    {key.is_test_mode ? (
                      <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]/50 text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-0.5" /> TEST
                      </Badge>
                    ) : (
                      <Badge className="bg-[#ff4000] text-white text-[10px]">
                        <Zap className="w-3 h-3 mr-0.5" /> PRODUCTION
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={(v) => handleToggleKey(key.id, v)}
                    />
                    <span className="text-xs text-muted-foreground">{key.is_active ? 'Actif' : 'Inactif'}</span>
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('walletApiPanel.cleApi')}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background border rounded-md px-3 py-2 text-xs font-mono truncate">
                      {showSecrets[`key-${key.id}`] ? key.api_key : key.api_key.slice(0, 12) + '••••••••••••••••'}
                    </code>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowSecrets(s => ({ ...s, [`key-${key.id}`]: !s[`key-${key.id}`] }))}>
                      {showSecrets[`key-${key.id}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(key.api_key, 'Clé API')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* API Secret */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Secret API</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background border rounded-md px-3 py-2 text-xs font-mono truncate">
                      {showSecrets[`secret-${key.id}`] ? key.api_secret : '••••••••••••••••••••••••'}
                    </code>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowSecrets(s => ({ ...s, [`secret-${key.id}`]: !s[`secret-${key.id}`] }))}>
                      {showSecrets[`secret-${key.id}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(key.api_secret, 'Secret API')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Mode toggle & info */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={key.is_test_mode}
                        onCheckedChange={(v) => handleToggleTestMode(key.id, v)}
                      />
                      <span className="text-xs">{key.is_test_mode ? 'Mode test' : 'Production'}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Commission: {key.commission_rate}%</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Limites: {key.rate_limit_per_minute}/min • {key.rate_limit_per_day}/jour
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Documentation rapide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="w-5 h-5" />
            Intégration rapide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-foreground whitespace-pre">{`// Initier un paiement via 224Wallet API
const response = await fetch('${window.location.origin}/api/224wallet/pay', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'VOTRE_CLE_API',
    'X-API-Secret': 'VOTRE_SECRET_API',
  },
  body: JSON.stringify({
    amount: 50000,           // Montant en GNF
    currency: 'GNF',
    payer_phone: '+224XXXXXXXXX',
    description: 'Paiement commande #123',
    reference: 'CMD-123',   // Votre référence unique
  }),
});

const { payment_id, status } = await response.json();`}</pre>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <ExternalLink className="w-3 h-3 inline mr-1" />
            Documentation complète disponible prochainement
          </p>
        </CardContent>
      </Card>

      {/* Dernières transactions */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('walletApiPanel.dernieresTransactions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transactions.slice(0, 10).map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">{tx.description || tx.payment_reference || 'Transaction'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{WalletApiService.formatAmount(tx.amount_gnf)}</p>
                    <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">
                      {tx.status === 'completed' ? 'Réussi' : tx.status === 'failed' ? 'Échoué' : 'En cours'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
