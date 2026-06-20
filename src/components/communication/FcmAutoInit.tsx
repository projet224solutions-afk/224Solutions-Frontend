/**
 * 🔔 INITIALISATION FCM GLOBALE - 224SOLUTIONS
 *
 * Monte le hook FCM UNE fois pour tout utilisateur connecté. Si la permission
 * de notification est déjà accordée, le token FCM est (ré)enregistré côté serveur
 * (table user_fcm_tokens) — indispensable pour recevoir les appels quand l'app
 * est fermée. Ne déclenche AUCUNE demande de permission automatique (UX) :
 * l'activation explicite se fait via le diagnostic d'appel ou les réglages.
 */

import { useFirebaseMessaging } from '@/hooks/useFirebaseMessaging';

// En mode DEV, on n'initialise PAS FCM : cela enregistrerait le service worker
// (qui met l'app en cache et masque les modifs pendant le développement).
// Les notifications restent testables en build/preview/production.
const DISABLE_IN_DEV = import.meta.env.DEV;

function FcmAutoInitInner() {
  useFirebaseMessaging();
  return null;
}

export default function FcmAutoInit() {
  if (DISABLE_IN_DEV) return null;
  return <FcmAutoInitInner />;
}
