/**
 * NOTIFICATION BELL BUTTON - Unified
 * Uses the `notifications` table (same source as Notifications page)
 * to ensure badge count matches page content exactly.
 */

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NotificationBellButtonProps {
  className?: string;
  iconSize?: string;
  externalUnreadCount?: number;
  badgeClassName?: string;
}

export function NotificationBellButton({ className = '', iconSize = 'w-5 h-5', externalUnreadCount, badgeClassName }: NotificationBellButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const displayCount = externalUnreadCount !== undefined ? externalUnreadCount : unreadCount;

  const fetchUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('[Bell] Error fetching unread count:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchUnread();

    // Listen to INSERT / UPDATE / DELETE on notifications for this user
    const channel = supabase
      .channel(`notif-bell-unified-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchUnread]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate('/notifications')}
      className={`relative ${className}`}
      aria-label="Notifications"
    >
      <Bell className={iconSize} />
      {displayCount > 0 && (
        <Badge className={`absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs border-2 border-card ${badgeClassName || 'bg-destructive text-destructive-foreground'}`}>
          {displayCount > 99 ? '99+' : displayCount}
        </Badge>
      )}
    </Button>
  );
}