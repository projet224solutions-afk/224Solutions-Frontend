/**
 * Hook pour détecter et gérer le statut de connexion (online/offline)
 * Uses shared networkHealth with aggressive caching to prevent flooding
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkNetworkHealth } from '@/lib/networkHealth';

interface OnlineStatus {
  isOnline: boolean;
  connectivity: 'online' | 'degraded' | 'offline';
  lastOnline: Date | null;
  wasOffline: boolean;
  lastError: string | null;
  offlineDuration: number;
  checkConnection: () => Promise<boolean>;
}

const HEALTH_TIMEOUT_MS = 4500;
const OFFLINE_CONFIRMATION_FAILURES = 2;
const OFFLINE_RECOVERY_POLL_MS = 15000;
const OFFLINE_EVENT_GRACE_MS = 1500;

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [connectivity, setConnectivity] = useState<'online' | 'degraded' | 'offline'>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );
  const [lastOnline, setLastOnline] = useState<Date | null>(isOnline ? new Date() : null);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [offlineDuration, setOfflineDuration] = useState<number>(0);

  const offlineStartRef = useRef<Date | null>(isOnline ? null : new Date());
  const consecutiveFailuresRef = useRef(0);
  const pendingOfflineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingOfflineTimer = useCallback(() => {
    if (pendingOfflineTimerRef.current) {
      clearTimeout(pendingOfflineTimerRef.current);
      pendingOfflineTimerRef.current = null;
    }
  }, []);

  const markOffline = useCallback((reason: string) => {
    clearPendingOfflineTimer();
    if (!offlineStartRef.current) offlineStartRef.current = new Date();
    setIsOnline(false);
    setConnectivity('offline');
    setLastError(reason);
  }, [clearPendingOfflineTimer]);

  const markOnline = useCallback((nextConnectivity: 'online' | 'degraded', reason?: string) => {
    clearPendingOfflineTimer();
    const now = new Date();
    if (offlineStartRef.current) {
      setOfflineDuration(Math.floor((now.getTime() - offlineStartRef.current.getTime()) / 1000));
      setWasOffline(true);
      offlineStartRef.current = null;
    }
    setIsOnline(true);
    setConnectivity(nextConnectivity);
    setLastOnline(now);
    setLastError(nextConnectivity === 'degraded' ? reason || 'degraded' : null);
    consecutiveFailuresRef.current = 0;
  }, [clearPendingOfflineTimer]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    // Probe real reachability instead of trusting navigator.onLine alone.
    const result = await checkNetworkHealth({ timeoutMs: HEALTH_TIMEOUT_MS, retries: 1, force: !isOnline });
    if (result.connectivity !== 'offline') {
      markOnline(result.connectivity, result.reason);
      return true;
    }

    consecutiveFailuresRef.current += 1;
    setLastError(result.reason);

    // Avoid false offline on one transient failure when navigator is still online
    if (consecutiveFailuresRef.current < OFFLINE_CONFIRMATION_FAILURES) {
      console.warn('[HEALTH CHECK FAIL] transient', {
        reason: result.reason,
        failures: consecutiveFailuresRef.current,
      });
      return false;
    }

    markOffline(result.reason);
    return false;
  }, [isOnline, markOffline, markOnline]);

  useEffect(() => {
    const handleOnline = () => void checkConnection();
    const handleOffline = () => {
      clearPendingOfflineTimer();
      pendingOfflineTimerRef.current = setTimeout(() => {
        pendingOfflineTimerRef.current = null;
        if (!navigator.onLine) {
          consecutiveFailuresRef.current = OFFLINE_CONFIRMATION_FAILURES;
          markOffline('browser_offline_event');
          return;
        }

        void checkConnection();
      }, OFFLINE_EVENT_GRACE_MS);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Single check on mount — no polling when online (save bandwidth)
    void checkConnection();

    // Only poll when offline to detect recovery
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!isOnline) {
      interval = setInterval(() => void checkConnection(), OFFLINE_RECOVERY_POLL_MS);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearPendingOfflineTimer();
      if (interval) clearInterval(interval);
    };
  }, [checkConnection, clearPendingOfflineTimer, isOnline, markOffline]);

  useEffect(() => {
    if (wasOffline) {
      const timeout = setTimeout(() => setWasOffline(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [wasOffline]);

  return { isOnline, connectivity, lastOnline, wasOffline, lastError, offlineDuration, checkConnection };
}

export default useOnlineStatus;
