/**
 * MFA SETUP COMPONENTS - 224SOLUTIONS
 * Composants UI pour la configuration et vérification MFA
 */

import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Mail, Key, QrCode, AlertTriangle, Check, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import useMFA from '@/hooks/useMFA';
import { MFAMethod, MFAFactor } from '@/services/auth/MFAService';
import { toast } from 'sonner';

/**
 * Bannière obligatoire de configuration MFA
 */
export function MFARequiredBanner() {
  const { requiresSetup, gracePeriodEnds } = useMFA();
  const [showSetup, setShowSetup] = useState(false);

  if (!requiresSetup) return null;

  const isGracePeriodExpired = gracePeriodEnds && new Date(gracePeriodEnds) < new Date();

  return (
    <>
      <Alert
        variant={isGracePeriodExpired ? 'destructive' : 'default'}
        className="mb-4"
      >
        <Shield className="h-4 w-4" />
        <AlertTitle>
          {isGracePeriodExpired
            ? 'Configuration MFA obligatoire'
            : 'Sécurisez votre compte'}
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            {isGracePeriodExpired
              ? 'Vous devez configurer l\'authentification à deux facteurs pour continuer.'
              : gracePeriodEnds
                ? `Configurez le MFA avant le ${new Date(gracePeriodEnds).toLocaleDateString('fr-FR')}`
                : 'Activez l\'authentification à deux facteurs pour protéger votre compte.'}
          </span>
          <Button
            variant={isGracePeriodExpired ? 'destructive' : 'default'}
            size="sm"
            onClick={() => setShowSetup(true)}
          >
            Configurer maintenant
          </Button>
        </AlertDescription>
      </Alert>

      <MFASetupDialog
        open={showSetup}
        onOpenChange={setShowSetup}
        required={isGracePeriodExpired}
      />
    </>
  );
}

/**
 * Dialog de configuration MFA
 */
export function MFASetupDialog({
  open,
  onOpenChange,
  required = false
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<MFAMethod>('totp');
  const [totpSetup, setTotpSetup] = useState<{
    qr_code?: string;
    backup_codes?: string[];
    factor_id?: string;
  } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentFactorId, setCurrentFactorId] = useState<string | null>(null);

  const { enrollTOTP, enrollSMS, enrollEmail, verifyTOTP, verifyCode, factors } = useMFA();

  // Enrôler TOTP
  const handleEnrollTOTP = async () => {
    setIsEnrolling(true);
    try {
      const result = await enrollTOTP('Authenticator');
      if (result.success) {
        setTotpSetup({
          qr_code: result.qr_code,
          backup_codes: result.backup_codes,
          factor_id: result.factor_id
        });
        setCurrentFactorId(result.factor_id || null);
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  // Enrôler SMS
  const handleEnrollSMS = async () => {
    if (!phoneNumber) return;

    setIsEnrolling(true);
    try {
      const result = await enrollSMS(phoneNumber);
      if (result.success) {
        setCurrentFactorId(result.factor_id || null);
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  // Enrôler Email
  const handleEnrollEmail = async () => {
    if (!email) return;

    setIsEnrolling(true);
    try {
      const result = await enrollEmail(email);
      if (result.success) {
        setCurrentFactorId(result.factor_id || null);
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  // Vérifier le code
  const handleVerify = async () => {
    if (!verificationCode || !currentFactorId) return;

    setIsVerifying(true);
    try {
      const success = activeTab === 'totp'
        ? await verifyTOTP(currentFactorId, verificationCode)
        : await verifyCode(currentFactorId, verificationCode);

      if (success) {
        onOpenChange(false);
        resetState();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const resetState = () => {
    setTotpSetup(null);
    setPhoneNumber('');
    setEmail('');
    setVerificationCode('');
    setCurrentFactorId(null);
  };

  return (
    <Dialog open={open} onOpenChange={required ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Configuration de l'authentification à deux facteurs
          </DialogTitle>
          <DialogDescription>
            Choisissez une méthode pour sécuriser votre compte
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MFAMethod)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="totp" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Authenticator</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">SMS</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
          </TabsList>

          {/* TOTP Setup */}
          <TabsContent value="totp" className="space-y-4">
            {!totpSetup ? (
              <div className="text-center py-6">
                <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Utilisez une application comme Google Authenticator, Authy ou 1Password
                </p>
                <Button onClick={handleEnrollTOTP} disabled={isEnrolling}>
                  {isEnrolling ? 'Configuration...' : 'Configurer l\'Authenticator'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* QR Code */}
                {totpSetup.qr_code && (
                  <div className="flex justify-center">
                    <img
                      src={totpSetup.qr_code}
                      alt="QR Code"
                      className="w-48 h-48 rounded-lg"
                    />
                  </div>
                )}

                {/* Code de vérification */}
                <div className="space-y-2">
                  <Label>Entrez le code de l'application</Label>
                  <div className="flex gap-2">
                    <Input
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-widest font-mono"
                      maxLength={6}
                    />
                    <Button onClick={handleVerify} disabled={verificationCode.length !== 6 || isVerifying}>
                      {isVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Vérifier'}
                    </Button>
                  </div>
                </div>

                {/* Codes de backup */}
                {totpSetup.backup_codes && totpSetup.backup_codes.length > 0 && (
                  <BackupCodesDisplay codes={totpSetup.backup_codes} />
                )}
              </div>
            )}
          </TabsContent>

          {/* SMS Setup */}
          <TabsContent value="sms" className="space-y-4">
            {!currentFactorId ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Numéro de téléphone</Label>
                  <Input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+224 620 00 00 00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Entrez votre numéro avec l'indicatif pays
                  </p>
                </div>
                <Button
                  onClick={handleEnrollSMS}
                  disabled={!phoneNumber || isEnrolling}
                  className="w-full"
                >
                  {isEnrolling ? 'Envoi...' : 'Envoyer le code'}
                </Button>
              </div>
            ) : (
              <VerificationCodeInput
                onVerify={handleVerify}
                isVerifying={isVerifying}
                code={verificationCode}
                setCode={setVerificationCode}
                label="Code reçu par SMS"
              />
            )}
          </TabsContent>

          {/* Email Setup */}
          <TabsContent value="email" className="space-y-4">
            {!currentFactorId ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Adresse email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                  />
                </div>
                <Button
                  onClick={handleEnrollEmail}
                  disabled={!email || isEnrolling}
                  className="w-full"
                >
                  {isEnrolling ? 'Envoi...' : 'Envoyer le code'}
                </Button>
              </div>
            ) : (
              <VerificationCodeInput
                onVerify={handleVerify}
                isVerifying={isVerifying}
                code={verificationCode}
                setCode={setVerificationCode}
                label="Code reçu par email"
              />
            )}
          </TabsContent>
        </Tabs>

        {!required && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Plus tard
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Challenge MFA (vérification lors de la connexion)
 */
export function MFAChallengeDialog({
  open,
  onOpenChange,
  onSuccess,
  factors
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  factors: MFAFactor[];
}) {
  const [selectedFactor, setSelectedFactor] = useState<MFAFactor | null>(
    factors.find(f => f.is_primary) || factors[0] || null
  );
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);

  const { verifyTOTP, verifyCode, verifyBackupCode, createChallenge } = useMFA();

  // Envoyer le challenge quand le facteur change (pour SMS/email)
  useEffect(() => {
    if (selectedFactor && (selectedFactor.method === 'sms' || selectedFactor.method === 'email')) {
      createChallenge(selectedFactor.id);
    }
  }, [selectedFactor, createChallenge]);

  const handleVerify = async () => {
    if (!code) return;

    setIsVerifying(true);
    try {
      let success = false;

      if (showBackupCode) {
        success = await verifyBackupCode(code);
      } else if (selectedFactor) {
        success = selectedFactor.method === 'totp'
          ? await verifyTOTP(selectedFactor.id, code)
          : await verifyCode(selectedFactor.id, code);
      }

      if (success) {
        onSuccess();
        onOpenChange(false);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Vérification en deux étapes
          </DialogTitle>
          <DialogDescription>
            Entrez le code pour accéder à votre compte
          </DialogDescription>
        </DialogHeader>

        {!showBackupCode && factors.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {factors.map((factor) => (
              <Button
                key={factor.id}
                variant={selectedFactor?.id === factor.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFactor(factor)}
              >
                {factor.method === 'totp' && <QrCode className="h-4 w-4 mr-1" />}
                {factor.method === 'sms' && <Smartphone className="h-4 w-4 mr-1" />}
                {factor.method === 'email' && <Mail className="h-4 w-4 mr-1" />}
                {factor.friendly_name}
              </Button>
            ))}
          </div>
        )}

        <VerificationCodeInput
          onVerify={handleVerify}
          isVerifying={isVerifying}
          code={code}
          setCode={setCode}
          label={showBackupCode ? 'Code de récupération' : 'Code de vérification'}
          length={showBackupCode ? 8 : 6}
        />

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => setShowBackupCode(!showBackupCode)}
          >
            {showBackupCode
              ? 'Utiliser un autre méthode'
              : 'Utiliser un code de récupération'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Affichage des codes de backup
 */
function BackupCodesDisplay({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    toast.success('Codes copiés');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-orange-50 dark:bg-[#ff4000]/20 border-orange-200 dark:border-[#ff4000]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Key className="h-4 w-4" />
          Codes de récupération
        </CardTitle>
        <CardDescription className="text-xs">
          Conservez ces codes en lieu sûr. Ils vous permettront d'accéder à votre compte si vous perdez l'accès à votre méthode principale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((code, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-center">
              {code}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={handleCopy} className="w-full">
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copié!' : 'Copier tous les codes'}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Input de code de vérification
 */
function VerificationCodeInput({
  onVerify,
  isVerifying,
  code,
  setCode,
  label,
  length = 6
}: {
  onVerify: () => void;
  isVerifying: boolean;
  code: string;
  setCode: (code: string) => void;
  label: string;
  length?: number;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{label}</Label>
        <Input
          value={code}
          onChange={(e) => {
            const value = length === 6
              ? e.target.value.replace(/\D/g, '').slice(0, length)
              : e.target.value.toUpperCase().slice(0, length);
            setCode(value);
          }}
          placeholder={length === 6 ? '000000' : 'XXXXXXXX'}
          className="text-center text-2xl tracking-widest font-mono"
          maxLength={length}
          onKeyDown={(e) => e.key === 'Enter' && code.length === length && onVerify()}
        />
      </div>
      <Button
        onClick={onVerify}
        disabled={code.length !== length || isVerifying}
        className="w-full"
      >
        {isVerifying ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Vérification...
          </>
        ) : (
          'Vérifier'
        )}
      </Button>
    </div>
  );
}

/**
 * Page de gestion MFA (paramètres)
 */
export function MFASettingsPanel() {
  const {
    status,
    factors,
    isLoading,
    removeFactor,
    regenerateBackupCodes,
    refresh
  } = useMFA();
  const [showSetup, setShowSetup] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState<string[] | null>(null);

  const handleRemoveFactor = async (factorId: string) => {
    if (factors.length === 1) {
      toast.error('Vous devez garder au moins une méthode d\'authentification');
      return;
    }

    if (confirm('Êtes-vous sûr de vouloir supprimer cette méthode d\'authentification?')) {
      await removeFactor(factorId);
    }
  };

  const handleRegenerateBackupCodes = async (factorId: string) => {
    const codes = await regenerateBackupCodes(factorId);
    if (codes) {
      setShowBackupCodes(codes);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Authentification à deux facteurs
              </CardTitle>
              <CardDescription>
                Protégez votre compte avec une couche de sécurité supplémentaire
              </CardDescription>
            </div>
            <Badge variant={status === 'enrolled' ? 'default' : 'secondary'}>
              {status === 'enrolled' ? 'Activé' : 'Non configuré'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Liste des facteurs */}
          {factors.length > 0 ? (
            <div className="space-y-3">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {factor.method === 'totp' && <QrCode className="h-5 w-5 text-primary" />}
                    {factor.method === 'sms' && <Smartphone className="h-5 w-5 text-primary" />}
                    {factor.method === 'email' && <Mail className="h-5 w-5 text-primary" />}
                    <div>
                      <p className="font-medium">{factor.friendly_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {factor.phone_number || factor.email || 'Authenticator App'}
                      </p>
                    </div>
                    {factor.is_primary && (
                      <Badge variant="outline" className="ml-2">Principal</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {factor.method === 'totp' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateBackupCodes(factor.id)}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFactor(factor.id)}
                      className="text-[#ff4000] hover:text-[#ff4000]"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune méthode d'authentification configurée</p>
            </div>
          )}

          <Button onClick={() => setShowSetup(true)} className="w-full">
            Ajouter une méthode
          </Button>
        </CardContent>
      </Card>

      <MFASetupDialog
        open={showSetup}
        onOpenChange={setShowSetup}
      />

      {/* Dialog pour afficher les codes de backup régénérés */}
      {showBackupCodes && (
        <Dialog open onOpenChange={() => setShowBackupCodes(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveaux codes de récupération</DialogTitle>
            </DialogHeader>
            <BackupCodesDisplay codes={showBackupCodes} />
            <DialogFooter>
              <Button onClick={() => setShowBackupCodes(null)}>J'ai noté les codes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Exports groupés
export const MFAComponents = {
  RequiredBanner: MFARequiredBanner,
  SetupDialog: MFASetupDialog,
  ChallengeDialog: MFAChallengeDialog,
  SettingsPanel: MFASettingsPanel
};

export default MFAComponents;
