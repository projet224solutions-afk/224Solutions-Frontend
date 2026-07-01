/**
 * 📞 useIncomingCalls — LE maillon manquant de la chaîne d'appel.
 * S'abonne en realtime aux INSERT sur `calls` où receiver_id = moi et status
 * 'ringing' → le récepteur est enfin NOTIFIÉ d'un appel entrant.
 * Ferme aussi l'écran entrant si l'appel est annulé/terminé avant décrochage.
 *
 * Signalisation = table `calls` + Supabase realtime (réplication activée :
 * backend 20260629000005). Le MÉDIA reste géré par Agora.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IncomingCall {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'audio' | 'video';
  agora_channel?: string;
  metadata?: any;
  status: string;
}

const TERMINAL = ['ended', 'rejected', 'missed'];

function toIncoming(call: any): IncomingCall {
  return {
    id: call.id,
    caller_id: call.caller_id,
    receiver_id: call.receiver_id,
    call_type: (call.call_type as 'audio' | 'video') || 'audio',
    metadata: call.metadata,
    status: call.status,
    agora_channel: call.metadata?.agora_channel || `call_${call.id}`,
  };
}

export function useIncomingCalls(userId?: string) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    // Rattrapage : un appel peut déjà être en 'ringing' au moment où l'app s'ouvre
    // (l'INSERT realtime aurait été manqué). On le récupère une fois au montage.
    (async () => {
      try {
        const { data } = await supabase
          .from('calls')
          .select('*')
          .eq('receiver_id', userId)
          .eq('status', 'ringing')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) {
          setIncomingCall(toIncoming(data));
        }
      } catch {
        /* non bloquant */
      }
    })();

    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const call = payload.new as any;
          if (call.status === 'ringing') {
            setIncomingCall(toIncoming(call));
          }
        }
      )
      // Si l'appel est terminé/refusé/manqué avant décrochage → fermer l'écran entrant.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const call = payload.new as any;
          if (TERMINAL.includes(call.status)) {
            setIncomingCall((cur) => (cur?.id === call.id ? null : cur));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { incomingCall, clearIncomingCall: () => setIncomingCall(null) };
}
