/**
 * NEARBY VENDORS MODAL - Ultra Professional E-Commerce Design
 * Premium wide layout with VendorCard + Proximity sorting
 * Même logique 20 km que la page /proximite/boutiques
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  MapPin,
  RefreshCw,
  Search,
  ArrowRight,
  Package,
  Navigation,
  Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { VendorCard } from '@/components/vendor/VendorCard';
import { useGeoDistance, calculateDistance as calcDistanceFn } from '@/hooks/useGeoDistance';

// Rayon maximum en km (même logique que la page de proximité)
const RADIUS_KM = 20;

// ⚠️ `vendors` a des grants au niveau colonne: address/phone/email/kyc_status sont
// interdits au rôle anonyme et font échouer TOUTE la requête (42501). On ne demande
// que des colonnes publiques, avec un repli minimal garanti lisible.
const VENDOR_PUBLIC_COLS =
  'id, user_id, business_name, description, logo_url, rating, city, neighborhood, latitude, longitude, business_type, service_type, is_verified, shop_slug';
const VENDOR_MINIMAL_COLS =
  'id, user_id, business_name, latitude, longitude, city, neighborhood, logo_url, business_type, service_type, shop_slug';

interface Vendor {
  id: string;
  user_id?: string | null;
  business_name: string;
  description?: string | null;
  address?: string | null;
  logo_url?: string | null;
  rating?: number | null;
  city?: string | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  business_type?: 'physical' | 'digital' | 'hybrid' | null;
  service_type?: 'wholesale' | 'retail' | 'mixed' | null;
  is_verified?: boolean | null;
  distance?: number | null;
  shop_slug?: string | null;
}

interface NearbyVendorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NearbyVendorsModal({ open, onOpenChange }: NearbyVendorsModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userPosition, positionReady, usingRealLocation, refreshPosition, DEFAULT_POSITION } = useGeoDistance();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');

  const loadVendors = useCallback(
    async (overridePosition?: { latitude: number; longitude: number }) => {
      const origin = overridePosition ?? (userPosition?.latitude ? userPosition : DEFAULT_POSITION);

      setLoading(true);
      setError(null);
      try {
        const runQuery = (columns: string) => {
          let query = supabase
            .from('vendors')
            .select(columns)
            .eq('is_active', true)
            .limit(200);

          if (businessTypeFilter !== 'all') query = query.eq('business_type', businessTypeFilter);
          if (serviceTypeFilter !== 'all') query = query.eq('service_type', serviceTypeFilter);
          return query;
        };

        // 1) Colonnes publiques complètes, 2) repli blindé sur le strict minimum.
        let { data, error: dbError } = await runQuery(VENDOR_PUBLIC_COLS);
        if (dbError) {
          console.warn('[NearbyVendorsModal] select public refusé, repli colonnes minimales:', dbError.message);
          ({ data, error: dbError } = await runQuery(VENDOR_MINIMAL_COLS));
          if (dbError) throw dbError;
        }

        let list: Vendor[] = (data || []).map((v: any) => ({
          ...v,
          business_type: v.business_type as Vendor['business_type'],
          service_type: v.service_type as Vendor['service_type'],
        }));

        const total = list.length;

        // Distances + filtre rayon - EXCLURE les boutiques sans GPS
        const withDistance = list.map((v) => {
          if (v.latitude === null || v.latitude === undefined || v.longitude === null || v.longitude === undefined) {
            return { ...v, distance: null };
          }
          const distance = calcDistanceFn(origin.latitude, origin.longitude, Number(v.latitude), Number(v.longitude));
          return { ...v, distance };
        });

        const withoutGps = withDistance.filter((v) => v.distance === null).length;
        const outOfRadius = withDistance.filter((v) => v.distance !== null && v.distance > RADIUS_KM).length;

        list = withDistance.filter((v) => v.distance !== null && v.distance <= RADIUS_KM);

        // Tri: plus proches d'abord
        list.sort((a, b) => {
          if (a.distance === null && b.distance === null) return (b.rating || 0) - (a.rating || 0);
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return (a.distance ?? 0) - (b.distance ?? 0);
        });

        // Debug (pour comprendre si des boutiques passent le filtre)
        console.debug('[NearbyVendorsModal] origin=', origin, {
          total,
          withoutGps,
          outOfRadius,
          inRadius: list.length,
          radiusKm: RADIUS_KM,
        });

        setVendors(list);
      } catch (err) {
        console.error('Error loading vendors:', err);
        setError('Erreur lors du chargement des boutiques');
      } finally {
        setLoading(false);
      }
    },
    [DEFAULT_POSITION, businessTypeFilter, serviceTypeFilter, userPosition]
  );

  // À l'ouverture: forcer une demande de position (même logique que proximité)
  useEffect(() => {
    if (!open) return;
    void refreshPosition();
  }, [open, refreshPosition]);

  // Charger dès que la position est prête (useGeoDistance gère le fallback)
  useEffect(() => {
    if (!open) return;
    if (!positionReady) return;
    void loadVendors();
  }, [open, positionReady, businessTypeFilter, serviceTypeFilter, loadVendors]);

  const handleRefresh = useCallback(async () => {
    const pos = await refreshPosition();
    await loadVendors(pos);
  }, [refreshPosition, loadVendors]);

  const handleVendorClick = useCallback(
    (vendorId: string, shopSlug?: string | null) => {
      onOpenChange(false);
      navigate(`/boutique/${shopSlug || vendorId}`);
    },
    [navigate, onOpenChange]
  );

  const filteredVendors = vendors.filter((vendor) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      vendor.business_name.toLowerCase().includes(q) ||
      vendor.city?.toLowerCase().includes(q) ||
      vendor.neighborhood?.toLowerCase().includes(q) ||
      vendor.description?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl z-[100]">
        {/* Premium Header */}
        <div className="bg-vendeur-primary p-4 sm:p-6 text-white">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm font-medium">
              <Navigation className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{t('nearbyVendorsModal.boutiquesAProximite')}</span>
            </div>
            <DialogTitle className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Store className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              Découvrez nos boutiques
            </DialogTitle>
          </DialogHeader>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={t('nearbyVendorsModal.rechercherParNomVilleQuartier')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl bg-white border-0 text-foreground placeholder:text-muted-foreground shadow-lg"
            />
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-white/70" />
              <select
                value={businessTypeFilter}
                onChange={(e) => setBusinessTypeFilter(e.target.value)}
                className="bg-transparent text-white text-xs border-0 focus:ring-0 cursor-pointer"
              >
                <option value="all" className="text-foreground">
                  Tous les types
                </option>
                <option value="physical" className="text-foreground">
                  Boutique physique
                </option>
                <option value="digital" className="text-foreground">
                  Boutique en ligne
                </option>
                <option value="hybrid" className="text-foreground">
                  Hybride
                </option>
              </select>
            </div>
            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
              <Package className="w-3.5 h-3.5 text-white/70" />
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="bg-transparent text-white text-xs border-0 focus:ring-0 cursor-pointer"
              >
                <option value="all" className="text-foreground">
                  Tous les services
                </option>
                <option value="wholesale" className="text-foreground">
                  Grossiste
                </option>
                <option value="retail" className="text-foreground">
                  Détaillant
                </option>
                <option value="mixed" className="text-foreground">
                  Mixte
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-3 sm:px-6 py-2 sm:py-3 bg-muted/30 border-b border-border/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="text-xs sm:text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredVendors.length}</span> boutiques disponibles
            </span>
            <Badge variant={usingRealLocation ? 'default' : 'secondary'} className="gap-1 text-[10px]">
              <MapPin className="w-3 h-3" />
              {usingRealLocation ? 'Position GPS active' : 'GPS désactivé'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Rayon: {RADIUS_KM} km
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="gap-1 sm:gap-2 text-xs sm:text-sm h-8">
            <RefreshCw className={cn('w-3 h-3 sm:w-4 sm:h-4', loading && 'animate-spin')} />
            Actualiser
          </Button>
        </div>

        {/* Vendors Grid - Utilise VendorCard comme la page de proximité */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-vendeur-primary/10 flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 animate-spin text-vendeur-primary" />
              </div>
              <p className="text-sm font-medium">{t('nearbyVendorsModal.chargementDesBoutiques')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground mb-2">{t('nearbyVendorsModal.erreurDeChargement')}</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={handleRefresh} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </Button>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Store className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-2">{t('nearbyVendorsModal.aucuneBoutiqueTrouvee')}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? 'Essayez un autre terme de recherche' : `Aucune boutique dans un rayon de ${RADIUS_KM} km`}
              </p>
              <Button variant="outline" onClick={() => setSearchQuery('')} className="gap-2">
                Effacer la recherche
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredVendors.map((vendor, index) => (
                <VendorCard key={vendor.id} vendor={vendor} index={index} onNavigate={handleVendorClick} />
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t border-border/40 bg-muted/20">
          <Button
            className="w-full h-12 rounded-xl gap-2 bg-vendeur-primary hover:bg-vendeur-primary/90 text-white font-semibold shadow-lg shadow-vendeur-primary/25"
            onClick={() => {
              onOpenChange(false);
              navigate('/proximite/boutiques');
            }}
          >
            <Store className="w-5 h-5" />
            Explorer toutes les boutiques
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NearbyVendorsModal;
