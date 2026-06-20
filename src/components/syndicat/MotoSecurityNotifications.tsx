import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  title: string;
  message: string;
  alert_type: string;
  severity?: string;
  is_read: boolean | null;
  is_critical: boolean | null;
  created_at: string | null;
}

interface Props {
  bureauId: string;
}

export default function MotoSecurityNotifications({ bureauId }: Props) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('syndicate_alerts')
        .select('*')
        .eq('bureau_id', bureauId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      toast.error(t('motoSecurityNotifications.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`security_notifications-${bureauId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'syndicate_alerts',
          filter: `bureau_id=eq.${bureauId}`
        },
        (payload: any) => {
          toast.error(t('motoSecurityNotifications.nouvelleAlerteDeSecurite'), {
            description: payload.new.title
          });
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bureauId]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('syndicate_alerts')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      loadNotifications();
      toast.success(t('motoSecurityNotifications.notificationMarqueeCommeLue'));
    } catch (error) {
      console.error('Erreur marquage notification:', error);
      toast.error(t('motoSecurityNotifications.erreurLorsDuMarquageDe'));
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('syndicate_alerts')
        .update({ is_read: true })
        .eq('bureau_id', bureauId)
        .eq('is_read', false);

      if (error) throw error;

      toast.success(t('motoSecurityNotifications.toutesLesNotificationsOntEte'));
      loadNotifications();
    } catch (error) {
      console.error('Erreur marquage notifications:', error);
      toast.error(t('motoSecurityNotifications.erreurLorsDuMarquageDes'));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert':
      case 'critical':
      case 'security':
        return <AlertTriangle className="w-5 h-5 text-[#ff4000]" />;
      case 'success':
      case 'resolved':
        return <CheckCircle2 className="w-5 h-5 text-[#ff4000]" />;
      case 'info':
      case 'maintenance':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              Tout marquer comme lu
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('motoSecurityNotifications.aucuneNotification')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition-colors ${
                  notification.is_read
                    ? 'bg-background border-border'
                    : notification.is_critical
                      ? 'bg-orange-50 border-orange-200 dark:bg-[#ff4000]/20 dark:border-[#ff4000]'
                      : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.alert_type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                        {notification.is_critical && (
                          <Badge variant="destructive" className="text-xs">Critique</Badge>
                        )}
                        {!notification.is_read && (
                          <Badge variant="secondary" className="text-xs">{t('motoSecurityNotifications.nouveau')}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        {notification.created_at
                          ? new Date(notification.created_at).toLocaleString('fr-FR')
                          : 'Date inconnue'
                        }
                      </span>
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-7 text-xs"
                        >
                          Marquer comme lu
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
