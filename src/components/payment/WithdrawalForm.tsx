/**
 * WITHDRAWAL FORM COMPONENT
 * Formulaire de demande de retrait
 * 224SOLUTIONS
 */

import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWallet } from '@/hooks/useWallet';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import {
  ArrowDownLeft,
  AlertTriangle,
  Loader2,
  Info,
  CreditCard,
  Smartphone
} from 'lucide-react';

interface WithdrawalFormProps {
  userId?: string;
  onSuccess?: (withdrawalId: string) => void;
  onCancel?: () => void;
}

type WithdrawalMethod = 'BANK_TRANSFER' | 'MOBILE_MONEY';

export function WithdrawalForm({ onSuccess, onCancel }: WithdrawalFormProps) {
  const { t } = useTranslation();
  const { wallet, balance, currency, isBlocked, withdraw, processing, refresh } = useWallet();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<WithdrawalMethod>('BANK_TRANSFER');
  const [bankDetails, setBankDetails] = useState({
    account_name: '',
    account_number: '',
    bank_name: '',
    swift_code: '',
  });
  const [mobileDetails, setMobileDetails] = useState({
    phone_number: '',
    provider: 'MTN',
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatAmount = useFormatCurrency();

  const numAmount = parseFloat(amount) || 0;
  const minWithdrawal = 10000; // GNF

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet) {
      setError('Portefeuille non chargé');
      return;
    }

    // Validations
    if (numAmount <= 0 || !Number.isInteger(numAmount)) {
      setError('Montant invalide');
      return;
    }

    if (numAmount > balance) {
      setError(`Solde insuffisant. Disponible: ${formatAmount(balance, currency)}`);
      return;
    }

    if (numAmount < minWithdrawal) {
      setError(`Montant minimum: ${formatAmount(minWithdrawal, currency)}`);
      return;
    }

    if (isBlocked) {
      setError('Impossible de demander un retrait: portefeuille bloqué');
      return;
    }

    // Validation des détails selon la méthode
    if (method === 'BANK_TRANSFER') {
      if (!bankDetails.account_name || !bankDetails.account_number || !bankDetails.bank_name) {
        setError('Veuillez remplir tous les champs bancaires requis');
        return;
      }
    } else if (method === 'MOBILE_MONEY') {
      if (!mobileDetails.phone_number || !mobileDetails.provider) {
        setError('Veuillez remplir les informations Mobile Money');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Requesting withdrawal:', {
        wallet_id: wallet.id,
        amount: numAmount,
        method,
      });

      const metadata = {
        method,
        bank_details: method === 'BANK_TRANSFER' ? bankDetails : null,
        mobile_money_details: method === 'MOBILE_MONEY' ? mobileDetails : null,
        notes: notes || null,
        description: `Retrait via ${method}`
      };

      const success = await withdraw(numAmount, method, metadata);

      if (success) {
        console.log('✅ Withdrawal request created');
        await refresh();
        onSuccess?.('withdrawal-completed');

        // Reset form
        setAmount('');
        setBankDetails({ account_name: '', account_number: '', bank_name: '', swift_code: '' });
        setMobileDetails({ phone_number: '', provider: 'MTN' });
        setNotes('');
      } else {
        setError('Erreur lors du retrait');
      }

    } catch (err) {
      const message = err instanceof Error ? err.message: t('withdrawalForm.erreurLorsDeLaDemande');
      console.error('❌ Withdrawal request error:', err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const canProceed = numAmount >= minWithdrawal && numAmount <= balance && !isBlocked;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ArrowDownLeft className="w-5 h-5" />
          <span>{t('withdrawalForm.demandeDeRetrait')}</span>
        </CardTitle>
        <CardDescription>
          Retirez vos fonds vers votre compte bancaire ou Mobile Money
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Solde disponible */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('withdrawalForm.soldeDisponible')}</strong> {formatAmount(balance, currency)}
            </AlertDescription>
          </Alert>

          {/* Montant */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Montant à retirer <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder={t('withdrawalForm.entrezLeMontant')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={minWithdrawal}
                max={balance}
                step="1000"
                required
                disabled={loading || processing}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Montant minimum: {formatAmount(minWithdrawal, currency)}
            </p>
          </div>

          {/* Méthode de retrait */}
          <div className="space-y-2">
            <Label htmlFor="method">
              Méthode de retrait <span className="text-destructive">*</span>
            </Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as WithdrawalMethod)}
              disabled={loading || processing}
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK_TRANSFER">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Virement Bancaire</span>
                  </div>
                </SelectItem>
                <SelectItem value="MOBILE_MONEY">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-4 h-4" />
                    <span>Mobile Money</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Détails bancaires */}
          {method === 'BANK_TRANSFER' && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium text-sm">Informations Bancaires</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_name">
                    Nom du titulaire <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="account_name"
                    value={bankDetails.account_name}
                    onChange={(e) => setBankDetails({ ...bankDetails, account_name: e.target.value })}
                    placeholder="Ex: DIALLO Mohamed"
                    required
                    disabled={loading || processing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_number">
                    Numéro de compte <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="account_number"
                    value={bankDetails.account_number}
                    onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                    placeholder="Ex: GN123456789"
                    required
                    disabled={loading || processing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">
                    Nom de la banque <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bank_name"
                    value={bankDetails.bank_name}
                    onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                    placeholder={t('withdrawalForm.exEcobankGuinee')}
                    required
                    disabled={loading || processing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="swift_code">Code SWIFT (optionnel)</Label>
                  <Input
                    id="swift_code"
                    value={bankDetails.swift_code}
                    onChange={(e) => setBankDetails({ ...bankDetails, swift_code: e.target.value })}
                    placeholder="Ex: ECOCGNGX"
                    disabled={loading || processing}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Détails Mobile Money */}
          {method === 'MOBILE_MONEY' && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium text-sm">Informations Mobile Money</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">
                    Opérateur <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={mobileDetails.provider}
                    onValueChange={(value) => setMobileDetails({ ...mobileDetails, provider: value })}
                    disabled={loading || processing}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                      <SelectItem value="ORANGE">Orange Money</SelectItem>
                      <SelectItem value="MOOV">Moov Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">
                    Numéro de téléphone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    value={mobileDetails.phone_number}
                    onChange={(e) => setMobileDetails({ ...mobileDetails, phone_number: e.target.value })}
                    placeholder="Ex: +224 621 234 567"
                    required
                    disabled={loading || processing}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('withdrawalForm.ajoutezDesInformationsSupplementairesSi')}
              rows={3}
              disabled={loading || processing}
            />
          </div>

          {/* Erreur */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading || processing}
                className="flex-1"
              >
                Annuler
              </Button>
            )}
            <Button
              type="submit"
              disabled={!canProceed || loading || processing}
              className="flex-1"
            >
              {loading || processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Demander le retrait
                </>
              )}
            </Button>
          </div>

          {/* Avertissement */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Les demandes de retrait sont traitées sous 24-48h ouvrables.
              Des frais de transaction peuvent s'appliquer selon la méthode choisie.
            </AlertDescription>
          </Alert>
        </form>
      </CardContent>
    </Card>
  );
}
