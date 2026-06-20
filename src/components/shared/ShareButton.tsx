import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Check, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createShortLink } from "@/services/shortLinkService";
import { toPublicShareUrl } from "@/lib/site";
import { canUseNativeShare, tryNativeShare } from "@/utils/nativeShare";

function sanitizeShareUrl(rawUrl: string): string {
  return toPublicShareUrl(rawUrl);
}

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  resourceType?: "shop" | "product" | "service" | "digital_product" | "other";
  resourceId?: string;
  useShortUrl?: boolean;
  ogType?: "product" | "shop" | "digital_product";
  imageUrl?: string;
  description?: string;
  price?: number;
  currency?: string;
}

export function ShareButton({
  title,
  text,
  url,
  variant = "outline",
  size = "icon",
  className,
  resourceType = "other",
  resourceId,
  useShortUrl = false,
  imageUrl,
  description,
  price,
  currency,
}: ShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const shareUrl = sanitizeShareUrl(url || window.location.href);
  const shareText = text || title;
  const nativeShareAvailable = canUseNativeShare({ title, text: shareText, url: shareUrl });

  /**
   * Obtient l'URL de partage.
   * Si useShortUrl=true, crée un vrai short link serveur.
   * Plus de fallback vers des liens longs og-meta.
   */
  const getShareUrl = async (): Promise<string> => {
    if (!useShortUrl) {
      return shareUrl;
    }

    setLoading(true);
    try {
      const shortUrl = await createShortLink({
        originalUrl: shareUrl,
        title,
        type: resourceType,
        resourceId,
        imageUrl,
        description: description || text,
        price,
        currency,
      });

      if (shortUrl) {
        console.log('🔗 [ShareButton] Short link created:', shortUrl);
        return shortUrl;
      }

      // Si la création échoue, on utilise l'URL publique propre (pas de lien og-meta long)
      console.warn('🔗 [ShareButton] Short link creation failed, using clean public URL');
      return shareUrl;
    } catch (error) {
      console.error("🔗 [ShareButton] Error creating short URL:", error);
      return shareUrl;
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const urlToShare = await getShareUrl();
      await navigator.clipboard.writeText(urlToShare);
      setCopied(true);
      toast.success(t('shareButton.lienCopieDansLePresse'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Erreur lors de la copie:", error);
      toast.error(t('shareButton.impossibleDeCopierLeLien'));
    }
  };

  const handleNativeShare = async () => {
    try {
      const urlToShare = await getShareUrl();

      const shareResult = await tryNativeShare({ title, text: shareText, url: urlToShare });

      if (shareResult === "shared") {
        toast.success(t('shareButton.partageReussi'));
        return;
      }

      if (shareResult === "fallback") {
        await navigator.clipboard.writeText(urlToShare);
        setCopied(true);
        toast.success(t('shareButton.lienCopieDansLePresse'));
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Erreur lors du partage:", error);
      await handleCopyLink();
    }
  };

  const handleWhatsAppShare = async () => {
    const urlToShare = await getShareUrl();
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${urlToShare}`)}`, "_blank");
    toast.success(t('shareButton.ouvertureDeWhatsapp'));
  };

  const handleFacebookShare = async () => {
    const urlToShare = await getShareUrl();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlToShare)}`, "_blank", "width=600,height=400");
    toast.success(t('shareButton.ouvertureDeFacebook'));
  };

  const handleTwitterShare = async () => {
    const urlToShare = await getShareUrl();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(urlToShare)}`, "_blank", "width=600,height=400");
    toast.success("Ouverture de Twitter/X...");
  };

  const ButtonContent = () => (
    <>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Share2 className="w-4 h-4" />
      )}
      {size !== "icon" && <span className="ml-2">Partager</span>}
    </>
  );

  if (nativeShareAvailable) {
    return (
      <Button variant={variant} size={size} onClick={handleNativeShare} className={className} title="Partager" disabled={loading}>
        <ButtonContent />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} title="Partager" disabled={loading}>
          <ButtonContent />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          {copied ? <Check className="w-4 h-4 mr-2 text-[#ff4000]" /> : <Link2 className="w-4 h-4 mr-2" />}
          Copier le lien
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsAppShare} className="cursor-pointer">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleFacebookShare} className="cursor-pointer">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTwitterShare} className="cursor-pointer">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Twitter/X
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ShareButton;
