/**
 * 🏗️ Hooks Construction/BTP — Extension professionnelle
 * Corps d'état (lots), Réserves (punch list), Réunions OPC, Intervenants.
 * Aucune modification des hooks existants dans useConstruction.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type TradeType =
  | 'gros_oeuvre' | 'terrassement' | 'charpente_couverture'
  | 'electricite' | 'plomberie_sanitaire' | 'menuiserie_bois'
  | 'menuiserie_alu' | 'carrelage_faience' | 'peinture_revetement'
  | 'vitrerie_miroiterie' | 'facade_enduit' | 'reseau_vrd'
  | 'climatisation' | 'ascenseur' | 'serrurerie' | 'autre';

export const TRADE_LABELS: Record<TradeType, string> = {
  gros_oeuvre: 'Gros Œuvre',
  terrassement: 'Terrassement / VRD',
  charpente_couverture: 'Charpente / Couverture',
  electricite: 'Électricité',
  plomberie_sanitaire: 'Plomberie / Sanitaire',
  menuiserie_bois: 'Menuiserie Bois',
  menuiserie_alu: 'Menuiserie Aluminium',
  carrelage_faience: 'Carrelage / Faïence',
  peinture_revetement: 'Peinture / Revêtement',
  vitrerie_miroiterie: 'Vitrerie / Miroiterie',
  facade_enduit: 'Façade / Enduit',
  reseau_vrd: 'Réseau / VRD',
  climatisation: 'Climatisation / VMC',
  ascenseur: 'Ascenseur',
  serrurerie: 'Serrurerie / Métallerie',
  autre: 'Autre',
};

export interface ConstructionLot {
  id: string;
  project_id: string;
  name: string;
  trade_type: TradeType;
  company_name: string | null;
  company_contact: string | null;
  company_phone: string | null;
  budget_amount: number;
  spent_amount: number;
  progress_percent: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ReservePriority = 'critical' | 'high' | 'medium' | 'low';
export type ReserveStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export const RESERVE_PRIORITY_LABELS: Record<ReservePriority, { label: string; color: string }> = {
  critical: { label: 'Critique', color: 'bg-red-600 text-white' },
  high: { label: 'Haute', color: 'bg-orange-500 text-white' },
  medium: { label: 'Normale', color: 'bg-[#04439e]/10 text-[#04439e]' },
  low: { label: 'Faible', color: 'bg-slate-100 text-slate-600' },
};

export const RESERVE_STATUS_LABELS: Record<ReserveStatus, { label: string; color: string }> = {
  open: { label: 'Ouverte', color: 'bg-red-100 text-red-700' },
  in_progress: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Levée', color: 'bg-[#16a34a]/10 text-[#16a34a]' },
  closed: { label: 'Clôturée', color: 'bg-slate-100 text-slate-500' },
};

export interface ConstructionReserve {
  id: string;
  project_id: string;
  lot_id: string | null;
  reserve_number: number;
  title: string;
  description: string | null;
  location_note: string | null;
  photo_urls: string[];
  priority: ReservePriority;
  status: ReserveStatus;
  assigned_to: string | null;
  due_date: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  resolution_photos: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  name: string;
  role: string;
  company: string;
  present: boolean;
  excuse: boolean;
}

export interface MeetingDecision {
  id: string;
  text: string;
  responsible: string;
  deadline: string | null;
  status: 'pending' | 'done';
}

export interface ConstructionMeeting {
  id: string;
  project_id: string;
  meeting_number: number;
  meeting_date: string;
  location: string | null;
  weather: string | null;
  attendees: MeetingAttendee[];
  general_observations: string | null;
  decisions: MeetingDecision[];
  action_items: MeetingDecision[];
  next_meeting_date: string | null;
  next_meeting_location: string | null;
  validated_at: string | null;
  created_at: string;
}

export type IntervenantRole =
  | 'maitre_ouvrage' | 'maitre_oeuvre' | 'architecte'
  | 'bet_structure' | 'bet_fluides' | 'bet_electricite'
  | 'coordinateur_sps' | 'bureau_controle'
  | 'entreprise_generale' | 'sous_traitant'
  | 'geometre' | 'notaire' | 'autre';

export const INTERVENANT_ROLE_LABELS: Record<IntervenantRole, string> = {
  maitre_ouvrage: 'Maître d\'Ouvrage',
  maitre_oeuvre: 'Maître d\'Œuvre',
  architecte: 'Architecte',
  bet_structure: 'BET Structure',
  bet_fluides: 'BET Fluides',
  bet_electricite: 'BET Électricité',
  coordinateur_sps: 'Coordinateur SPS',
  bureau_controle: 'Bureau de Contrôle',
  entreprise_generale: 'Entreprise Générale',
  sous_traitant: 'Sous-traitant',
  geometre: 'Géomètre',
  notaire: 'Notaire',
  autre: 'Autre',
};

export interface ConstructionIntervenant {
  id: string;
  project_id: string;
  name: string;
  role: IntervenantRole;
  company: string | null;
  phone: string | null;
  email: string | null;
  lot_id: string | null;
  notes: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════
// HOOK — LOTS (Corps d'état)
// ═══════════════════════════════════════════════════════════════

export function useConstructionLots(projectId?: string) {
  const [lots, setLots] = useState<ConstructionLot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from('construction_lots')
      .select('*')
      .eq('project_id', projectId)
      .order('trade_type');
    if (error) { console.error('[useLots]', error.message); }
    setLots((data as unknown as ConstructionLot[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const addLot = useCallback(async (payload: Partial<ConstructionLot>) => {
    if (!projectId) return null;
    const { data, error } = await (supabase as any)
      .from('construction_lots')
      .insert({
        project_id: projectId,
        name: payload.name!,
        trade_type: payload.trade_type || 'autre',
        company_name: payload.company_name,
        company_phone: payload.company_phone,
        budget_amount: payload.budget_amount || 0,
        spent_amount: payload.spent_amount || 0,
        status: payload.status || 'not_started',
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    toast.success('Lot ajouté');
    await load();
    return data as ConstructionLot;
  }, [projectId, load]);

  const updateLot = useCallback(async (id: string, patch: Partial<ConstructionLot>) => {
    const { error } = await (supabase as any)
      .from('construction_lots')
      .update({ ...patch, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('project_id', projectId!);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  }, [projectId, load]);

  const deleteLot = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from('construction_lots')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId!);
    if (error) { toast.error(error.message); return false; }
    toast.success('Lot supprimé');
    await load();
    return true;
  }, [projectId, load]);

  // Statistiques globales des lots
  const lotStats = {
    totalBudget: lots.reduce((s, l) => s + l.budget_amount, 0),
    totalSpent: lots.reduce((s, l) => s + l.spent_amount, 0),
    completedLots: lots.filter(l => l.status === 'completed').length,
    inProgressLots: lots.filter(l => l.status === 'in_progress').length,
    avgProgress: lots.length
      ? Math.round(lots.reduce((s, l) => s + l.progress_percent, 0) / lots.length)
      : 0,
  };

  return { lots, loading, reload: load, addLot, updateLot, deleteLot, lotStats };
}

// ═══════════════════════════════════════════════════════════════
// HOOK — RÉSERVES (Punch list)
// ═══════════════════════════════════════════════════════════════

export function useConstructionReserves(projectId?: string) {
  const [reserves, setReserves] = useState<ConstructionReserve[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from('construction_reserves')
      .select('*')
      .eq('project_id', projectId)
      .order('reserve_number');
    if (error) { console.error('[useReserves]', error.message); }
    setReserves((data as unknown as ConstructionReserve[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
    if (!projectId) return;
    // Temps réel sur les réserves (le client les voit aussi)
    const ch = supabase.channel(`reserves-${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'construction_reserves',
        filter: `project_id=eq.${projectId}`,
      }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [projectId, load]);

  const addReserve = useCallback(async (
    payload: Partial<ConstructionReserve>
  ) => {
    if (!projectId) return null;
    const { data: authData } = await (supabase as any).auth.getUser();
    const { data, error } = await (supabase as any)
      .from('construction_reserves')
      .insert({
        project_id: projectId,
        lot_id: payload.lot_id || null,
        title: payload.title!,
        description: payload.description,
        location_note: payload.location_note,
        photo_urls: payload.photo_urls || [],
        priority: payload.priority || 'medium',
        status: 'open',
        assigned_to: payload.assigned_to,
        due_date: payload.due_date,
        created_by: authData.user?.id,
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    toast.success(`Réserve #${(data as any).reserve_number} créée`);
    await load();
    return data as ConstructionReserve;
  }, [projectId, load]);

  const updateReserve = useCallback(async (
    id: string,
    patch: Partial<ConstructionReserve>
  ) => {
    const updatePayload: any = {
      ...patch,
      updated_at: new Date().toISOString(),
    };
    // Si on passe en résolu, enregistrer la date
    if (patch.status === 'resolved' && !patch.resolved_at) {
      updatePayload.resolved_at = new Date().toISOString();
    }
    const { error } = await (supabase as any)
      .from('construction_reserves')
      .update(updatePayload)
      .eq('id', id)
      .eq('project_id', projectId!);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  }, [projectId, load]);

  // Statistiques des réserves
  const reserveStats = {
    total: reserves.length,
    open: reserves.filter(r => r.status === 'open').length,
    inProgress: reserves.filter(r => r.status === 'in_progress').length,
    resolved: reserves.filter(r => r.status === 'resolved').length,
    closed: reserves.filter(r => r.status === 'closed').length,
    critical: reserves.filter(r => r.priority === 'critical' && r.status !== 'closed').length,
    openRate: reserves.length
      ? Math.round(((reserves.filter(r => ['open', 'in_progress'].includes(r.status)).length) / reserves.length) * 100)
      : 0,
  };

  return { reserves, loading, reload: load, addReserve, updateReserve, reserveStats };
}

// ═══════════════════════════════════════════════════════════════
// HOOK — RÉUNIONS OPC
// ═══════════════════════════════════════════════════════════════

export function useConstructionMeetings(projectId?: string) {
  const [meetings, setMeetings] = useState<ConstructionMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from('construction_meetings')
      .select('*')
      .eq('project_id', projectId)
      .order('meeting_date', { ascending: false });
    if (error) { console.error('[useMeetings]', error.message); }
    setMeetings((data as unknown as ConstructionMeeting[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const createMeeting = useCallback(async (
    payload: Partial<ConstructionMeeting>
  ) => {
    if (!projectId) return null;
    const { data: authData } = await (supabase as any).auth.getUser();
    const { data, error } = await (supabase as any)
      .from('construction_meetings')
      .insert({
        project_id: projectId,
        meeting_date: payload.meeting_date || new Date().toISOString().split('T')[0],
        location: payload.location,
        weather: payload.weather,
        attendees: payload.attendees || [],
        general_observations: payload.general_observations,
        decisions: payload.decisions || [],
        action_items: payload.action_items || [],
        next_meeting_date: payload.next_meeting_date,
        next_meeting_location: payload.next_meeting_location,
        created_by: authData.user?.id,
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    toast.success(`Réunion #${(data as any).meeting_number} créée`);
    await load();
    return data as ConstructionMeeting;
  }, [projectId, load]);

  const updateMeeting = useCallback(async (
    id: string,
    patch: Partial<ConstructionMeeting>
  ) => {
    const { error } = await (supabase as any)
      .from('construction_meetings')
      .update({ ...patch, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('project_id', projectId!);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  }, [projectId, load]);

  const validateMeeting = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from('construction_meetings')
      .update({ validated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('project_id', projectId!);
    if (error) { toast.error(error.message); return false; }
    toast.success('Compte-rendu validé et verrouillé');
    await load();
    return true;
  }, [projectId, load]);

  return { meetings, loading, reload: load, createMeeting, updateMeeting, validateMeeting };
}

// ═══════════════════════════════════════════════════════════════
// HOOK — INTERVENANTS
// ═══════════════════════════════════════════════════════════════

export function useConstructionIntervenants(projectId?: string) {
  const [intervenants, setIntervenants] = useState<ConstructionIntervenant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from('construction_intervenants')
      .select('*')
      .eq('project_id', projectId)
      .order('role');
    if (error) { console.error('[useIntervenants]', error.message); }
    setIntervenants((data as unknown as ConstructionIntervenant[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const addIntervenant = useCallback(async (
    payload: Partial<ConstructionIntervenant>
  ) => {
    if (!projectId) return null;
    const { data, error } = await (supabase as any)
      .from('construction_intervenants')
      .insert({
        project_id: projectId,
        name: payload.name!,
        role: payload.role!,
        company: payload.company,
        phone: payload.phone,
        email: payload.email,
        lot_id: payload.lot_id || null,
        notes: payload.notes,
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    toast.success('Intervenant ajouté');
    await load();
    return data as ConstructionIntervenant;
  }, [projectId, load]);

  const removeIntervenant = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from('construction_intervenants')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId!);
    if (error) { toast.error(error.message); return false; }
    toast.success('Intervenant retiré');
    await load();
    return true;
  }, [projectId, load]);

  return { intervenants, loading, reload: load, addIntervenant, removeIntervenant };
}
