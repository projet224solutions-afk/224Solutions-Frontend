/**
 * 🔗 PAGE DE REDIRECTION SHORT URL
 * Résout les liens courts via Edge Function serveur et redirige.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Link2Off, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { resolveShortLink, extractTargetPath } from '@/services/shortLinkService';

type Status = 'loading' | 'redirecting' | 'error' | 'fallback';

interface LinkInfo {
  title: string;
  type: string;
  targetPath: string;
}

export default function ShortLinkRedirect() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const hasResolved = useRef(false);

  useEffect(() => {
    if (!shortCode || hasResolved.current) return;
    hasResolved.current = true;
    doResolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode]);

  const doResolve = async () => {
    if (!shortCode) {
      setStatus('error');
      setErrorMessage('Code de lien manquant');
      return;
    }

    console.log('🔗 [ShortLinkRedirect] Resolving via server:', shortCode);

    try {
      const result = await resolveShortLink(shortCode);

      if (!result) {
        console.warn('🔗 [ShortLinkRedirect] Not found:', shortCode);
        setStatus('error');
        setErrorMessage('Lien introuvable ou expiré');
        return;
      }

      const targetPath = extractTargetPath(result.originalUrl);
      console.log('🔗 [ShortLinkRedirect] Target path:', targetPath);

      // Store link info for fallback UI
      setLinkInfo({
        title: result.title,
        type: result.linkType,
        targetPath,
      });

      setStatus('redirecting');

      // Navigate via React Router
      navigate(targetPath, { replace: true });

      // Safety check - if still on /s/ after 500ms, show fallback
      setTimeout(() => {
        if (window.location.pathname.includes('/s/')) {
          console.log('🔗 [ShortLinkRedirect] Navigation stuck, showing fallback');
          setStatus('fallback');
        }
      }, 500);
    } catch (err) {
      console.error('🔗 [ShortLinkRedirect] Error:', err);
      setStatus('error');
      setErrorMessage('Erreur inattendue');
    }
  };

  const handleManualRedirect = () => {
    if (linkInfo?.targetPath) {
      window.location.href = linkInfo.targetPath;
    }
  };

  // Loading / redirecting
  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {status === 'loading' ? 'Chargement...' : 'Redirection en cours...'}
          </p>
        </div>
      </div>
    );
  }

  // Error
  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2Off className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => navigate('/marketplace', { replace: true })} className="w-full">
              Voir le Marketplace
            </Button>
            <Button variant="outline" onClick={() => navigate('/', { replace: true })} className="w-full">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback (navigation stuck)
  if (status === 'fallback' && linkInfo) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">{linkInfo.title}</CardTitle>
            <CardDescription>
              Cliquez pour accéder à {linkInfo.type === 'shop' ? 'cette boutique' : (linkInfo.type === 'product' || linkInfo.type === 'digital_product') ? 'ce produit' : 'cette page'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleManualRedirect} className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir
            </Button>
            <Button variant="outline" onClick={() => navigate('/', { replace: true })} className="w-full">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
