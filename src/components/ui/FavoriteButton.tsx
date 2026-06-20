/**
 * FAVORITE BUTTON - Bouton favori réutilisable
 * Petit cœur discret à placer sur les cartes produit/vendeur
 */
import { Heart } from "lucide-react";
import { useState, useEffect, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FavoriteButtonProps = {
  className?: string;
  size?: "sm" | "md";
} & (
  | { productId: string; vendorId?: never }
  | { vendorId: string; productId?: never }
);

function FavoriteButtonComponent({ productId, vendorId, className, size = "sm" }: FavoriteButtonProps) {
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(false);

  const target = productId
    ? ({ kind: "product", column: "product_id", id: productId } as const)
    : vendorId
      ? ({ kind: "vendor", column: "vendor_id", id: vendorId } as const)
      : null;

  useEffect(() => {
    if (!user?.id || !target?.id) return;
    let cancelled = false;

    const wl = supabase.from("wishlists" as any);

    wl.select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq(target.column, target.id)
      .then(({ count }: { count: number | null }) => {
        if (!cancelled) setIsFav((count || 0) > 0);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, target?.column, target?.id]);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!target?.id) return;

      if (!user?.id) {
        toast.error("Connectez-vous pour ajouter aux favoris");
        return;
      }

      setLoading(true);

      try {
        const wl = supabase.from("wishlists" as any);

        if (isFav) {
          await wl.delete().eq("user_id", user.id).eq(target.column, target.id);
          setIsFav(false);
          toast.success("Retiré des favoris");
          return;
        }

        const { error } = await wl.insert({
          user_id: user.id,
          [target.column]: target.id,
        });

        if (error?.code === "23505") {
          setIsFav(true);
          return;
        }
        if (error) throw error;

        setIsFav(true);
        toast.success("Ajouté aux favoris ❤️");
      } catch (err: any) {
        console.error("❌ Erreur favori:", err);
        toast.error("Impossible de modifier les favoris");
      } finally {
        setLoading(false);
      }
    },
    [user?.id, target?.column, target?.id, isFav]
  );

  const sizeClasses = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  // Important: si aucune cible n'est fournie, on ne rend rien (évite un bouton non fonctionnel)
  if (!target?.id) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={
        isFav
          ? `Retirer ${target.kind === "product" ? "le produit" : "le vendeur"} des favoris`
          : `Ajouter ${target.kind === "product" ? "le produit" : "le vendeur"} aux favoris`
      }
      className={cn(
        "flex items-center justify-center",
        "transition-all duration-200",
        "hover:scale-110 active:scale-95",
        "disabled:opacity-50",
        sizeClasses,
        className
      )}
    >
      <Heart
        className={cn(iconSize, isFav && "fill-current")}
        style={{ color: "#ff4000" }}
      />
    </button>
  );
}

export const FavoriteButton = memo(FavoriteButtonComponent);
export default FavoriteButton;
