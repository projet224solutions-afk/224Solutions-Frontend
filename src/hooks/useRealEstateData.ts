/**
 * Hook pour gérer les données immobilières (properties, visits, contacts)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Property {
  id: string;
  professional_service_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  offer_type: 'vente' | 'location';
  property_type: string;
  price: number;
  currency: string;
  surface: number;
  rooms: number;
  bathrooms: number;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
  status: 'disponible' | 'sous_option' | 'vendu' | 'loue' | 'brouillon';
  is_featured: boolean;
  views_count: number;
  favorites_count: number;
  metadata: any;
  created_at: string;
  updated_at: string;
  images?: PropertyImage[];
}

export interface PropertyImage {
  id: string;
  property_id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
}

export interface PropertyVisit {
  id: string;
  property_id: string;
  professional_service_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  visit_date: string;
  visit_time: string | null;
  status: 'planifiee' | 'effectuee' | 'annulee';
  notes: string | null;
  created_at: string;
  property?: Property;
}

export interface PropertyContact {
  id: string;
  professional_service_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contact_type: 'acheteur' | 'vendeur' | 'locataire' | 'bailleur';
  interested_in: string[];
  budget: number | null;
  notes: string | null;
  created_at: string;
}

export function useRealEstateData(serviceId: string) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<PropertyVisit[]>([]);
  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProperties = useCallback(async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*, images:property_images(*)')
      .eq('professional_service_id', serviceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties:', error);
      return;
    }
    setProperties((data || []) as unknown as Property[]);
  }, [serviceId]);

  const fetchVisits = useCallback(async () => {
    const { data, error } = await supabase
      .from('property_visits')
      .select('*')
      .eq('professional_service_id', serviceId)
      .order('visit_date', { ascending: true });

    if (error) {
      console.error('Error fetching visits:', error);
      return;
    }
    setVisits((data || []) as unknown as PropertyVisit[]);
  }, [serviceId]);

  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from('property_contacts')
      .select('*')
      .eq('professional_service_id', serviceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
      return;
    }
    setContacts((data || []) as unknown as PropertyContact[]);
  }, [serviceId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProperties(), fetchVisits(), fetchContacts()]);
    setLoading(false);
  }, [fetchProperties, fetchVisits, fetchContacts]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createProperty = async (data: {
    title: string;
    description?: string;
    offer_type: string;
    property_type: string;
    price: number;
    surface?: number;
    rooms?: number;
    bathrooms?: number;
    address?: string;
    city?: string;
    neighborhood?: string;
    latitude?: number;
    longitude?: number;
    amenities?: string[];
  }) => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Non authentifié');

      const { data: property, error } = await supabase
        .from('properties')
        .insert({
          professional_service_id: serviceId,
          owner_id: user.user.id,
          title: data.title,
          description: data.description || null,
          offer_type: data.offer_type,
          property_type: data.property_type,
          price: data.price,
          surface: data.surface || 0,
          rooms: data.rooms || 0,
          bathrooms: data.bathrooms || 0,
          address: data.address || null,
          city: data.city || null,
          neighborhood: data.neighborhood || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          amenities: data.amenities || [],
          status: 'disponible',
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Bien publié avec succès !');
      await fetchProperties();
      return property;
    } catch (error: any) {
      console.error('Error creating property:', error);
      toast.error('Erreur lors de la publication');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updatePropertyStatus = async (propertyId: string, status: string) => {
    const { error } = await supabase
      .from('properties')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', propertyId);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }
    toast.success('Statut mis à jour');
    await fetchProperties();
  };

  const deleteProperty = async (propertyId: string) => {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }
    toast.success('Bien supprimé');
    await fetchProperties();
  };

  const createVisit = async (data: {
    property_id: string;
    client_name: string;
    client_phone?: string;
    client_email?: string;
    visit_date: string;
    visit_time?: string;
    notes?: string;
  }) => {
    const { error } = await supabase
      .from('property_visits')
      .insert({
        ...data,
        professional_service_id: serviceId,
        status: 'planifiee',
      });

    if (error) {
      toast.error('Erreur lors de la planification');
      return false;
    }
    toast.success('Visite planifiée');
    await fetchVisits();
    return true;
  };

  const updateVisitStatus = async (visitId: string, status: string) => {
    const { error } = await supabase
      .from('property_visits')
      .update({ status })
      .eq('id', visitId);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }
    toast.success('Visite mise à jour');
    await fetchVisits();
  };

  const createContact = async (data: {
    name: string;
    phone?: string;
    email?: string;
    contact_type: string;
    interested_in?: string[];
    budget?: number;
    notes?: string;
  }) => {
    const { error } = await supabase
      .from('property_contacts')
      .insert({
        ...data,
        professional_service_id: serviceId,
      });

    if (error) {
      toast.error('Erreur lors de l\'ajout');
      return false;
    }
    toast.success('Contact ajouté');
    await fetchContacts();
    return true;
  };

  // Stats
  const stats = {
    totalProperties: properties.length,
    forSale: properties.filter(p => p.offer_type === 'vente').length,
    forRent: properties.filter(p => p.offer_type === 'location').length,
    available: properties.filter(p => p.status === 'disponible').length,
    totalViews: properties.reduce((acc, p) => acc + (p.views_count || 0), 0),
    todayVisits: visits.filter(v => v.visit_date === new Date().toISOString().split('T')[0]).length,
    pendingVisits: visits.filter(v => v.status === 'planifiee').length,
    totalContacts: contacts.length,
  };

  return {
    properties,
    visits,
    contacts,
    stats,
    loading,
    saving,
    createProperty,
    updatePropertyStatus,
    deleteProperty,
    createVisit,
    updateVisitStatus,
    createContact,
    refresh: loadAll,
  };
}
