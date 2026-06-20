/**
 * TRANSLATED PRODUCT CARD - Carte produit avec traduction automatique
 * Utilise useProductTranslation pour traduire le nom et la description
 */

import { useEffect, useState } from 'react';
import { MarketplaceProductCard } from './MarketplaceProductCard';
import { useProductTranslation } from '@/hooks/useProductTranslation';

interface TranslatedProductCardProps {
  id: string;
  image: string | string[];
  promotionalVideos?: string[];
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  vendor: string;
  vendorId?: string;
  vendorUserId?: string;
  vendorPublicId?: string;
  vendorLocation?: string;
  vendorRating?: number;
  vendorRatingCount?: number;
  rating: number;
  reviewCount: number;
  isPremium?: boolean;
  stock?: number;
  category?: string;
  deliveryTime?: string;
  onBuy?: () => void;
  onAddToCart?: () => void;
  onContact?: () => void;
  contactLoading?: boolean;
}

export function TranslatedProductCard({
  id,
  title,
  description,
  ...props
}: TranslatedProductCardProps) {
  const {
    getTranslatedName,
    getTranslatedDescription,
    hasTranslation,
    translateProduct,
    needsTranslation
  } = useProductTranslation();

  const [translatedTitle, setTranslatedTitle] = useState(title);
  const [isTranslating, setIsTranslating] = useState(false);

  // Traduire au montage si nécessaire
  useEffect(() => {
    if (needsTranslation && !hasTranslation(id) && !isTranslating) {
      setIsTranslating(true);
      translateProduct({ id, name: title, description })
        .then(result => {
          setTranslatedTitle(result.translatedName);
        })
        .catch(() => {
          // Garder le titre original en cas d'erreur
          setTranslatedTitle(title);
        })
        .finally(() => {
          setIsTranslating(false);
        });
    } else if (needsTranslation && hasTranslation(id)) {
      // Utiliser le cache
      setTranslatedTitle(getTranslatedName(id, title));
    } else {
      setTranslatedTitle(title);
    }
  }, [id, title, description, needsTranslation, hasTranslation, translateProduct, getTranslatedName, isTranslating]);

  return (
    <MarketplaceProductCard
      id={id}
      title={translatedTitle}
      {...props}
    />
  );
}

export default TranslatedProductCard;
