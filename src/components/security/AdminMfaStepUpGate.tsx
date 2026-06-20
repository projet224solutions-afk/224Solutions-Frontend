/**
 * 🔐 PORTE STEP-UP 2FA ADMIN (modal globale)
 * ---------------------------------------------------------------------------
 * Enregistre dans `backendApi` un handler appelé automatiquement quand une
 * opération financière sensible renvoie un défi `MFA_REQUIRED` / `MFA_INVALID`.
 * Affiche un prompt de code TOTP → `/api/admin/mfa/step-up` → ouvre la fenêtre
 * de 5 min (grant Redis serveur) ; `backendFetch` rejoue alors la requête.
 *
 * Monter une seule fois en haut de l'app admin (PDG). Invisible tant qu'aucun
 * défi n'est en cours.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { registerMfaStepUpHandler } from '@/services/backendApi';
import { useAdminMfa } from '@/hooks/useAdminMfa';

export const AdminMfaStepUpGate: React.FC = () => {
  const { stepUp } = useAdminMfa();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  // Files d'attente des promesses (plusieurs ops sensibles concurrentes possibles).
  const resolversRef = useRef<Array<(ok: boolean) => void>>([]);

  const settle = useCallback((ok: boolean) => {
    resolversRef.current.forEach((r) => r(ok));
    resolversRef.current = [];
    setOpen(false);
    setCode('');
    setError(null);
    setVerifying(false);
  }, []);

  useEffect(() => {
    registerMfaStepUpHandler(() => new Promise<boolean>((resolve) => {
      resolversRef.current.push(resolve);
      setError(null);
      setOpen(true);
    }));
    return () => registerMfaStepUpHandler(null);
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError(null);
    const res = await stepUp(code);
    if (res.ok) {
      settle(true);
    } else {
      setVerifying(false);
      setCode('');
      setError(res.code === 'MFA_LOCKED'
        ? 'Trop de tentatives — compte 2FA verrouillé temporairement.'
        : (res.error || 'Code invalide.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) settle(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#ff4000]" />
            Vérification 2FA requise
          </DialogTitle>
          <DialogDescription>
            Cette opération financière sensible nécessite votre code à deux facteurs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          )}
          <Input
            autoFocus
            placeholder="000000"
            value={code}
            inputMode="numeric"
            maxLength={6}
            className="text-center text-2xl tracking-widest font-mono"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleVerify(); }}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => settle(false)} disabled={verifying}>
              Annuler
            </Button>
            <Button className="flex-1" onClick={handleVerify} disabled={code.length !== 6 || verifying}>
              {verifying ? 'Vérification…' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminMfaStepUpGate;
