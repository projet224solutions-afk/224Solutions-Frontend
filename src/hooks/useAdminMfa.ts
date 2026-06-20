/**
 * 🔐 Hook 2FA ADMIN (step-up TOTP vérifié SERVEUR)
 * ---------------------------------------------------------------------------
 * Remplace l'ancien `useTwoFactorAuth` (client-side, cosmétique). Toute la
 * cryptographie/vérification vit dans le backend Node.js — ici on ne fait que
 * piloter les endpoints `/api/admin/mfa/*`.
 */

import { useState, useCallback, useEffect } from 'react';
import { backendFetch } from '@/services/backendApi';

export interface AdminMfaStatus {
  enabled: boolean;
  enrolledAt: string | null;
  locked: boolean;
  stepUpActive: boolean;
  enforced: boolean;
}

interface EnrollResult {
  otpauthUrl: string;
  secret: string;
}

export function useAdminMfa() {
  const [status, setStatus] = useState<AdminMfaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backendFetch<unknown>('/api/admin/mfa/status', { method: 'GET' });
      if (res.success) {
        const r = res as unknown as AdminMfaStatus;
        setStatus({
          enabled: !!r.enabled,
          enrolledAt: r.enrolledAt ?? null,
          locked: !!r.locked,
          stepUpActive: !!r.stepUpActive,
          enforced: !!r.enforced,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  /** Génère un secret EN ATTENTE et renvoie l'URL otpauth (pour le QR). */
  const enroll = useCallback(async (): Promise<EnrollResult | null> => {
    setBusy(true);
    try {
      const res = await backendFetch<unknown>('/api/admin/mfa/enroll', { method: 'POST', body: {} });
      if (!res.success) return null;
      const r = res as unknown as EnrollResult;
      return r.otpauthUrl ? { otpauthUrl: r.otpauthUrl, secret: r.secret } : null;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Vérifie le code et active la 2FA. */
  const activate = useCallback(async (code: string): Promise<{ ok: boolean; error?: string }> => {
    setBusy(true);
    try {
      const res = await backendFetch('/api/admin/mfa/activate', { method: 'POST', body: { code } });
      if (res.success) { await loadStatus(); return { ok: true }; }
      return { ok: false, error: res.error };
    } finally {
      setBusy(false);
    }
  }, [loadStatus]);

  /** Ouvre une fenêtre step-up de 5 min (pour les ops sensibles). */
  const stepUp = useCallback(async (code: string): Promise<{ ok: boolean; error?: string; code?: string }> => {
    const res = await backendFetch('/api/admin/mfa/step-up', { method: 'POST', body: { code } });
    if (res.success) return { ok: true };
    return { ok: false, error: res.error, code: res.code };
  }, []);

  /** Désactive la 2FA (code valide requis). */
  const disable = useCallback(async (code: string): Promise<{ ok: boolean; error?: string }> => {
    setBusy(true);
    try {
      const res = await backendFetch('/api/admin/mfa/disable', { method: 'POST', body: { code } });
      if (res.success) { await loadStatus(); return { ok: true }; }
      return { ok: false, error: res.error };
    } finally {
      setBusy(false);
    }
  }, [loadStatus]);

  return { status, loading, busy, loadStatus, enroll, activate, stepUp, disable };
}
