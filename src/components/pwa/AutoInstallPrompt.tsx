/**
 * AUTO INSTALL PROMPT - 224SOLUTIONS
 * Prompt d'installation PWA automatique et professionnel
 *
 * Fonctionnalités:
 * - Priorisation pour les vendeurs (affichage immédiat)
 * - Détection du mode hors ligne
 * - Support du mode POS local pour vendeurs
 * - Interface adaptée selon le contexte (vendeur/client/offline)
 * - Gestion avancée du localStorage avec tracking
 * - Support iOS, Android et Desktop
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { Button } from '@/components/ui/button';
import {
  Download,
  X,
  Smartphone,
  WifiOff,
  Zap,
  Bell,
  Share,
  ShieldCheck,
  Store,
  Database
} from 'lucide-react';
import IOSInstallGuide from './IOSInstallGuide';

interface AutoInstallPromptProps {
  /** Délai avant affichage en ms (défaut: 3000 pour clients) */
  delayMs?: number;
  /** Afficher uniquement sur mobile */
  mobileOnly?: boolean;
  /** Afficher pour les vendeurs uniquement */
  vendorOnly?: boolean;
  /** Callback après installation */
  onInstalled?: () => void;
  /** Callback après fermeture */
  onDismissed?: () => void;
}

// Clé de stockage local
const STORAGE_KEY = 'pwa-auto-install-prompt-v2';
// Durée avant ré-affichage après dismissal
const DISMISS_DURATION_DAYS = 7;
// Durée réduite pour vendeurs (ré-afficher plus tôt car critique)
const VENDOR_DISMISS_DURATION_DAYS = 1;
// Clé pour vérifier l'initialisation POS
const POS_STORAGE_KEY = '224solutions_pos_state';

// Structure du stockage local amélioré
interface StoredPromptData {
  dismissedAt?: string;
  installed: boolean;
  installedAt?: string;
  installType?: 'client' | 'vendor';
  lastShownContext?: 'offline' | 'normal' | 'vendor-priority';
  shownCount?: number;
}

// Lecture sécurisée du localStorage
function getStoredData(): StoredPromptData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StoredPromptData;
  } catch {
    // Si erreur de parsing, supprimer la donnée corrompue
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorer si impossible de supprimer
    }
    return null;
  }
}

// Écriture sécurisée du localStorage
function setStoredData(data: StoredPromptData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    console.warn('[AutoInstallPrompt] Impossible de sauvegarder dans localStorage');
    return false;
  }
}

// Vérifier si le POS local est initialisé
function isPOSInitialized(): boolean {
  try {
    const posData = localStorage.getItem(POS_STORAGE_KEY);
    return posData !== null;
  } catch {
    return false;
  }
}

export function AutoInstallPrompt({
  delayMs = 3000,
  mobileOnly = false,
  vendorOnly = false,
  onInstalled,
  onDismissed
}: AutoInstallPromptProps) {
  const { t } = useTranslation();
  useTranslation();

  const { profile } = useAuth();
  const { isOffline } = useOfflineStatus({ showToasts: false });
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isSafari,
    promptInstall
  } = usePWAInstall();

  const [isVisible, setIsVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [displayContext, setDisplayContext] = useState<'normal' | 'offline' | 'vendor-priority'>('normal');

  // Ref pour éviter les boucles d'affichage
  const hasShownRef = useRef(false);
  const isVendor = profile?.role === 'vendeur';
  const posInitialized = isPOSInitialized();

  // Calculer le délai effectif
  const getEffectiveDelay = useCallback(() => {
    // Vendeur: affichage immédiat
    if (isVendor) return 0;
    // Offline: affichage immédiat
    if (isOffline) return 0;
    // Client: délai max 3s
    return Math.min(delayMs, 3000);
  }, [isVendor, isOffline, delayMs]);

  // Vérifier si on doit afficher le prompt
  const shouldShowPrompt = useCallback(() => {
    // Éviter affichage multiple
    if (hasShownRef.current) return false;

    // Déjà installé (PWA détectée)
    if (isInstalled) return false;

    // Non installable (sauf iOS qui a toujours des instructions)
    if (!isInstallable && !isIOS) return false;

    // vendorOnly mais utilisateur n'est pas vendeur
    if (vendorOnly && !isVendor) return false;

    // Mobile only mais pas sur mobile
    if (mobileOnly && !(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))) {
      return false;
    }

    // Vérifier le stockage local
    const stored = getStoredData();
    if (stored) {
      // Déjà installé selon notre tracking
      if (stored.installed) return false;

      // Vérifier le délai de ré-affichage
      if (stored.dismissedAt) {
        const dismissDate = new Date(stored.dismissedAt);
        const now = new Date();
        const daysSinceDismiss = (now.getTime() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);

        // Délai différent selon le type d'utilisateur
        const dismissDuration = isVendor ? VENDOR_DISMISS_DURATION_DAYS : DISMISS_DURATION_DAYS;

        // Exception: si hors ligne et vendeur, afficher quand même
        if (isOffline && isVendor) {
          return true;
        }

        if (daysSinceDismiss < dismissDuration) {
          return false;
        }
      }
    }

    return true;
  }, [isInstalled, isInstallable, isIOS, mobileOnly, vendorOnly, isVendor, isOffline]);

  // Déterminer le contexte d'affichage
  const determineContext = useCallback(() => {
    if (isOffline) return 'offline';
    if (isVendor) return 'vendor-priority';
    return 'normal';
  }, [isOffline, isVendor]);

  // Effet pour afficher le prompt
  useEffect(() => {
    if (!shouldShowPrompt()) return;

    const effectiveDelay = getEffectiveDelay();
    const context = determineContext();

    const timer = setTimeout(() => {
      hasShownRef.current = true;
      setDisplayContext(context);
      setIsVisible(true);

      // Mettre à jour le compteur d'affichage
      const stored = getStoredData() || { installed: false };
      setStoredData({
        ...stored,
        lastShownContext: context,
        shownCount: (stored.shownCount || 0) + 1
      });
    }, effectiveDelay);

    return () => clearTimeout(timer);
  }, [shouldShowPrompt, getEffectiveDelay, determineContext]);

  // Effet pour écouter les changements de connexion
  useEffect(() => {
    if (isInstalled || hasShownRef.current) return;

    // Si on passe offline et qu'on n'a pas encore affiché
    if (isOffline && !isVisible && shouldShowPrompt()) {
      hasShownRef.current = true;
      setDisplayContext('offline');
      setIsVisible(true);
    }
  }, [isOffline, isInstalled, isVisible, shouldShowPrompt]);

  // Gérer l'installation
  const handleInstall = async () => {
    if (isIOS || (isSafari && /Mac/i.test(navigator.userAgent))) {
      // Sur iOS, masquer le prompt principal et ouvrir directement le guide immersif
      setIsVisible(false);
      setShowIOSGuide(true);
      return;
    }

    setIsInstalling(true);

    try {
      const accepted = await promptInstall();

      if (accepted) {
        setStoredData({
          installed: true,
          installedAt: new Date().toISOString(),
          installType: isVendor ? 'vendor' : 'client',
          lastShownContext: displayContext
        });

        setIsVisible(false);
        onInstalled?.();
      }
    } catch (error) {
      console.error('[AutoInstallPrompt] Erreur installation:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  // Gérer la fermeture
  const handleDismiss = () => {
    const stored = getStoredData() || { installed: false };
    setStoredData({
      ...stored,
      dismissedAt: new Date().toISOString(),
      installed: false,
      installType: isVendor ? 'vendor' : 'client',
      lastShownContext: displayContext
    });

    setIsVisible(false);
    onDismissed?.();
  };

  // Gérer la fermeture du guide iOS
  const handleIOSGuideClose = () => {
    setShowIOSGuide(false);
    const stored = getStoredData() || { installed: false };
    setStoredData({
      ...stored,
      dismissedAt: new Date().toISOString(),
      installed: false,
      installType: isVendor ? 'vendor' : 'client',
      lastShownContext: displayContext
    });
    setIsVisible(false);
  };

  // Message principal selon le contexte
  const getMainMessage = () => {
    if (isVendor && !posInitialized) {
      return "Installez l'application pour activer le mode caisse hors ligne.";
    }
    if (displayContext === 'offline') {
      return "Installez l'application pour continuer à travailler hors connexion.";
    }
    if (isVendor) {
      return "Installez l'application pour gérer vos ventes même sans internet.";
    }
    return "Installez l'application pour une meilleure expérience.";
  };

  // Titre selon le contexte
  const getTitle = () => {
    if (isVendor) return "Mode Caisse POS";
    return "Installer 224Solutions";
  };

  // Sous-titre selon le contexte
  const getSubtitle = () => {
    if (displayContext === 'offline') return "Accès hors ligne requis";
    if (isVendor) return "Application vendeur";
    return "Application gratuite";
  };

  if (!isVisible && !showIOSGuide) return null;

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleDismiss();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header gradient - couleur selon contexte */}
              <div className={`p-6 text-white ${
                displayContext === 'offline'
                  ? 'bg-[#ff4000]'
                  : isVendor
                    ? 'bg-[#ff4000]'
                    : 'bg-[#04439e]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
                      {displayContext === 'offline' ? (
                        <WifiOff className="w-8 h-8" />
                      ) : isVendor ? (
                        <Store className="w-8 h-8" />
                      ) : (
                        <img
                          src="/icon-192.png?v=3"
                          alt="224Solutions"
                          className="w-14 h-14"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                            if (img.parentElement) {
                              img.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>';
                            }
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{getTitle()}</h2>
                      <p className={`text-sm ${
                        displayContext === 'offline'
                          ? 'text-orange-100'
                          : isVendor
                            ? 'text-orange-100'
                            : 'text-blue-100'
                      }`}>
                        {getSubtitle()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    aria-label={t('autoInstallPrompt.fermer')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-4">
                <p className="text-gray-600 dark:text-gray-300 text-center font-medium">
                  {getMainMessage()}
                </p>

                {/* Alerte POS non initialisé pour vendeurs */}
                {isVendor && !posInitialized && (
                  <div className="bg-orange-50 dark:bg-[#ff4000]/30 border border-orange-200 dark:border-[#ff4000] rounded-lg p-3">
                    <p className="text-sm text-[#ff4000] dark:text-orange-200 flex items-center gap-2">
                      <Database className="w-4 h-4 flex-shrink-0" />
                      <span>{t('autoInstallPrompt.laBaseDeDonneesLocale')}</span>
                    </p>
                  </div>
                )}

                {/* Avantages - adaptés selon le contexte */}
                <div className="grid grid-cols-2 gap-3">
                  {isVendor ? (
                    // Avantages vendeur
                    <>
                      <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-[#ff4000]/30 rounded-lg">
                        <Store className="w-5 h-5 text-[#ff4000] dark:text-[#ff4000]" />
                        <span className="text-sm font-medium">Caisse POS</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <WifiOff className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium">Ventes offline</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-[#04439e]/30 rounded-lg">
                        <Database className="w-5 h-5 text-[#04439e] dark:text-[#04439e]" />
                        <span className="text-sm font-medium">Sync auto</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                        <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm font-medium">Performance</span>
                      </div>
                    </>
                  ) : (
                    // Avantages client
                    <>
                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <WifiOff className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium">Mode hors ligne</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-[#ff4000]/30 rounded-lg">
                        <Zap className="w-5 h-5 text-[#ff4000] dark:text-[#ff4000]" />
                        <span className="text-sm font-medium">Plus rapide</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-[#04439e]/30 rounded-lg">
                        <Bell className="w-5 h-5 text-[#04439e] dark:text-[#04439e]" />
                        <span className="text-sm font-medium">Notifications</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                        <Smartphone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm font-medium">{t('autoInstallPrompt.accesDirect')}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Instructions iOS */}
                {isIOS && (
                  <div className="bg-orange-50 dark:bg-[#ff4000]/30 border border-orange-200 dark:border-[#ff4000] rounded-lg p-4">
                    <p className="text-sm text-[#ff4000] dark:text-orange-200 flex items-center gap-2">
                      <Share className="w-4 h-4" />
                      Appuyez sur <strong>Partager</strong> puis <strong>{t('autoInstallPrompt.surLEcranDAccueil')}</strong>
                    </p>
                  </div>
                )}

                {/* Boutons */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className={`w-full h-12 text-base font-semibold ${
                      isVendor
                        ? 'bg-[#ff4000] hover:bg-[#ce3d11]'
                        : 'bg-[#04439e]'
                    }`}
                  >
                    {isInstalling ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        >
                          <Download className="w-5 h-5 mr-2" />
                        </motion.div>
                        Installation...
                      </>
                    ) : isIOS ? (
                      <>
                        <Share className="w-5 h-5 mr-2" />
                        Voir les instructions
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 mr-2" />
                        {isVendor ? 'Activer le mode POS' : 'Installer maintenant'}
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={handleDismiss}
                    className="w-full text-gray-500"
                  >
                    {isVendor ? 'Plus tard' : 'Continuer sur le navigateur'}
                  </Button>
                </div>

                {/* Note de sécurité - corrigée */}
                <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Installation rapide et sécurisée pour utilisation hors ligne.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guide iOS */}
      <IOSInstallGuide
        open={showIOSGuide}
        onOpenChange={handleIOSGuideClose}
      />
    </>
  );
}

export default AutoInstallPrompt;
