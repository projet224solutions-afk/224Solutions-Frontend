/**
 * PWA DIAGNOSTIC TOOL
 * Outil de diagnostic complet pour l'installation PWA
 * 224SOLUTIONS
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, AlertCircle, Wifi, WifiOff,
  Download, Smartphone, Monitor, RefreshCw, Shield, Database, Globe
} from "lucide-react";
import { toast } from "sonner";

interface DiagnosticItem {
  label: string;
  status: 'success' | 'error' | 'warning' | 'loading';
  message: string;
  icon: React.ReactNode;
}

export default function PWADiagnostic() {
  const { t } = useTranslation();
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [_swStatus, setSwStatus] = useState<string>('checking');
  const [_cacheStatus, setCacheStatus] = useState<{ cached: number; size: string } | null>(null);

  // Écouter l'événement d'installation PWA
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Vérifier si déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Exécuter le diagnostic
  const runDiagnostic = async () => {
    setIsRunning(true);
    const results: DiagnosticItem[] = [];

    // 1. Vérifier HTTPS
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    results.push({
      label: t('pWADiagnostic.connexionSecuriseeHttps'),
      status: isSecure ? 'success' : 'error',
      message: isSecure ? 'HTTPS actif' : 'HTTPS requis pour PWA',
      icon: <Shield className="w-4 h-4" />
    });

    // 2. Vérifier Service Worker
    let swRegistered = false;
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        swRegistered = !!registration;
        setSwStatus(registration ? 'active' : 'not-registered');

        results.push({
          label: t('pWADiagnostic.serviceWorker'),
          status: swRegistered ? 'success' : 'error',
          message: swRegistered
            ? `Actif (${registration?.active?.state || 'installed'})`
            : 'Non enregistré',
          icon: <Database className="w-4 h-4" />
        });

        // Vérifier les caches
        if (swRegistered) {
          const cacheNames = await caches.keys();
          const _totalSize = 0;
          let cachedCount = 0;

          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            cachedCount += keys.length;
          }

          setCacheStatus({ cached: cachedCount, size: `${cacheNames.length} caches` });

          results.push({
            label: 'Cache offline',
            status: cachedCount > 0 ? 'success' : 'warning',
            message: `${cachedCount} ressources en cache`,
            icon: <Database className="w-4 h-4" />
          });
        }
      } catch (_error) {
        results.push({
          label: t('pWADiagnostic.serviceWorker'),
          status: 'error',
          message: t('pWADiagnostic.erreurLorsDeLaVerification'),
          icon: <Database className="w-4 h-4" />
        });
      }
    } else {
      results.push({
        label: t('pWADiagnostic.serviceWorker'),
        status: 'error',
        message: t('pWADiagnostic.nonSupporteParCeNavigateur'),
        icon: <Database className="w-4 h-4" />
      });
    }

    // 3. Vérifier le Manifest
    try {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        const manifestUrl = manifestLink.getAttribute('href');
        const response = await fetch(manifestUrl || '/manifest.webmanifest');
        const manifest = await response.json();

        const hasRequiredFields = manifest.name && manifest.icons?.length > 0 && manifest.start_url;

        results.push({
          label: 'Manifest PWA',
          status: hasRequiredFields ? 'success' : 'warning',
          message: hasRequiredFields
            ? `${manifest.short_name || manifest.name}`
            : 'Champs requis manquants',
          icon: <Globe className="w-4 h-4" />
        });
      } else {
        results.push({
          label: 'Manifest PWA',
          status: 'error',
          message: t('pWADiagnostic.manifestNonTrouve'),
          icon: <Globe className="w-4 h-4" />
        });
      }
    } catch (_error) {
      results.push({
        label: 'Manifest PWA',
        status: 'error',
        message: 'Erreur chargement manifest',
        icon: <Globe className="w-4 h-4" />
      });
    }

    // 4. Vérifier la connectivité
    const isOnline = navigator.onLine;
    results.push({
      label: t('pWADiagnostic.connexionInternet'),
      status: isOnline ? 'success' : 'warning',
      message: isOnline ? 'En ligne' : 'Hors ligne',
      icon: isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />
    });

    // 5. Vérifier l'installabilité
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInFrame = window.top !== window.self;

    if (isStandalone) {
      results.push({
        label: 'Mode d\'affichage',
        status: 'success',
        message: t('pWADiagnostic.applicationInstalleeStandalone'),
        icon: <Smartphone className="w-4 h-4" />
      });
    } else if (isInFrame) {
      results.push({
        label: 'Mode d\'affichage',
        status: 'warning',
        message: t('pWADiagnostic.dansUnIframeOuvrezDans'),
        icon: <Monitor className="w-4 h-4" />
      });
    } else {
      results.push({
        label: 'Mode d\'affichage',
        status: isInstallable ? 'success' : 'warning',
        message: isInstallable ? 'Installation disponible' : 'Navigateur standard',
        icon: <Monitor className="w-4 h-4" />
      });
    }

    // 6. Vérifier IndexedDB
    try {
      const _testDB = await new Promise((resolve, reject) => {
        const request = indexedDB.open('pwa-diagnostic-test', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          indexedDB.deleteDatabase('pwa-diagnostic-test');
          resolve(true);
        };
      });

      results.push({
        label: 'Stockage IndexedDB',
        status: 'success',
        message: t('pWADiagnostic.disponiblePourDonneesOffline'),
        icon: <Database className="w-4 h-4" />
      });
    } catch (_error) {
      results.push({
        label: 'Stockage IndexedDB',
        status: 'error',
        message: 'Non disponible',
        icon: <Database className="w-4 h-4" />
      });
    }

    // 7. Vérifier le navigateur
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isEdge = /Edge|Edg/.test(navigator.userAgent);

    let browserName = 'Inconnu';
    let browserSupport: 'success' | 'warning' | 'error' = 'warning';

    if (isChrome) { browserName = 'Chrome'; browserSupport = 'success'; }
    else if (isEdge) { browserName = 'Edge'; browserSupport = 'success'; }
    else if (isSafari) { browserName = 'Safari'; browserSupport = 'warning'; }
    else if (isFirefox) { browserName = 'Firefox'; browserSupport = 'warning'; }

    results.push({
      label: 'Navigateur',
      status: browserSupport,
      message: `${browserName} - ${browserSupport === 'success' ? 'Support complet' : 'Support partiel'}`,
      icon: <Globe className="w-4 h-4" />
    });

    setDiagnostics(results);
    setIsRunning(false);
  };

  // Installer la PWA
  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.error("L'installation n'est pas disponible", {
        description: t('pWADiagnostic.essayezDOuvrirLApp')
      });
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        toast.success(t('pWADiagnostic.installationReussie'));
        setIsInstallable(false);
      } else {
        toast.info(t('pWADiagnostic.installationAnnulee'));
      }

      setDeferredPrompt(null);
    } catch (error) {
      console.error('Erreur installation:', error);
      toast.error(t('pWADiagnostic.erreurLorsDeLInstallation'));
    }
  };

  // Forcer la mise en cache pour le mode offline
  const forceCacheResources = async () => {
    try {
      toast.info("Mise en cache en cours...");

      // Ouvrir le cache dynamique
      const cache = await caches.open('224solutions-dynamic-v6');

      // Liste des ressources essentielles à mettre en cache
      const essentialUrls = [
        '/',
        '/vendeur',
        '/vendeur/dashboard',
        '/vendeur/products',
        '/vendeur/orders',
        '/vendeur/pos',
        '/manifest.webmanifest',
        '/favicon.png',
        '/icon-192.png',
        '/icon-512.png'
      ];

      let cached = 0;
      for (const url of essentialUrls) {
        try {
          const response = await fetch(url, { cache: 'reload' });
          if (response.ok) {
            await cache.put(url, response);
            cached++;
          }
        } catch (_e) {
          console.warn(`Impossible de mettre en cache: ${url}`);
        }
      }

      toast.success(`✅ ${cached} ressources mises en cache`, {
        description: t('pWADiagnostic.leModeOfflineEstMaintenant')
      });

      // Relancer le diagnostic
      runDiagnostic();
    } catch (error) {
      console.error('Erreur mise en cache:', error);
      toast.error(t('pWADiagnostic.erreurLorsDeLaMise'));
    }
  };

  // Réinitialiser le Service Worker
  const resetServiceWorker = async () => {
    try {
      toast.info(t('pWADiagnostic.reinitialisationEnCours'));

      // Supprimer tous les caches
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // Désenregistrer le SW
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));

      toast.success(t('pWADiagnostic.serviceWorkerReinitialise'), {
        description: t('pWADiagnostic.rechargezLaPagePourReactiver')
      });

      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Erreur réinitialisation:', error);
      toast.error(t('pWADiagnostic.erreurLorsDeLaReinitialisation'));
    }
  };

  // Lancer le diagnostic au montage
  useEffect(() => {
    runDiagnostic();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-[#ff4000]" />;
      case 'error': return <XCircle className="w-5 h-5 text-[#ff4000]" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-[#ff4000]" />;
      case 'loading': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'success': return 'bg-orange-100 text-[#ff4000]';
      case 'error': return 'bg-orange-100 text-[#ff4000]';
      case 'warning': return 'bg-orange-100 text-[#ff4000]';
      case 'loading': return 'bg-blue-100 text-blue-800';
    }
  };

  const successCount = diagnostics.filter(d => d.status === 'success').length;
  const errorCount = diagnostics.filter(d => d.status === 'error').length;
  const overallStatus = errorCount > 0 ? 'error' : successCount === diagnostics.length ? 'success' : 'warning';

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-[#04439e] text-white rounded-t-lg">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Diagnostic PWA
          </span>
          <Badge className={`${
            overallStatus === 'success' ? 'bg-[#ff4000]' :
            overallStatus === 'error' ? 'bg-[#ff4000]' : 'bg-[#ff4000]'
          } text-white`}>
            {successCount}/{diagnostics.length} OK
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Résultats du diagnostic */}
        <div className="space-y-3">
          {diagnostics.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(item.status)}>
                  {item.message}
                </Badge>
                {getStatusIcon(item.status)}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button
            onClick={runDiagnostic}
            variant="outline"
            disabled={isRunning}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            Relancer
          </Button>

          {isInstallable && (
            <Button onClick={handleInstall} className="bg-[#ff4000] hover:bg-[#ff4000]">
              <Download className="w-4 h-4 mr-2" />
              Installer l'app
            </Button>
          )}

          <Button onClick={forceCacheResources} variant="secondary">
            <Database className="w-4 h-4 mr-2" />
            Forcer le cache offline
          </Button>

          <Button onClick={resetServiceWorker} variant="destructive">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réinitialiser SW
          </Button>
        </div>

        {/* Instructions */}
        {errorCount > 0 && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="font-semibold text-[#ff4000] mb-2">
              ⚠️ Actions recommandées
            </h4>
            <ul className="text-sm text-[#ff4000] space-y-1">
              {diagnostics.find(d => d.label === 'Service Worker' && d.status !== 'success') && (
                <li>{t('pWADiagnostic.rechargezLaPagePourActiver')}</li>
              )}
              {!navigator.onLine && (
                <li>{t('pWADiagnostic.connectezVousAInternetPour')}</li>
              )}
              {window.top !== window.self && (
                <li>{t('pWADiagnostic.ouvrezLApplicationDansUn')}</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
