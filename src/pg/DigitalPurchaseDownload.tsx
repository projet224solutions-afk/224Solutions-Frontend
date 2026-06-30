/**
 * 📥 PAGE DE TÉLÉCHARGEMENT / ACCÈS PRODUIT NUMÉRIQUE
 * Gère les achats uniques ET les abonnements actifs
 * Inspiré de Gumroad / Teachable / Payhip
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download, CheckCircle, FileText, Image, Music, Video,
  Package, ArrowLeft, ExternalLink, ShoppingBag, AlertCircle,
  Loader2, RefreshCw, Calendar, Shield, Infinity, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { LocalPrice } from '@/components/ui/LocalPrice';

interface AccessInfo {
  type: 'purchase' | 'subscription';
  id: string;
  product_id: string;
  amount: number;
  access_granted: boolean;
  download_count: number;
  max_downloads: number | null;
  created_at: string;
  // Subscription-specific
  status?: string;
  billing_cycle?: string;
  current_period_end?: string;
  auto_renew?: boolean;
  access_expires_at?: string | null;
}

interface DigitalProduct {
  id: string;
  title: string;
  description: string | null;
  images: string[] | null;
  file_urls: string[] | null;
  file_type: string | null;
  price: number;
  currency: string | null;
  pricing_type: string | null;
  subscription_interval: string | null;
  merchant_id: string | null;
  vendor_id: string | null;
  vendors?: {
    business_name: string;
  };
}

function getFileIcon(url: string) {
  const ext = url.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <Image className="w-5 h-5 text-blue-500" />;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return <Music className="w-5 h-5 text-[#04439e]" />;
  if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext)) return <Video className="w-5 h-5 text-[#ff4000]" />;
  if (['pdf', 'doc', 'docx', 'txt', 'epub'].includes(ext)) return <FileText className="w-5 h-5 text-orange-500" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <Package className="w-5 h-5 text-[#ff4000]" />;
  return <Package className="w-5 h-5 text-muted-foreground" />;
}

function getFileName(url: string): string {
  try {
    const parts = url.split('/');
    const name = parts[parts.length - 1];
    return decodeURIComponent(name.split('?')[0]);
  } catch {
    return 'Fichier';
  }
}

function _getFileSize(_url: string): string {
  // Placeholder - in production, store file sizes in DB
  return '';
}

export default function DigitalPurchaseDownload() {
  const { t } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(true);

  useEffect(() => {
    if (user?.id && productId) {
      loadAccessAndProduct();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, productId]);

  // Auto-hide success banner after 8s
  useEffect(() => {
    const timer = setTimeout(() => setShowSuccess(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const loadAccessAndProduct = async (retryCount = 0) => {
    try {
      // 1. Check for direct purchase
      const { data: purchaseData } = await supabase
        .from('digital_product_purchases')
        .select('*')
        .eq('product_id', productId!)
        .eq('buyer_id', user!.id)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Check for active subscription
      const { data: subData } = await supabase
        .from('digital_subscriptions')
        .select('*')
        .eq('product_id', productId!)
        .eq('buyer_id', user!.id)
        .in('status', ['active', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Determine access: subscription takes priority, then purchase
      let accessInfo: AccessInfo | null = null;

      if (subData && (subData.status === 'active' || subData.status === 'past_due')) {
        // Active subscription = unlimited access
        accessInfo = {
          type: 'subscription',
          id: subData.id,
          product_id: subData.product_id,
          amount: subData.amount_per_period || 0,
          access_granted: true,
          download_count: 0,
          max_downloads: null, // Unlimited for subscribers
          created_at: subData.created_at,
          status: subData.status,
          billing_cycle: subData.billing_cycle,
          current_period_end: subData.current_period_end,
          auto_renew: subData.auto_renew,
        };
      } else if (purchaseData) {
        const isExpired = purchaseData.access_expires_at && new Date(purchaseData.access_expires_at) < new Date();
        accessInfo = {
          type: 'purchase',
          id: purchaseData.id,
          product_id: purchaseData.product_id,
          amount: purchaseData.amount || 0,
          access_granted: purchaseData.access_granted && !isExpired,
          download_count: purchaseData.download_count || 0,
          max_downloads: purchaseData.max_downloads,
          created_at: purchaseData.created_at,
          access_expires_at: purchaseData.access_expires_at,
        };
      }

      if (!accessInfo) {
        if (retryCount < 3) {
          console.log(`[DigitalPurchaseDownload] Access not found, retrying (${retryCount + 1}/3)...`);
          setTimeout(() => loadAccessAndProduct(retryCount + 1), 1500);
          return;
        }
        toast.error(t('digitalPurchaseDownload.achatNonTrouveOuAcces'));
        navigate('/marketplace');
        return;
      }

      setAccess(accessInfo);

      // Load product
      const { data: productData, error: productError } = await supabase
        .from('digital_products')
        .select(`
          id, title, description, images, file_urls, file_type, video_url, price, currency,
          pricing_type, subscription_interval, merchant_id, vendor_id,
          vendors:vendor_id(business_name)
        `)
        .eq('id', productId!)
        .maybeSingle();

      if (productError) {
        console.error('Error fetching product:', productError);
        throw productError;
      }

      if (!productData) {
        console.error('Digital product not found for ID:', productId);
        toast.error(t('digitalPurchaseDownload.produitIntrouvable'));
        navigate('/marketplace');
        return;
      }

      const vRaw = (productData as any).vendors;
      setProduct({
        ...productData,
        vendors: Array.isArray(vRaw) ? vRaw[0] : vRaw
      } as DigitalProduct);

    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error(t('digitalPurchaseDownload.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileUrl: string) => {
    if (!access || !access.access_granted) {
      toast.error(t('digitalPurchaseDownload.accesNonAutorise'));
      return;
    }

    if (access.type === 'purchase' && access.max_downloads && access.download_count >= access.max_downloads) {
      toast.error(`Limite de téléchargement atteinte (${access.max_downloads} max)`);
      return;
    }

    setDownloading(fileUrl);
    try {
      // Increment download counter for purchases
      if (access.type === 'purchase') {
        await supabase
          .from('digital_product_purchases')
          .update({ download_count: (access.download_count || 0) + 1 })
          .eq('id', access.id);

        setAccess(prev => prev ? { ...prev, download_count: (prev.download_count || 0) + 1 } : prev);
      }

      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      toast.success(t('digitalPurchaseDownload.telechargementLance'));
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      toast.error(t('digitalPurchaseDownload.erreurLorsDuTelechargement'));
    } finally {
      setDownloading(null);
    }
  };

  const resolvedFileUrls = (() => {
    const explicitFiles = Array.isArray(product?.file_urls) ? product.file_urls.filter(Boolean) : [];
    if (explicitFiles.length > 0) return explicitFiles;

    // Compatibilite retroactive: produits crees avec video uniquement
    const fallbackVideoUrl = (product as any)?.video_url;
    return fallbackVideoUrl ? [fallbackVideoUrl] : [];
  })();

  const handleDownloadAll = async () => {
    for (const url of resolvedFileUrls) {
      await handleDownload(url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('digitalPurchaseDownload.chargementDeVotreContenu')}</p>
        </div>
      </div>
    );
  }

  if (!access || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">{t('digitalPurchaseDownload.achatNonTrouve')}</h2>
            <p className="text-muted-foreground mb-4">
              Vous n'avez pas accès à ce produit ou l'achat n'a pas été finalisé.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/marketplace')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Marketplace
              </Button>
              <Button variant="outline" onClick={() => navigate('/my-digital-purchases')}>
                <ShoppingBag className="w-4 h-4 mr-2" />
                Mes achats
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fileUrls = resolvedFileUrls;
  const hasFiles = fileUrls.length > 0;
  const isSubscription = access.type === 'subscription';
  const daysRemaining = access.current_period_end
    ? Math.max(0, Math.ceil((new Date(access.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const downloadProgress = access.max_downloads
    ? ((access.download_count || 0) / access.max_downloads) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 py-6 space-y-4">

        {/* Success Banner - animated, auto-hides */}
        {showSuccess && (
          <Card className="border-[#ff4000]/30 bg-[#ff4000]/5 animate-in fade-in slide-in-from-top-2 duration-500">
            <CardContent className="p-5 text-center">
              <CheckCircle className="w-12 h-12 text-[#ff4000] mx-auto mb-3" />
              <h1 className="text-xl font-bold text-foreground mb-1">
                {isSubscription ? 'Abonnement activé !' : 'Achat réussi !'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isSubscription
                  ? `Votre abonnement ${access.billing_cycle === 'yearly' ? 'annuel' : 'mensuel'} est maintenant actif.`
                  : <>{t('digitalPurchaseDownload.votrePaiementDe')} <LocalPrice amount={access.amount} currency={product.currency || 'GNF'} /> {t('digitalPurchaseDownload.aEteConfirme')}</>
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Access Status Card */}
        <Card className={isSubscription ? 'border-primary/20' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isSubscription ? 'bg-primary/10' : 'bg-[#ff4000]/10'
              }`}>
                {isSubscription ? <RefreshCw className="w-5 h-5 text-primary" /> : <Shield className="w-5 h-5 text-[#ff4000]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {isSubscription ? 'Abonnement actif' : 'Achat unique'}
                  </span>
                  <Badge variant="outline" className={
                    isSubscription
                      ? 'bg-primary/10 text-primary border-primary/20 text-xs'
                      : 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20 text-xs'
                  }>
                    {isSubscription
                      ? (access.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel')
                      : 'Complété'
                    }
                  </Badge>
                </div>
                {isSubscription && daysRemaining !== null ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {daysRemaining > 0
                      ? `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`
                      : 'Renouvellement imminent'
                    }
                  </p>
                ) : access.max_downloads ? (
                  <div className="mt-1">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{access.download_count || 0} / {access.max_downloads} téléchargements</span>
                      <span>{Math.round(downloadProgress)}%</span>
                    </div>
                    <Progress value={downloadProgress} className="h-1.5" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Infinity className="w-3 h-3 inline mr-1" />
                    Téléchargements illimités
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {product.images?.[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-foreground text-lg leading-tight">{product.title}</h2>
                {product.vendors?.business_name && (
                  <p className="text-sm text-muted-foreground mt-0.5">Par {product.vendors.business_name}</p>
                )}
                {product.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.description}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-5 h-5" />
                Fichiers disponibles
                {hasFiles && (
                  <Badge variant="secondary" className="text-xs">{fileUrls.length}</Badge>
                )}
              </CardTitle>
              {hasFiles && fileUrls.length > 1 && (
                <Button size="sm" variant="outline" onClick={handleDownloadAll} className="text-xs">
                  <Download className="w-3 h-3 mr-1" />
                  Tout télécharger
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {hasFiles ? (
              fileUrls.map((url, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center shrink-0 group-hover:bg-muted">
                      {getFileIcon(url)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{getFileName(url)}</p>
                      <p className="text-xs text-muted-foreground">Fichier {index + 1}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(url)}
                    disabled={
                      downloading === url ||
                      (!isSubscription && !!access.max_downloads && access.download_count >= access.max_downloads)
                    }
                    className="shrink-0 ml-3"
                  >
                    {downloading === url ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Télécharger
                      </>
                    )}
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-foreground/70">{t('digitalPurchaseDownload.contenuEnPreparation')}</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  Le vendeur n'a pas encore ajouté les fichiers téléchargeables.
                  Ils seront disponibles ici dès qu'ils seront mis en ligne.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => loadAccessAndProduct()}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Vérifier à nouveau
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-auto py-3" onClick={() => navigate('/my-digital-purchases')}>
            <div className="text-center">
              <ShoppingBag className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">Mes achats</span>
            </div>
          </Button>
          {isSubscription ? (
            <Button variant="outline" className="h-auto py-3" onClick={() => navigate('/my-digital-subscriptions')}>
              <div className="text-center">
                <RefreshCw className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">Mes abonnements</span>
              </div>
            </Button>
          ) : (
            <Button variant="outline" className="h-auto py-3" onClick={() => navigate('/marketplace')}>
              <div className="text-center">
                <ExternalLink className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">Marketplace</span>
              </div>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
