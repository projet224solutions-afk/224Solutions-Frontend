import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UserInfo {
  public_id: string;
  user_id: string;
  created_at: string;
}

export const useUserInfo = () => {
  const { user } = useAuth();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserInfo = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, public_id, created_at')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Formater les données pour correspondre à l'interface UserInfo
      if (data) {
        setUserInfo({
          public_id: data.public_id || '',
          user_id: data.id,
          created_at: data.created_at || new Date().toISOString()
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      console.error('Error fetching user info:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  return {
    userInfo,
    loading,
    error,
    refetch: fetchUserInfo
  };
};