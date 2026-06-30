import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { backendFetch } from "@/services/backendApi";
import { useAuth } from "@/hooks/useAuth";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ProgramInfo {
  enabled: boolean;
  commission_rate: number;
  ref: string | null;
  can_affiliate: boolean;
}

/**
 * 🤝 Encart d'affiliation sur la fiche produit.
 *  - Capture le clic d'affiliation (?ref=) une fois l'acheteur connecté (attribution 30 j).
 *  - Propose à tout utilisateur connecté (hors propriétaire) d'obtenir son lien d'affiliation.
 */
export default function ProductAffiliateBox({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [info, setInfo] = useState<ProgramInfo | null>(null);
  const [link, setLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1) Capture du clic d'affiliation (best-effort, ne bloque jamais l'achat).
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref || !productId || !user?.id) return;
    backendFetch("/api/affiliate-program/track-click", {
      method: "POST",
      body: { product_id: productId, ref },
    }).catch(() => {});
  }, [searchParams, productId, user?.id]);

  // 2) Infos programme + lien de l'utilisateur courant.
  const loadInfo = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const res = await backendFetch<ProgramInfo>(`/api/affiliate-program/product/${productId}`, {
      allowAnonymous: true,
    });
    if (res.success) setInfo(res as unknown as ProgramInfo);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const generateLink = () => {
    if (!info?.ref) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${base}/digital-product/${productId}?ref=${info.ref}`);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t('productAffiliateBox.lienDAffiliationCopie'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('productAffiliateBox.impossibleDeCopierLeLien'));
    }
  };

  // Rien à afficher si le programme n'est pas actif sur ce produit.
  if (loading || !info?.enabled) return null;

  return (
    <div className="rounded-lg border border-[#ff4000]/20 bg-[#ff4000]/5 p-4">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-[#ff4000]" />
        <span className="text-sm font-semibold text-[#ff4000]">
          Gagnez {info.commission_rate}% en recommandant ce produit
        </span>
      </div>

      {!user?.id ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Connectez-vous pour obtenir votre lien d'affiliation et toucher une commission sur chaque
          vente que vous générez.
        </p>
      ) : !info.can_affiliate ? (
        <p className="mt-2 text-xs text-muted-foreground">
          L'affiliation n'est pas disponible pour vous sur ce produit.
        </p>
      ) : !link ? (
        <Button size="sm" className="mt-3" onClick={generateLink}>
          <Share2 className="mr-2 h-4 w-4" />
          Obtenir mon lien d'affiliation
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={link}
              readOnly
              className="font-mono text-xs"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Partagez ce lien. Toute commande passée dans les 30 jours suivant un clic vous rapporte{" "}
            {info.commission_rate}% du montant — versés après confirmation de la livraison.
          </p>
        </div>
      )}
    </div>
  );
}
