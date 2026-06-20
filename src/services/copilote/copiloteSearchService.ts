/**
 * COPILOTE SEARCH — Service frontend
 * Appelle POST /edge-functions/copilote/search via backendFetch
 * 224Solutions
 */

import { backendFetch } from "@/services/backendApi";

// ─── Types exportés ───────────────────────────────────────────────────────────

export interface SearchShopRef {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  logo?: string | null;
}

export interface SearchLocation {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
}

export interface SearchResultItem {
  id: string;
  type: "product" | "shop" | "service";
  name: string;
  description?: string | null;
  price?: number | null;
  currency: string;
  image?: string | null;
  rating?: number | null;
  isVerified: boolean;
  isActive: boolean;
  stockQuantity?: number | null;
  durationMinutes?: number | null;
  shop?: SearchShopRef | null;
  location?: SearchLocation | null;
  deliveryEnabled: boolean;
  distanceKm?: number | null;
  relevanceScore: number;
  links: {
    view: string;
    order?: string;
    book?: string;
  };
  phone?: string | null;
}

export interface SearchIntent {
  type: "product" | "service" | "shop" | "address" | "mixed";
  keywords: string[];
  location: string | null;
  budget: number | null;
  urgency: boolean;
  category: string;
  action: "buy" | "book" | "contact" | "navigate" | "info";
}

export interface CopiloteSearchResponse {
  success: boolean;
  intent: SearchIntent;
  results: SearchResultItem[];
  total: number;
  message: string;
  alternatives: string[];
  query: string;
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export async function copiloteSearch(
  query: string,
  userLocation?: { latitude: number; longitude: number } | null
): Promise<CopiloteSearchResponse> {
  const response = await backendFetch<CopiloteSearchResponse>(
    "/edge-functions/copilote/search",
    {
      method: "POST",
      body: { query: query.trim(), userLocation: userLocation ?? null },
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error ?? "Erreur de recherche Copilote");
  }

  return response.data;
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

/** Formate un prix en GNF */
export function formatPriceGNF(price: number | null | undefined): string {
  if (price == null) return "";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "GNF",
    maximumFractionDigits: 0,
  }).format(price);
}

/** Construit le lien WhatsApp */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("224") ? digits : `224${digits}`;
  const text = encodeURIComponent(message ?? "Bonjour, je vous contacte via 224Solutions.");
  return `https://wa.me/${number}?text=${text}`;
}

/** Construit le lien Google Maps itinéraire */
export function buildItineraryLink(lat: number, lng: number, label?: string): string {
  const dest = `${lat},${lng}`;
  const name = label ? encodeURIComponent(label) : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&destination_place_id=${name}`;
}

/** Texte de distance humain */
export function formatDistance(km: number | null | undefined): string {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
