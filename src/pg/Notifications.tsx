import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserNotifications, UserNotification } from '@/hooks/useUserNotifications';
import { useAuth } from '@/hooks/useAuth';
import { getNotificationLink } from '@/lib/notificationLink';
import {
  Bell,
  CheckCheck,
  Package,
  CreditCard,
  MessageSquare,
  Shield,
  AlertTriangle,
  Star,
  Gift,
  ArrowLeft,
  Trash2,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, React.ElementType> = {
  order: Package,
  payment: CreditCard,
  message: MessageSquare,
  security: Shield,
  stock: AlertTriangle,
  promotion: Gift,
  recommendation: Star,
  system: Info,
};

const notificationColors: Record<string, string> = {
  order: 'text-blue-600 bg-blue-100',
  payment: 'text-[#ff4000] bg-orange-100',
  message: 'text-[#04439e] bg-blue-100',
  security: 'text-[#ff4000] bg-orange-100',
  stock: 'text-orange-600 bg-orange-100',
  promotion: 'text-[#ff4000] bg-orange-100',
  recommendation: 'text-[#ff4000] bg-orange-100',
  system: 'text-gray-600 bg-gray-100',
};

function NotificationItem({
  notification,
  onOpen,
  onDelete
}: {
  notification: UserNotification;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const Icon = notificationIcons[notification.type] || Bell;
  const colorClass = notificationColors[notification.type] || 'text-muted-foreground bg-muted';
  const [iconBg, iconText] = colorClass.split(' ');

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        !notification.read && "bg-primary/5 border-primary/30"
      )}
      onClick={onOpen}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-full shrink-0", iconBg.replace('text-', 'bg-').replace('600', '100'))}>
            <Icon className={cn("h-5 w-5", iconText)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{notification.title}</h3>
              {!notification.read && (
                <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
                locale: fr
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useUserNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Clic sur une notification : la marquer lue PUIS rediriger vers la fonctionnalité dédiée
  // (ex. confirmation de réception → page de suivi de la commande concernée).
  const handleOpen = (notification: UserNotification) => {
    if (!notification.read) markAsRead(notification.id);
    const link = getNotificationLink(notification, (profile as any)?.role);
    if (link) navigate(link);
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Connexion requise</CardTitle>
            <CardDescription>
              Connectez-vous pour voir vos notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/auth')}>
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Notifications</h1>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Tout lire</span>
            </Button>
          )}
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="max-w-2xl mx-auto px-4 py-3 border-b">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Toutes ({notifications.length})
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            Non lues ({unreadCount})
          </Button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
            </h2>
            <p className="text-muted-foreground">
              {filter === 'unread'
                ? 'Toutes vos notifications ont été lues'
                : 'Vous recevrez des notifications ici'}
            </p>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onOpen={() => handleOpen(notification)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </main>
    </div>
  );
}
