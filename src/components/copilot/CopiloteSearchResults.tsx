/**
 * COPILOTE SEARCH RESULTS
 * Affiche les cartes de résultats avec boutons d'action
 * 224Solutions
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  Phone,
  MessageCircle,
  ShoppingCart,
  Calendar,
  Navigation,
  ExternalLink,
  Star,
  CheckCircle,
  Clock,
  Truck,
  Package,
  Store,
  Scissors,
  Search,
  Copy,
  Check,
} from "lucide-react";
import {
  CopiloteSearchResponse,
  SearchResultItem,
  formatPriceGNF,
  buildWhatsAppLink,
  buildItineraryLink,
  formatDistance,
} from "@/services/copilote/copiloteSearchService";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CopiloteSearchResultsProps {
  data: CopiloteSearchResponse;
}

// ─── Filtre ───────────────────────────────────────────────────────────────────

type FilterType = "all" | "product" | "shop" | "service";

const FILTER_LABELS: Record<FilterType, string> = {
  all: "Tout",
  product: "Produits",
  shop: "Boutiques",
  service: "Services",
};

// ─── Icône par type ───────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: SearchResultItem["type"] }) {
  if (type === "product") return <Package className="w-3.5 h-3.5" />;
  if (type === "service") return <Scissors className="w-3.5 h-3.5" />;
  return <Store className="w-3.5 h-3.5" />;
}

// ─── Carte résultat ───────────────────────────────────────────────────────────

function ResultCard({ item }: { item: SearchResultItem }) {
  const [copied, setCopied] = useState(false);
  const phone = item.phone ?? item.shop?.phone ?? null;
  const lat = item.location?.latitude;
  const lng = item.location?.longitude;
  const hasMap = lat != null && lng != null;
  const shopName = item.shop?.name ?? null;
  const cityLabel = item.location?.city ?? item.shop?.city ?? null;

  // Label badge type
  const typeLabel =
    item.type === "product" ? "Produit" : item.type === "service" ? "Service" : "Boutique";
  const typeBadgeClass =
    item.type === "product"
      ? "bg-blue-100 text-blue-700"
      : item.type === "service"
      ? "bg-blue-100 text-[#04439e]"
      : "bg-orange-100 text-[#ff4000]";

  return (
    <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Image */}
          <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <TypeIcon type={item.type} />
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1 mb-0.5">
              <h4 className="font-semibold text-sm leading-tight truncate pr-1">{item.name}</h4>
              <Badge className={`${typeBadgeClass} text-[10px] px-1.5 py-0 flex-shrink-0 flex items-center gap-0.5`}>
                <TypeIcon type={item.type} />
                {typeLabel}
              </Badge>
            </div>

            {/* Shop / prestataire */}
            {shopName && (
              <p className="text-xs text-muted-foreground truncate">{shopName}</p>
            )}

            {/* Prix + durée */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {item.price != null && (
                <span className="text-sm font-bold text-primary">
                  {formatPriceGNF(item.price)}
                </span>
              )}
              {item.durationMinutes && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {item.durationMinutes} min
                </span>
              )}
            </div>

            {/* Métadonnées */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.rating != null && (
                <span className="flex items-center gap-0.5 text-xs">
                  <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              {item.isVerified && (
                <span className="flex items-center gap-0.5 text-xs text-[#ff4000]">
                  <CheckCircle className="w-3 h-3" />
                  Vérifié
                </span>
              )}
              {item.distanceKm != null && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {formatDistance(item.distanceKm)}
                </span>
              )}
              {cityLabel && !item.distanceKm && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {cityLabel}
                </span>
              )}
              {item.deliveryEnabled && (
                <span className="flex items-center gap-0.5 text-xs text-blue-600">
                  <Truck className="w-3 h-3" />
                  Livraison
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description courte */}
        {item.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Boutons d'action */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {/* Ouvrir — navigation interne React Router */}
          <Link to={item.links.view} className="flex-shrink-0">
            <Button size="sm" className="h-7 px-2.5 text-xs gap-1">
              <ExternalLink className="w-3 h-3" />
              Ouvrir
            </Button>
          </Link>

          {/* Copier le lien */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1 flex-shrink-0"
            onClick={() => {
              const fullUrl = `${window.location.origin}${item.links.view}`;
              navigator.clipboard.writeText(fullUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? <Check className="w-3 h-3 text-[#ff4000]" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copié !" : "Copier lien"}
          </Button>

          {/* Commander (produits) — navigation interne */}
          {item.type === "product" && item.links.order && (
            <Link to={item.links.order} className="flex-shrink-0">
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                <ShoppingCart className="w-3 h-3" />
                Commander
              </Button>
            </Link>
          )}

          {/* Réserver (services) — navigation interne */}
          {item.type === "service" && item.links.book && (
            <Link to={item.links.book} className="flex-shrink-0">
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                <Calendar className="w-3 h-3" />
                Réserver
              </Button>
            </Link>
          )}

          {/* Voir la boutique (pour un produit) — navigation interne */}
          {item.type === "product" && item.shop?.id && (
            <Link to={`/shop/${item.shop.id}`} className="flex-shrink-0">
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                <Store className="w-3 h-3" />
                Boutique
              </Button>
            </Link>
          )}

          {/* Appeler — lien externe tel: */}
          {phone && (
            <a href={`tel:+${phone}`} className="flex-shrink-0">
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                <Phone className="w-3 h-3" />
                Appeler
              </Button>
            </a>
          )}

          {/* WhatsApp — lien externe */}
          {phone && (
            <a
              href={buildWhatsAppLink(phone, `Bonjour, je vous contacte via 224Solutions pour "${item.name}".`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1 text-[#ff4000] border-orange-200 hover:bg-orange-50"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </Button>
            </a>
          )}

          {/* Itinéraire — lien externe Google Maps */}
          {hasMap && (
            <a
              href={buildItineraryLink(lat!, lng!, item.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                <Navigation className="w-3 h-3" />
                Itinéraire
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CopiloteSearchResults({ data }: CopiloteSearchResultsProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const typesPresent = Array.from(new Set(data.results.map((r) => r.type)));
  const showFilter = typesPresent.length > 1;

  const filtered =
    filter === "all" ? data.results : data.results.filter((r) => r.type === filter);

  // ── Cas : aucun résultat ──
  if (data.total === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-[#ff4000]/30 rounded-xl border border-orange-200 dark:border-[#ff4000]">
          <Search className="w-4 h-4 text-[#ff4000] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#ff4000] dark:text-orange-200">
              Aucun résultat trouvé
            </p>
            <p className="text-xs text-[#ff4000] dark:text-orange-300 mt-0.5">
              Recherche : <em>"{data.query}"</em>
            </p>
          </div>
        </div>

        {data.alternatives.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Suggestions :</p>
            {data.alternatives.map((alt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-1 h-1 bg-muted-foreground rounded-full flex-shrink-0" />
                {alt}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Résultats ──
  return (
    <div className="space-y-3 w-full">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground">
          {data.total} résultat{data.total > 1 ? "s" : ""} · "
          <span className="text-foreground">{data.query}</span>"
          {data.intent.location && (
            <span className="text-primary"> · {data.intent.location}</span>
          )}
        </p>
        {data.intent.urgency && (
          <Badge variant="destructive" className="text-[10px] h-4">Urgent</Badge>
        )}
      </div>

      {/* Filtres */}
      {showFilter && (
        <div className="flex gap-1.5 flex-wrap">
          {(["all", ...typesPresent] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {FILTER_LABELS[f]}
              {f !== "all" && (
                <span className="ml-1 opacity-70">
                  ({data.results.filter((r) => r.type === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Cartes */}
      <div className="space-y-2">
        {filtered.map((item) => (
          <ResultCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>

      {/* Budget hint */}
      {data.intent.budget && (
        <p className="text-xs text-muted-foreground text-center">
          Résultats filtrés pour un budget ≤ {formatPriceGNF(data.intent.budget)}
        </p>
      )}
    </div>
  );
}
