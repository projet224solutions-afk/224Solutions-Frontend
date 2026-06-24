/**
 * MODULE AGRICULTURE PROFESSIONNEL (réel) — catalogue + QR traçabilité + commandes temps réel.
 * Inspiré de : JD Agriculture (traçabilité QR) + FarmLogs (parcelles/saisons).
 */

import { useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sprout, TrendingUp, Package, ShoppingCart, Users, Sun, CloudRain, Calendar, Leaf, AlertTriangle } from 'lucide-react';
import { useFarmProducts, useFarmOrders } from '@/hooks/useFarm';
import { FarmProductCatalog } from '@/components/professional-services/modules/agriculture/FarmProductCatalog';
import { FarmOrdersKanban } from '@/components/professional-services/modules/agriculture/FarmOrdersKanban';

interface AgricultureModuleProps { serviceId: string; businessName?: string; }

const SEASONS = ['Saison sèche (Nov-Avr)', 'Saison des pluies (Mai-Oct)', "Toute l'année"];

// Référence agronomique : cultures typiques par saison en Guinée (guide de planification, pas une donnée vendeur).
const CROP_CALENDAR: Record<string, string[]> = {
  'Saison sèche (Nov-Avr)': ['Tomate', 'Oignon', 'Pomme de terre', 'Aubergine', 'Piment', 'Chou', 'Carotte', 'Gombo (irrigué)'],
  'Saison des pluies (Mai-Oct)': ['Riz', 'Maïs', 'Fonio', 'Arachide', 'Manioc', 'Igname', 'Gombo', 'Niébé'],
  "Toute l'année": ['Banane plantain', 'Manioc', 'Patate douce', 'Légumes-feuilles', 'Papaye'],
};

export function AgricultureModule({ serviceId, businessName }: AgricultureModuleProps) {
  const { t } = useTranslation();
  const { products, lowStock } = useFarmProducts(serviceId);
  const { columns, active } = useFarmOrders(serviceId);

  const availableCount = products.filter((p) => p.is_active && p.stock_quantity > 0).length;
  const organicCount = products.filter((p) => p.organic).length;
  const pendingOrders = columns.nouvelles.length;
  const ordersValue = active.reduce((s, o) => s + (Number(o.total) || 0), 0);

  const nextHarvest = useMemo(() => {
    const dates = products.map((p) => p.harvest_date).filter((d): d is string => !!d && new Date(d) >= new Date()).sort();
    if (!dates.length) return null;
    return Math.max(0, Math.ceil((new Date(dates[0]).getTime() - Date.now()) / 86_400_000));
  }, [products]);

  const Kpi = ({ label, value, Icon, accent, badge }: { label: string; value: React.ReactNode; Icon: any; accent?: string; badge?: number }) => (
    <Card className={accent || ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between"><Icon className="h-4 w-4 opacity-80" />{badge ? <Badge className="bg-red-500">{badge}</Badge> : null}</div>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        <p className="text-xs opacity-80">{label}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-green-600 p-3"><Sprout className="h-8 w-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || 'Exploitation Agricole'}</h2>
          <p className="text-muted-foreground">{t('agricultureModule.produitsFraisLocauxTracabiliteGarantie')}</p>
        </div>
        {organicCount > 0 && <Badge className="ml-auto gap-1 bg-green-100 text-green-700"><Leaf className="h-3 w-3" />{organicCount} Bio</Badge>}
      </div>

      {/* KPIs réels */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label={t('agricultureModule.produitsEnVente')} value={availableCount} Icon={Package} />
        <Kpi label={t('agricultureModule.commandesEnAttente')} value={pendingOrders} Icon={ShoppingCart} badge={pendingOrders || undefined} />
        <Kpi label={t('agricultureModule.valeurCommandesActives')} value={`${(ordersValue / 1e6).toFixed(1)}M`} Icon={TrendingUp} />
        <Kpi label="Stock faible" value={lowStock.length} Icon={AlertTriangle} accent={lowStock.length ? 'border-red-200' : ''} />
        <Kpi label={t('agricultureModule.prochaineRecolte')} value={nextHarvest === null ? '—' : `${nextHarvest} j`} Icon={Calendar} />
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />Stock faible :
            {lowStock.slice(0, 3).map((p) => <Badge key={p.id} variant="outline" className="border-amber-300">{p.name} ({p.stock_quantity} {p.unit})</Badge>)}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="produits">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="produits"><Package className="mr-1 h-4 w-4 hidden sm:inline" />{t('agricultureModule.produits')}</TabsTrigger>
          <TabsTrigger value="commandes"><ShoppingCart className="mr-1 h-4 w-4 hidden sm:inline" />{t('agricultureModule.commandes')}</TabsTrigger>
          <TabsTrigger value="clients"><Users className="mr-1 h-4 w-4 hidden sm:inline" />Clients</TabsTrigger>
          <TabsTrigger value="saisons"><Sun className="mr-1 h-4 w-4 hidden sm:inline" />Saisons</TabsTrigger>
        </TabsList>

        <TabsContent value="produits" className="mt-4">
          <FarmProductCatalog serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="commandes" className="mt-4">
          <FarmOrdersKanban serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Mes acheteurs</CardTitle><CardDescription>{t('agricultureModule.clientsAyantCommandeChezVous')}</CardDescription></CardHeader>
            <CardContent>
              {(() => {
                const buyers = new Map<string, { name: string; phone: string | null; count: number; total: number }>();
                active.forEach((o) => {
                  const key = o.customer_name || o.customer_phone || o.id;
                  const cur = buyers.get(key) || { name: o.customer_name || 'Client', phone: o.customer_phone, count: 0, total: 0 };
                  cur.count++; cur.total += Number(o.total) || 0; buyers.set(key, cur);
                });
                const list = [...buyers.values()].sort((a, b) => b.total - a.total);
                if (list.length === 0) return <p className="text-sm text-muted-foreground">{t('agricultureModule.aucunAcheteurPourLInstant')}</p>;
                return (
                  <div className="space-y-2">
                    {list.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700">{b.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0"><div className="font-medium">{b.name}</div>{b.phone && <div className="text-xs text-muted-foreground">{b.phone}</div>}</div>
                        <div className="ml-auto text-right"><div className="font-semibold">{(b.total / 1000).toFixed(0)}k GNF</div><div className="text-xs text-muted-foreground">{b.count} cmd</div></div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saisons" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sun className="h-5 w-5 text-[#ff4000]" />{t('agricultureModule.calendrierDeProduction')}</CardTitle><CardDescription>{t('agricultureModule.disponibiliteSaisonniereDeVosProduits')}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {SEASONS.map((season) => {
                const sp = products.filter((p) => p.season === season);
                return (
                  <div key={season} className="rounded-lg bg-muted/30 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {season.includes('sèche') ? <Sun className="h-4 w-4 text-[#ff4000]" /> : season.includes('pluie') ? <CloudRain className="h-4 w-4 text-blue-500" /> : <Calendar className="h-4 w-4 text-[#ff4000]" />}
                      <h4 className="text-sm font-semibold">{season}</h4>
                      <Badge variant="outline" className="text-xs">{sp.length} produits</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sp.map((p) => <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>)}
                      {sp.length === 0 && <p className="text-xs text-muted-foreground">{t('agricultureModule.aucunProduitPourCetteSaison')}</p>}
                    </div>
                    {CROP_CALENDAR[season] && (
                      <div className="mt-2 border-t border-dashed pt-2">
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cultures typiques en Guinée</p>
                        <div className="flex flex-wrap gap-1">
                          {CROP_CALENDAR[season].map((c) => <Badge key={c} variant="outline" className="text-[10px] text-muted-foreground">{c}</Badge>)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AgricultureModule;
