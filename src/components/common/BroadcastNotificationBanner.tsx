import { useTranslation } from "@/hooks/useTranslation";
/**
 * COMPOSANT - BANNIÈRE DE NOTIFICATION BROADCAST
 * Affiche les messages de diffusion aux utilisateurs
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bell,
  Megaphone,
  X,
  ExternalLink,
  CheckCheck,
  AlertTriangle,
  Info,
  Clock
} from 'lucide-react';
import { useBroadcasts, Broadcast } from '@/hooks/useBroadcasts';
import { cn } from '@/lib/utils';

interface BroadcastNotificationBannerProps {
  showBanner?: boolean;
  className?: string;
}

const BroadcastNotificationBanner: React.FC<BroadcastNotificationBannerProps> = ({
  showBanner = true,
  className
}) => {
  const { t } = useTranslation();
  const {
    broadcasts,
    stats,
    loading,
    markAsRead,
    markAllAsRead,
    getUrgentBroadcast,
    getUnreadBroadcasts
  } = useBroadcasts();

  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [dismissedUrgent, setDismissedUrgent] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const urgentBroadcast = getUrgentBroadcast();
  const _unreadBroadcasts = getUnreadBroadcasts();

  const handleOpenBroadcast = async (broadcast: Broadcast) => {
    setSelectedBroadcast(broadcast);
    if (!broadcast.is_read) {
      await markAsRead(broadcast.broadcast_id);
    }
  };

  const handleDismissUrgent = (broadcastId: string) => {
    setDismissedUrgent(prev => [...prev, broadcastId]);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-[#ff4000]" />;
      case 'high':
        return <Bell className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-[#ff4000] bg-orange-50 dark:bg-[#ff4000]/30';
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-950/30';
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/30';
    }
  };

  // Bannière urgente en haut de page
  const showUrgentBanner = showBanner &&
    urgentBroadcast &&
    !dismissedUrgent.includes(urgentBroadcast.broadcast_id);

  return (
    <>
      {/* Bannière urgente */}
      {showUrgentBanner && (
        <div className={cn(
          "fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top",
          getPriorityStyle(urgentBroadcast.priority),
          className
        )}>
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <AlertTriangle className="h-5 w-5 text-[#ff4000] animate-pulse" />
                <div className="flex-1">
                  <p className="font-semibold text-[#ff4000] dark:text-orange-300">
                    {urgentBroadcast.title}
                  </p>
                  <p className="text-sm text-[#ff4000] dark:text-[#ff4000] line-clamp-1">
                    {urgentBroadcast.content}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#ff4000] text-[#ff4000] hover:bg-orange-100"
                  onClick={() => handleOpenBroadcast(urgentBroadcast)}
                >
                  Voir
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleDismissUrgent(urgentBroadcast.broadcast_id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bouton de notification avec popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {stats.unread > 0 && (
              <Badge
                className={cn(
                  "absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs",
                  stats.urgent > 0 ? "bg-[#ff4000]" : "bg-primary"
                )}
              >
                {stats.unread > 9 ? '9+' : stats.unread}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="font-semibold">Messages</span>
            </div>
            {stats.unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Tout marquer lu
              </Button>
            )}
          </div>

          <ScrollArea className="h-[300px]">
            {broadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t('broadcastNotificationBanner.aucunMessage')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {broadcasts.map((broadcast) => (
                  <div
                    key={broadcast.broadcast_id}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                      !broadcast.is_read && "bg-primary/5"
                    )}
                    onClick={() => handleOpenBroadcast(broadcast)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-1 p-1 rounded-full",
                        broadcast.priority === 'urgent' ? 'bg-orange-100' :
                        broadcast.priority === 'high' ? 'bg-orange-100' : 'bg-blue-100'
                      )}>
                        {getPriorityIcon(broadcast.priority)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-sm truncate",
                            !broadcast.is_read && "font-semibold"
                          )}>
                            {broadcast.title}
                          </p>
                          {!broadcast.is_read && (
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {broadcast.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(broadcast.sent_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Dialog pour voir le message complet */}
      <Dialog open={!!selectedBroadcast} onOpenChange={() => setSelectedBroadcast(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              {selectedBroadcast && getPriorityIcon(selectedBroadcast.priority)}
              <Badge variant="outline">
                {selectedBroadcast?.message_type}
              </Badge>
            </div>
            <DialogTitle>{selectedBroadcast?.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-muted-foreground whitespace-pre-wrap">
              {selectedBroadcast?.content}
            </p>

            {selectedBroadcast?.image_url && (
              <img
                src={selectedBroadcast.image_url}
                alt="Broadcast"
                className="rounded-lg max-h-60 w-full object-cover"
              />
            )}

            {selectedBroadcast?.link_url && (
              <a
                href={selectedBroadcast.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {selectedBroadcast.link_text || 'En savoir plus'}
              </a>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
              <span>De: {selectedBroadcast?.sender_name}</span>
              <span>
                {selectedBroadcast?.sent_at &&
                  new Date(selectedBroadcast.sent_at).toLocaleString('fr-FR')}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BroadcastNotificationBanner;
