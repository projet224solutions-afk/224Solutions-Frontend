/**
 * HOOK: Notifications Taxi-Moto temps réel
 * Subscribe aux notifications avec gestion du son et affichage toast
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationsService, type TaxiNotification } from '@/services/taxi/notificationsService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useTaxiNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<TaxiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Charger les notifications au démarrage
  useEffect(() => {
    if (!user) return;

    const loadNotifications = async () => {
      const unread = await NotificationsService.getUnreadNotifications(user.id);
      setNotifications(unread);
      setUnreadCount(unread.length);
      setLoading(false);
    };

    loadNotifications();
  }, [user]);

  // Subscribe au temps réel
  useEffect(() => {
    if (!user) return;

    // 1. S'abonner aux notifications dans taxi_notifications
    const unsubscribe = NotificationsService.subscribeToNotifications(
      user.id,
      (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Tous les toasts taxi ramènent le chauffeur vers son tableau de bord course.
        const ride = notification.ride_id ? `?ride=${notification.ride_id}` : '';
        const goToRide = { label: 'Voir', onClick: () => navigate(`/taxi-moto/driver${ride}`) };

        if (notification.type === 'ride_request' || notification.type === 'new_ride_request') {
          toast.info(notification.title, {
            description: notification.body,
            duration: 10000,
            action: goToRide,
          });
          playNotificationSound();
        } else if (notification.type === 'ride_accepted') {
          toast.success(notification.title, { description: notification.body, action: goToRide });
        } else if (notification.type === 'payment_received') {
          toast.success(notification.title, { description: notification.body, icon: '💰', action: goToRide });
        }
      }
    );

    return unsubscribe;
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    await NotificationsService.markAsRead(notificationId);
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await NotificationsService.markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead
  };
};

// Utiliser le service de son global
import { playNotificationSound } from '@/services/notificationSoundService';

export { playNotificationSound };