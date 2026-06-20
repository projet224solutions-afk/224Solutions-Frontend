import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, MapPin, RefreshCw, Search, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import QuickFooter from "@/components/QuickFooter";
import { cn } from "@/lib/utils";
import { useGeoDistance, calculateDistance as calcDistanceFn } from "@/hooks/useGeoDistance";
import { VendorCard } from "@/components/vendor/VendorCard";

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
  business_type?: "physical" | "digital" | "hybrid" | null;
  service_type?: "wholesale" | "retail" | "mixed" | null;
  is_verified?: boolean | null;
  distance?: number | null;
  shop_slug?: string | null;
}

const RADIUS_KM = 20;

// ⚠️ Sécurité: `vendors` applique des grants au niveau COLONNE (durcissement RLS/PII).
// Les colonnes `address`, `phone`, `email`, `kyc_status` sont INTERDITES au rôle anonyme.
// PostgREST refuse TOUTE la requête (42501) si une seule colonne non autorisée est demandée.
// → On ne demande ici que des colonnes publiques, et on garde un jeu minimal de secours.
const VENDOR_PUBLIC_COLS =
  "id, user_id, business_name, description, logo_url, rating, city, neighborhood, latitude, longitude, business_type, service_type, is_verified, shop_slug";
const VENDOR_MINIMAL_COLS =
  "id, user_id, business_name, latitude, longitude, city, neighborhood, logo_url, business_type, service_type, shop_slug";

export default function NearbyBoutiques() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userPosition, positionReady, usingRealLocation, refreshPosition } = useGeoDistance();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");

  useEffect(() => {
    document.title = t('nearbyBoutiques.boutiquesAProximite224solutions');
  }, []);

  const loadVendors = async (overridePosition?: { latitude: number; longitude: number }) => {
    setLoading(true);
    setError(null);
    try {
      // Construit la requête avec un set de colonnes donné (filtres appliqués à chaque tentative)
      const runQuery = (columns: string) => {
        let query = supabase
          .from("vendors")
          .select(columns)
          .eq("is_active", true)
          .limit(200);

        if (businessTypeFilter !== "all") query = query.eq("business_type", businessTypeFilter);
        if (serviceTypeFilter !== "all") query = query.eq("service_type", serviceTypeFilter);
        return query;
      };

      // 1) Tentative avec les colonnes publiques complètes.
      let { data, error: dbError } = await runQuery(VENDOR_PUBLIC_COLS);

      // 2) Repli blindé: si une colonne devient interdite (grants RLS),
      //    on réessaie avec le strict minimum garanti lisible — la page reste fonctionnelle.
      if (dbError) {
        console.warn("[NearbyBoutiques] select public refusé, repli colonnes minimales:", dbError.message);
        ({ data, error: dbError } = await runQuery(VENDOR_MINIMAL_COLS));
        if (dbError) throw dbError;
      }

      // Utiliser la position fournie ou la position de useGeoDistance (inclut déjà le fallback Coyah)
      const origin = overridePosition ?? userPosition;

      // On utilise la position (réelle ou par défaut) pour calculer les distances

      let list: Vendor[] = (data || []).map((v: any) => ({
        ...v,
        business_type: v.business_type as Vendor["business_type"],
        service_type: v.service_type as Vendor["service_type"],
      }));

      // Distances + filtre rayon - Exclure boutiques sans GPS valide
      list = list
        .map((v) => {
          const lat_val = Number(v.latitude);
          const lng_val = Number(v.longitude);
          if (v.latitude == null || v.longitude == null ||
              !Number.isFinite(lat_val) || !Number.isFinite(lng_val) ||
              (lat_val === 0 && lng_val === 0)) {
            return { ...v, distance: null };
          }
          const distance = calcDistanceFn(origin.latitude, origin.longitude, lat_val, lng_val);
          return { ...v, distance };
        })
        .filter((v) => v.distance !== null && v.distance <= RADIUS_KM);

      // Tri: plus proches d'abord, sinon par note
      list.sort((a, b) => {
        if (a.distance === null && b.distance === null) return (b.rating || 0) - (a.rating || 0);
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

      setVendors(list);
    } catch (e) {
      console.error("Erreur chargement boutiques:", e);
      setError("Erreur lors du chargement des boutiques");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const pos = await refreshPosition();
    await loadVendors(pos);
  };

  useEffect(() => {
    // Charger les boutiques dès que la position est prête.
    // useGeoDistance gère déjà le fallback (Coyah) en cas d'échec GPS.
    if (!positionReady) return;
    void loadVendors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionReady, businessTypeFilter, serviceTypeFilter]);

  const filteredVendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => {
      return (
        v.business_name?.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q) ||
        v.neighborhood?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q)
      );
    });
  }, [vendors, searchQuery]);

  // Handler de navigation optimisé avec useCallback pour éviter les re-créations
  const handleVendorNavigate = useCallback((vendorId: string, shopSlug?: string | null) => {
    navigate(`/boutique/${shopSlug || vendorId}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate("/proximite")}
                aria-label={t('nearbyBoutiques.retourAProximite')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-foreground truncate">{t('nearbyBoutiques.boutiquesAProximite')}</h1>
                <p className="text-xs text-muted-foreground truncate">Découvrez les vendeurs dans un rayon de {RADIUS_KM} km</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={handleRefresh} disabled={loading} aria-label="Actualiser">
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={usingRealLocation ? "default" : "secondary"} className="gap-1">
              <MapPin className="w-3 h-3" />
              {usingRealLocation ? "Position GPS active" : "GPS désactivé"}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              Rayon: {RADIUS_KM} km
            </Badge>
            <Badge variant="outline" className="text-xs">
              {filteredVendors.length} boutique{filteredVendors.length > 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('nearbyBoutiques.rechercherUneBoutiqueNomVille')}
              className="pl-10 h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">Type</span>
              <select
                value={businessTypeFilter}
                onChange={(e) => setBusinessTypeFilter(e.target.value)}
                className="bg-transparent text-sm text-foreground border-0 focus:outline-none"
              >
                <option value="all">{t('nearbyBoutiques.tous')}</option>
                <option value="physical">Physique</option>
                <option value="digital">En ligne</option>
                <option value="hybrid">Hybride</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">{t('nearbyBoutiques.service')}</span>
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="bg-transparent text-sm text-foreground border-0 focus:outline-none"
              >
                <option value="all">{t('nearbyBoutiques.tous')}</option>
                <option value="retail">{t('nearbyBoutiques.detaillant')}</option>
                <option value="wholesale">Grossiste</option>
                <option value="mixed">Mixte</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error ? (
          <div className="rounded-2xl border border-border/50 bg-card p-6 text-center">
            <p className="text-sm font-medium text-foreground mb-1">Erreur</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('nearbyBoutiques.chargementDesBoutiques')}</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
            <Store className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">{t('nearbyBoutiques.aucuneBoutiqueTrouvee')}</p>
            <p className="text-sm text-muted-foreground">{t('nearbyBoutiques.essayezDeModifierLesFiltres')}</p>
          </div>
        ) : (
          <section aria-label={t('nearbyBoutiques.listeDesBoutiques')} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVendors.map((vendor, index) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                index={index}
                onNavigate={handleVendorNavigate}
              />
            ))}
          </section>
        )}
      </main>

      <QuickFooter />
    </div>
  );
}
