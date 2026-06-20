/**
 * EMERGENCY MODULE - Index des exports
 * 224Solutions - Point d'entrée unique pour le module d'urgence
 */

// ============================================
// COMPOSANTS PRINCIPAUX
// ============================================

export { EmergencySOSButton } from './EmergencySOSButton';
export { EmergencyAlertsDashboard } from './EmergencyAlertsDashboard';
export { EmergencyAlertCard } from './EmergencyAlertCard';
export { EmergencyMapView } from './EmergencyMapView';
export { EmergencyActionsPanel } from './EmergencyActionsPanel';
export { EmergencyStatsWidget } from './EmergencyStatsWidget';

// ============================================
// TYPES
// ============================================

export type {
  EmergencyAlert,
  EmergencyGPSTracking,
  EmergencyAction,
  EmergencyStats,
  EmergencyStatus,
  EmergencyActionType,
  GPSPosition,
  CreateEmergencyAlertPayload,
  UpdateEmergencyAlertPayload,
  CreateGPSTrackingPayload,
  CreateEmergencyActionPayload,
  EmergencyNotificationPayload,
  EmergencyWebSocketMessage
} from '@/types/emergency';

// ============================================
// SERVICES
// ============================================

export { emergencyService, gpsTrackingService } from '@/services/emergencyService';
export { emergencyNotifications, initializeEmergencyNotifications } from '@/services/emergencyNotifications';

// ============================================
// HOOKS
// ============================================

export {
  useActiveEmergencyAlerts,
  useEmergencyAlert,
  useEmergencyStats,
  useEmergencyActions,
  useEmergencyGPSTracking,
  useDriverActiveAlert,
  useEmergencyNotifications
} from '@/hooks/useEmergency';

// ============================================
// PAGES
// ============================================

export { EmergencyPage, EmergencyAlertDetailPage } from '@/pages/EmergencyPage';

// ============================================
// CONSTANTES
// ============================================

export const EMERGENCY_CONFIG = {
  // Intervalle de tracking GPS (millisecondes)
  GPS_TRACKING_INTERVAL: 2000,

  // Cooldown du bouton SOS (secondes)
  SOS_BUTTON_COOLDOWN: 5,

  // Durée de rafraîchissement des statistiques (millisecondes)
  STATS_REFRESH_INTERVAL: 30000,

  // Nombre maximum de points GPS à conserver
  MAX_GPS_POINTS: 50,

  // Durée de conservation des 30 dernières secondes (millisecondes)
  RECENT_GPS_DURATION: 30000,

  // Priorité des notifications
  NOTIFICATION_PRIORITY: {
    CRITICAL: 'critical',
    HIGH: 'high',
    NORMAL: 'normal'
  },

  // Sons
  SOUNDS: {
    EMERGENCY: '/sounds/emergency-alert.mp3',
    CONFIRMATION: '/sounds/confirmation.mp3'
  },

  // Statuts d'alerte
  STATUS: {
    ACTIVE: 'active',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    FALSE_ALERT: 'false_alert'
  },

  // Types d'action
  ACTION_TYPES: {
    CALL_DRIVER: 'call_driver',
    SEND_MESSAGE: 'send_message',
    NOTIFY_POLICE: 'notify_police',
    MARK_SAFE: 'mark_safe',
    ESCALATE: 'escalate',
    NOTE: 'note'
  }
};

// ============================================
// UTILITAIRES
// ============================================

/**
 * Formater le temps écoulé depuis une alerte
 */
export function formatTimeSinceAlert(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins > 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}min`;
  }

  return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
}

/**
 * Obtenir la couleur du statut
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-[#ff4000]';
    case 'in_progress':
      return 'bg-orange-500';
    case 'resolved':
      return 'bg-[#ff4000]';
    case 'false_alert':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Obtenir le label du statut
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'URGENCE';
    case 'in_progress':
      return 'EN COURS';
    case 'resolved':
      return 'RÉSOLUE';
    case 'false_alert':
      return 'FAUSSE ALERTE';
    default:
      return status.toUpperCase();
  }
}

/**
 * Obtenir l'icône du type d'action
 */
export function getActionIcon(type: string): string {
  switch (type) {
    case 'call_driver':
      return '📞';
    case 'send_message':
      return '💬';
    case 'notify_police':
      return '🚔';
    case 'mark_safe':
      return '✅';
    case 'escalate':
      return '⚠️';
    case 'note':
      return '📝';
    default:
      return '📋';
  }
}

/**
 * Obtenir le label du type d'action
 */
export function getActionLabel(type: string): string {
  switch (type) {
    case 'call_driver':
      return 'Appel conducteur';
    case 'send_message':
      return 'Message envoyé';
    case 'notify_police':
      return 'Police notifiée';
    case 'mark_safe':
      return 'Marqué en sécurité';
    case 'escalate':
      return 'Escaladé';
    case 'note':
      return 'Note';
    default:
      return type;
  }
}

/**
 * Calculer la distance entre deux points GPS (en mètres)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance en mètres
}

/**
 * Formater une distance (mètres → km/m)
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Valider une position GPS
 */
export function isValidGPSPosition(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

/**
 * Générer une URL Google Maps
 */
export function getGoogleMapsUrl(lat: number, lng: number, zoom: number = 16): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}`;
}

/**
 * Générer une URL Google Maps Directions
 */
export function getGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// ============================================
// VERSION
// ============================================

export const EMERGENCY_MODULE_VERSION = '1.0.0';
export const EMERGENCY_MODULE_BUILD_DATE = '2024-11-30';

console.log(`
🚨 Emergency SOS Module v${EMERGENCY_MODULE_VERSION}
📅 Build: ${EMERGENCY_MODULE_BUILD_DATE}
✅ Module chargé avec succès
`);
