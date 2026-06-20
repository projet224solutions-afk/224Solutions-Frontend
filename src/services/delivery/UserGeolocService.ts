/**
 * SERVICE DE GÉOLOCALISATION DES UTILISATEURS
 * Récupère la position GPS des vendeurs et clients par leur ID, téléphone ou nom
 */

import { supabase } from '@/integrations/supabase/client';

export interface UserLocation {
  userId: string;
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
  phone?: string;
}

export class UserGeolocService {
  /**
   * Vérifie si une chaîne est un UUID valide
   */
  private static isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Vérifie si une chaîne est un numéro de téléphone
   */
  private static isPhoneNumber(str: string): boolean {
    const cleaned = str.replace(/[\s\-\+\(\)]/g, '');
    return /^\d{8,15}$/.test(cleaned);
  }

  /**
   * Récupère la position d'un utilisateur par son ID, téléphone ou nom
   */
  static async getUserLocation(identifier: string): Promise<UserLocation | null> {
    try {
      console.log('[UserGeolocService] Getting location for:', identifier);

      let profile = null;

      // Recherche par UUID
      if (this.isUUID(identifier)) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', identifier)
          .single();

        if (!error && data) profile = data;
      }

      // Recherche par téléphone si pas trouvé
      if (!profile && this.isPhoneNumber(identifier)) {
        const cleaned = identifier.replace(/[\s\-\+\(\)]/g, '');
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .or(`phone.ilike.%${cleaned}%,phone.ilike.%${identifier}%`)
          .limit(1)
          .single();

        if (data) profile = data;
      }

      // Recherche par nom si pas trouvé
      if (!profile) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .or(`first_name.ilike.%${identifier}%,last_name.ilike.%${identifier}%`)
          .limit(1)
          .single();

        if (data) profile = data;
      }

      if (!profile) {
        console.error('[UserGeolocService] No profile found for:', identifier);
        return null;
      }

      // Chercher les dernières coordonnées GPS dans delivery_tracking
      const { data: trackingData } = await supabase
        .from('delivery_tracking')
        .select('latitude, longitude')
        .eq('driver_id', profile.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (trackingData && trackingData.latitude && trackingData.longitude) {
        return {
          userId: profile.id,
          latitude: trackingData.latitude,
          longitude: trackingData.longitude,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Client',
          phone: profile.phone || ''
        };
      }

      // Si pas de position GPS, retourner Conakry par défaut
      return {
        userId: profile.id,
        latitude: 9.5091,
        longitude: -13.7122,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Client',
        phone: profile.phone || '',
        address: 'Conakry, Guinée (position par défaut)'
      };
    } catch (error) {
      console.error('[UserGeolocService] Error getting user location:', error);
      return null;
    }
  }

  /**
   * Récupère les informations d'un vendeur par son ID, nom de boutique ou téléphone
   */
  static async getVendorInfo(identifier: string): Promise<UserLocation | null> {
    try {
      console.log('[UserGeolocService] Getting vendor info for:', identifier);

      let vendor = null;

      // Recherche par UUID
      if (this.isUUID(identifier)) {
        const { data, error } = await supabase
          .from('vendors')
          .select('id, user_id, business_name, phone, latitude, longitude, address')
          .eq('id', identifier)
          .single();

        if (!error && data) vendor = data;
      }

      // Recherche par nom de boutique si pas trouvé
      if (!vendor) {
        const { data } = await supabase
          .from('vendors')
          .select('id, user_id, business_name, phone, latitude, longitude, address')
          .ilike('business_name', `%${identifier}%`)
          .limit(1)
          .single();

        if (data) vendor = data;
      }

      // Recherche par téléphone si pas trouvé
      if (!vendor && this.isPhoneNumber(identifier)) {
        const cleaned = identifier.replace(/[\s\-\+\(\)]/g, '');
        const { data } = await supabase
          .from('vendors')
          .select('id, user_id, business_name, phone, latitude, longitude, address')
          .or(`phone.ilike.%${cleaned}%,phone.ilike.%${identifier}%`)
          .limit(1)
          .single();

        if (data) vendor = data;
      }

      if (!vendor) {
        console.error('[UserGeolocService] No vendor found for:', identifier);
        return null;
      }

      // Si le vendor a ses propres coordonnées, les utiliser
      if (vendor.latitude && vendor.longitude) {
        return {
          userId: vendor.id,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          name: vendor.business_name || 'Fournisseur',
          phone: vendor.phone || '',
          address: vendor.address || ''
        };
      }

      // Sinon, chercher via le user_id
      if (vendor.user_id) {
        const userLoc = await this.getUserLocation(vendor.user_id);
        if (userLoc) {
          return {
            ...userLoc,
            name: vendor.business_name || userLoc.name,
            phone: vendor.phone || userLoc.phone
          };
        }
      }

      // Position par défaut Conakry
      return {
        userId: vendor.id,
        latitude: 9.5091,
        longitude: -13.7122,
        name: vendor.business_name || 'Fournisseur',
        phone: vendor.phone || '',
        address: 'Conakry, Guinée (position par défaut)'
      };
    } catch (error) {
      console.error('[UserGeolocService] Error getting vendor info:', error);
      return null;
    }
  }

  /**
   * Calcule la distance entre deux positions
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
