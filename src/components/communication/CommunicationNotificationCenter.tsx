/**
 * Centre de Notifications pour Communication - 224SOLUTIONS
 * Affiche les notifications de messages et appels
 */

import React, { useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, MessageSquare, Phone, Video, X, Check } from 'lucide-react';
import { useUniversalCommunication } from '@/hooks/useUniversalCommunication';
import { useAuth } from '@/hooks/useAuth';

interface CommunicationNotificationCenterProps {
  className?: string;
}

export default function CommunicationNotificationCenter({
  className
}: CommunicationNotificationCenterProps) {
  const { t } = useTranslation();
  const { notifications, markNotificationAsRead, loadNotifications } = useUniversalCommunication();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
    }
  }, [user?.id, loadNotifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'missed_call':
        return <Phone className="h-4 w-4" />;
      case 'call_incoming':
        return <Video className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_message':
        return 'bg-blue-500';
      case 'missed_call':
        return 'bg-[#ff4000]';
      case 'call_incoming':
        return 'bg-[#ff4000]';
      default:
        return 'bg-gray-500';
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    const promises = notifications.map(n => markNotificationAsRead(n.id));
    await Promise.all(promises);
  };

  if (notifications.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground">{t('communicationNotificationCenter.aucuneNotification')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
            <Badge variant="destructive">{notifications.length}</Badge>
          </CardTitle>
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
            >
              <Check className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-medium text-sm leading-5">
                      {notification.title}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 hover:bg-destructive/10"
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 leading-5">
                    {notification.body}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(notification.created_at).toLocaleString('fr-FR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {notification.type === 'message' ? 'Message' :
                       notification.type === 'call' ? 'Appel' :
                       notification.type === 'mention' ? 'Mention' :
                       notification.type === 'invitation' ? 'Invitation' :
                       'Notification'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}