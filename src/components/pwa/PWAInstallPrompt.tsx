// PWAInstallPrompt v2 - Avec protection contre les erreurs React HMR

import { useEffect, useState, memo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor, Chrome } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';

function PWAInstallPromptInner() {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Guard contre l'hydratation SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Vérifier si l'utilisateur a déjà refusé
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        setIsDismissed(true);
        return;
      }
      localStorage.removeItem('pwa-install-dismissed');
    }

    // Afficher après 5 secondes si installable et pas déjà installé
    const timer = setTimeout(() => {
      if (isInstallable && !isInstalled) {
        setIsVisible(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled, mounted]);

  const handleInstall = async () => {
    const installed = await promptInstall();

    if (installed) {
      toast.success(t('pWAInstallPrompt.applicationInstalleeAvecSucces'), {
        description: 'Vous pouvez maintenant utiliser 224Solutions depuis votre écran d\'accueil'
      });
      setIsVisible(false);
    } else {
      toast.error(t('pWAInstallPrompt.installationAnnulee'), {
        description: 'Vous pourrez installer l\'application plus tard'
      });
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));

    toast.info(t('pWAInstallPrompt.invitationMasquee'), {
      description: 'Vous pourrez installer l\'application depuis les paramètres de votre navigateur'
    });
  };

  // Ne pas afficher avant le mount client ou si installé/non installable/refusé
  if (!mounted || !isVisible || isInstalled || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md animate-in slide-in-from-bottom-5 duration-500">
      <Card className="border-2 border-primary shadow-2xl bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icône */}
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
              <img
                src="/icon-192.png?v=3"
                alt="224Solutions"
                className="w-12 h-12"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  if (img.parentElement) {
                    img.parentElement.className = 'w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-lg';
                  }
                }}
              />
            </div>

            {/* Contenu */}
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-lg text-gray-900">
                📱 Installer 224Solutions
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Installez notre application pour un accès rapide depuis votre écran d'accueil !
              </p>

              {/* Avantages */}
              <div className="space-y-1 text-xs text-gray-500 mt-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3 h-3 text-blue-600" />
                  <span>{t('pWAInstallPrompt.accesInstantaneSansOuvrirLe')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-3 h-3 text-[#04439e]" />
                  <span>Fonctionne hors ligne</span>
                </div>
                <div className="flex items-center gap-2">
                  <Chrome className="w-3 h-3 text-[#ff4000]" />
                  <span>{t('pWAInstallPrompt.t0MoDEspaceLeger')}</span>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleInstall}
                  className="flex-1 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Installer maintenant
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  size="sm"
                  className="px-3"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Memo pour éviter les re-renders inutiles qui peuvent causer des problèmes HMR
const PWAInstallPrompt = memo(PWAInstallPromptInner);
PWAInstallPrompt.displayName = 'PWAInstallPrompt';

export default PWAInstallPrompt;
