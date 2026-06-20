import { useState, useEffect } from 'react';
import { generateUniqueId, RoleType } from '@/lib/autoIdGenerator';

/**
 * Hook pour générer et gérer les IDs automatiques
 * S'intègre facilement dans les composants existants
 */
export function useAutoId(roleType: RoleType, shouldGenerate: boolean = false) {
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateId = async () => {
    setLoading(true);
    setError(null);

    try {
      const newId = await generateUniqueId(roleType);
      setId(newId);
      return newId;
    } catch (err: any) {
      const errorMessage = err?.message || 'Erreur génération ID';
      setError(errorMessage);
      console.error('Erreur useAutoId:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shouldGenerate && !id) {
      generateId();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldGenerate]);

  return {
    id,
    loading,
    error,
    generateId,
    setId
  };
}
