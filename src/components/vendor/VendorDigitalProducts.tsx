/**
 * Gestion des produits numériques du vendeur
 * - Suppression sécurisée (vérifie achats/abonnements avant suppression)
 * - Archivage comme alternative à la suppression
 * - Republication de produits rejetés/archivés
 */

import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, Plus, Eye, Edit, Trash2, ExternalLink,
  Laptop, FileText, BookOpen, Plane, Box, Loader2,
  Archive, RotateCcw, AlertTriangle, Download
} from "lucide-react";
import { useMerchantDigitalProducts, DigitalProduct } from "@/hooks/useDigitalProducts";
import { useDigitalDownload } from "@/hooks/useDigitalDownload";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DigitalProductForm } from "@/components/digital-products/DigitalProductForm";

const categoryIcons: Record<string, React.ComponentType<any>> = {
  voyage: Plane,
  logiciel: Laptop,
  formation: FileText,
  livre: BookOpen,
  dropshipping: Box,
  custom: Package,
  ai: Laptop,
};

const statusColors: Record<string, string> = {
  published: "bg-[#16a34a] text-white",            // Vert — produit actif/publié
  draft:     "bg-muted text-foreground",            // Gris — brouillon
  pending:   "bg-[#04439e]/10 text-[#04439e]",      // Bleu pâle — en attente de validation
  rejected:  "bg-destructive/10 text-destructive",  // Rouge — rejeté
  archived:  "bg-muted text-muted-foreground",      // Gris — archivé
};

const statusLabels: Record<string, string> = {
  published: "Publié",
  draft: "Brouillon",
  pending: "En attente",
  rejected: "Rejeté",
  archived: "Archivé",
};

export default function VendorDigitalProducts() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const navigate = useNavigate();
  const { products, loading, refresh } = useMerchantDigitalProducts();
  const { download, downloading } = useDigitalDownload();
  const [deleteProduct, setDeleteProduct] = useState<DigitalProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DigitalProduct | null>(null);
  const [deleteHasPurchases, setDeleteHasPurchases] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /** Check if product has active purchases/subscriptions before allowing deletion */
  const handleRequestDelete = async (product: DigitalProduct) => {
    try {
      const [purchasesRes, subsRes] = await Promise.all([
        supabase
          .from('digital_product_purchases')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', product.id),
        supabase
          .from('digital_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .eq('status', 'active'),
      ]);

      const totalPurchases = (purchasesRes.count || 0) + (subsRes.count || 0);
      setDeleteHasPurchases(totalPurchases > 0);
      setDeleteProduct(product);
    } catch {
      setDeleteHasPurchases(false);
      setDeleteProduct(product);
    }
  };

  /** Archive instead of hard delete */
  const handleArchive = async () => {
    if (!deleteProduct) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('digital_products')
        .update({ status: 'archived' as any })
        .eq('id', deleteProduct.id)
        .eq('merchant_id', deleteProduct.merchant_id);
      if (error) throw error;
      toast.success(t('vendorDigitalProducts.produitArchive'), { description: t('vendorDigitalProducts.leProduitResteAccessiblePour') });
      refresh();
    } catch (err: unknown) {
      console.error("Erreur archivage:", err);
      toast.error(t('vendorDigitalProducts.impossibleDArchiverLeProduit'));
    } finally {
      setIsDeleting(false);
      setDeleteProduct(null);
    }
  };

  /** Hard delete (only for products without purchases) */
  const handleDelete = async () => {
    if (!deleteProduct) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('digital_products')
        .delete()
        .eq('id', deleteProduct.id)
        .eq('merchant_id', deleteProduct.merchant_id);
      if (error) throw error;
      toast.success(t('vendorDigitalProducts.produitSupprimeDefinitivement'));
      refresh();
    } catch (err: unknown) {
      console.error("Erreur suppression:", err);
      toast.error(t('vendorDigitalProducts.impossibleDeSupprimerLeProduit'));
    } finally {
      setIsDeleting(false);
      setDeleteProduct(null);
    }
  };

  /** Republish a rejected or archived product (sets status back to pending for review) */
  const handleRepublish = async (product: DigitalProduct) => {
    setActionLoading(product.id);
    try {
      const newStatus = product.status === 'archived' ? 'draft' : 'pending';
      const { error } = await supabase
        .from('digital_products')
        .update({ status: newStatus as any })
        .eq('id', product.id)
        .eq('merchant_id', product.merchant_id);
      if (error) throw error;
      toast.success(
        product.status === 'archived' ? "Produit restauré en brouillon" : "Produit soumis pour réexamen",
        { description: product.status === 'rejected' ? "Le produit sera réexaminé par l'équipe." : "Vous pouvez maintenant le modifier et le republier." }
      );
      refresh();
    } catch (err: unknown) {
      console.error("Erreur republication:", err);
      toast.error(t('vendorDigitalProducts.impossibleDeRepublierLeProduit'));
    } finally {
      setActionLoading(null);
    }
  };

  // CONVERTIT depuis la devise du produit (défaut GNF) vers la devise du vendeur (taux BCRG)
  // au lieu de seulement formater — sinon le prix s'affichait dans sa devise brute.
  const formatPrice = (price: number, currency: string = 'GNF') => {
    try {
      return fc(price, currency || 'GNF');
    } catch {
      return `${price.toLocaleString('fr-FR')} ${currency}`;
    }
  };

  if (editingProduct) {
    return (
      <DigitalProductForm
        category={editingProduct.category as any}
        mode="edit"
        initialProduct={editingProduct}
        onBack={() => setEditingProduct(null)}
        onSuccess={() => {
          setEditingProduct(null);
          refresh();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border-0 bg-[#04439e] p-5 shadow-[0_24px_60px_rgba(4,67,158,0.30)] sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              Catalogue vendeur digital
            </div>
            <h2 className="text-xl font-semibold leading-tight text-white sm:text-3xl">{t('vendorDigitalProducts.organisezVotreBoutiqueDigitaleAvec')}</h2>
            <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">
              Retrouvez vos produits, leur statut commercial et les actions de gestion dans une structure plus propre et plus crédible.
            </p>
          </div>
          <Button onClick={() => navigate('/vendeur-digital/add-product')} className="h-12 w-full rounded-2xl bg-[#ff4000] px-5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,64,0,0.34)] hover:bg-[#e53900] sm:w-auto gap-2">
            <Plus className="w-4 h-4" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Card className="rounded-[24px] border-0 bg-[#04439e] shadow-[0_18px_45px_rgba(4,67,158,0.22)]">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Total</p>
                <div className="mt-3 text-2xl sm:text-3xl font-semibold text-white">{products.length}</div>
                <p className="mt-2 text-sm text-white/55">{t('vendorDigitalProducts.produitsDansLeCatalogue')}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-[#ff4000] shadow-[0_18px_45px_rgba(255,64,0,0.20)]">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{t('vendorDigitalProducts.publies')}</p>
                <div className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
                  {products.filter(p => p.status === 'published').length}
                </div>
                <p className="mt-2 text-sm text-white/60">{t('vendorDigitalProducts.offresVisiblesSurLeMarche')}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Laptop className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-[#04439e] shadow-[0_18px_45px_rgba(4,67,158,0.22)]">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Affiliation</p>
                <div className="mt-3 text-2xl sm:text-3xl font-semibold text-[#ffb08a]">
                  {products.filter(p => p.product_mode === 'affiliate').length}
                </div>
                <p className="mt-2 text-sm text-white/55">{t('vendorDigitalProducts.produitsPartenaires')}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
                <ExternalLink className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-[#04439e] shadow-[0_18px_45px_rgba(4,67,158,0.22)]">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{t('vendorDigitalProducts.visibilite')}</p>
                <div className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
                  {products.reduce((sum, p) => sum + (p.views_count || 0), 0)}
                </div>
                <p className="mt-2 text-sm text-white/55">{t('vendorDigitalProducts.vuesCumulees')}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Eye className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-[#0b1b33]">{t('vendorDigitalProducts.catalogueEnGestion')}</h3>
          <p className="text-sm text-[#5f78a5]">{t('vendorDigitalProducts.retrouvezVosFichesLeurStatut')}</p>
        </div>
        <Badge className="w-fit border-0 bg-[#04439e]/10 px-3 py-1 text-[11px] font-semibold text-[#04439e] shadow-none">
          {products.length} fiche{products.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Product List */}
      {products.length === 0 ? (
        <Card className="rounded-[28px] border border-dashed border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
          <CardContent className="flex flex-col items-center justify-center py-10 sm:py-14 text-center">
            <Package className="mb-4 h-12 w-12 text-slate-300 sm:h-16 sm:w-16" />
            <h3 className="mb-2 text-base font-semibold text-slate-900 sm:text-lg">{t('vendorDigitalProducts.aucunProduitNumerique')}</h3>
            <p className="mb-4 max-w-sm px-4 text-sm text-slate-500">
              Commencez à vendre des produits numériques ou à développer vos offres d’affiliation dans un espace propre et structuré.
            </p>
            <Button onClick={() => navigate('/vendeur-digital/add-product')} className="rounded-xl bg-[#ff4000] text-white hover:bg-[#e53900] gap-2">
              <Plus className="w-4 h-4" />
              Créer mon premier produit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {products.map((product) => {
            const CategoryIcon = categoryIcons[product.category] || Package;
            const mainImage = product.images?.[0] || '/placeholder.svg';
            const canRepublish = product.status === 'rejected' || product.status === 'archived';

            return (
              <Card key={product.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(15,23,42,0.12)]">
                {/* Image */}
                <div className="relative h-40 sm:h-48 bg-muted">
                  <img
                    src={mainImage}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.02)_42%,rgba(15,23,42,0.68)_100%)]" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge className="border-0 bg-white/90 text-[11px] font-semibold text-[#04439e] shadow-none backdrop-blur">
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {product.category}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className={`text-[11px] px-2 py-0.5 border-0 shadow-none ${statusColors[product.status] || statusColors.draft}`}>
                      {statusLabels[product.status] || product.status}
                    </Badge>
                  </div>
                  {product.product_mode === 'affiliate' && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="border-white/40 bg-[#ff4000]/90 text-[11px] font-semibold text-white px-2 py-0.5">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Affiliation
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 text-right text-white sm:bottom-4 sm:right-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">Performance</p>
                    <p className="mt-1 text-sm font-semibold">{product.sales_count || 0} ventes</p>
                  </div>
                </div>

                {/* Content */}
                <CardContent className="bg-white p-5 sm:p-6">
                  <h3 className="mb-2 line-clamp-1 text-lg font-semibold text-slate-900">
                    {product.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-sm text-slate-600">
                    {product.short_description || product.description || 'Aucune description'}
                  </p>

                  {/* Price */}
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
                    <div>
                      {product.price > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900 sm:text-xl">
                            {formatPrice(product.price, product.currency)}
                          </span>
                          {product.original_price && product.original_price > product.price && (
                            <span className="text-sm text-slate-400 line-through">
                              {formatPrice(product.original_price, product.currency)}
                            </span>
                          )}
                        </div>
                      ) : (
                          <span className="font-semibold text-lg sm:text-xl text-orange-300">Gratuit</span>
                      )}
                    </div>
                    {product.product_mode === 'affiliate' && product.commission_rate > 0 && (
                        <Badge className="border-0 bg-[#ff4000] text-[11px] font-semibold text-white shadow-none">
                        {product.commission_rate}%
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                    <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {product.views_count || 0} vues
                    </span>
                    <span>•</span>
                    <span>{product.sales_count || 0} ventes</span>
                    <span className="truncate">
                      {formatDistanceToNow(new Date(product.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-[#04439e] hover:bg-slate-100"
                      onClick={() => navigate(`/digital-product/${product.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      Voir
                    </Button>

                    {canRepublish && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl border-[#ff4000]/40 bg-[#ff4000]/18 text-xs font-semibold text-[#ff8050] hover:bg-[#ff4000]/30 hover:text-white gap-1"
                        disabled={actionLoading === product.id}
                        onClick={() => handleRepublish(product)}
                      >
                        {actionLoading === product.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        {product.status === 'archived' ? 'Restaurer' : 'Resoumettre'}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      disabled={downloading}
                      onClick={() => download(product.id)}
                      aria-label={t('vendorDigitalProducts.telechargerLeLivrable')}
                      title={t('vendorDigitalProducts.telechargerLeLivrableLienSecurise')}
                    >
                      {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      onClick={() => setEditingProduct(product)}
                      aria-label={t('vendorDigitalProducts.modifierLeProduit')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl border border-[#ff4000]/35 bg-[#ff4000]/15 text-[#ff8050] hover:bg-[#ff4000]/28"
                      onClick={() => handleRequestDelete(product)}
                      aria-label="Supprimer / Archiver"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Safe Delete / Archive Dialog */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => { setDeleteProduct(null); setDeleteHasPurchases(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteHasPurchases && <AlertTriangle className="w-5 h-5 text-orange-500" />}
              {deleteHasPurchases ? "Ce produit a des achats existants" : "Supprimer ce produit ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteHasPurchases ? (
                <>
                  Le produit <strong>"{deleteProduct?.title}"</strong> possède des achats ou abonnements actifs.
                  La suppression définitive n'est pas possible. Vous pouvez <strong>l'archiver</strong> pour
                  le retirer de la vente tout en conservant l'accès pour les acheteurs existants.
                </>
              ) : (
                <>
                  Vous pouvez <strong>archiver</strong> le produit (retrait de la vente, données conservées)
                  ou le <strong>{t('vendorDigitalProducts.supprimerDefinitivement')}</strong> (irréversible).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting}>{t('vendorDigitalProducts.annuler')}</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archiver
            </Button>
            {!deleteHasPurchases && (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Supprimer définitivement
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
