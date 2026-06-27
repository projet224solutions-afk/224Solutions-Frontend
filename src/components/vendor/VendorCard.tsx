import { memo, useCallback } from "react";
import { MapPin, Star, Store } from "lucide-react";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistance } from "@/hooks/useGeoDistance";
import { useVendorCertificationCached } from "@/hooks/useVendorCertificationCache";
import { CertifiedIcon } from "@/components/vendor/CertifiedVendorBadge";
import { useTranslation } from "@/hooks/useTranslation";


interface VendorCardProps {
  vendor: {
    id: string;
    user_id?: string | null;
    business_name: string;
    description?: string | null;
    address?: string | null;
    logo_url?: string | null;
    rating?: number | null;
    city?: string | null;
    neighborhood?: string | null;
    is_verified?: boolean | null;
    distance?: number | null;
    shop_slug?: string | null;
  };
  index: number;
  onNavigate: (vendorId: string, shopSlug?: string | null) => void;
}

/**
 * Carte vendeur optimisée avec React.memo pour éviter les re-renders inutiles
 */
function VendorCardComponent({ vendor, index, onNavigate }: VendorCardProps) {
  const { t } = useTranslation();
  // ✅ Source de vérité unique pour la certification = table vendor_certifications.
  // ⚠️ vendor_certifications.vendor_id = le USER_ID du vendeur (pas vendors.id) → on doit
  // interroger le cache avec vendor.user_id (fallback id pour ne rien casser).
  // Le champ vendor.is_verified n'est PLUS utilisé pour l'affichage (il était mis à true
  // automatiquement à la création par agent, sans vérification réelle → badge trompeur).
  const { isCertified } = useVendorCertificationCached(vendor.user_id || vendor.id);

  // Handler optimisé: décale la navigation avec requestAnimationFrame
  const handleClick = useCallback(() => {
    // Évite les calculs synchrones lourds dans le clic
    requestAnimationFrame(() => {
      onNavigate(vendor.id, vendor.shop_slug);
    });
  }, [vendor.id, vendor.shop_slug, onNavigate]);

  return (
    <div
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex flex-col p-4 rounded-2xl text-left",
        "bg-card border border-border/50",
        "hover:border-primary/30 hover:shadow-lg transition-all duration-300",
        "hover:-translate-y-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Favori vendeur (petit mais visible) */}
      <FavoriteButton vendorId={vendor.id} className="absolute top-2 left-2 z-10" size="sm" />

      {vendor.distance !== null ? (
        <div className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {formatDistance(vendor.distance)}
        </div>
      ) : (
        <div className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-medium shadow-sm">
          {t('vendorCard.noGps')}
        </div>
      )}

      <div className="w-14 h-14 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden mb-3 group-hover:scale-105 transition-transform">
        {vendor.logo_url ? (
          <img
            src={vendor.logo_url}
            alt={`${t('vendorCard.logoAlt')} ${vendor.business_name}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Store className="w-7 h-7 text-primary" />
        )}
      </div>

      <div className="flex-1 space-y-2">
        <h2 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors flex items-center gap-1">
          {vendor.business_name}
          {isCertified && <CertifiedIcon status="CERTIFIE" className="w-3.5 h-3.5 shrink-0" />}
        </h2>

        {(vendor.city || vendor.neighborhood || vendor.address) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="line-clamp-1">
              {[vendor.neighborhood, vendor.city, !vendor.city && !vendor.neighborhood ? vendor.address : null]
                .filter(Boolean)
                .join(", ")}
            </span>
          </p>
        )}

        {vendor.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{vendor.description}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {/* Rating - seulement si disponible (données réelles) */}
          {vendor.rating !== null && vendor.rating !== undefined && vendor.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-[#ff4000] fill-[#ff4000]" />
              <span className="text-xs font-semibold text-foreground">{vendor.rating.toFixed(1)}</span>
            </div>
          )}
          {isCertified && (
            <Badge variant="secondary" className="text-[10px]">{t('vendorCard.verified')}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Mémorise le composant pour éviter les re-renders quand les props n'ont pas changé
export const VendorCard = memo(VendorCardComponent, (prevProps, nextProps) => {
  // Re-render uniquement si les données essentielles changent
  return (
    prevProps.vendor.id === nextProps.vendor.id &&
    prevProps.vendor.distance === nextProps.vendor.distance &&
    prevProps.vendor.rating === nextProps.vendor.rating &&
    prevProps.index === nextProps.index
  );
});

export default VendorCard;

