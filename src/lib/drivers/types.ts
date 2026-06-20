/**
 * Types partagés pour les drivers (livraison, taxi-moto)
 * 224Solutions
 */

export interface DriverProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface BaseDriver {
  id: string;
  user_id: string;
  vehicle_type: string;
  status: string;
  is_online: boolean;
  rating: number | null;
  distance?: number;
  profile?: DriverProfile | null;
}

export interface DeliveryDriver extends BaseDriver {
  current_lat?: number;
  current_lng?: number;
  total_deliveries: number | null;
  source: 'drivers';
}

export interface TaxiDriver extends BaseDriver {
  vehicle_plate: string;
  last_lat: number | null;
  last_lng: number | null;
  total_rides: number | null;
  taxi_category?: 'car' | 'motorcycle' | null;
  source: 'taxi_drivers';
}

export type NearbyDriver = DeliveryDriver | TaxiDriver;

export interface DriverQueryResult {
  drivers: NearbyDriver[];
  error: Error | null;
}

export interface DriverPosition {
  lat: number;
  lng: number;
}
