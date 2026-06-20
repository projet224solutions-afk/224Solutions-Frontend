/**
 * PAGE OBLIGATOIRE: Sélection du pays de résidence
 * Affichée après la connexion Google/Facebook si le pays n'a pas encore été renseigné.
 * L'utilisateur choisit son pays → le système déduit automatiquement la devise
 * → wallet créé/mis à jour avec la bonne devise, verrouillée.
 */

import { useState, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { COUNTRY_TO_CURRENCY } from "@/data/countryMappings";
import { useCurrency } from "@/contexts/CurrencyContext";
import { resolvePostAuthRouteSync } from "@/utils/postAuthRoute";
import { toast } from "sonner";
import { Search, Globe, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Pays avec leurs noms affichables et drapeaux emoji
const COUNTRIES: Array<{ code: string; name: string; flag: string }> = [
  // ─── AFRIQUE DE L'OUEST (priorité) ─────────────────────────
  { code: "GN", name: "Guinée",           flag: "🇬🇳" },
  { code: "SN", name: "Sénégal",          flag: "🇸🇳" },
  { code: "CI", name: "Côte d'Ivoire",    flag: "🇨🇮" },
  { code: "ML", name: "Mali",             flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso",     flag: "🇧🇫" },
  { code: "NE", name: "Niger",            flag: "🇳🇪" },
  { code: "TG", name: "Togo",             flag: "🇹🇬" },
  { code: "BJ", name: "Bénin",            flag: "🇧🇯" },
  { code: "GW", name: "Guinée-Bissau",    flag: "🇬🇼" },
  { code: "GM", name: "Gambie",           flag: "🇬🇲" },
  { code: "SL", name: "Sierra Leone",     flag: "🇸🇱" },
  { code: "LR", name: "Liberia",          flag: "🇱🇷" },
  { code: "GH", name: "Ghana",            flag: "🇬🇭" },
  { code: "NG", name: "Nigeria",          flag: "🇳🇬" },
  { code: "CV", name: "Cap-Vert",         flag: "🇨🇻" },
  { code: "MR", name: "Mauritanie",       flag: "🇲🇷" },
  // ─── AFRIQUE CENTRALE ───────────────────────────────────────
  { code: "CM", name: "Cameroun",         flag: "🇨🇲" },
  { code: "GA", name: "Gabon",            flag: "🇬🇦" },
  { code: "CG", name: "Congo",            flag: "🇨🇬" },
  { code: "CD", name: "RD Congo",         flag: "🇨🇩" },
  { code: "CF", name: "Centrafrique",     flag: "🇨🇫" },
  { code: "TD", name: "Tchad",            flag: "🇹🇩" },
  { code: "GQ", name: "Guinée Équatoriale", flag: "🇬🇶" },
  { code: "ST", name: "Sao Tomé-et-Príncipe", flag: "🇸🇹" },
  // ─── AFRIQUE DU NORD ────────────────────────────────────────
  { code: "MA", name: "Maroc",            flag: "🇲🇦" },
  { code: "DZ", name: "Algérie",          flag: "🇩🇿" },
  { code: "TN", name: "Tunisie",          flag: "🇹🇳" },
  { code: "EG", name: "Égypte",           flag: "🇪🇬" },
  { code: "LY", name: "Libye",            flag: "🇱🇾" },
  // ─── AFRIQUE DE L'EST ────────────────────────────────────────
  { code: "KE", name: "Kenya",            flag: "🇰🇪" },
  { code: "TZ", name: "Tanzanie",         flag: "🇹🇿" },
  { code: "UG", name: "Ouganda",          flag: "🇺🇬" },
  { code: "RW", name: "Rwanda",           flag: "🇷🇼" },
  { code: "ET", name: "Éthiopie",         flag: "🇪🇹" },
  { code: "BI", name: "Burundi",          flag: "🇧🇮" },
  { code: "DJ", name: "Djibouti",         flag: "🇩🇯" },
  // ─── AFRIQUE AUSTRALE ────────────────────────────────────────
  { code: "ZA", name: "Afrique du Sud",   flag: "🇿🇦" },
  { code: "AO", name: "Angola",           flag: "🇦🇴" },
  { code: "MZ", name: "Mozambique",       flag: "🇲🇿" },
  { code: "ZM", name: "Zambie",           flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe",         flag: "🇿🇼" },
  { code: "NA", name: "Namibie",          flag: "🇳🇦" },
  { code: "BW", name: "Botswana",         flag: "🇧🇼" },
  { code: "MG", name: "Madagascar",       flag: "🇲🇬" },
  { code: "MU", name: "Maurice",          flag: "🇲🇺" },
  { code: "KM", name: "Comores",          flag: "🇰🇲" },
  // ─── EUROPE ─────────────────────────────────────────────────
  { code: "FR", name: "France",           flag: "🇫🇷" },
  { code: "BE", name: "Belgique",         flag: "🇧🇪" },
  { code: "CH", name: "Suisse",           flag: "🇨🇭" },
  { code: "DE", name: "Allemagne",        flag: "🇩🇪" },
  { code: "GB", name: "Royaume-Uni",      flag: "🇬🇧" },
  { code: "IT", name: "Italie",           flag: "🇮🇹" },
  { code: "ES", name: "Espagne",          flag: "🇪🇸" },
  { code: "PT", name: "Portugal",         flag: "🇵🇹" },
  { code: "NL", name: "Pays-Bas",         flag: "🇳🇱" },
  { code: "LU", name: "Luxembourg",       flag: "🇱🇺" },
  { code: "NO", name: "Norvège",          flag: "🇳🇴" },
  { code: "SE", name: "Suède",            flag: "🇸🇪" },
  { code: "DK", name: "Danemark",         flag: "🇩🇰" },
  { code: "PL", name: "Pologne",          flag: "🇵🇱" },
  { code: "RU", name: "Russie",           flag: "🇷🇺" },
  { code: "TR", name: "Turquie",          flag: "🇹🇷" },
  // ─── AMÉRIQUE DU NORD ───────────────────────────────────────
  { code: "US", name: "États-Unis",       flag: "🇺🇸" },
  { code: "CA", name: "Canada",           flag: "🇨🇦" },
  { code: "MX", name: "Mexique",          flag: "🇲🇽" },
  // ─── AMÉRIQUE DU SUD ────────────────────────────────────────
  { code: "BR", name: "Brésil",           flag: "🇧🇷" },
  { code: "AR", name: "Argentine",        flag: "🇦🇷" },
  { code: "CO", name: "Colombie",         flag: "🇨🇴" },
  { code: "CL", name: "Chili",            flag: "🇨🇱" },
  { code: "HT", name: "Haïti",            flag: "🇭🇹" },
  // ─── MOYEN-ORIENT ───────────────────────────────────────────
  { code: "AE", name: "Émirats Arabes Unis", flag: "🇦🇪" },
  { code: "SA", name: "Arabie Saoudite",  flag: "🇸🇦" },
  { code: "QA", name: "Qatar",            flag: "🇶🇦" },
  { code: "KW", name: "Koweït",           flag: "🇰🇼" },
  // ─── ASIE ────────────────────────────────────────────────────
  { code: "CN", name: "Chine",            flag: "🇨🇳" },
  { code: "JP", name: "Japon",            flag: "🇯🇵" },
  { code: "IN", name: "Inde",             flag: "🇮🇳" },
  { code: "SG", name: "Singapour",        flag: "🇸🇬" },
  { code: "MY", name: "Malaisie",         flag: "🇲🇾" },
  // ─── OCÉANIE ────────────────────────────────────────────────
  { code: "AU", name: "Australie",        flag: "🇦🇺" },
  { code: "NZ", name: "Nouvelle-Zélande", flag: "🇳🇿" },
];

export default function SelectCountryPage() {
  const { t } = useTranslation();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, profile, refreshProfile } = useAuth();

  const { setCurrency: setGlobalCurrency } = useCurrency();

  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<typeof COUNTRIES[0] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [needsAdmin, setNeedsAdmin] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const handleConfirm = async () => {
    if (!selected || !user) return;

    const currency = COUNTRY_TO_CURRENCY[selected.code] || "GNF";
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "complete_country_setup",
        {
          p_country_code: selected.code,
          p_country_name: selected.name,
          p_currency:     currency,
        }
      );

      if (rpcError) throw rpcError;

      const result = data as {
        success: boolean;
        currency?: string;
        needs_admin_review?: boolean;
        error?: string;
      };

      if (!result?.success) {
        throw new Error(result?.error || "Erreur lors de la configuration du pays");
      }

      // Mettre à jour le contexte de devise global immédiatement
      setGlobalCurrency(currency);

      // Synchroniser le cache géo pour éviter que syncFromGeoCache revienne à GNF
      try {
        const geoCache = { data: { country: selected.code, currency, detectionMethod: 'manual' }, timestamp: Date.now() };
        localStorage.setItem('geo_detection_cache', JSON.stringify(geoCache));
      } catch {}

      if (result.needs_admin_review) {
        setNeedsAdmin(true);
        toast.warning(
          "Votre wallet existant a un solde — un admin vérifiera la mise à jour de devise.",
          { duration: 8000 }
        );
      } else {
        toast.success(
          `Pays enregistré : ${selected.name} — Devise wallet : ${currency}`,
          { duration: 5000 }
        );
      }

      // Rafraîchir le profil pour que le gate ne se déclenche plus
      await refreshProfile();

      // Rediriger vers le dashboard
      const from = (location.state as any)?.from;
      const dashboardRoute = profile?.role
        ? resolvePostAuthRouteSync(profile.role)
        : "/";
      navigate(from || dashboardRoute, { replace: true });

    } catch (err: any) {
      console.error("❌ Erreur complete_country_setup:", err);
      setError(err?.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* En-tête */}
        <div className="bg-[#04439e] px-6 py-8 text-white text-center">
          <div className="flex justify-center mb-3">
            <Globe className="w-10 h-10 opacity-90" />
          </div>
          <h1 className="text-2xl font-bold">{t('selectCountryPage.votrePaysDeResidence')}</h1>
          <p className="text-blue-200 text-sm mt-2">
            Sélectionnez le pays où vous résidez.<br />
            Votre devise wallet sera attribuée automatiquement.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Erreur */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Message admin */}
          {needsAdmin && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Votre wallet a déjà un solde. Un administrateur sera contacté
                pour valider le changement de devise.
              </AlertDescription>
            </Alert>
          )}

          {/* Pays sélectionné */}
          {selected && (
            <div className="flex items-center gap-3 rounded-lg border-2 border-[#04439e] bg-blue-50 p-3">
              <span className="text-3xl">{selected.flag}</span>
              <div className="flex-1">
                <p className="font-semibold text-[#04439e]">{selected.name}</p>
                <p className="text-sm text-gray-500">
                  Devise : <strong>{COUNTRY_TO_CURRENCY[selected.code] || "GNF"}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Changer
              </button>
            </div>
          )}

          {/* Recherche + liste (cachée si pays déjà sélectionné) */}
          {!selected && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={t('selectCountryPage.rechercherUnPays')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
                {filtered.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Aucun pays trouvé pour « {search} »
                  </div>
                ) : (
                  filtered.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => setSelected(country)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                    >
                      <span className="text-2xl">{country.flag}</span>
                      <span className="flex-1 text-sm font-medium text-gray-800">
                        {country.name}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {COUNTRY_TO_CURRENCY[country.code] || "—"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* Bouton de confirmation */}
          <Button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="w-full bg-[#04439e] hover:bg-[#012070] text-white font-semibold py-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Configuration en cours...
              </>
            ) : (
              `Confirmer — ${selected ? selected.name : "sélectionnez un pays"}`
            )}
          </Button>

          <p className="text-xs text-center text-gray-400">
            La devise de votre wallet est attribuée selon votre pays de résidence.
          </p>
        </div>
      </div>
    </div>
  );
}
