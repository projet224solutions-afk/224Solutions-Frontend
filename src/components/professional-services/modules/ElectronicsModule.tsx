/**
 * MODULE ÉLECTRONIQUE PROFESSIONNEL
 * Inspiré de: Amazon Electronics, Best Buy, Jumia
 * E-commerce électronique avec spécifications techniques
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Laptop, Tv, Headphones, Watch, Camera, DollarSign, Package, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface ElectronicsModuleProps {
  serviceId: string;
  businessName?: string;
}

const CATEGORIES = [
  { id: 'smartphones', name: 'Smartphones', icon: Smartphone },
  { id: 'computers', name: 'Ordinateurs', icon: Laptop },
  { id: 'tv', name: 'TV & Audio', icon: Tv },
  { id: 'accessories', name: 'Accessoires', icon: Headphones },
  { id: 'wearables', name: 'Montres Connectées', icon: Watch },
  { id: 'cameras', name: 'Photo & Vidéo', icon: Camera }
];

export function ElectronicsModule({ serviceId, businessName }: ElectronicsModuleProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('catalog');
  const [stats] = useState({ products: 243, orders: 67, revenue: 18500000, rating: 4.5 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Smartphone className="w-8 h-8 text-primary" />
            {businessName || 'Boutique Électronique'}
          </h2>
          <p className="text-muted-foreground">{t('electronicsModule.highTechElectronique')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('electronicsModule.produits')}</CardTitle>
            <Package className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.products}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('electronicsModule.commandes')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('electronicsModule.caDuMois')}</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><Money amount={stats.revenue} from="GNF" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rating}/5</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalog">Catalogue</TabsTrigger>
          <TabsTrigger value="add">{t('electronicsModule.ajouter')}</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <Card>
            <CardHeader>
              <CardTitle>{t('electronicsModule.categoriesDeProduits')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <Card key={cat.id} className="cursor-pointer hover:border-primary transition-colors">
                      <CardContent className="pt-6 text-center">
                        <Icon className="w-12 h-12 mx-auto mb-2 text-primary" />
                        <h3 className="font-bold">{cat.name}</h3>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>{t('electronicsModule.ajouterUnProduitElectronique')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('electronicsModule.nomDuProduit')}</Label>
                  <Input placeholder="Ex: iPhone 15 Pro Max" />
                </div>
                <div className="space-y-2">
                  <Label>{t('electronicsModule.categorie')}</Label>
                  <Select>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Marque</Label>
                  <Input placeholder="Apple, Samsung..." />
                </div>
                <div className="space-y-2">
                  <Label>Prix (GNF)</Label>
                  <Input type="number" placeholder="5000000" />
                </div>
              </div>
              <Button className="w-full">{t('electronicsModule.ajouterAuCatalogue')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
