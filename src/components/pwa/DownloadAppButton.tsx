import { useTranslation } from "@/hooks/useTranslation";
/**
 * COMPOSANT: DownloadAppButton
 * Bouton d'installation PWA simplifié
 * Version: 5.0 - Installation PWA uniquement (sans APK/EXE externes)
 */

import { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, Share, MoreVertical, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';

interface DownloadAppButtonProps {
  variant?: 'default' | 'compact' | 'banner';
  className?: string;
}

export function DownloadAppButton({ variant = 'default', className = '' }: DownloadAppButtonProps) {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  useEffect(() => {
    const ua = navigator.userAgent;
    const mobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    const inApp = /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|wv)/i.test(ua);

    setIsMobile(mobile);
    setIsIOS(ios);
    setIsInIframe(inIframe);
    setIsInAppBrowser(inApp);
  }, []);

  const openForInstall = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('pwa', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      // 0) PWA install bloqué en iframe / webview
      if (isInIframe || isInAppBrowser) {
        toast.info(t('downloadAppButton.ouvrirDansLeNavigateurPour'), {
          description: isInAppBrowser
            ? 'Ouvrez ce lien dans Chrome/Safari (les navigateurs intégrés bloquent l’installation).'
            : "Ouvrez l'application dans un nouvel onglet pour installer.",
          duration: 7000,
        });
        openForInstall();
        setShowDialog(false);
        return;
      }

      // 1) En preview Lovable: activer le SW pour rendre l'app installable
      const isLovablePreview = window.location.hostname.includes('lovableproject.com');
      const pwaPreviewEnabled = window.localStorage.getItem('enable_pwa_preview') === '1';
      if (!isInstallable && isLovablePreview && !pwaPreviewEnabled) {
        window.localStorage.setItem('enable_pwa_preview', '1');
        const url = new URL(window.location.href);
        url.searchParams.set('pwa', '1');
        toast.info(t('downloadAppButton.activationDeLInstallation'), {
          description: t('downloadAppButton.rechargeEnCoursPourActiver'),
          duration: 4000,
        });
        window.location.replace(url.toString());
        return;
      }

      // 2) Installation PWA native
      if (isInstallable) {
        const success = await promptInstall();
        if (success) {
          toast.success(t('downloadAppButton.applicationInstallee'), {
            description: t('downloadAppButton.t224solutionsEstMaintenantSurVotre'),
          });
          setShowDialog(false);
          return;
        }
      }

      // 3) Instructions manuelles
      setShowDialog(false);

      if (isIOS) {
        toast.info('Installation sur iPhone/iPad', {
          description: t('downloadAppButton.appuyezSurPartagerPuisSur'),
          duration: 8000,
        });
      } else if (isMobile) {
        toast.info(t('downloadAppButton.installationSurAndroid'), {
          description: t('downloadAppButton.menuInstallerLApplicationOu'),
          duration: 8000,
        });
      } else {
        toast.info(t('downloadAppButton.installationSurOrdinateur'), {
          description: t('downloadAppButton.cliquezSurLIconeD'),
          duration: 8000,
        });
      }
    } finally {
      setIsInstalling(false);
    }
  };

  // Si déjà installé, ne rien afficher
  if (isInstalled) {
    return null;
  }

  // Variant Banner
  if (variant === 'banner') {
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-4 shadow-lg ${className}`}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile ? <Smartphone className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
            <div>
              <p className="font-semibold">Installez 224Solutions</p>
              <p className="text-sm opacity-90">{t('downloadAppButton.accesRapideDepuisLEcran')}</p>
            </div>
          </div>
          <Button onClick={() => setShowDialog(true)} variant="secondary" className="gap-2">
            <Download className="w-4 h-4" />
            Installer
          </Button>
        </div>

        <InstallDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          onInstall={handleInstall}
          isInstalling={isInstalling}
          isInstallable={isInstallable}
          isMobile={isMobile}
          isIOS={isIOS}
        />
      </div>
    );
  }

  // Variant Compact
  if (variant === 'compact') {
    return (
      <>
        <Button onClick={() => setShowDialog(true)} variant="outline" size="sm" className={`gap-2 ${className}`}>
          <Download className="w-4 h-4" />
          Installer l'app
        </Button>
        <InstallDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          onInstall={handleInstall}
          isInstalling={isInstalling}
          isInstallable={isInstallable}
          isMobile={isMobile}
          isIOS={isIOS}
        />
      </>
    );
  }

  // Variant Default (carte)
  return (
    <>
      <div className={`bg-primary rounded-xl p-6 text-primary-foreground shadow-lg ${className}`}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Download className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">Installer 224Solutions</h3>
            <p className="text-sm opacity-90">{t('downloadAppButton.accesRapideDepuisVotreEcran')}</p>
          </div>
          <Button onClick={() => setShowDialog(true)} variant="secondary" size="lg" className="gap-2">
            <Download className="w-5 h-5" />
            Installer
          </Button>
        </div>
      </div>

      <InstallDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onInstall={handleInstall}
        isInstalling={isInstalling}
        isInstallable={isInstallable}
        isMobile={isMobile}
        isIOS={isIOS}
      />
    </>
  );
}

// Dialog d'installation
interface InstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => Promise<void>;
  isInstalling: boolean;
  isInstallable: boolean;
  isMobile: boolean;
  isIOS: boolean;
}

function InstallDialog({
  open,
  onOpenChange,
  onInstall,
  isInstalling,
  isInstallable,
  isMobile,
  isIOS,
}: InstallDialogProps) {
  const { t } = useTranslation();
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const inApp = /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|wv)/i.test(navigator.userAgent);

  const getInstructions = () => {
    if (inIframe || inApp) {
      return (
        <div className="space-y-2">
          <p className="font-medium">Important :</p>
          <p className="text-sm">
            L’installation PWA est bloquée dans un aperçu / navigateur intégré.
            Ouvrez ce lien dans <span className="font-semibold">Chrome</span> {t('downloadAppButton.androidOu')} <span className="font-semibold">Safari</span> (iOS).
          </p>
        </div>
      );
    }

    if (isInstallable) {
      return (
        <div className="flex items-center gap-2 text-[#ff4000]">
          <CheckCircle2 className="w-5 h-5" />
          <span>Installation automatique disponible</span>
        </div>
      );
    }

    if (isIOS) {
      return (
        <div className="space-y-2">
          <p className="font-medium">Sur iPhone/iPad :</p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
              Appuyez sur <Share className="inline w-4 h-4" /> (Partager)
            </p>
            <p className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
              Faites défiler et appuyez "Sur l'écran d'accueil"
            </p>
            <p className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
              Appuyez sur "Ajouter"
            </p>
          </div>
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-2">
          <p className="font-medium">{t('downloadAppButton.surAndroid')}</p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
              Appuyez sur <MoreVertical className="inline w-4 h-4" /> (menu en haut à droite)
            </p>
            <p className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
              "Installer l'application" ou "Ajouter à l'écran d'accueil"
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="font-medium">{t('downloadAppButton.surOrdinateur')}</p>
        <p className="text-sm">{t('downloadAppButton.cliquezSurLIconeD')}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary" />
            Installer 224Solutions
          </DialogTitle>
          <DialogDescription>
            Installez l'application pour un accès rapide depuis votre écran d'accueil
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Instructions */}
          <div className="p-4 border rounded-lg bg-muted/50">
            {getInstructions()}
          </div>

          {/* Avantages */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
              <span className="text-lg">⚡</span>
              <span>Plus rapide</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
              <span className="text-lg">📴</span>
              <span>Hors-ligne</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
              <span className="text-lg">🔔</span>
              <span>Notifications</span>
            </div>
          </div>

          {/* Bouton d'installation */}
          <Button onClick={onInstall} className="w-full" size="lg" disabled={isInstalling}>
            {isInstalling ? (
              'Installation en cours...'
            ) : inIframe || inApp ? (
              'Ouvrir pour installer'
            ) : isInstallable ? (
              <>
                <Download className="w-4 h-4 mr-2" />
                Installer maintenant
              </>
            ) : (
              'Compris'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DownloadAppButton;
