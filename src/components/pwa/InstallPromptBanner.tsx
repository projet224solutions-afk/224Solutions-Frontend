/**
 * BANNIÈRE D'INSTALLATION PWA
 * Affiche un bouton d'installation discret pour l'application mobile
 * Supporte iOS (via guide manuel) et Android (via beforeinstallprompt)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { X, Download, Share, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import IOSInstallGuide from './IOSInstallGuide';

function detectIOSLike(): boolean {
  const ua = navigator.userAgent;
  const isClassicIOS = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOSDesktop = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return isClassicIOS || isIPadOSDesktop;
}

function detectSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|GSA|FBAN|FBAV|Instagram/i.test(ua);
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPromptBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Détection plateforme
    const ua = navigator.userAgent;
    const ios = detectIOSLike();
    const mac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua) && !ios;
    const safari = detectSafariBrowser();
    setIsIOS(ios);
    setIsMac(mac);
    setIsSafari(safari);

    // Vérifier si l'app est déjà installée (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) {
      return;
    }

    // Vérifier si l'utilisateur a déjà dismissé la bannière (valide 30 jours)
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        setDismissed(true);
        return;
      }
      // Expirée → effacer le flag
      localStorage.removeItem('pwa-install-dismissed');
    }

    // Écouter l'événement beforeinstallprompt (Android/Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Sur iOS/Mac Safari ou mobile sans prompt, afficher après délai
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    if ((isMobile || ios || (mac && safari)) && !dismissedAt) {
      setTimeout(() => {
        setShowBanner(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = () => {
    // Sur iOS ou Mac Safari → ouvrir le guide d'installation manuel
    if (isIOS || (isMac && isSafari)) {
      setShowIOSGuide(true);
      return;
    }

    // Android/Desktop avec beforeinstallprompt
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setShowBanner(false);
        }
        setDeferredPrompt(null);
      });
    } else {
      // Fallback: rediriger vers la page d'installation
      navigate('/install-app');
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  // Ne pas afficher si déjà installé ou dismissé
  if (!showBanner || dismissed || isStandalone) {
    return null;
  }

  // Message adapté selon la plateforme
  const getInstallMessage = () => {
    if (isIOS) {
      if (!isSafari) {
        return "Ouvrez d'abord ce lien dans Safari pour pouvoir installer l'app";
      }
      return (
        <span className="flex items-center gap-1">
          <Share className="w-4 h-4 inline" /> Partager puis "Ajouter à l'écran d'accueil"
        </span>
      );
    }
    if (isMac && isSafari) {
      return "Fichier → Ajouter au Dock";
    }
    return "Accédez plus rapidement à vos courses et commandes";
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <div className="bg-[#04439e] text-white rounded-2xl shadow-2xl p-4 border border-[#04439e]/20">
          <button
            onClick={handleDismiss}
            className="absolute -top-2 -right-2 bg-white text-gray-800 rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors"
            aria-label={t('installPromptBanner.fermer')}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="bg-white/10 p-1 rounded-xl flex-shrink-0">
              <img
                src="/icon-192.png?v=3"
                alt="224Solutions"
                className="w-10 h-10 rounded-lg"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const parent = img.parentElement;
                  if (parent) parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white m-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>';
                }}
              />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">
                Installer 224Solutions
              </h3>
              <p className="text-sm text-blue-100 mb-3">
                {getInstallMessage()}
              </p>
              <Button
                onClick={handleInstall}
                className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold"
                size="sm"
              >
                {isIOS && !isSafari
                  ? "Ouvrir les étapes Safari"
                  : (isIOS || (isMac && isSafari) ? "Voir les instructions" : "Installer maintenant")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Guide d'installation iOS/Mac */}
      <IOSInstallGuide
        open={showIOSGuide}
        onOpenChange={setShowIOSGuide}
      />
    </>
  );
}
