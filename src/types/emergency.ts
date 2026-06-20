/**
 * EMERGENCY SOS SYSTEM - Types TypeScript
 * 224Solutions - Système d'alerte d'urgence pour taxi-moto
 */

export type EmergencyStatus = 'active' | 'in_progress' | 'resolved' | 'false_alert';

export type EmergencyActionType =
  | 'call_driver'
  | 'send_message'
  | 'notify_police'
  | 'mark_safe'
  | 'escalate'
  | 'note';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  direction?: number;
  altitude?: number;
  timestamp?: string;
}

export interface EmergencyAlert {
  id: string;
  driver_id: string;
  driver_name?: string;
  driver_phone?: string;
  driver_code?: string;

  // Statut
  status: EmergencyStatus;

  // Position initiale
  initial_latitude: number;
  initial_longitude: number;
  initial_accuracy?: number;

  // Position actuelle
  current_latitude?: number;
  current_longitude?: number;
  current_accuracy?: number;
  current_speed?: number;
  current_direction?: number;

  // Métadonnées
  silent_mode: boolean;
  bureau_syndicat_id?: string;
  handled_by?: string;
  handled_at?: string;
  resolution_notes?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  resolved_at?: string;

  // Données enrichies (depuis la vue)
  driver_full_name?: string;
  driver_avatar?: string;
  seconds_since_alert?: number;
  tracking_points_count?: number;
}

export interface EmergencyGPSTracking {
  id: string;
  alert_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  direction?: number;
  altitude?: number;
  timestamp: string;
}

export interface EmergencyAction {
  id: string;
  alert_id: string;
  action_type: EmergencyActionType;
  performed_by: string;
  performed_by_name?: string;
  action_details?: Record<string, any>;
  notes?: string;
  created_at: string;
}

export interface EmergencyStats {
  total_alerts: number;
  active_alerts: number;
  resolved_alerts: number;
  false_alerts: number;
  avg_resolution_time?: string;
}

export interface CreateEmergencyAlertPayload {
  driver_id: string;
  driver_name?: string;
  driver_phone?: string;
  driver_code?: string;
  initial_latitude: number;
  initial_longitude: number;
  initial_accuracy?: number;
  silent_mode?: boolean;
  bureau_syndicat_id?: string;
}

export interface UpdateEmergencyAlertPayload {
  current_latitude?: number;
  current_longitude?: number;
  current_accuracy?: number;
  current_speed?: number;
  current_direction?: number;
  status?: EmergencyStatus;
  handled_by?: string;
  handled_at?: string;
  resolution_notes?: string;
  resolved_at?: string;
}

export interface CreateGPSTrackingPayload {
  alert_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  direction?: number;
  altitude?: number;
}

export interface CreateEmergencyActionPayload {
  alert_id: string;
  action_type: EmergencyActionType;
  performed_by: string;
  performed_by_name?: string;
  action_details?: Record<string, any>;
  notes?: string;
}

// Notification Push payload
export interface EmergencyNotificationPayload {
  type: 'emergency_alert' | 'emergency_update' | 'emergency_resolved';
  alert_id: string;
  driver_name: string;
  driver_code: string;
  latitude: number;
  longitude: number;
  message: string;
  priority: 'high' | 'critical';
  sound: 'emergency' | 'default';
  timestamp: string;
}

// WebSocket message types
export interface EmergencyWebSocketMessage {
  type: 'alert_created' | 'alert_updated' | 'gps_update' | 'action_created' | 'alert_resolved';
  payload: EmergencyAlert | EmergencyGPSTracking | EmergencyAction;
  timestamp: string;
}
