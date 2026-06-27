import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface PDGHealthCockpit {
  kyc_pending:    number;
  disputes_open:  number;
  bcrg_stale:     boolean;
  bcrg_hours:     number;
  escrow_pending: number;
  generated_at:   string;
}

export function usePDGHealthCockpit(pollMs = 60_000) {
  const [data, setData]       = useState<PDGHealthCockpit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: res, error } = await supabase.rpc('get_pdg_health_cockpit');
      if (error) throw error;
      if ((res as any)?.error) { setData(null); return; }
      setData(res as PDGHealthCockpit);
    } catch (e) {
      console.error('[cockpit] erreur:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs); // rafraîchissement périodique
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { data, loading, refresh: load };
}
