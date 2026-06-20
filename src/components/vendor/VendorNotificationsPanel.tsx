import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVendorNotifications } from '@/hooks/useVendorNotifications';
import { Bell, CheckCheck, Package, CreditCard, MessageSquare, Shield, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const notificationIcons: Record<string, any> = {
  order: Package,
  payment: CreditCard,
  message: MessageSquare,
  security: Shield,
  stock: AlertTriangle
};

const notificationColors: Record<string, string> = {
  order: 'text-blue-600',
  payment: 'text-[#ff4000]',
  message: 'text-[#04439e]',
  security: 'text-[#ff4000]',
  stock: 'text-orange-600'
};

const INITIAL_VISIBLE_COUNT = 3;

export function VendorNotificationsPanel() {
  const { t } = useTranslation();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useVendorNotifications();
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const visibleNotifications = showAll
    ? notifications
    : notifications.slice(0, INITIAL_VISIBLE_COUNT);

  const hiddenCount = notifications.length - INITIAL_VISIBLE_COUNT;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {visibleNotifications.map((notification) => {
          const Icon = notificationIcons[notification.type] || Bell;
          const colorClass = notificationColors[notification.type] || 'text-muted-foreground';

          return (
            <Card
              key={notification.id}
              className={`p-4 cursor-pointer transition-colors ${
                !notification.read ? 'bg-primary/5 border-primary' : ''
              }`}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 ${colorClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{notification.title}</h3>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: fr
                    })}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}

        {notifications.length === 0 && (
          <Card className="p-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('vendorNotificationsPanel.aucuneNotification')}</p>
          </Card>
        )}

        {/* Bouton pour afficher plus / moins */}
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Afficher moins
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Voir {hiddenCount} autres notifications
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
