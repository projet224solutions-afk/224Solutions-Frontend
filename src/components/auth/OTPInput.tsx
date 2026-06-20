import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, RefreshCw, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface OTPInputProps {
  identifier: string;
  onVerify: (otp: string) => Promise<void>;
  onResendOTP: () => Promise<void>;
  isLoading?: boolean;
  expiresAt?: string;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  identifier,
  onVerify,
  onResendOTP,
  isLoading = false,
  expiresAt
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Calculer temps restant
  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        toast.error('Code OTP expiré. Demandez un nouveau code.');
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // Format temps restant MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Gérer changement input
  const handleChange = (index: number, value: string) => {
    // Autoriser uniquement les chiffres
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Prendre dernier caractère uniquement
    setOtp(newOtp);

    // Auto-focus sur input suivant
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit si 6 chiffres complets
    if (newOtp.every(digit => digit !== '') && !isLoading) {
      const fullOtp = newOtp.join('');
      handleVerify(fullOtp);
    }
  };

  // Gérer touche backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Gérer paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    if (!/^\d{6}$/.test(pastedData)) {
      toast.error('Code invalide. Collez un code à 6 chiffres.');
      return;
    }

    const newOtp = pastedData.split('');
    setOtp(newOtp);

    // Focus dernier input et submit
    inputRefs.current[5]?.focus();
    handleVerify(pastedData);
  };

  // Vérifier OTP
  const handleVerify = async (otpCode: string) => {
    if (otpCode.length !== 6) {
      toast.error('Code incomplet. Entrez les 6 chiffres.');
      return;
    }

    if (timeLeft !== null && timeLeft <= 0) {
      toast.error('Code expiré. Demandez un nouveau code.');
      return;
    }

    try {
      await onVerify(otpCode);
    } catch (_error) {
      // Réinitialiser inputs en cas d'erreur
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  // Renvoyer OTP
  const handleResend = async () => {
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    await onResendOTP();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Lock className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Vérification en 2 étapes</CardTitle>
        <CardDescription className="text-center">
          Un code de sécurité à 6 chiffres a été envoyé à
        </CardDescription>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium text-sm">{identifier}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Inputs OTP */}
        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className="w-12 h-14 text-center text-2xl font-bold"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {/* Temps restant */}
        {timeLeft !== null && (
          <div className="text-center">
            <p className={`text-sm font-medium ${timeLeft <= 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
              Code expire dans: <span className="font-mono">{formatTime(timeLeft)}</span>
            </p>
          </div>
        )}

        {/* Bouton Vérifier (manuel si auto-submit échoué) */}
        <Button
          onClick={() => handleVerify(otp.join(''))}
          disabled={otp.some(d => d === '') || isLoading || (timeLeft !== null && timeLeft <= 0)}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Vérification...
            </>
          ) : (
            <>
              Vérifier le code
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {/* Renvoyer code */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Vous n'avez pas reçu le code ?
          </p>
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={isLoading || (timeLeft !== null && timeLeft > 240)} // Désactiver si >4min restantes
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Renvoyer le code
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-muted p-3 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            💡 <strong>Astuce:</strong> Vous pouvez coller le code directement depuis votre email
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
