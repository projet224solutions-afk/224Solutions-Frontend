import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🧵 FIL DE DISCUSSION D'UN LITIGE ESCROW (tripartite : client / vendeur / PDG)
 * Réutilisable par les 3 interfaces. Chaque partie poste en son nom (sender_type),
 * tout le monde voit le même fil rattaché au litige `escrow_disputes`.
 *
 * Dépend de la migration 20260613100000 (dispute_messages.escrow_dispute_id).
 * Dégrade proprement si la colonne n'est pas encore en place.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Send, ShieldCheck, Store, User as UserIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type DisputeParty = 'client' | 'vendor' | 'admin';

interface DisputeMessage {
  id: string;
  sender_id: string;
  sender_type: DisputeParty | 'ai';
  message: string;
  created_at: string;
}

interface EscrowDisputeThreadProps {
  escrowDisputeId: string;
  /** Rôle de l'utilisateur courant DANS ce litige (détermine sender_type à l'envoi). */
  currentParty: DisputeParty;
  /** Désactiver l'envoi (litige résolu). */
  readOnly?: boolean;
  className?: string;
}

const PARTY_META: Record<string, { label: string; Icon: any; color: string }> = {
  client: { label: "Client", Icon: UserIcon, color: 'text-blue-600' },
  vendor: { label: "Vendeur", Icon: Store, color: 'text-[#ff4000]' },
  admin: { label: 'PDG / Arbitrage', Icon: ShieldCheck, color: 'text-emerald-600' },
  ai: { label: 'Assistant', Icon: ShieldCheck, color: 'text-muted-foreground' },
};

export function EscrowDisputeThread({ escrowDisputeId, currentParty, readOnly = false, className }: EscrowDisputeThreadProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!escrowDisputeId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('dispute_messages')
      .select('id, sender_id, sender_type, message, created_at')
      .eq('escrow_dispute_id', escrowDisputeId)
      .order('created_at', { ascending: true });
    if (error) {
      // Colonne/migration absente → fil indisponible (dégrade proprement)
      if (/column .*escrow_dispute_id|does not exist|42703/i.test(error.message)) setUnavailable(true);
      setMessages([]);
    } else {
      setMessages((data as any) || []);
    }
    setLoading(false);
  }, [escrowDisputeId]);

  useEffect(() => { load(); }, [load]);

  // Temps réel : nouveaux messages du litige
  useEffect(() => {
    if (!escrowDisputeId || unavailable) return;
    const ch = supabase
      .channel(`dispute-thread-${escrowDisputeId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `escrow_dispute_id=eq.${escrowDisputeId}` },
        (payload) => setMessages((prev) => prev.some((m) => m.id === (payload.new as any).id) ? prev : [...prev, payload.new as any]),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [escrowDisputeId, unavailable]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user?.id) return;
    setSending(true);
    const { error } = await supabase.from('dispute_messages').insert({
      escrow_dispute_id: escrowDisputeId,
      sender_id: user.id,
      sender_type: currentParty,
      message: body,
    });
    setSending(false);
    if (error) {
      toast.error(t('escrowDisputeThread.impossibleDEnvoyerLeMessage'));
      return;
    }
    setText('');
    load();
  };

  if (unavailable) {
    return (
      <div className={cn('text-xs text-muted-foreground bg-muted/40 rounded-lg p-3', className)}>
        Le fil de discussion sera disponible une fois la mise à jour appliquée.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-card', className)}>
      <div className="px-3 py-2 border-b border-border text-sm font-semibold">{t('escrowDisputeThread.discussionDuLitige')}</div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-72 min-h-24">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">{t('escrowDisputeThread.aucunMessagePourLInstant')}</p>
        ) : (
          messages.map((m) => {
            const meta = PARTY_META[m.sender_type] || PARTY_META.client;
            const mine = m.sender_id === user?.id;
            const Icon = meta.Icon;
            return (
              <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <div className={cn('flex items-center gap-1 mb-0.5 text-[11px]', meta.color)}>
                  <Icon className="w-3 h-3" />
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-muted-foreground">· {new Date(m.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                  mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
                )}>
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {!readOnly && (
        <div className="p-2 border-t border-border flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={currentParty === 'vendor' ? 'Donnez votre version des faits…' : currentParty === 'admin' ? 'Message d\'arbitrage…' : 'Expliquez votre litige…'}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="icon" onClick={send} disabled={sending || !text.trim()} className="shrink-0 h-10 w-10">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

export default EscrowDisputeThread;
