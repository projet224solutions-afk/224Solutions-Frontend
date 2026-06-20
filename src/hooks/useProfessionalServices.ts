import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  features: any;
  commission_rate: number;
  is_active: boolean;
}

export interface ProfessionalService {
  id: string;
  user_id: string;
  service_type_id: string;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  rating: number;
  total_reviews: number;
  total_orders: number;
  total_revenue: number;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  service_type?: ServiceType;
}

export const useProfessionalServices = () => {
  const { user } = useAuth();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [userServices, setUserServices] = useState<ProfessionalService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchServiceTypes();
      if (user) {
        await fetchUserServices();
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const parsedData = (data || []).map(service => ({
        ...service,
        features: typeof service.features === 'string'
          ? JSON.parse(service.features)
          : Array.isArray(service.features)
            ? service.features
            : []
      }));

      setServiceTypes(parsedData as ServiceType[]);
    } catch (error: any) {
      console.error('Erreur lors du chargement des types de service:', error);
      toast.error('Impossible de charger les services');
    }
  };

  const fetchUserServices = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('professional_services')
        .select(`
          *,
          service_type:service_types(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserServices((data || []) as ProfessionalService[]);
    } catch (error: any) {
      console.error('Erreur lors du chargement des services utilisateur:', error);
    }
  };

  const createProfessionalService = async (data: {
    service_type_id: string;
    business_name: string;
    description?: string;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    if (!user) {
      toast.error('Vous devez être connecté pour créer un service');
      return null;
    }

    try {
      const { data: service, error } = await supabase
        .from('professional_services')
        .insert([
          {
            user_id: user.id,
            service_type_id: data.service_type_id,
            business_name: data.business_name,
            description: data.description,
            phone: data.phone,
            email: data.email || user.email,
            city: data.city || null,
            address: data.address,
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            status: 'pending',
            verification_status: 'unverified',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success('Service professionnel créé avec succès !');
      await fetchUserServices();
      return service;
    } catch (error: any) {
      console.error('Erreur lors de la création du service:', error);
      toast.error('Erreur lors de la création du service');
      return null;
    }
  };

  const updateProfessionalService = async (
    serviceId: string,
    updates: Partial<ProfessionalService>
  ) => {
    try {
      const { error } = await supabase
        .from('professional_services')
        .update(updates)
        .eq('id', serviceId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Service mis à jour avec succès');
      await fetchUserServices();
      return true;
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour du service');
      return false;
    }
  };

  return {
    serviceTypes,
    userServices,
    loading,
    createProfessionalService,
    updateProfessionalService,
    refreshServices: fetchUserServices,
  };
};
