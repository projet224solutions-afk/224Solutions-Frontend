/**
 * HOOK FIREBASE CLOUD MESSAGING
 * Gestion des notifications push FCM dans les composants React
 * 224SOLUTIONS
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import firebaseMessaging from '@/lib/firebaseMessaging';
import { toast } from 'sonner';

export interface FCMStatus {
  isSupported: boolean;
  isEnabled: boolean;
  permission: NotificationPermission;
  token: string | null;
  isLoading: boolean;
}

export function useFirebaseMessaging() {
  const { user } = useAuth();
  const [status, setStatus] = useState<FCMStatus>({
    isSupported: false,
    isEnabled: false,
    permission: 'default',
    token: null,
    isLoading: true
  });

  // Initialisation au montage
  useEffect(() => {
    const init = async () => {
      // Plateforme native (Capacitor) → push natif FCM (réveille même app fermée)
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          setStatus(prev => ({ ...prev, isSupported: true, isLoading: false }));
          if (user) {
            const { registerNativePush } = await import('@/lib/nativePush');
            await registerNativePush();
            setStatus(prev => ({ ...prev, isEnabled: true, permission: 'granted' }));
          }
          return; // ne pas exécuter le chemin web
        }
      } catch { /* @capacitor/core indisponible → chemin web */ }

      // Vérifier le support (web)
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator;

      setStatus(prev => ({
        ...prev,
        isSupported,
        permission: isSupported ? Notification.permission : 'denied',
        isLoading: false
      }));

      // Si l'utilisateur est connecté et les notifications sont autorisées
      if (user && isSupported && Notification.permission === 'granted') {
        const initialized = await firebaseMessaging.initializeMessaging();
        if (initialized) {
          const token = await firebaseMessaging.requestNotificationPermission();
          setStatus(prev => ({
            ...prev,
            isEnabled: token !== null,
            token
          }));
        }
      }
    };

    init();
  }, [user]);

  // Envoyer la config Firebase au service worker
  useEffect(() => {
    const sendConfigToSW = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;

          // Récupérer la config Firebase via Supabase edge function
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: config, error } = await supabase.functions.invoke('firebase-config');

          if (!error && config && config.configured) {
            registration.active?.postMessage({
              type: 'FIREBASE_CONFIG',
              config: {
                apiKey: config.apiKey,
                authDomain: config.authDomain,
                projectId: config.projectId,
                storageBucket: config.storageBucket,
                messagingSenderId: config.messagingSenderId,
                appId: config.appId
              }
            });
            console.log('✅ Config Firebase envoyée au Service Worker');
          }
        } catch (error) {
          console.warn('Impossible d\'envoyer la config au SW:', error);
        }
      }
    };

    if (status.isEnabled) {
      sendConfigToSW();
    }
  }, [status.isEnabled]);

  /**
   * Demande la permission et active les notifications
   */
  const enableNotifications = useCallback(async () => {
    console.log('[Hook FCM] 🔔 enableNotifications appelé');

    if (!status.isSupported) {
      console.warn('[Hook FCM] Notifications non supportées');
      toast.error('Les notifications ne sont pas supportées sur ce navigateur');
      return false;
    }

    setStatus(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('[Hook FCM] 🚀 Initialisation Firebase Messaging...');
      // Initialiser Firebase Messaging (silencieux si non configuré)
      const initialized = await firebaseMessaging.initializeMessaging();
      console.log('[Hook FCM] Initialized:', initialized);

      if (!initialized) {
        console.log('Firebase Messaging non configuré - utilisation des notifications locales');
        setStatus(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      console.log('[Hook FCM] 📢 Demande permission...');
      // Demander la permission et obtenir le token
      const token = await firebaseMessaging.requestNotificationPermission();

      if (token) {
        setStatus(prev => ({
          ...prev,
          isEnabled: true,
          permission: 'granted',
          token,
          isLoading: false
        }));
        toast.success('🔔 Notifications activées');
        return true;
      } else {
        setStatus(prev => ({
          ...prev,
          permission: Notification.permission,
          isLoading: false
        }));

        if (Notification.permission === 'denied') {
          toast.error('Les notifications sont bloquées. Activez-les dans les paramètres du navigateur.');
        }
        return false;
      }
    } catch (error) {
      console.error('Erreur activation notifications:', error);
      setStatus(prev => ({ ...prev, isLoading: false }));
      toast.error('Erreur lors de l\'activation des notifications');
      return false;
    }
  }, [status.isSupported]);

  /**
   * Désactive les notifications
   */
  const disableNotifications = useCallback(async () => {
    try {
      await firebaseMessaging.deleteToken();
      setStatus(prev => ({
        ...prev,
        isEnabled: false,
        token: null
      }));
      toast.info('Notifications désactivées');
    } catch (error) {
      console.error('Erreur désactivation notifications:', error);
    }
  }, []);

  /**
   * Teste les notifications
   */
  const testNotification = useCallback(() => {
    if (!status.isEnabled) {
      toast.warning('Activez d\'abord les notifications');
      return;
    }

    // Notification locale de test
    new Notification('🧪 Test de notification', {
      body: 'Les notifications fonctionnent correctement !',
      icon: '/icon-192.png',
      badge: '/favicon.png'
    });

    toast.success('Notification de test envoyée');
  }, [status.isEnabled]);

  return {
    ...status,
    enableNotifications,
    disableNotifications,
    testNotification
  };
}

export default useFirebaseMessaging;
