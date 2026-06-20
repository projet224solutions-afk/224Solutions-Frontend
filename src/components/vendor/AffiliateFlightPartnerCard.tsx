import { ArrowUpRight, ExternalLink, Plane, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";

interface AffiliateFlightPartnerCardProps {
  product: any;
  fallbackCurrency?: string;
  onOpen: () => void;
}

const ZERO_DECIMAL_CURRENCIES = new Set(["GNF", "XOF", "XAF", "JPY"]);

function normalizePartnerUrl(url?: string) {
  if (!url) {
    return null;
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

function formatPartnerReference(t: (k: string) => string, amount?: number | null, currency?: string) {
  const normalizedAmount = Number(amount || 0);
  const normalizedCurrency = currency || "GNF";

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return t("flightPartner.partnerOffer");
  }

  const decimals = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 0 : 2;
  const formattedAmount = normalizedAmount.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${t("flightPartner.startingFrom")} ${formattedAmount} ${normalizedCurrency}`;
}

export function AffiliateFlightPartnerCard({
  product,
  fallbackCurrency = "GNF",
  onOpen,
}: AffiliateFlightPartnerCardProps) {
  const { t } = useTranslation();
  const coverImage = product.images?.[0];
  const description = product.short_description || product.description || t("flightPartner.descFallback");
  const referencePrice = formatPartnerReference(t, product.price, product.currency || fallbackCurrency);
  const partnerUrl = normalizePartnerUrl(product.affiliate_url);

  const handlePartnerRedirect = () => {
    if (partnerUrl) {
      window.location.assign(partnerUrl);
      return;
    }

    onOpen();
  };

  return (
    <Card
      className="group overflow-hidden border-orange-200/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-100/80 cursor-pointer"
      onClick={onOpen}
    >
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-slate-950 via-orange-950 to-[#ff4000]">
        {coverImage ? (
          <img
            src={coverImage}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge className="border-0 bg-white/14 text-white backdrop-blur-sm hover:bg-white/14">
            <Ticket className="mr-1 h-3 w-3" />
            {t("flightPartner.flightTicket")}
          </Badge>
        </div>

        <div className="absolute right-3 top-3">
          <Badge className="border-0 bg-orange-500 text-white hover:bg-orange-500">
            <ExternalLink className="mr-1 h-3 w-3" />
            {t("flightPartner.partner")}
          </Badge>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-medium backdrop-blur-sm">
            <Plane className="h-3.5 w-3.5" />
            {t("flightPartner.affiliateBooking")}
          </div>
          <h3 className="text-lg font-semibold leading-snug line-clamp-2">
            {product.title}
          </h3>
        </div>
      </div>

      <CardContent className="space-y-4 p-4">
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-700">
                {t("flightPartner.partnerMode")}
              </p>
              <p className="mt-1 text-lg font-semibold text-orange-600">
                {referencePrice}
              </p>
            </div>
            <div className="rounded-full bg-white p-2 text-orange-500 shadow-sm">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        <Button
          className="w-full bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 hover:shadow-orange-500/30"
          onClick={(event) => {
            event.stopPropagation();
            handlePartnerRedirect();
          }}
        >
          <Plane className="mr-2 h-4 w-4" />
          {t("flightPartner.bookFlight")}
        </Button>
      </CardContent>
    </Card>
  );
}

export default AffiliateFlightPartnerCard;