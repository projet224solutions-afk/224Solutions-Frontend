/**
 * Guide d'installation PWA iOS - Style natif immersif
 * Overlay plein écran avec flèche animée pointant vers le bouton Share de Safari
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { motion, AnimatePresence } from 'framer-motion';
import { Share, Plus, X, Check, ArrowDown, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IOSInstallGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IOSInstallGuide({ open, onOpenChange }: IOSInstallGuideProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [isSafari, setIsSafari] = useState(true);
  const [isIPad, setIsIPad] = useState(false);

  const openInSafari = async () => {
    const current = window.location.href;
    // Schéma iOS pour ouvrir Safari depuis un autre navigateur/app
    const safariUrl = current.startsWith('https://')
      ? current.replace('https://', 'x-safari-https://')
      : current;

    try {
      window.location.href = safariUrl;
      // Si le schéma n'est pas supporté, proposer la copie du lien
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText(current);
        } catch {
          // Rien: le texte reste visible dans l'UI
        }
      }, 600);
    } catch {
      try {
        await navigator.clipboard.writeText(current);
      } catch {
        // Ignore clipboard failures silently
      }
    }
  };

  useEffect(() => {
    const ua = navigator.userAgent;
    const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|GSA|FBAN|FBAV|Instagram/i.test(ua);
    const ipad = /iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
    setIsSafari(safari);
    setIsIPad(ipad);
  }, []);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  // Si pas Safari → message "ouvrir dans Safari"
  if (!isSafari) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-2xl"
          >
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto">
              <Smartphone className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t('iOSInstallGuide.ouvrezDansSafari')}</h2>
            <p className="text-muted-foreground text-sm">
              L'installation iOS ne fonctionne que depuis <strong>Safari</strong>. Depuis Google/Chrome iOS, ouvrez d'abord ce lien dans Safari.
            </p>
            <Button
              onClick={openInSafari}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Ouvrir dans Safari
            </Button>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  const btn = document.getElementById('copy-btn-text');
                  if (btn) btn.textContent = 'Copié ✓';
                  setTimeout(() => { if (btn) btn.textContent = 'Copier le lien'; }, 2000);
                } catch {
                  const btn = document.getElementById('copy-btn-text');
                  if (btn) btn.textContent = 'Copie impossible';
                }
              }}
              variant="outline"
              className="w-full h-12 font-semibold"
            >
              <span id="copy-btn-text">{t('iOSInstallGuide.copierLeLien')}</span>
            </Button>
            <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:underline">
              Fermer
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const steps = [
    {
      // Étape 0 : Flèche vers le bouton Share
      render: () => (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col"
          onClick={() => setStep(1)}
        >
          {/* Overlay semi-transparent en haut */}
          <div className="flex-1 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center px-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
            >
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <img src="/icon-192.png?v=3" alt="224Solutions" className="w-12 h-12 rounded-xl" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }} />
              </div>
              <h2 className="text-xl font-bold text-foreground">Installer 224Solutions</h2>
              <p className="text-muted-foreground text-sm">
                Appuyez sur le bouton <strong>Partager</strong> en bas de votre écran
              </p>

              {/* Icône Share stylisée */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                  <Share className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Flèche animée pointant vers le bas (vers le bouton Share de Safari) */}
          <div className={`bg-black/70 ${isIPad ? 'pb-4' : 'pb-16'} pt-4 flex flex-col items-center`}>
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              className="flex flex-col items-center"
            >
              <ArrowDown className="w-10 h-10 text-white" />
              <span className="text-white text-xs font-medium mt-1">Appuyez ici</span>
            </motion.div>
          </div>

          {/* Bouton fermer discret */}
          <button
            onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
            className="absolute top-12 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </motion.div>
      ),
    },
    {
      // Étape 1 : "Sur l'écran d'accueil"
      render: () => (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setStep(2)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-2xl"
          >
            {/* Simulation du menu partager iOS */}
            <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700 rounded-xl border-2 border-blue-500 shadow-md">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">{t('iOSInstallGuide.surLEcranDAccueil')}</p>
                  <p className="text-xs text-muted-foreground">{t('iOSInstallGuide.ajouterALEcranD')}</p>
                </div>
                <motion.div
                  animate={{ x: [-4, 4, -4] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="ml-auto"
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                </motion.div>
              </div>

              {/* Faux éléments du menu */}
              <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-700/60 rounded-xl opacity-40">
                <div className="w-10 h-10 bg-gray-300 dark:bg-slate-600 rounded-lg" />
                <div className="h-3 w-24 bg-gray-200 dark:bg-slate-600 rounded" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-700/60 rounded-xl opacity-30">
                <div className="w-10 h-10 bg-gray-300 dark:bg-slate-600 rounded-lg" />
                <div className="h-3 w-20 bg-gray-200 dark:bg-slate-600 rounded" />
              </div>
            </div>

            <p className="text-muted-foreground text-sm">
              Faites défiler et appuyez sur <strong>{t('iOSInstallGuide.surLEcranDAccueil2')}</strong>
            </p>

            <Button
              onClick={() => setStep(2)}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Suivant
            </Button>
          </motion.div>

          <button
            onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
            className="absolute top-12 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </motion.div>
      ),
    },
    {
      // Étape 2 : Confirmation "Ajouter"
      render: () => (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-2xl"
          >
            {/* Simulation de la confirmation iOS */}
            <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <button className="text-blue-600 text-sm font-medium">{t('iOSInstallGuide.annuler')}</button>
                <p className="font-semibold text-sm text-foreground">{t('iOSInstallGuide.ajouterALEcran')}</p>
                <motion.button
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-blue-600 text-sm font-bold px-3 py-1 bg-blue-100 dark:bg-blue-900/40 rounded-lg"
                >
                  Ajouter
                </motion.button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700 rounded-xl">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow">
                  <img src="/icon-192.png?v=3" alt="" className="w-10 h-10 rounded-lg" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">224Solutions</p>
                  <p className="text-xs text-muted-foreground truncate">224solution.net</p>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-sm">
              Appuyez sur <strong>{t('iOSInstallGuide.ajouter')}</strong> en haut à droite
            </p>

            <Button
              onClick={() => onOpenChange(false)}
              className="w-full h-12 bg-[#ff4000] hover:bg-[#ff4000] text-white font-semibold"
            >
              <Check className="w-5 h-5 mr-2" />
              Compris !
            </Button>
          </motion.div>

          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-12 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </motion.div>
      ),
    },
  ];

  return (
    <AnimatePresence mode="wait">
      {steps[step]?.render()}
    </AnimatePresence>
  );
}

export default IOSInstallGuide;
