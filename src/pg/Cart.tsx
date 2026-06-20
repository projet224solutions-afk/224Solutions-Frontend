import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingCart, ExternalLink, AlertCircle } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { usePriceConverter } from '@/hooks/usePriceConverter';

export default function Cart() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartCount } = useCart();
  const { convert } = usePriceConverter();

  // Formater le prix dans la devise locale de l'utilisateur
  const formatLocalPrice = (price: number, sourceCurrency: string = 'GNF') => {
    const converted = convert(price, sourceCurrency);
    return converted.formatted;
  };

  // S├®parer les produits affili├®s des produits normaux
  const affiliateItems = cartItems.filter(item =>
    item.item_type === 'digital_product' && item.product_mode === 'affiliate'
  );
  const normalItems = cartItems.filter(item =>
    !(item.item_type === 'digital_product' && item.product_mode === 'affiliate')
  );

  // Total des produits normaux — CHAQUE item est converti depuis SA devise (vendeur) vers la devise
  // d'affichage AVANT de sommer. Avant : somme des prix bruts → total absurde pour un panier
  // multi-vendeur multi-devise (ex. 50 000 XOF + 25 000 GNF additionnés tels quels).
  const normalItemsTotal = normalItems.reduce(
    (total, item) => total + convert(item.price, item.currency || 'GNF').convertedAmount * item.quantity,
    0
  );

  const handleAffiliateClick = (item: typeof cartItems[0]) => {
    if (item.affiliate_url) {
      window.open(item.affiliate_url, '_blank');
      toast.success(t('cart.redirectionVersLePartenaire'));
      // Optionnel: retirer du panier apr├¿s redirection
      removeFromCart(item.id);
    }
  };

  const handleCheckout = () => {
    if (normalItems.length === 0) {
      toast.info(t('cart.votrePanierNeContientQue'));
      return;
    }

    navigate('/payment', {
      state: {
        cartItems: normalItems, // Envoyer uniquement les produits normaux
        totalAmount: normalItemsTotal,
        fromCart: true
      }
    });
  };

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="bg-card border-b border-border sticky top-0 z-40 flex-shrink-0">
          <div className="px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Mon Panier</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-4 pb-24 md:pb-4">
          <ShoppingCart className="w-20 h-20 md:w-24 md:h-24 text-muted-foreground mb-4" />
          <h2 className="text-xl md:text-2xl font-bold mb-2">{t('cart.votrePanierEstVide')}</h2>
          <p className="text-muted-foreground mb-6 text-center">{t('cart.ajoutezDesProduitsPourCommencer')}</p>
          <Button onClick={() => navigate('/marketplace')}>
            Découvrir les produits
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-40 flex-shrink-0">
        <div className="px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Mon Panier</h1>
          <Badge className="ml-auto">{getCartCount()} article{getCartCount() > 1 ? 's' : ''}</Badge>
        </div>
      </header>

      <div className="flex-1 overflow-auto max-w-4xl mx-auto w-full p-4 pb-24 md:pb-6 space-y-4">
        {/* Alerte pour les produits affili├®s */}
        {affiliateItems.length > 0 && (
          <Alert className="border-primary/50 bg-primary/5">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>{affiliateItems.length} produit{affiliateItems.length > 1 ? 's' : ''} affili├®{affiliateItems.length > 1 ? 's' : ''}</strong> : Ces produits sont vendus par nos partenaires.
              Cliquez sur "Voir l'offre" pour ├¬tre redirig├® vers leur site.
            </AlertDescription>
          </Alert>
        )}

        {/* Liste des produits affili├®s */}
        {affiliateItems.length > 0 && (
          <Card className="border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                Produits Partenaires ({affiliateItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {affiliateItems.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 border border-primary/20 rounded-lg bg-primary/5">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                    {item.vendor_name && (
                      <p className="text-xs text-muted-foreground">
                        Partenaire: {item.vendor_name}
                      </p>
                    )}
                    <p className="text-primary font-bold text-sm">{formatLocalPrice(item.price, item.currency)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAffiliateClick(item)}
                      className="text-xs"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Voir l'offre
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs text-muted-foreground"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Liste des produits normaux */}
        {normalItems.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Articles ({normalItems.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={clearCart}>
                Vider le panier
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {normalItems.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-md"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                    {item.vendor_name && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Vendu par {item.vendor_name}
                      </p>
                    )}
                    <p className="text-primary font-bold">{formatLocalPrice(item.price, item.currency)}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="h-8 w-8"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="font-mono font-bold w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold">
                      Total: {formatLocalPrice(item.price * item.quantity, item.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* R├®sum├® de la commande - seulement pour les produits normaux */}
        {normalItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('cart.rSumDeLaCommande')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total ({normalItems.length} article{normalItems.length > 1 ? 's' : ''})</span>
                  <span className="font-semibold">{formatLocalPrice(normalItemsTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('cart.fraisDeLivraison')}</span>
                  <span className="font-semibold">{t('cart.cCalculer')}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatLocalPrice(normalItemsTotal)}</span>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
              >
                Proc├®der au paiement
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Message si uniquement des produits affili├®s */}
        {normalItems.length === 0 && affiliateItems.length > 0 && (
          <Card className="border-muted">
            <CardContent className="py-8 text-center">
              <ExternalLink className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t('cart.produitsPartenairesUniquement')}</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Votre panier ne contient que des produits affili├®s.
                Cliquez sur "Voir l'offre" pour chaque produit afin d'├¬tre redirig├® vers le site du partenaire.
              </p>
              <Button variant="outline" onClick={() => navigate('/marketplace')}>
                Continuer mes achats
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
