import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🛒 Page publique ACHAT GROUPÉ (Pinduoduo) — rejoindre, progression, compte à rebours 24h.
 * Lecture publique ; rejoindre via backend (RPC atomique : débit, et si minimum atteint → succès).
 * Temps réel : la progression et le statut se mettent à jour en direct.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { backendFetch } from '@/services/backendApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/Money';
import { Users, Clock, Check, X, Loader2, Share2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

export default function GroupBuyPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gb, setGb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [joined, setJoined] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from('group_buys').select('*').eq('id', id).maybeSingle();
    setGb(data); setLoading(false);
    if (data && user) {
      const { data: p } = await supabase.from('group_buy_participants').select('id').eq('group_buy_id', id).eq('user_id', user.id).maybeSingle();
      setJoined(!!p);
    }
  };

  useEffect(() => { void load();   }, [id, user?.id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`gb-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_buys', filter: `id=eq.${id}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_buy_participants', filter: `group_buy_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  const remaining = useMemo(() => gb ? Math.max(0, Math.floor((new Date(gb.expires_at).getTime() - now) / 1000)) : 0, [gb, now]);
  const hh = Math.floor(remaining / 3600), mm = Math.floor((remaining % 3600) / 60), ss = remaining % 60;

  const join = async () => {
    if (!user) { toast.error(t('groupBuyPage.connectezVousPourRejoindre')); navigate('/auth'); return; }
    setJoining(true);
    const res = await backendFetch<{ status: string; count: number }>(`/api/v2/group-buy/${id}/join`, { method: 'POST', body: { quantity: 1 } });
    setJoining(false);
    if (res.success) { toast.success((res as any).status === 'succeeded' ? 'Objectif atteint ! Commande confirmée 🎉' : 'Vous avez rejoint le groupe !'); setJoined(true); await load(); }
    else toast.error(res.error || 'Participation impossible');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!gb) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">{t('groupBuyPage.achatGroupeIntrouvable')}</div>;

  const pct = Math.min(100, Math.round((gb.participant_count / gb.min_participants) * 100));
  const need = Math.max(0, gb.min_participants - gb.participant_count);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="text-center"><span className="inline-flex items-center gap-1 rounded-full bg-[#ff4000] px-3 py-1 text-sm font-semibold text-white"><ShoppingBag className="h-4 w-4" />{t('groupBuyPage.achatGroupe')}</span></div>

      <Card><CardContent className="space-y-4 p-5 text-center">
        <h1 className="text-xl font-bold">{gb.product_name || 'Produit'}</h1>
        <div className="text-3xl font-bold text-[#ff4000]"><Money amount={gb.group_price} /></div>
        <div className="text-xs text-muted-foreground">Prix groupé · à {gb.min_participants} participants</div>

        {gb.status === 'succeeded' ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 p-3 text-green-700"><Check className="h-5 w-5" />{t('groupBuyPage.objectifAtteintCommandeConfirmeePour')}</div>
        ) : gb.status === 'failed' ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 p-3 text-slate-600"><X className="h-5 w-5" />{t('groupBuyPage.groupeExpireSansAtteindreLe')}</div>
        ) : (
          <>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm"><span className="flex items-center gap-1"><Users className="h-4 w-4" />{gb.participant_count}/{gb.min_participants}</span><span className="text-[#ff4000]">{need > 0 ? `Encore ${need} !` : 'Complet !'}</span></div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#ff4000]" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-[#ff4000]"><Clock className="h-4 w-4" />Se termine dans {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</div>
            {joined ? (
              <div className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{t('groupBuyPage.vousParticipezInvitezVosAmis')}</div>
            ) : (
              <Button className="w-full" disabled={joining || remaining === 0} onClick={join}>{joining ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Users className="h-4 w-4 mr-1" />}Rejoindre · <Money amount={gb.group_price} /></Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => { void navigator.clipboard?.writeText(window.location.href); toast.success(t('groupBuyPage.lienCopiePartagezLe')); }}><Share2 className="h-4 w-4 mr-1" />Partager</Button>
          </>
        )}
      </CardContent></Card>

      <p className="text-center text-[11px] text-muted-foreground">{t('groupBuyPage.siLeMinimumNEst')}</p>
    </div>
  );
}
