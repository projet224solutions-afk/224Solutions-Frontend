import { useTranslation } from "@/hooks/useTranslation";
/**
 * Composant de challenge de sécurité (alternative légère au CAPTCHA)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Shield, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface SecurityChallengeProps {
  onSuccess: () => void;
  onFailure?: () => void;
  maxAttempts?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface Challenge {
  question: string;
  answer: string;
  type: 'math' | 'text' | 'image';
}

export const SecurityChallenge: React.FC<SecurityChallengeProps> = ({
  onSuccess,
  onFailure,
  maxAttempts = 3,
  difficulty = 'medium'
}) => {
  const { t } = useTranslation();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [isVerifying, setIsVerifying] = useState(false);

  const generateChallenge = useCallback((): Challenge => {
    const challenges: Challenge[] = [];

    // Challenges mathématiques
    const num1 = Math.floor(Math.random() * (difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 50));
    const num2 = Math.floor(Math.random() * (difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 50));
    const operators = ['+', '-', '*'];
    const op = operators[Math.floor(Math.random() * (difficulty === 'hard' ? 3 : 2))];

    let result: number;
    switch (op) {
      case '+': result = num1 + num2; break;
      case '-': result = num1 - num2; break;
      case '*': result = num1 * num2; break;
      default: result = num1 + num2;
    }

    challenges.push({
      question: `Combien font ${num1} ${op} ${num2} ?`,
      answer: result.toString(),
      type: 'math'
    });

    // Challenges texte
    const textChallenges = [
      { q: 'Écrivez "sécurité" sans accents', a: 'securite' },
      { q: 'Combien de lettres dans "protection" ?', a: '10' },
      { q: 'Quelle est la première lettre de "Guinée" ?', a: 'g' },
      { q: 'Écrivez le chiffre 5 en lettres', a: 'cinq' },
    ];

    const textChallenge = textChallenges[Math.floor(Math.random() * textChallenges.length)];
    challenges.push({
      question: textChallenge.q,
      answer: textChallenge.a.toLowerCase(),
      type: 'text'
    });

    return challenges[Math.floor(Math.random() * challenges.length)];
  }, [difficulty]);

  useEffect(() => {
    setChallenge(generateChallenge());
  }, [generateChallenge]);

  const handleVerify = async () => {
    if (!challenge || !userAnswer.trim()) return;

    setIsVerifying(true);

    // Petit délai pour éviter le brute force
    await new Promise(resolve => setTimeout(resolve, 500));

    const isCorrect = userAnswer.toLowerCase().trim() === challenge.answer.toLowerCase();

    if (isCorrect) {
      setStatus('success');
      setTimeout(() => onSuccess(), 1000);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= maxAttempts) {
        setStatus('failed');
        onFailure?.();
      } else {
        setUserAnswer('');
        setChallenge(generateChallenge());
      }
    }

    setIsVerifying(false);
  };

  const handleRefresh = () => {
    setUserAnswer('');
    setChallenge(generateChallenge());
  };

  if (status === 'success') {
    return (
      <Card className="w-full max-w-md mx-auto border-[#ff4000] bg-orange-50">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="w-16 h-16 text-[#ff4000] mb-4" />
          <p className="text-[#ff4000] font-semibold">{t('securityChallenge.verificationReussie')}</p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'failed') {
    return (
      <Card className="w-full max-w-md mx-auto border-[#ff4000] bg-orange-50">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <XCircle className="w-16 h-16 text-[#ff4000] mb-4" />
          <p className="text-[#ff4000] font-semibold">{t('securityChallenge.tropDeTentativesEchouees')}</p>
          <p className="text-[#ff4000] text-sm mt-2">{t('securityChallenge.veuillezReessayerPlusTard')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center gap-2">
        <Shield className="w-5 h-5 text-blue-500" />
        <CardTitle className="text-lg">{t('securityChallenge.verificationDeSecurite')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-slate-100 p-4 rounded-lg">
          <p className="text-center font-medium">{challenge?.question}</p>
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder={t('securityChallenge.votreReponse')}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            disabled={isVerifying}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isVerifying}
            title={t('securityChallenge.nouveauChallenge')}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tentative {attempts + 1}/{maxAttempts}
          </p>
          <Button
            onClick={handleVerify}
            disabled={!userAnswer.trim() || isVerifying}
          >
            {isVerifying ? 'Vérification...' : 'Vérifier'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityChallenge;
