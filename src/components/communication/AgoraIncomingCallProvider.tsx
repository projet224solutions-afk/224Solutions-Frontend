/**
 * 📞 AgoraIncomingCallProvider — couche GLOBALE d'appels ENTRANTS (récepteur).
 * Le maillon manquant : écoute realtime des appels entrants → écran Accepter/Refuser
 * → à l'acceptation, le récepteur REJOINT le MÊME canal Agora que l'appelant (via le
 * même agora_channel) → les deux se voient/s'entendent enfin.
 *
 * Monté au niveau GLOBAL (App.tsx, dans le contexte Auth) : un appel entrant
 * s'affiche PARTOUT, pas seulement dans l'écran de messagerie.
 *
 * Signalisation = table `calls` + realtime. Média = Agora (agoraService inchangé).
 * WebRTC natif reste séparé (bascule future via CallTransport).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { universalCommunicationService } from '@/services/UniversalCommunicationService';
import { useIncomingCalls, IncomingCall } from '@/hooks/useIncomingCalls';
import IncomingCallDialog from './IncomingCallDialog';

const AgoraVideoCall = React.lazy(() => import('./AgoraVideoCall'));
const AgoraAudioCall = React.lazy(() => import('./AgoraAudioCall'));

const TERMINAL = ['ended', 'rejected', 'missed'];

export default function AgoraIncomingCallProvider() {
  const { user } = useAuth();
  const { incomingCall, clearIncomingCall } = useIncomingCalls(user?.id);

  const [activeCall, setActiveCall] = useState<IncomingCall | null>(null);
  const [callerInfo, setCallerInfo] = useState<{ name: string; avatar?: string } | undefined>();
  const acceptedAtRef = useRef<number>(0);

  const closeCall = useCallback(() => {
    setActiveCall(null);
    setCallerInfo(undefined);
    acceptedAtRef.current = 0;
  }, []);

  // ACCEPTER : statut 'accepted' (garde token Agora) puis ouverture de l'appel Agora
  // avec le MÊME channel que l'appelant.
  const onAccept = useCallback(async (call: IncomingCall) => {
    try {
      await universalCommunicationService.acceptCall(call.id);
    } catch (e) {
      console.error('[IncomingCall] acceptCall échec:', e);
    }
    // Résoudre le profil appelant pour l'overlay « en attente ».
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, avatar_url')
        .eq('id', call.caller_id)
        .maybeSingle();
      if (data) {
        setCallerInfo({
          name:
            (data as any).full_name ||
            [(data as any).first_name, (data as any).last_name].filter(Boolean).join(' ') ||
            'Correspondant',
          avatar: (data as any).avatar_url || undefined,
        });
      }
    } catch {
      /* overlay sans info, non bloquant */
    }
    acceptedAtRef.current = Date.now();
    setActiveCall(call);
    clearIncomingCall();
  }, [clearIncomingCall]);

  const onReject = useCallback(async (call: IncomingCall, reason: 'rejected' | 'missed' = 'rejected') => {
    try {
      await universalCommunicationService.rejectCall(call.id, reason);
    } catch (e) {
      console.error('[IncomingCall] rejectCall échec:', e);
    }
    clearIncomingCall();
  }, [clearIncomingCall]);

  // Raccrochage du récepteur → statut 'ended' + fermeture (Agora libéré au démontage).
  const onCallEnd = useCallback(async () => {
    if (activeCall) {
      try {
        const started = acceptedAtRef.current || Date.now();
        const duration = Math.max(0, Math.floor((Date.now() - started) / 1000));
        await universalCommunicationService.endCall(activeCall.id, duration);
      } catch (e) {
        console.error('[IncomingCall] endCall échec:', e);
      }
    }
    closeCall();
  }, [activeCall, closeCall]);

  // Fin d'appel SYNCHRONISÉE : si l'appelant termine/refuse → fermer ici aussi.
  useEffect(() => {
    if (!activeCall?.id) return;
    const ch = supabase
      .channel(`call-status-recv:${activeCall.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${activeCall.id}` },
        (payload) => {
          const s = (payload.new as any).status;
          if (TERMINAL.includes(s)) closeCall();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeCall?.id, closeCall]);

  if (!user?.id) return null;

  const channelName = activeCall ? activeCall.agora_channel || `call_${activeCall.id}` : '';

  return (
    <>
      {/* Écran « appel entrant » (tant qu'on n'a pas accepté) */}
      {incomingCall && !activeCall && (
        <IncomingCallDialog incomingCall={incomingCall} onAccept={onAccept} onReject={onReject} />
      )}

      {/* Appel accepté → le récepteur rejoint le MÊME canal Agora que l'appelant */}
      {activeCall && (
        <Dialog open onOpenChange={() => onCallEnd()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <React.Suspense fallback={<div className="p-8 text-center">Connexion…</div>}>
              {activeCall.call_type === 'video' ? (
                <AgoraVideoCall
                  channel={channelName}
                  isIncoming={false}
                  callerInfo={callerInfo}
                  onCallEnd={onCallEnd}
                />
              ) : (
                <AgoraAudioCall
                  channel={channelName}
                  isIncoming={false}
                  callerInfo={callerInfo}
                  onCallEnd={onCallEnd}
                />
              )}
            </React.Suspense>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
