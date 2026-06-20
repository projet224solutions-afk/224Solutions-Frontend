/**
 * 🔐 Téléchargement sécurisé d'un produit numérique
 * ---------------------------------------------------------------------------
 * Appelle l'endpoint backend qui vérifie l'achat (ou la propriété) puis renvoie
 * des URLs SIGNÉES à courte durée. Aucune URL permanente n'est plus exposée :
 * le bucket `digital-products` est privé.
 */

import { useState, useCallback } from 'react';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

interface SignedFile { url: string; name: string }

export function useDigitalDownload() {
  const [downloading, setDownloading] = useState(false);

  /**
   * Récupère les liens signés et déclenche le téléchargement.
   * Retourne true si au moins un fichier a été obtenu.
   */
  const download = useCallback(async (productId: string): Promise<boolean> => {
    setDownloading(true);
    try {
      const res = await backendFetch<unknown>(`/api/v2/digital/${productId}/download`, { method: 'GET' });
      if (!res.success) {
        if (res.code === 'NOT_PURCHASED') {
          toast.error('Vous devez acheter ce produit pour le télécharger.');
        } else {
          toast.error(res.error || 'Téléchargement indisponible.');
        }
        return false;
      }
      const files = ((res as unknown as { files?: SignedFile[] }).files) || [];
      if (files.length === 0) {
        toast.error('Aucun fichier disponible pour ce produit.');
        return false;
      }
      // Ouvre chaque fichier (les liens expirent en 5 min).
      files.forEach((f, i) => {
        setTimeout(() => window.open(f.url, '_blank', 'noopener'), i * 300);
      });
      toast.success(files.length > 1 ? `${files.length} fichiers ouverts` : 'Téléchargement lancé');
      return true;
    } catch {
      toast.error('Erreur réseau lors du téléchargement.');
      return false;
    } finally {
      setDownloading(false);
    }
  }, []);

  return { download, downloading };
}
