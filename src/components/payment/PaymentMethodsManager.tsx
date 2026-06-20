/**
 * GESTIONNAIRE DE MOYENS DE PAIEMENT CLIENT
 * Affichage et gestion des 5 moyens de paiement configurés
 * 224Solutions - Payment System
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Wallet,
  Smartphone,
  Banknote,
  Plus,
  Trash2,
  Check,
  CreditCard,
  Edit
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  type: 'wallet' | 'orange_money' | 'mtn_money' | 'cash' | 'bank_card';
  label: string;
  details?: string; // Numéro de téléphone masqué ou derniers chiffres carte
  is_default: boolean;
  is_active: boolean;
}

export function PaymentMethodsManager() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMethodType, setNewMethodType] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadPaymentMethods();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPaymentMethods = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await (supabase as any)
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (queryError) {
        console.error('Erreur chargement moyens de paiement:', queryError);

        // Si la table n'existe pas ou problème réseau, utiliser des moyens par défaut en mémoire
        if (queryError.message.includes('does not exist') ||
            queryError.message.includes('schema cache') ||
            queryError.message.includes('Failed to fetch') ||
            queryError.message.includes('NetworkError') ||
            queryError.code === 'PGRST301' ||
            queryError.code === '42P01') {

          console.log('Table non trouvée ou erreur réseau, utilisation des moyens par défaut en mémoire');
          const defaultMethods: PaymentMethod[] = [{
            id: 'wallet-default',
            type: 'wallet',
            label: 'Portefeuille 224Solutions',
            is_default: true,
            is_active: true
          }];
          setPaymentMethods(defaultMethods);
          setLoading(false);
          toast.info(t('paymentMethodsManager.moyensDePaiementEnMode'));
          return;
        }

        setError(`Erreur: ${queryError.message}`);
        toast.error(`Impossible de charger les moyens de paiement: ${queryError.message}`);
        return;
      }

      const formatted: PaymentMethod[] = (data || []).map(method => ({
        id: method.id,
        type: method.method_type as PaymentMethod['type'],
        label: getMethodLabel(method.method_type),
        details: method.phone_number ? maskPhoneNumber(method.phone_number) :
                 method.card_last_four ? `**** ${method.card_last_four}` : undefined,
        is_default: method.is_default || false,
        is_active: method.is_active !== false
      }));

      // Si aucun moyen de paiement, créer le wallet par défaut
      if (formatted.length === 0) {
        console.log('Aucun moyen de paiement trouvé, création du wallet par défaut...');
        try {
          await createDefaultWallet();
          // Recharger après création
          return loadPaymentMethods();
        } catch (_createError) {
          // Si erreur de création, utiliser le wallet par défaut en mémoire
          console.warn('Impossible de créer le wallet en DB, utilisation en mémoire');
          const defaultMethods: PaymentMethod[] = [{
            id: 'wallet-default',
            type: 'wallet',
            label: 'Portefeuille 224Solutions',
            is_default: true,
            is_active: true
          }];
          setPaymentMethods(defaultMethods);
          return;
        }
      }

      setPaymentMethods(formatted);
    } catch (error: any) {
      console.error('Erreur chargement moyens de paiement:', error);

      // En cas d'erreur réseau ou autre, utiliser wallet par défaut en mémoire
      const defaultMethods: PaymentMethod[] = [{
        id: 'wallet-default',
        type: 'wallet',
        label: 'Portefeuille 224Solutions',
        is_default: true,
        is_active: true
      }];
      setPaymentMethods(defaultMethods);
      toast.info(t('paymentMethodsManager.modeHorsLigneUtilisationDu'));
    } finally {
      setLoading(false);
    }
  };

  const createDefaultWallet = async () => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from('user_payment_methods')
        .insert({
          user_id: user.id,
          method_type: 'wallet',
          is_default: true,
          is_active: true,
          label: 'Portefeuille 224Solutions'
        });

      if (error) {
        console.error('Erreur création wallet par défaut:', error);
      } else {
        console.log('✅ Wallet par défaut créé avec succès');
      }
    } catch (error) {
      console.error('Erreur création wallet:', error);
    }
  };

  const getMethodLabel = (type: string): string => {
    switch (type) {
      case 'wallet': return 'Portefeuille 224Solutions';
      case 'orange_money': return 'Orange Money';
      case 'mtn_money': return 'MTN Mobile Money';
      case 'cash': return 'Espèces';
      case 'bank_card': return 'Carte bancaire';
      default: return type;
    }
  };

  const maskPhoneNumber = (phone: string): string => {
    if (!phone || phone.length < 4) return phone;
    const last4 = phone.slice(-4);
    const masked = '*'.repeat(phone.length - 4);
    return `${masked}${last4}`;
  };

  const getMethodIcon = (type: PaymentMethod['type']) => {
    switch (type) {
      case 'wallet':
        return <Wallet className="h-5 w-5 text-primary" />;
      case 'orange_money':
        return <Smartphone className="h-5 w-5" style={{ color: '#FF6B00' }} />;
      case 'mtn_money':
        return <Smartphone className="h-5 w-5" style={{ color: '#ff4000' }} />;
      case 'cash':
        return <Banknote className="h-5 w-5 text-[#ff4000]" />;
      case 'bank_card':
        return <CreditCard className="h-5 w-5 text-blue-600" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  };

  const handleAddMethod = async () => {
    if (!user || !newMethodType) {
      toast.error(t('paymentMethodsManager.selectionnezUnTypeDePaiement'));
      return;
    }

    // Validation selon le type
    if ((newMethodType === 'orange_money' || newMethodType === 'mtn_money') && !phoneNumber) {
      toast.error(t('paymentMethodsManager.entrezUnNumeroDeTelephone'));
      return;
    }

    if (newMethodType === 'bank_card' && !cardNumber) {
      toast.error(t('paymentMethodsManager.entrezUnNumeroDeCarte'));
      return;
    }

    setSaving(true);
    try {
      // Vérifier si c'est le premier moyen de paiement (sera par défaut)
      const isFirstMethod = paymentMethods.length === 0 || paymentMethods[0].id === 'wallet-default';

      const methodData: any = {
        user_id: user.id,
        method_type: newMethodType,
        is_default: isFirstMethod,
        is_active: true
      };

      // Ajouter les détails selon le type
      if (newMethodType === 'orange_money' || newMethodType === 'mtn_money') {
        methodData.phone_number = phoneNumber;
      }

      if (newMethodType === 'bank_card') {
        // Ne stocker que les 4 derniers chiffres pour la sécurité
        methodData.card_last_four = cardNumber.slice(-4);
      }

      const { error } = await (supabase as any)
        .from('user_payment_methods')
        .insert(methodData);

      if (error) {
        // Si la table n'existe pas, ajouter en mémoire seulement
        if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
          toast.warning(t('paymentMethodsManager.ajouteTemporairementLaTableDoit'));
          const newMethod: PaymentMethod = {
            id: `temp-${Date.now()}`,
            type: newMethodType as PaymentMethod['type'],
            label: getMethodLabel(newMethodType),
            details: phoneNumber ? maskPhoneNumber(phoneNumber) :
                     cardNumber ? `**** ${cardNumber.slice(-4)}` : undefined,
            is_default: isFirstMethod,
            is_active: true
          };
          setPaymentMethods([...paymentMethods.filter(m => m.id !== 'wallet-default'), newMethod]);
          setShowAddDialog(false);
          setNewMethodType('');
          setPhoneNumber('');
          setCardNumber('');
          return;
        }
        throw error;
      }

      toast.success(t('paymentMethodsManager.moyenDePaiementAjouteAvec'));
      setShowAddDialog(false);
      setNewMethodType('');
      setPhoneNumber('');
      setCardNumber('');
      loadPaymentMethods();
    } catch (error: any) {
      console.error('Erreur ajout moyen de paiement:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    if (!user) return;

    try {
      // Retirer le défaut de tous les autres
      await (supabase as any)
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Mettre celui-ci par défaut
      const { error } = await (supabase as any)
        .from('user_payment_methods')
        .update({ is_default: true })
        .eq('id', methodId);

      if (error) throw error;

      toast.success(t('paymentMethodsManager.moyenDePaiementParDefaut'));
      loadPaymentMethods();
    } catch (error) {
      console.error('Erreur modification défaut:', error);
      toast.error(t('paymentMethodsManager.impossibleDeModifierLeMoyen'));
    }
  };

  const handleToggleActive = async (methodId: string, currentState: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('user_payment_methods')
        .update({ is_active: !currentState })
        .eq('id', methodId);

      if (error) throw error;

      toast.success(currentState ? 'Moyen de paiement désactivé' : 'Moyen de paiement activé');
      loadPaymentMethods();
    } catch (error) {
      console.error('Erreur toggle actif:', error);
      toast.error(t('paymentMethodsManager.erreurLorsDeLaModification'));
    }
  };

  const handleDelete = async (methodId: string) => {
    if (!confirm(t('paymentMethodsManager.etesVousSurDeVouloir'))) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('user_payment_methods')
        .delete()
        .eq('id', methodId);

      if (error) throw error;

      toast.success(t('paymentMethodsManager.moyenDePaiementSupprime'));
      loadPaymentMethods();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error(t('paymentMethodsManager.impossibleDeSupprimerCeMoyen'));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        <p className="text-muted-foreground mt-4">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="bg-orange-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <CreditCard className="h-8 w-8 text-[#ff4000]" />
        </div>
        <h3 className="text-lg font-semibold text-[#ff4000] mb-2">{t('paymentMethodsManager.erreurDeChargement')}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {error}
        </p>
        <div className="space-y-2">
          <Button
            onClick={loadPaymentMethods}
            variant="outline"
            size="sm"
          >
            Réessayer
          </Button>
          <p className="text-xs text-muted-foreground">
            La table 'user_payment_methods' doit être créée dans Supabase
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Liste des moyens de paiement */}
      {paymentMethods.length === 0 ? (
        <div className="text-center py-8">
          <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('paymentMethodsManager.aucunMoyenDePaiement')}</h3>
          <p className="text-muted-foreground mb-4">
            Ajoutez vos moyens de paiement préférés pour des transactions plus rapides
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <Card key={method.id} className={!method.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {getMethodIcon(method.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{method.label}</p>
                        {method.is_default && (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                            Par défaut
                          </Badge>
                        )}
                        {!method.is_active && (
                          <Badge variant="outline">{t('paymentMethodsManager.desactive')}</Badge>
                        )}
                      </div>
                      {method.details && (
                        <p className="text-sm text-muted-foreground">{method.details}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle actif/inactif */}
                    <Switch
                      checked={method.is_active}
                      onCheckedChange={() => handleToggleActive(method.id, method.is_active)}
                    />

                    {/* Définir par défaut */}
                    {!method.is_default && method.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Par défaut
                      </Button>
                    )}

                    {/* Supprimer */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bouton Ajouter */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger asChild>
          <Button className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un moyen de paiement
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('paymentMethodsManager.ajouterUnMoyenDePaiement')}</DialogTitle>
            <DialogDescription>
              Sélectionnez le type de paiement et entrez les informations nécessaires
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Sélection du type */}
            <div className="space-y-2">
              <Label>{t('paymentMethodsManager.typeDePaiement')}</Label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={newMethodType === 'wallet' ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setNewMethodType('wallet')}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Portefeuille 224Solutions
                </Button>
                <Button
                  variant={newMethodType === 'orange_money' ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setNewMethodType('orange_money')}
                >
                  <Smartphone className="h-4 w-4 mr-2" style={{ color: newMethodType === 'orange_money' ? 'white' : '#FF6B00' }} />
                  Orange Money
                </Button>
                <Button
                  variant={newMethodType === 'mtn_money' ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setNewMethodType('mtn_money')}
                >
                  <Smartphone className="h-4 w-4 mr-2" style={{ color: newMethodType === 'mtn_money' ? 'white' : '#ff4000' }} />
                  MTN Mobile Money
                </Button>
                <Button
                  variant={newMethodType === 'cash' ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setNewMethodType('cash')}
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Espèces
                </Button>
                <Button
                  variant={newMethodType === 'bank_card' ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setNewMethodType('bank_card')}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Carte bancaire
                </Button>
              </div>
            </div>

            {/* Champs conditionnels */}
            {(newMethodType === 'orange_money' || newMethodType === 'mtn_money') && (
              <div className="space-y-2">
                <Label htmlFor="phone">{t('paymentMethodsManager.numeroDeTelephone')}</Label>
                <Input
                  id="phone"
                  placeholder="+224 XXX XX XX XX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            )}

            {newMethodType === 'bank_card' && (
              <div className="space-y-2">
                <Label htmlFor="card">{t('paymentMethodsManager.numeroDeCarte')}</Label>
                <Input
                  id="card"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  maxLength={19}
                />
                <p className="text-xs text-muted-foreground">
                  Seuls les 4 derniers chiffres seront stockés pour votre sécurité
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowAddDialog(false)}
            >
              Annuler
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddMethod}
              disabled={!newMethodType || saving}
            >
              {saving ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
