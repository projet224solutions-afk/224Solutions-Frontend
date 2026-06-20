/**
 * UNIFIED NOTIFICATIONS REALTIME LISTENER
 *
 * Listens to `notifications` table (source of truth) + `messages` table.
 *
 * Behavior:
 * - Tab VISIBLE: toast + in-app sound + vibration
 * - Tab HIDDEN: system Notification API push (with sound/vibration via OS)
 * - Deduplication via seenIds to prevent double toast/sound
 * - Cleanup of seen IDs to prevent memory leak
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playNotificationSound } from "@/services/notificationSoundService";

type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
};

/**
 * Show a system-level notification (works even when tab is hidden)
 */
function showSystemNotification(title: string, body: string, tag?: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/favicon.png',
      tag: tag || `notif-${Date.now()}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      // Navigate to notifications page
      if (window.location.pathname !== '/notifications') {
        window.location.href = '/notifications';
      }
    };
  } catch (e) {
    // Service worker context or unsupported
    console.debug('[Notifications] System notification fallback failed:', e);
  }
}

/**
 * Handle a new notification based on visibility state
 */
function handleNewNotification(n: AppNotification): void {
  const title = n.title || "Nouvelle notification";
  const description = n.message || "";

  if (document.visibilityState === 'visible') {
    // ── Tab is ACTIVE: toast + sound + vibration ──
    playNotificationSound();

    switch ((n.type || "").toLowerCase()) {
      case "security":
        toast.error(title, { description, duration: 10000 });
        break;
      case "promotion":
      case "recommendation":
        toast.info(title, { description });
        break;
      case "order":
      case "payment":
        toast.success(title, { description });
        break;
      case "message":
        toast("💬 " + title, { description, duration: 5000 });
        break;
      default:
        toast(title, { description });
        break;
    }
  } else {
    // ── Tab is HIDDEN: system push notification (makes phone ring/vibrate) ──
    showSystemNotification(title, description, `notif-${n.id}`);
  }
}

/**
 * Handle a new message (from messages table)
 */
function handleNewMessage(msg: any): void {
  const senderName = msg.sender_name || "Nouveau message";
  const content = msg.content?.substring(0, 80) || "Vous avez reçu un message";

  if (document.visibilityState === 'visible') {
    playNotificationSound();
    toast("💬 " + senderName, {
      description: content,
      duration: 5000,
    });
  } else {
    showSystemNotification(`💬 ${senderName}`, content, `msg-${msg.id}`);
  }
}

/**
 * Global realtime subscription on `notifications` + `messages`.
 * Plays sound and shows toast for active tabs,
 * sends system push notification for hidden tabs.
 */
export function useNotificationsRealtime() {
  const { user } = useAuth();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Request notification permission proactively (one-time, non-blocking)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // ─── 1. Notifications table listener ───
    const notifChannel = supabase
      .channel(`unified-notif:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          if (!n?.id || seenIdsRef.current.has(n.id)) return;
          seenIdsRef.current.add(n.id);
          handleNewNotification(n);

          // Cleanup seen IDs periodically
          if (cleanupTimerRef.current) window.clearTimeout(cleanupTimerRef.current);
          cleanupTimerRef.current = window.setTimeout(() => {
            const ids = Array.from(seenIdsRef.current);
            if (ids.length > 200) {
              seenIdsRef.current = new Set(ids.slice(ids.length - 200));
            }
          }, 5000);
        }
      )
      .subscribe();

    // ─── 2. Messages table listener ───
    const msgChannel = supabase
      .channel(`unified-msg:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new as any;
          if (!msg?.id || seenIdsRef.current.has(msg.id)) return;
          seenIdsRef.current.add(msg.id);
          handleNewMessage(msg);
        }
      )
      .subscribe();

    return () => {
      if (cleanupTimerRef.current) window.clearTimeout(cleanupTimerRef.current);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [user?.id]);
}