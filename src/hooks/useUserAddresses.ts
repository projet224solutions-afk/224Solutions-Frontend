import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateInput, addressSchema } from '@/lib/inputValidation';
import { rateLimiter } from '@/lib/rateLimiter';

export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  street: string;
  city: string;
  postal_code?: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook pour gérer les adresses multiples (comme Amazon)
 */
export const useUserAddresses = () => {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<UserAddress | null>(null);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAddresses([]);
        return;
      }

      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAddresses(data || []);
      setDefaultAddress(data?.find(a => a.is_default) || null);
    } catch (error: any) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAddress = async (address: Omit<UserAddress, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    // Rate limiting
    if (!rateLimiter.check('add-address', { maxRequests: 10, windowMs: 60000 })) {
      toast.error('Trop de requêtes. Veuillez patienter.');
      return false;
    }

    // Validation
    const validation = validateInput(addressSchema, {
      street: address.street,
      city: address.city,
      postal_code: address.postal_code || '',
      country: address.country,
      phone: address.phone
    });

    if (!validation.success) {
      toast.error(validation.errors?.[0] || 'Données invalides');
      return false;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return false;
      }

      // Si c'est la première adresse ou marquée par défaut, mettre les autres à false
      if (address.is_default || addresses.length === 0) {
        await supabase
          .from('user_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('user_addresses')
        .insert({
          ...address,
          user_id: user.id,
          is_default: address.is_default || addresses.length === 0
        });

      if (error) throw error;

      toast.success('Adresse ajoutée avec succès');
      await loadAddresses();
      return true;
    } catch (error: any) {
      console.error('Error adding address:', error);
      toast.error('Erreur lors de l\'ajout de l\'adresse');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateAddress = async (addressId: string, updates: Partial<UserAddress>) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return false;
      }

      // Si on change le défaut, réinitialiser les autres
      if (updates.is_default) {
        await supabase
          .from('user_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('user_addresses')
        .update(updates)
        .eq('id', addressId);

      if (error) throw error;

      toast.success('Adresse mise à jour');
      await loadAddresses();
      return true;
    } catch (error: any) {
      console.error('Error updating address:', error);
      toast.error('Erreur lors de la mise à jour');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;

      toast.success('Adresse supprimée');
      await loadAddresses();
      return true;
    } catch (error: any) {
      console.error('Error deleting address:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const setAsDefault = async (addressId: string) => {
    return updateAddress(addressId, { is_default: true });
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  return {
    addresses,
    defaultAddress,
    loading,
    addAddress,
    updateAddress,
    deleteAddress,
    setAsDefault,
    reload: loadAddresses
  };
};
