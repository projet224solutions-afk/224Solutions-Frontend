/**
 * 🤖 Contexte temps réel du Copilot 224 (Phase 1 — additif).
 * Agrège, en lecture seule, ce que le copilot doit « connaître » de l'utilisateur :
 * prénom, rôle, solde wallet + devise, service courant. Tolérant aux erreurs (dégrade
 * proprement). N'altère AUCUN flux existant : sert juste à enrichir le system prompt.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CopilotContext {
  name?: string;
  role?: string;
  balance?: number;
  currency?: string;
  service?: string;
}

export function useCopilotContext(service?: string): CopilotContext {
  const { user } = useAuth();
  const [ctx, setCtx] = useState<CopilotContext>({ service });

  useEffect(() => {
    let alive = true;
    setCtx((c) => ({ ...c, service }));
    if (!user) return;
    (async () => {
      const base: CopilotContext = {
        service,
        name: (user as any).user_metadata?.full_name || (user.email ? user.email.split('@')[0] : undefined),
      };
      try {
        const [{ data: wallet }, { data: profile }] = await Promise.all([
          supabase.from('wallets').select('balance, currency').eq('user_id', user.id).maybeSingle(),
          supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        ]);
        if (!alive) return;
        if (wallet) { base.balance = Number((wallet as any).balance) || 0; base.currency = (wallet as any).currency || 'GNF'; }
        if (profile) base.role = (profile as any).role;
      } catch { /* dégradation propre */ }
      if (alive) setCtx(base);
    })();
    return () => { alive = false; };
  }, [user, service]);

  return ctx;
}
