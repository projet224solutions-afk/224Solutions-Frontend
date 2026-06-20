/**
 * NEARBY DELIVERY MODAL - Premium Design
 * Shows available delivery drivers
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Truck, RefreshCw, AlertCircle, CheckCircle2, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface NearbyDriver {
  id: string;
  full_name?: string;
  phone?: string;
}

interface NearbyDeliveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NearbyDeliveryModal({ open, onOpenChange }: NearbyDeliveryModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchDrivers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'livreur')
        .eq('is_active', true)
        .limit(10);

      if (dbError) throw dbError;
      setDrivers(data || []);
    } catch (err) {
      console.error('Error finding drivers:', err);
      setError('Erreur lors de la recherche de livreurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      searchDrivers();
    }
  }, [open]);

  const handleOrderDelivery = () => {
    onOpenChange(false);
    navigate('/livreur');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-livreur-primary" />
            Livreurs disponibles
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <div className="relative">
                <Truck className="w-12 h-12 text-livreur-primary animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-livreur-primary/30 border-t-livreur-primary animate-spin" style={{ animationDuration: '1s' }} />
              </div>
              <p className="text-sm mt-4">{t('delivery.searchingCouriers')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={searchDrivers}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </div>
          ) : drivers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-20 h-20 rounded-full bg-[#ff4000]/10 flex items-center justify-center mb-4">
                <Navigation className="w-10 h-10 text-[#ff4000]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Aucun livreur disponible
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Il n'y a pas de livreur disponible pour le moment.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  onClick={searchDrivers}
                  className="w-full bg-livreur-primary hover:bg-livreur-primary/90"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nouvelle recherche
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#ff4000]/10 border border-[#ff4000]/20">
                <CheckCircle2 className="w-5 h-5 text-[#ff4000] flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {drivers.length} livreur{drivers.length > 1 ? 's' : ''} disponible{drivers.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Prêts à livrer vos colis
                  </p>
                </div>
              </div>

              {/* Drivers list */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {drivers.slice(0, 5).map((driver) => (
                  <div
                    key={driver.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl',
                      'bg-card border border-border/40'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-livreur-primary/10 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-livreur-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {driver.full_name || 'Livreur'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Disponible maintenant
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <Button
                onClick={handleOrderDelivery}
                className="w-full bg-livreur-primary hover:bg-livreur-primary/90"
                size="lg"
              >
                Commander une Livraison
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NearbyDeliveryModal;
