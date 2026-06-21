/**
 * NOTIFICATIONS DE LIVRAISON POUR LE VENDEUR
 * Affiche les notifications en temps réel avec les preuves de livraison
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  CheckCircle2,
  Package,
  ImageIcon,
  PenTool,
  Clock,
  X,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface DeliveryNotification {
  id: string;
  delivery_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean; // La colonne s'appelle 'read' dans la DB
  created_at: string;
  delivery?: {
    customer_name: string;
    delivery_address: any; // jsonb
    delivery_fee: number;
    proof_photo_url: string | null;
    client_signature: string | null;
    completed_at: string | null;
  };
}

export function VendorDeliveryNotifications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<DeliveryNotification | null>(null);
  const [_vendorId, setVendorId] = useState<string | null>(null);

  // Charger le vendeur
  useEffect(() => {
    const loadVendor = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setVendorId(data.id);
      }
    };
    loadVendor();
  }, [user]);

  // Charger les notifications
  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('delivery_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'delivery_completed')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Charger les détails de livraison pour chaque notification
      const notificationsWithDetails = await Promise.all(
        (data || []).map(async (notif) => {
          if (notif.delivery_id) {
            const { data: delivery } = await supabase
              .from('deliveries')
              .select('customer_name, delivery_address, delivery_fee, proof_photo_url, client_signature, completed_at')
              .eq('id', notif.delivery_id)
              .single();

            return { ...notif, delivery } as DeliveryNotification;
          }
          return notif as DeliveryNotification;
        })
      );

      setNotifications(notificationsWithDetails);
      setUnreadCount(notificationsWithDetails.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();

      // Souscription temps réel
      const channel = supabase
        .channel('vendor-delivery-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'delivery_notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New delivery notification:', payload);
            loadNotifications();
            toast.success(t('vendorDeliveryNotifications.nouvelleNotificationDeLivraison'));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Marquer comme lu
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('delivery_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    try {
      await supabase
        .from('delivery_notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success(t('vendorDeliveryNotifications.toutesLesNotificationsMarqueesComme'));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = useFormatCurrency();

  const viewNotificationDetails = (notif: DeliveryNotification) => {
    setSelectedNotification(notif);
    if (!notif.read) {
      markAsRead(notif.id);
    }
  };

  return (
    <>
      {/* Bouton notification avec badge */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-[#ff4000] text-white text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Livraisons confirmées
              </DialogTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  Tout marquer lu
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('vendorDeliveryNotifications.aucuneNotification')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <Card
                    key={notif.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      !notif.read ? 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/10' : ''
                    }`}
                    onClick={() => viewNotificationDetails(notif)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-[#ff4000] flex-shrink-0" />
                            <span className="font-medium text-sm truncate">
                              {notif.delivery?.customer_name || 'Client'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {typeof notif.delivery?.delivery_address === 'object'
                              ? notif.delivery?.delivery_address?.formatted || notif.delivery?.delivery_address?.street || 'Adresse'
                              : notif.delivery?.delivery_address || 'Adresse'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(notif.created_at)}
                            </span>
                            {notif.delivery?.proof_photo_url && (
                              <ImageIcon className="h-3 w-3 text-blue-500" />
                            )}
                            {notif.delivery?.client_signature && (
                              <PenTool className="h-3 w-3 text-[#04439e]" />
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[#ff4000] text-xs">
                          {formatCurrency(notif.delivery?.delivery_fee || 0)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal détails de la notification */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />
              Livraison confirmée
            </DialogTitle>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4">
              {/* Infos client */}
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('vendorDeliveryNotifications.client')}</span>
                    <span className="font-medium">{selectedNotification.delivery?.customer_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Adresse</span>
                    <span className="text-sm text-right max-w-[60%]">
                      {typeof selectedNotification.delivery?.delivery_address === 'object'
                        ? selectedNotification.delivery?.delivery_address?.formatted || selectedNotification.delivery?.delivery_address?.street || 'Adresse'
                        : selectedNotification.delivery?.delivery_address || 'Adresse'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('vendorDeliveryNotifications.montant')}</span>
                    <span className="font-bold text-[#ff4000]">
                      {formatCurrency(selectedNotification.delivery?.delivery_fee || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('vendorDeliveryNotifications.confirmeLe')}</span>
                    <span className="text-sm">
                      {selectedNotification.delivery?.completed_at
                        ? formatDate(selectedNotification.delivery.completed_at)
                        : formatDate(selectedNotification.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Photo de preuve */}
              {selectedNotification.delivery?.proof_photo_url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                    Photo de preuve
                  </p>
                  <img
                    src={selectedNotification.delivery.proof_photo_url}
                    alt={t('vendorDeliveryNotifications.preuveDeLivraison')}
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(selectedNotification.delivery?.proof_photo_url || '', '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir en grand
                  </Button>
                </div>
              )}

              {/* Signature client */}
              {selectedNotification.delivery?.client_signature && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-[#04439e]" />
                    Signature du client
                  </p>
                  <div className="bg-white border rounded-lg p-4">
                    <img
                      src={selectedNotification.delivery.client_signature}
                      alt={t('vendorDeliveryNotifications.signatureClient')}
                      className="w-full h-24 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Message complet */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap font-sans">
                  {selectedNotification.message}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
