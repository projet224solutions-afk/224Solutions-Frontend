import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WalletPinPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (pin: string) => Promise<void>;
  onForgotPin?: () => void;
}

export function WalletPinPromptDialog({
  open,
  onOpenChange,
  title = 'Confirmer avec votre code PIN',
  description = 'Entrez votre code de sécurité à 6 chiffres pour confirmer cette opération.',
  loading = false,
  error,
  onConfirm,
  onForgotPin,
}: WalletPinPromptDialogProps) {
  const [pin, setPin] = useState('');

  const handleConfirm = async () => {
    await onConfirm(pin);
    setPin('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="wallet-pin-confirm">Code PIN</Label>
            <Input
              id="wallet-pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center tracking-[0.4em] text-lg"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {onForgotPin ? (
            <div className="text-right">
              <Button type="button" variant="link" className="h-auto px-0 text-xs" onClick={onForgotPin}>
                PIN oublié ? Réinitialiser
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={loading || pin.length !== 6}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface WalletPinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'setup' | 'change' | 'reset';
  loading?: boolean;
  error?: string | null;
  onSubmit: (payload: { currentPin?: string; accountPassword?: string; pin: string; confirmPin: string }) => Promise<void>;
  onForgotPin?: () => void;
}

export function WalletPinSetupDialog({
  open,
  onOpenChange,
  mode = 'setup',
  loading = false,
  error,
  onSubmit,
  onForgotPin,
}: WalletPinSetupDialogProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleSubmit = async () => {
    await onSubmit({
      currentPin: mode === 'change' ? currentPin : undefined,
      accountPassword: mode === 'reset' ? accountPassword : undefined,
      pin,
      confirmPin,
    });
    if (!loading) {
      setCurrentPin('');
      setAccountPassword('');
      setPin('');
      setConfirmPin('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'change'
              ? 'Modifier le code PIN'
              : mode === 'reset'
                ? 'Réinitialiser le code PIN'
                : 'Configurer le code PIN wallet'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'change'
              ? 'Entrez votre ancien code puis le nouveau code de sécurité à 6 chiffres.'
              : mode === 'reset'
                ? 'Entrez le mot de passe de votre compte, puis choisissez un nouveau code PIN à 6 chiffres.'
                : 'Créez un code de sécurité à 6 chiffres. Il sera demandé pour chaque retrait ou transfert.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {mode === 'change' ? (
            <div>
              <Label htmlFor="wallet-pin-current">Code PIN actuel</Label>
              <Input
                id="wallet-pin-current"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center tracking-[0.4em] text-lg"
              />
              {onForgotPin ? (
                <div className="mt-1 text-right">
                  <Button type="button" variant="link" className="h-auto px-0 text-xs" onClick={onForgotPin}>
                    PIN oublié ?
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {mode === 'reset' ? (
            <div>
              <Label htmlFor="wallet-account-password">Mot de passe du compte</Label>
              <Input
                id="wallet-account-password"
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Votre mot de passe de connexion"
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="wallet-pin-new">Nouveau code PIN</Label>
            <Input
              id="wallet-pin-new"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center tracking-[0.4em] text-lg"
            />
          </div>
          <div>
            <Label htmlFor="wallet-pin-confirm-new">Confirmer le code PIN</Label>
            <Input
              id="wallet-pin-confirm-new"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center tracking-[0.4em] text-lg"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || pin.length !== 6 || confirmPin.length !== 6 || (mode === 'change' && currentPin.length !== 6) || (mode === 'reset' && accountPassword.trim().length === 0)}
          >
            {mode === 'change' ? 'Mettre à jour' : mode === 'reset' ? 'Réinitialiser le PIN' : 'Activer le code PIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
