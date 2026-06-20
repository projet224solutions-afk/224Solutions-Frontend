import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🔐 Carte 2FA ADMIN — enrôlement & gestion (vérifié SERVEUR)
 * ---------------------------------------------------------------------------
 * Remplace `TwoFactorSetup` (client-side, cosmétique) pour les comptes admin/PDG.
 * Le secret et la vérification vivent dans le backend (`/api/admin/mfa/*`).
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, ShieldCheck, Smartphone, Copy, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminMfa } from '@/hooks/useAdminMfa';

export const AdminMfaCard: React.FC = () => {
  const { t } = useTranslation();
  const { status, loading, busy, enroll, activate, disable } = useAdminMfa();
  const [step, setStep] = useState<'idle' | 'qr'>('idle');
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  const handleEnroll = async () => {
    const res = await enroll();
    if (!res) { toast.error(t('adminMfaCard.erreurLorsDeLaGeneration')); return; }
    setOtpauthUrl(res.otpauthUrl);
    setSecret(res.secret);
    setStep('qr');
  };

  const handleActivate = async () => {
    const res = await activate(code);
    if (res.ok) {
      toast.success(t('adminMfaCard.t2faActiveeVosOperationsSensibles'));
      setStep('idle'); setOtpauthUrl(null); setSecret(null); setCode('');
    } else {
      toast.error(res.error || 'Code invalide');
    }
  };

  const handleDisable = async () => {
    const res = await disable(disableCode);
    if (res.ok) { toast.success(t('adminMfaCard.t2faDesactivee')); setShowDisable(false); setDisableCode(''); }
    else toast.error(res.error || 'Code invalide');
  };

  if (loading) {
    return (
      <Card><CardContent className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  // ── 2FA activée ──
  if (status?.enabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-[#ff4000]" />
              <div>
                <CardTitle>{t('adminMfaCard.authentificationADeuxFacteursAdmin')}</CardTitle>
                <CardDescription>{t('adminMfaCard.verificationServeurActiveSurLes')}</CardDescription>
              </div>
            </div>
            <Badge className="bg-[#ff4000]"><ShieldCheck className="h-3 w-3 mr-1" />{t('adminMfaCard.activee')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.locked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('adminMfaCard.compte2faTemporairementVerrouilleTrop')}</AlertDescription>
            </Alert>
          )}
          <Dialog open={showDisable} onOpenChange={setShowDisable}>
            <DialogTrigger asChild>
              <Button variant="destructive"><XCircle className="h-4 w-4 mr-2" />{t('adminMfaCard.desactiverLa2fa')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('adminMfaCard.desactiverLa2fa')}</DialogTitle>
                <DialogDescription>{t('adminMfaCard.entrezUnCode2faValide')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder={t('adminMfaCard.codeA6Chiffres')} value={disableCode} inputMode="numeric"
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDisable(false)}>{t('adminMfaCard.annuler')}</Button>
                  <Button variant="destructive" className="flex-1" disabled={disableCode.length !== 6 || busy} onClick={handleDisable}>
                    {busy ? 'Vérification…' : 'Désactiver'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // ── Non activée : enrôlement ──
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>{t('adminMfaCard.authentificationADeuxFacteursAdmin')}</CardTitle>
            <CardDescription>
              {status?.enforced
                ? 'Obligatoire pour effectuer des opérations financières sensibles.'
                : 'Recommandée — sera bientôt obligatoire sur les opérations sensibles.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'idle' && (
          <>
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                Utilisez Google Authenticator, Authy ou toute application TOTP. La vérification se fait côté serveur.
              </AlertDescription>
            </Alert>
            <Button onClick={handleEnroll} disabled={busy} className="w-full">
              {busy ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('adminMfaCard.generation')}</> : <><Shield className="h-4 w-4 mr-2" />{t('adminMfaCard.configurerLa2fa')}</>}
            </Button>
          </>
        )}

        {step === 'qr' && otpauthUrl && (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">{t('adminMfaCard.scannezCeQrCodeAvec')}</p>
              <div className="inline-block p-4 bg-white rounded-lg border"><QRCodeSVG value={otpauthUrl} size={200} /></div>
            </div>
            {secret && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">{t('adminMfaCard.ouEntrezCeCodeManuellement')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded font-mono text-sm break-all">{secret}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(secret); toast.success(t('adminMfaCard.copie')); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>{t('adminMfaCard.entrezLeCodeA6')}</AlertDescription>
            </Alert>
            <Input placeholder="000000" value={code} inputMode="numeric" maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep('idle'); setCode(''); }}>{t('adminMfaCard.retour')}</Button>
              <Button className="flex-1" disabled={code.length !== 6 || busy} onClick={handleActivate}>
                {busy ? 'Vérification…' : 'Vérifier et activer'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminMfaCard;
