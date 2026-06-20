/**
 * PAGE DE REDIRECTION POUR LIEN D'AFFILIATION AGENT
 * Stocke le token d'affiliation et redirige vers la page de connexion
 * 224SOLUTIONS
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentAffiliateRedirect() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Token depuis URL params ou query string
  const affiliateToken = token || searchParams.get('ref');

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    if (affiliateToken) {
      validateAndRedirect();
    } else {
      // Pas de token, rediriger directement vers /auth
      navigate('/auth');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliateToken]);

  const validateAndRedirect = async () => {
    try {
      // Valider que le token existe
      if (!affiliateToken || affiliateToken.trim() === '') {
        throw new Error('Token d\'affiliation manquant');
      }

      // Valider le token auprès du backend Node (endpoint public, sans auth)
      const { resolveBackendUrl } = await import('@/config/backend');
      const res = await fetch(resolveBackendUrl('/api/agents/affiliate-links/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: affiliateToken }),
      });
      const data = await res.json();

      if (data?.valid) {
        setStatus('valid');
        setAgentName(data.agent_name || 'Agent');

        // Stocker le token d'affiliation dans localStorage
        localStorage.setItem('affiliate_token', affiliateToken);
        localStorage.setItem('affiliate_agent_name', data.agent_name || 'Agent');
        localStorage.setItem('affiliate_agent_id', data.agent_id || '');
        localStorage.setItem('affiliate_target_role', data.target_role || 'all');
        localStorage.setItem('affiliate_timestamp', Date.now().toString());

        // Enregistrer le clic (endpoint public backend, non bloquant)
        try {
          await fetch(resolveBackendUrl('/api/agents/affiliate-links/track-click'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: affiliateToken, referrer: document.referrer || null }),
          });
        } catch (e) {
          console.warn('Erreur tracking clic:', e);
        }

        toast.success(`Bienvenue !`, {
          description: `Vous avez été invité par ${data.agent_name || 'un agent'}. Créez votre compte pour continuer.`
        });

        // Rediriger vers la page de connexion après un court délai
        setTimeout(() => {
          navigate('/auth', {
            state: {
              fromAffiliate: true,
              agentName: data.agent_name,
              targetRole: data.target_role
            }
          });
        }, 1500);
      } else {
        setStatus('invalid');
        toast.error(t('agentAffiliateRedirect.lienInvalideOuExpire'), {
          description: 'Ce lien d\'affiliation n\'est plus valide.'
        });

        // Rediriger vers /auth quand même après un délai
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur validation token:', error);
      setStatus('invalid');

      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardContent className="pt-8 pb-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('agentAffiliateRedirect.verificationDuLien')}</h2>
              <p className="text-muted-foreground">Veuillez patienter</p>
            </>
          )}

          {status === 'valid' && (
            <>
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-[#ff4000]" />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-[#ff4000]">{t('agentAffiliateRedirect.lienVerifie')}</h2>
              <p className="text-muted-foreground mb-4">
                Invitation de <span className="font-semibold text-primary">{agentName}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Redirection vers la page d'inscription...
              </p>
            </>
          )}

          {status === 'invalid' && (
            <>
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-[#ff4000]" />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-[#ff4000]">Lien invalide</h2>
              <p className="text-muted-foreground mb-4">
                Ce lien d'affiliation n'existe pas ou a expiré.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirection vers la page de connexion...
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
