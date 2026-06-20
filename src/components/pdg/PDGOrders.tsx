/**
 * 📦 PDG ORDERS MANAGEMENT
 * Gestion centralisée des commandes
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Clock, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Order {
  id: string;
  public_id: string;
  customer_id: string;
  vendor_id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export default function PDGOrders() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0
  });

  const loadVendorProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('pDGOrders.vousDevezEtreConnecte'));
        return null;
      }

      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error || !vendor) {
        console.error('Erreur profil vendeur:', error);
        toast.error(t('pDGOrders.profilVendeurIntrouvable'));
        return null;
      }

      return vendor.id;
    } catch (error: any) {
      console.error('Erreur chargement profil:', error);
      return null;
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);

      // PDG : charge TOUTES les commandes de la plateforme (vue globale),
      // et non celles d'un seul vendeur (l'ancien code gatait sur un profil vendeur
      // du PDG -> introuvable -> « Profil vendeur introuvable » + 0 commande).
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setOrders(data || []);

      // Calculer les stats
      const pending = data?.filter(o => o.status === 'pending').length || 0;
      const confirmed = data?.filter(o => o.status === 'confirmed').length || 0;
      const completed = data?.filter(o => o.status === 'delivered').length || 0;
      const cancelled = data?.filter(o => o.status === 'cancelled').length || 0;

      setStats({ pending, confirmed, completed, cancelled });
    } catch (error: any) {
      console.error('Erreur chargement commandes:', error);
      toast.error(t('pDGOrders.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: 'En attente', className: 'bg-[#ff4000]' },
      confirmed: { label: 'En cours', className: 'bg-blue-500' },
      delivered: { label: 'Livrée', className: 'bg-[#ff4000]' },
      cancelled: { label: 'Annulée', className: 'bg-[#ff4000]' }
    };

    const config = variants[status] || { label: status, className: 'bg-gray-500' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span>{t('pDGOrders.chargementDesCommandes')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.pending}</span>
              <Clock className="w-5 h-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('pDGOrders.confirmees')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.confirmed}</span>
              <Package className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('pDGOrders.terminees')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.completed}</span>
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('pDGOrders.annulees')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.cancelled}</span>
              <XCircle className="w-5 h-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des commandes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pDGOrders.commandesRecentes')}</CardTitle>
              <CardDescription>Les {orders.length} dernières commandes</CardDescription>
            </div>
            <Button onClick={loadOrders} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{order.public_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold">{fc(order.total_amount || 0)}</span>
                  {getStatusBadge(order.status)}
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
