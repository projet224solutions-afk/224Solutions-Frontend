/**
 * 📲 IncomingCallDialog — écran « appel entrant » (Accepter / Refuser).
 * Monté au niveau GLOBAL (AgoraIncomingCallProvider) → s'affiche partout dans l'app.
 * Sonnerie + vibration tant qu'il est ouvert ; timeout ~30s → auto-refus ('missed').
 */
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { playNotificationSound } from '@/services/notificationSoundService';
import type { IncomingCall } from '@/hooks/useIncomingCalls';

interface CallerProfile {
  name: string;
  avatar?: string;
}

interface IncomingCallDialogProps {
  incomingCall: IncomingCall;
  onAccept: (call: IncomingCall) => void;
  onReject: (call: IncomingCall, reason?: 'rejected' | 'missed') => void;
}

const RING_TIMEOUT_MS = 30000;

export default function IncomingCallDialog({ incomingCall, onAccept, onReject }: IncomingCallDialogProps) {
  const [caller, setCaller] = useState<CallerProfile>({ name: 'Appel entrant' });
  const onRejectRef = useRef(onReject);
  onRejectRef.current = onReject;

  // Résoudre le profil de l'appelant (nom / avatar).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, first_name, last_name, avatar_url')
          .eq('id', incomingCall.caller_id)
          .maybeSingle();
        if (cancelled || !data) return;
        const name =
          (data as any).full_name ||
          [(data as any).first_name, (data as any).last_name].filter(Boolean).join(' ') ||
          'Appel entrant';
        setCaller({ name, avatar: (data as any).avatar_url || undefined });
      } catch {
        /* garde le nom par défaut */
      }
    })();
    return () => { cancelled = true; };
  }, [incomingCall.caller_id]);

  // Sonnerie + vibration tant que l'écran est ouvert ; timeout 30s → 'missed'.
  useEffect(() => {
    let ringing = true;
    const ring = () => {
      if (!ringing) return;
      try { playNotificationSound(); } catch { /* non bloquant */ }
      try { navigator.vibrate?.([400, 200, 400]); } catch { /* ignore */ }
    };
    ring();
    const interval = setInterval(ring, 2500);
    const timeout = setTimeout(() => {
      onRejectRef.current(incomingCall, 'missed');
    }, RING_TIMEOUT_MS);

    return () => {
      ringing = false;
      clearInterval(interval);
      clearTimeout(timeout);
      try { navigator.vibrate?.(0); } catch { /* ignore */ }
    };
  }, [incomingCall.id]);

  const isVideo = incomingCall.call_type === 'video';

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onReject(incomingCall, 'rejected'); }}>
      <DialogContent className="sm:max-w-sm text-center" onInteractOutside={(e) => e.preventDefault()}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <Avatar className="w-24 h-24">
              <AvatarImage src={caller.avatar} />
              <AvatarFallback className="text-2xl">{caller.name.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 rounded-full animate-ping border-2 border-[#ff4000] opacity-60" />
          </div>

          <div>
            <h3 className="text-xl font-semibold">{caller.name}</h3>
            <p className="text-muted-foreground flex items-center justify-center gap-2 mt-1">
              {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              {isVideo ? 'Appel vidéo entrant…' : 'Appel audio entrant…'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-8 mt-2">
            <Button
              onClick={() => onReject(incomingCall, 'rejected')}
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
              aria-label="Refuser"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              onClick={() => onAccept(incomingCall)}
              size="lg"
              className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700"
              aria-label="Accepter"
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
