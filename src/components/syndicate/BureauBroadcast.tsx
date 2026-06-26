import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Loader2, Bell, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
  { label: 'Réunion',    title: 'Réunion obligatoire',    body: 'Une réunion est organisée. Présence obligatoire pour tous les membres.' },
  { label: 'Tarif',      title: 'Mise à jour des tarifs', body: 'Les nouveaux tarifs sont en vigueur. Consultez votre bureau.' },
  { label: 'Cotisation', title: 'Rappel cotisation',      body: 'Votre cotisation mensuelle est due. Passez au bureau régulariser.' },
  { label: 'Urgence',    title: 'Information urgente',     body: '' },
];

export default function BureauBroadcast({ bureauId }: { bureauId: string }) {
  const [title, setTitle]   = useState('');
  const [body, setBody]     = useState('');
  const [sending, setSending] = useState(false);
  const [mDate, setMDate]   = useState('');
  const [mPlace, setMPlace] = useState('');
  const [mAgenda, setMAgenda] = useState('');

  const send = async () => {
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('broadcast_bureau_message' as any,
        { p_bureau_id: bureauId, p_title: title.trim(), p_body: body.trim() });
      if (error) throw error;
      const res = data as any;
      if (res?.success) { toast.success(`Envoyé à ${res.drivers_notified} chauffeur(s)`); setTitle(''); setBody(''); }
      else toast.error(res?.error || 'Erreur envoi');
    } catch (err: any) { toast.error(err?.message || 'Impossible'); }
    finally { setSending(false); }
  };

  const sendMeeting = async () => {
    if (!mDate || !mPlace || sending) return;
    const dateStr = new Date(mDate).toLocaleString('fr-FR',
      { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const meetBody = ['Vous êtes convoqué(e) à une réunion du syndicat.',
      `Date : ${dateStr}`, `Lieu : ${mPlace}`,
      mAgenda ? `Ordre du jour : ${mAgenda}` : '', 'Présence obligatoire.']
      .filter(Boolean).join('\n');
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('broadcast_bureau_message' as any,
        { p_bureau_id: bureauId, p_title: 'Convocation à réunion', p_body: meetBody, p_type: 'meeting_convocation' });
      if (error) throw error;
      const res = data as any;
      if (res?.success) { toast.success(`Convocation envoyée à ${res.drivers_notified} chauffeur(s)`); setMDate(''); setMPlace(''); setMAgenda(''); }
      else toast.error(res?.error || 'Erreur');
    } catch (err: any) { toast.error(err?.message || 'Impossible'); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#04439e]" />
            Message à tous les chauffeurs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map(tpl => (
              <button key={tpl.label} onClick={() => { setTitle(tpl.title); setBody(tpl.body); }}
                className="text-[10px] px-2 py-1 rounded-full border bg-card hover:bg-muted transition-colors">
                {tpl.label}
              </button>
            ))}
          </div>
          <div><Label className="text-xs">Titre</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex : Réunion obligatoire" className="mt-1" /></div>
          <div><Label className="text-xs">Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Détails..." rows={3} className="mt-1" /></div>
          <Button onClick={send} disabled={sending || !title.trim() || !body.trim()} className="w-full bg-[#04439e] text-white">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Envoyer à tous les chauffeurs
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#ff4000]" />
            Convoquer une réunion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Date et heure</Label>
              <Input type="datetime-local" value={mDate} onChange={e => setMDate(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Lieu</Label>
              <Input value={mPlace} onChange={e => setMPlace(e.target.value)} placeholder="Siège du bureau" className="mt-1" /></div>
          </div>
          <div><Label className="text-xs">Ordre du jour (optionnel)</Label>
            <Textarea value={mAgenda} onChange={e => setMAgenda(e.target.value)} placeholder="Points à discuter..." rows={2} className="mt-1" /></div>
          <Button onClick={sendMeeting} disabled={sending || !mDate || !mPlace} className="w-full bg-[#ff4000] text-white">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Convoquer tous les chauffeurs
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
