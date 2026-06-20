/**
 * MODULE MODE & VÊTEMENTS PROFESSIONNEL
 * Inspiré de: Zara, H&M, ASOS
 * E-commerce mode avec gestion des tailles, couleurs et collections
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shirt, ShoppingBag, TrendingUp, DollarSign, Package, Star } from 'lucide-react';
import { toast } from 'sonner';

interface FashionModuleProps {
  serviceId: string;
  businessName?: string;
}

const CATEGORIES = ['Homme', 'Femme', 'Enfant', 'Accessoires'];
const SIZES = {
  Homme: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  Femme: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Enfant: ['6 mois', '12 mois', '2 ans', '4 ans', '6 ans', '8 ans', '10 ans', '12 ans', '14 ans']
};
const COLORS = [
  { name: 'Noir', hex: '#000000' },
  { name: 'Blanc', hex: '#FFFFFF' },
  { name: 'Rouge', hex: '#ff4000' },
  { name: 'Bleu', hex: '#04439e' },
  { name: 'Vert', hex: '#ff4000' },
  { name: 'Jaune', hex: '#ff4000' },
  { name: 'Rose', hex: '#ff4000' },
  { name: 'Gris', hex: '#6B7280' }
];

export function FashionModule({ serviceId, businessName }: FashionModuleProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('products');
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Homme',
    subCategory: '',
    brand: '',
    price: '',
    description: '',
    selectedSizes: [] as string[],
    selectedColors: [] as string[],
    stockPerVariant: {} as Record<string, number>
  });

  const [stats] = useState({
    totalProducts: 156,
    totalOrders: 89,
    revenue: 4250000,
    avgRating: 4.6
  });

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price || newProduct.selectedSizes.length === 0) {
      toast.error(t('fashionModule.remplissezLesChampsObligatoiresEt'));
      return;
    }
    toast.success(t('fashionModule.produitAjouteAvecSucces'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Shirt className="w-8 h-8 text-primary" />
            {businessName || 'Boutique Mode'}
          </h2>
          <p className="text-muted-foreground">{t('fashionModule.gestionDeVotreCatalogueMode')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('fashionModule.produits')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Articles en catalogue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('fashionModule.commandes')}</CardTitle>
            <ShoppingBag className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><Money amount={stats.revenue} from="GNF" /></div>
            <p className="text-xs text-muted-foreground">+18% vs mois dernier</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Note Moyenne</CardTitle>
            <Star className="h-4 w-4 text-[#ff4000] fill-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgRating}/5</div>
            <p className="text-xs text-muted-foreground">67 avis</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">Catalogue</TabsTrigger>
          <TabsTrigger value="add">{t('fashionModule.ajouterArticle')}</TabsTrigger>
          <TabsTrigger value="inventory">Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nouvel Article</CardTitle>
              <CardDescription>{t('fashionModule.ajoutezUnVetementAVotre')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('fashionModule.nomDuProduit')}</Label>
                  <Input placeholder="Ex: T-shirt basique col rond" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label>{t('fashionModule.categorie')}</Label>
                  <Select value={newProduct.category} onValueChange={(v) => setNewProduct({...newProduct, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Marque</Label>
                  <Input placeholder="Ex: Nike, Adidas..." value={newProduct.brand} onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label>Prix (GNF) *</Label>
                  <Input type="number" placeholder="50000" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tailles disponibles *</Label>
                <div className="flex flex-wrap gap-2">
                  {(SIZES[newProduct.category as keyof typeof SIZES] || []).map(size => (
                    <Badge
                      key={size}
                      variant={newProduct.selectedSizes.includes(size) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setNewProduct({
                          ...newProduct,
                          selectedSizes: newProduct.selectedSizes.includes(size)
                            ? newProduct.selectedSizes.filter(s => s !== size)
                            : [...newProduct.selectedSizes, size]
                        });
                      }}
                    >
                      {size}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Couleurs disponibles</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <div
                      key={color.name}
                      onClick={() => {
                        setNewProduct({
                          ...newProduct,
                          selectedColors: newProduct.selectedColors.includes(color.name)
                            ? newProduct.selectedColors.filter(c => c !== color.name)
                            : [...newProduct.selectedColors, color.name]
                        });
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border-2 cursor-pointer transition-all ${
                        newProduct.selectedColors.includes(color.name) ? 'border-primary bg-primary/10' : 'border-gray-200'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: color.hex }} />
                      <span className="text-sm">{color.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleAddProduct} className="w-full" size="lg">
                Ajouter au catalogue
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>{t('fashionModule.catalogueProduits')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Shirt className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('fashionModule.utilisezLOngletAjouterArticle')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>{t('fashionModule.gestionDuStock')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('fashionModule.suiviDesStocksParTaille')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
