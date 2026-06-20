/**
 * Types TypeScript pour le système SOS Taxi Moto
 * Compatible sans migration SQL déployée
 */

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  direction?: number; // 0-360 degrés
  speed?: number; // m/s
  timestamp: number;
}

export interface SOSAlert {
  id: string;
  taxi_driver_id: string;
  driver_name: string;
  driver_phone: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  direction?: number;
  speed?: number;
  gps_history: GPSPosition[];
  status: 'DANGER' | 'EN_INTERVENTION' | 'RESOLU' | 'ANNULE';
  bureau_syndicat_id?: string;
  description?: string;
  resolved_by?: string;
  resolved_at?: string;
  triggered_at: string;
  updated_at?: string;
}

export interface SOSResponse {
  success: boolean;
  sos_id?: string;
  message: string;
  error?: string;
}

export type SOSStatus = 'DANGER' | 'EN_INTERVENTION' | 'RESOLU' | 'ANNULE';
