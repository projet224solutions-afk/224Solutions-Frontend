import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏗️ Réunions OPC — Comptes-rendus de chantier (BTP professionnel)
 * Participants, observations, décisions, actions à suivre, prochaine réunion.
 * Validation = verrouillage. Export PDF par réunion.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Trash2, Loader2, CalendarDays, MapPin, Users,
  FileDown, Lock, CheckCircle2, ListChecks
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useConstructionMeetings,
  type ConstructionMeeting,
  type MeetingAttendee,
  type MeetingDecision,
} from '@/hooks/useConstructionExtended';
import type { ConstructionProject } from '@/hooks/useConstruction';
import { exportMeetingPdf } from '@/lib/constructionPdf';

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const today = () => new Date().toISOString().split('T')[0];

interface Props {
  project: ConstructionProject;
}

export function ConstructionMeetings({ project }: Props) {
  const { t } = useTranslation();
  const { meetings, loading, createMeeting, updateMeeting, validateMeeting } = useConstructionMeetings(project.id);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [head, setHead] = useState({
    meeting_date: today(), location: '', weather: '',
    general_observations: '', next_meeting_date: '', next_meeting_location: '',
  });
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [actions, setActions] = useState<MeetingDecision[]>([]);

  const reset = () => {
    setHead({ meeting_date: today(), location: '', weather: '', general_observations: '', next_meeting_date: '', next_meeting_location: '' });
    setAttendees([]); setDecisions([]); setActions([]);
  };

  const submit = async () => {
    setSaving(true);
    const res = await createMeeting({
      meeting_date: head.meeting_date,
      location: head.location || null,
      weather: head.weather || null,
      general_observations: head.general_observations || null,
      attendees,
      decisions,
      action_items: actions,
      next_meeting_date: head.next_meeting_date || null,
      next_meeting_location: head.next_meeting_location || null,
    });
    setSaving(false);
    if (res) { reset(); setOpen(false); }
  };

  // Bascule l'état d'une action (fait/à faire) sur une réunion non verrouillée
  const toggleAction = async (m: ConstructionMeeting, idx: number) => {
    if (m.validated_at) return;
    const next = (m.action_items || []).map((a, i) =>
      i === idx ? { ...a, status: a.status === 'done' ? 'pending' as const : 'done' as const } : a
    );
    await updateMeeting(m.id, { action_items: next });
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{meetings.length} réunion(s)</h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-[#04439e] text-white hover:bg-[#04439e]/90">
          <Plus className="h-4 w-4 mr-1" />Nouvelle réunion
        </Button>
      </div>

      {meetings.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucune réunion. Créez le compte-rendu de votre première réunion de chantier.
        </p>
      )}

      {meetings.map((m) => {
        const present = (m.attendees || []).filter(a => a.present).length;
        const doneActions = (m.action_items || []).filter(a => a.status === 'done').length;
        return (
          <Card key={m.id} className="border border-slate-100">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">Réunion N°{m.meeting_number}</span>
                    {m.validated_at
                      ? <Badge className="bg-[#16a34a]/10 text-[#16a34a] border-0 text-[10px] gap-1"><Lock className="h-3 w-3" />{t('constructionMeetings.valide')}</Badge>
                      : <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Brouillon</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(m.meeting_date).toLocaleDateString('fr-FR')}</span>
                    {m.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{present}/{m.attendees?.length || 0} présents</span>
                    {(m.action_items?.length || 0) > 0 && (
                      <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{doneActions}/{m.action_items.length} actions</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportMeetingPdf(project, m)}>
                    <FileDown className="h-3.5 w-3.5 mr-1" />PDF
                  </Button>
                  {!m.validated_at && (
                    <Button size="sm" className="h-7 text-xs bg-[#16a34a] text-white hover:bg-[#16a34a]/90" onClick={() => validateMeeting(m.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Valider
                    </Button>
                  )}
                </div>
              </div>

              {m.general_observations && (
                <p className="text-sm text-slate-600">{m.general_observations}</p>
              )}

              {(m.decisions?.length || 0) > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">{t('constructionMeetings.decisions')}</p>
                  <ul className="space-y-0.5">
                    {m.decisions.map((d, i) => (
                      <li key={d.id || i} className="text-xs text-slate-700">• {d.text}{d.responsible && <span className="text-muted-foreground"> — {d.responsible}</span>}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(m.action_items?.length || 0) > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">{t('constructionMeetings.actionsASuivre')}</p>
                  <ul className="space-y-1">
                    {m.action_items.map((a, i) => (
                      <li key={a.id || i}>
                        <button
                          type="button"
                          disabled={!!m.validated_at}
                          onClick={() => toggleAction(m, i)}
                          className={`flex items-start gap-2 text-xs text-left ${m.validated_at ? 'cursor-default' : 'hover:text-[#04439e]'}`}
                        >
                          <span className={`mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded border ${a.status === 'done' ? 'bg-[#16a34a] border-[#16a34a] text-white' : 'border-slate-300'}`}>
                            {a.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                          </span>
                          <span className={a.status === 'done' ? 'line-through text-muted-foreground' : 'text-slate-700'}>
                            {a.text}{a.responsible && <span className="text-muted-foreground"> — {a.responsible}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog création */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('constructionMeetings.nouvelleReunionDeChantier')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* En-tête */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={head.meeting_date} onChange={(e) => setHead(h => ({ ...h, meeting_date: e.target.value }))} />
              </div>
              <div>
                <Label>Lieu</Label>
                <Input value={head.location} onChange={(e) => setHead(h => ({ ...h, location: e.target.value }))} placeholder={t('constructionMeetings.bureauDeChantier')} />
              </div>
            </div>
            <div>
              <Label>{t('constructionMeetings.meteo')}</Label>
              <Input value={head.weather} onChange={(e) => setHead(h => ({ ...h, weather: e.target.value }))} placeholder={t('constructionMeetings.exEnsoleille28C')} />
            </div>
            <div>
              <Label>{t('constructionMeetings.observationsGenerales')}</Label>
              <Textarea rows={2} value={head.general_observations} onChange={(e) => setHead(h => ({ ...h, general_observations: e.target.value }))} />
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Participants</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setAttendees(a => [...a, { name: '', role: '', company: '', present: true, excuse: false }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
                </Button>
              </div>
              {attendees.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input className="h-8 flex-1 min-w-[120px] text-xs" placeholder="Nom" value={a.name}
                    onChange={(e) => setAttendees(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Input className="h-8 w-28 text-xs" placeholder={t('constructionMeetings.role')} value={a.role}
                    onChange={(e) => setAttendees(arr => arr.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={a.present}
                      onChange={(e) => setAttendees(arr => arr.map((x, j) => j === i ? { ...x, present: e.target.checked, excuse: e.target.checked ? false : x.excuse } : x))} />
                    Présent
                  </label>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setAttendees(arr => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Décisions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('constructionMeetings.decisions')}</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setDecisions(d => [...d, { id: uid(), text: '', responsible: '', deadline: null, status: 'pending' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
                </Button>
              </div>
              {decisions.map((d, i) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2">
                  <Input className="h-8 flex-1 min-w-[140px] text-xs" placeholder={t('constructionMeetings.decisionPrise')} value={d.text}
                    onChange={(e) => setDecisions(arr => arr.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                  <Input className="h-8 w-28 text-xs" placeholder="Responsable" value={d.responsible}
                    onChange={(e) => setDecisions(arr => arr.map((x, j) => j === i ? { ...x, responsible: e.target.value } : x))} />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDecisions(arr => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions à suivre */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('constructionMeetings.actionsASuivre')}</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setActions(a => [...a, { id: uid(), text: '', responsible: '', deadline: null, status: 'pending' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
                </Button>
              </div>
              {actions.map((a, i) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2">
                  <Input className="h-8 flex-1 min-w-[140px] text-xs" placeholder={t('constructionMeetings.actionARealiser')} value={a.text}
                    onChange={(e) => setActions(arr => arr.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                  <Input className="h-8 w-28 text-xs" placeholder={t('constructionMeetings.assigneeA')} value={a.responsible}
                    onChange={(e) => setActions(arr => arr.map((x, j) => j === i ? { ...x, responsible: e.target.value } : x))} />
                  <Input className="h-8 w-36 text-xs" type="date" value={a.deadline || ''}
                    onChange={(e) => setActions(arr => arr.map((x, j) => j === i ? { ...x, deadline: e.target.value || null } : x))} />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setActions(arr => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Prochaine réunion */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('constructionMeetings.prochaineReunion')}</Label>
                <Input type="date" value={head.next_meeting_date} onChange={(e) => setHead(h => ({ ...h, next_meeting_date: e.target.value }))} />
              </div>
              <div>
                <Label>{t('constructionMeetings.lieuProchaineReunion')}</Label>
                <Input value={head.next_meeting_location} onChange={(e) => setHead(h => ({ ...h, next_meeting_location: e.target.value }))} />
              </div>
            </div>

            <Button onClick={submit} disabled={saving} className="w-full bg-[#04439e] text-white hover:bg-[#04439e]/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Créer le compte-rendu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConstructionMeetings;
