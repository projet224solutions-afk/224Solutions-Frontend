/**
 * 📲 PUSH NATIF (Capacitor) — Android / iOS
 *
 * Enregistre le device pour les notifications push FCM natives et sauvegarde le
 * token dans `user_fcm_tokens` (même table que le push web). Permet de réveiller
 * l'application même totalement fermée.
 *
 * Ne fait rien sur le web (le push web FCM est géré par firebaseMessaging.ts).
 *
 * ⚠️ Nécessite côté build natif : google-services.json (Android) /
 *    GoogleService-Info.plist (iOS) + `npx cap sync`.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let registered = false;

async function saveNativeToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !token) return;
    await (supabase as any).from('user_fcm_tokens').upsert(
      {
        user_id: user.id,
        fcm_token: token,
        is_active: true,
        device_info: { platform: Capacitor.getPlatform(), native: true },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    console.log('✅ Token push natif sauvegardé');
  } catch (e) {
    console.error('Erreur sauvegarde token natif:', e);
  }
}

/**
 * Enregistre le push natif (idempotent). À appeler quand l'utilisateur est connecté.
 */
export async function registerNativePush(): Promise<void> {
  if (registered) return;
  if (!Capacitor.isNativePlatform()) return; // web → géré ailleurs

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('Push natif : permission refusée');
      return;
    }

    registered = true;

    // Token FCM reçu → sauvegarde
    await PushNotifications.addListener('registration', (token) => {
      void saveNativeToken(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Push natif : erreur enregistrement', err);
    });

    // Notification reçue app au premier plan (l'OS gère l'affichage en arrière-plan)
    await PushNotifications.addListener('pushNotificationReceived', (notif) => {
      console.log('📩 Push natif reçu (foreground):', notif?.title);
    });

    // L'utilisateur a tapé la notification → ouvrir l'écran ciblé
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = (action?.notification?.data as any)?.action_url || '/taxi-moto';
      try { window.location.href = url; } catch { /* nav best-effort */ }
    });

    await PushNotifications.register();
    console.log('✅ Push natif enregistré');
  } catch (e) {
    registered = false;
    console.error('Erreur registerNativePush:', e);
  }
}
