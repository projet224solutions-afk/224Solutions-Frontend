/**
 * PAGE CLIENT LIVRAISON COMPLÈTE
 * Interface pour commander, suivre et consulter l'historique des livraisons
 * 224Solutions - Delivery System
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  Clock,
  History,
  LogOut,
  MapPin,
  User,
  Phone,
  Truck,
  Star,
  ArrowLeft,
  Wallet
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserIdDisplay } from "@/components/UserIdDisplay";
import CommunicationWidget from "@/components/communication/CommunicationWidget";
import { useResponsive } from "@/hooks/useResponsive";
import UniversalWalletDashboard from "@/components/wallet/UniversalWalletDashboard";

interface Driver {
  id: string;
  full_name: string;
  rating: number;
  distance: number;
  vehicle_type: string;
  email: string;
  completedDeliveries: number;
}

interface Delivery {
  id: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickup_address: string;
  delivery_address: string;
  package_details?: string;
  delivery_fee: number;
  driver_id?: string;
  customer_id?: string;
  created_at: string;
  driver?: any;
}

export default function DeliveryClient() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  const [activeTab, setActiveTab] = useState('booking');
  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]);
  const [currentDelivery, setCurrentDelivery] = useState<Delivery | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  useEffect(() => {
    loadNearbyDrivers();
    loadCurrentDelivery();
    loadDeliveryHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Temps réel pour la livraison en cours
  useEffect(() => {
    if (!currentDelivery?.id) return;

    const subscription = supabase
      .channel(`delivery_${currentDelivery.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: `id=eq.${currentDelivery.id}`
      }, (payload) => {
        console.log('Delivery updated:', payload);
        setCurrentDelivery(payload.new as Delivery);

        if (payload.new.status === 'delivered') {
          toast.success(t('deliveryClient.livraisonTerminee'));
          setCurrentDelivery(null);
          loadDeliveryHistory();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDelivery?.id]);

  const loadNearbyDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, rating, vehicle_type, email')
        .eq('vehicle_type', 'truck')
        .limit(10);

      if (error) throw error;

      const drivers = data.map(driver => ({
        id: driver.id,
        full_name: driver.full_name || 'Livreur',
        rating: driver.rating || 4.5,
        distance: Math.random() * 5 + 1,
        vehicle_type: driver.vehicle_type,
        email: driver.email || '',
        completedDeliveries: Math.floor(Math.random() * 100) + 10
      }));

      setNearbyDrivers(drivers);
    } catch (error) {
      console.error('Erreur chargement livreurs:', error);
      toast.error(t('deliveryClient.erreurLorsDuChargementDes'));
    }
  };

  const loadCurrentDelivery = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('client_id', user.id)
        .in('status', ['pending', 'assigned', 'picked_up', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setCurrentDelivery(data as any);
        setActiveTab('tracking');
      }
    } catch (error) {
      console.error('Erreur chargement livraison en cours:', error);
    }
  };

  const loadDeliveryHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('client_id', user.id)
        .in('status', ['delivered', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDeliveryHistory((data || []) as any);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    }
  };

  const handleBookDelivery = async () => {
    if (!pickupAddress || !deliveryAddress || !packageDescription) {
      toast.error(t('deliveryClient.veuillezRemplirTousLesChamps'));
      return;
    }

    if (!user) {
      toast.error(t('deliveryClient.vousDevezEtreConnectePour'));
      return;
    }

    setLoading(true);

    try {
      // Calculer le prix estimé (exemple simple)
      const estimatedFee = Math.floor(Math.random() * 15000) + 10000;

      const { data, error } = await supabase
        .from('deliveries')
        .insert({
          client_id: user.id,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          package_details: packageDescription,
          delivery_fee: estimatedFee,
          status: 'pending'
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success(t('deliveryClient.commandeDeLivraisonCreeeAvec'));
      setCurrentDelivery(data as any);
      setActiveTab('tracking');

      // Reset form
      setPickupAddress('');
      setDeliveryAddress('');
      setPackageDescription('');
      setRecipientName('');
      setRecipientPhone('');
    } catch (error) {
      console.error('Erreur création livraison:', error);
      toast.error(t('deliveryClient.erreurLorsDeLaCreation'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'En attente', variant: 'secondary' as const },
      assigned: { label: t('deliveryClient.assignee'), variant: 'default' as const },
      picked_up: { label: t('deliveryClient.recuperee'), variant: 'default' as const },
      in_transit: { label: 'En cours', variant: 'default' as const },
      delivered: { label: t('deliveryClient.livree'), variant: 'default' as const },
      cancelled: { label: t('deliveryClient.annulee'), variant: 'destructive' as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/home')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-livreur-primary" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    Service de Livraison
                  </h1>
                  {profile && (
                    <p className="text-xs text-muted-foreground">
                      {profile.first_name} {profile.last_name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <UserIdDisplay />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="booking" className="gap-2">
              <Package className="w-4 h-4" />
              {!isMobile && 'Commander'}
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-2">
              <Clock className="w-4 h-4" />
              {!isMobile && 'Suivi'}
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-2">
              <Wallet className="w-4 h-4" />
              {!isMobile && 'Wallet'}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              {!isMobile && 'Historique'}
            </TabsTrigger>
          </TabsList>

          {/* Onglet Commander */}
          <TabsContent value="booking" className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-bold mb-4">{t('deliveryClient.nouvelleLivraison')}</h2>

                <div className="space-y-2">
                  <Label htmlFor="pickup">{t('deliveryClient.adresseDeRecuperation')}</Label>
                  <Input
                    id="pickup"
                    placeholder="Ex: Rue KA001, Kaloum"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery">{t('deliveryClient.adresseDeLivraison')}</Label>
                  <Input
                    id="delivery"
                    placeholder="Ex: Quartier Matam, Conakry"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('deliveryClient.descriptionDuColis')}</Label>
                  <Textarea
                    id="description"
                    placeholder={t('deliveryClient.decrivezLeColisALivrer')}
                    value={packageDescription}
                    onChange={(e) => setPackageDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient">{t('deliveryClient.nomDuDestinataire')}</Label>
                    <Input
                      id="recipient"
                      placeholder={t('deliveryClient.nomDuDestinataire')}
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('deliveryClient.telephoneDuDestinataire')}</Label>
                    <Input
                      id="phone"
                      placeholder="+224 ..."
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleBookDelivery}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Création en cours...' : 'Commander la livraison'}
                </Button>
              </CardContent>
            </Card>

            {/* Livreurs disponibles */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">
                  Livreurs disponibles ({nearbyDrivers.length})
                </h3>
                <div className="space-y-3">
                  {nearbyDrivers.slice(0, 5).map((driver) => (
                    <div key={driver.id} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-livreur-primary rounded-full flex items-center justify-center">
                          <Truck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">{driver.full_name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                            <span>{driver.rating.toFixed(1)}</span>
                            <span>•</span>
                            <span>{driver.completedDeliveries} livraisons</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {driver.distance.toFixed(1)} km
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Suivi */}
          <TabsContent value="tracking">
            {currentDelivery ? (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">{t('deliveryClient.livraisonEnCours')}</h2>
                    {getStatusBadge(currentDelivery.status)}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                      <MapPin className="w-5 h-5 text-livreur-primary mt-1" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">{t('deliveryClient.recuperation')}</p>
                        <p className="font-medium">{currentDelivery.pickup_address}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                      <MapPin className="w-5 h-5 text-destructive mt-1" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Destination</p>
                        <p className="font-medium">{currentDelivery.delivery_address}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                      <Package className="w-5 h-5 text-primary mt-1" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Colis</p>
                        <p className="font-medium">{currentDelivery.package_details || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {currentDelivery.driver && (
                    <div className="border-t pt-4">
                      <h3 className="font-bold mb-3">{t('deliveryClient.votreLivreur')}</h3>
                      <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                        <div className="w-12 h-12 bg-livreur-primary rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{currentDelivery.driver?.full_name || 'Livreur'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                            <span>{currentDelivery.driver?.rating?.toFixed(1) || '4.5'}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <Phone className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{t('deliveryClient.fraisDeLivraison')}</span>
                      <span className="text-xl font-bold text-livreur-primary">
                        {formatCurrency(currentDelivery.delivery_fee)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t('deliveryClient.aucuneLivraisonEnCours')}</p>
                  <Button
                    className="mt-4"
                    onClick={() => setActiveTab('booking')}
                  >
                    Commander une livraison
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet Wallet */}
          <TabsContent value="wallet">
            <UniversalWalletDashboard
              userId={user?.id || ''}
              showTransactions={true}
            />
          </TabsContent>

          {/* Onglet Historique */}
          <TabsContent value="history">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">
                  Historique des livraisons ({deliveryHistory.length})
                </h2>
                {deliveryHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('deliveryClient.aucuneLivraisonDansLHistorique')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deliveryHistory.map((delivery) => (
                      <div key={delivery.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-livreur-primary" />
                            <span className="font-medium">
                              {new Date(delivery.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          {getStatusBadge(delivery.status)}
                        </div>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">{t('deliveryClient.de')}</span> {delivery.pickup_address}</p>
                          <p><span className="text-muted-foreground">À:</span> {delivery.delivery_address}</p>
                          <p className="font-semibold text-livreur-primary">
                            {formatCurrency(delivery.delivery_fee)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Communication Widget */}
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}
