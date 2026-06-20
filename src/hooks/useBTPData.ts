/**
 * Hook pour gérer les données du module Construction / BTP
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BTPProject {
  id: string;
  professional_service_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  project_type: string;
  location: string | null;
  city: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  budget_estimated: number;
  budget_spent: number;
  currency: string;
  start_date: string | null;
  estimated_duration_days: number;
  status: string;
  progress_percent: number;
  photos: string[];
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface BTPProfessional {
  id: string;
  professional_service_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  specialty: string;
  experience_years: number;
  description: string | null;
  photo_url: string | null;
  portfolio_urls: string[];
  rating: number;
  reviews_count: number;
  city: string | null;
  is_available: boolean;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface BTPTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  progress_percent: number;
  photos: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  professional?: BTPProfessional;
}

export interface BTPQuote {
  id: string;
  professional_service_id: string;
  project_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  project_type: string;
  description: string;
  location: string | null;
  budget_range: string | null;
  estimated_cost: number | null;
  estimated_duration: string | null;
  response_details: string | null;
  status: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BTPMaterial {
  id: string;
  professional_service_id: string;
  name: string;
  category: string;
  unit: string;
  unit_price: number;
  quantity_available: number;
  supplier_name: string | null;
  supplier_phone: string | null;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface BTPDailyReport {
  id: string;
  project_id: string;
  report_date: string;
  weather: string | null;
  workers_present: number;
  summary: string;
  issues: string | null;
  photos: string[];
  created_by: string | null;
  created_at: string;
}

export function useBTPData(serviceId: string) {
  const [projects, setProjects] = useState<BTPProject[]>([]);
  const [professionals, setProfessionals] = useState<BTPProfessional[]>([]);
  const [quotes, setQuotes] = useState<BTPQuote[]>([]);
  const [materials, setMaterials] = useState<BTPMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('btp_projects')
      .select('*')
      .eq('professional_service_id', serviceId)
      .order('created_at', { ascending: false });
    if (!error) setProjects((data || []) as unknown as BTPProject[]);
  }, [serviceId]);

  const fetchProfessionals = useCallback(async () => {
    const { data, error } = await supabase
      .from('btp_professionals')
      .select('*')
      .eq('professional_service_id', serviceId)
      .order('name');
    if (!error) setProfessionals((data || []) as unknown as BTPProfessional[]);
  }, [serviceId]);

  const fetchQuotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('btp_quotes')
      .select('*')
      .eq('professional_service_id', serviceId)
      .order('created_at', { ascending: false });
    if (!error) setQuotes((data || []) as unknown as BTPQuote[]);
  }, [serviceId]);

  const fetchMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from('btp_materials')
      .select('*')
      .eq('professional_service_id', serviceId)
      .order('name');
    if (!error) setMaterials((data || []) as unknown as BTPMaterial[]);
  }, [serviceId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProjects(), fetchProfessionals(), fetchQuotes(), fetchMaterials()]);
    setLoading(false);
  }, [fetchProjects, fetchProfessionals, fetchQuotes, fetchMaterials]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ===== PROJECTS =====
  const createProject = async (data: Partial<BTPProject>) => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Non authentifié');
      const { error } = await supabase.from('btp_projects').insert({
        professional_service_id: serviceId,
        owner_id: user.user.id,
        title: data.title!,
        description: data.description,
        project_type: data.project_type || 'maison',
        location: data.location,
        city: data.city,
        neighborhood: data.neighborhood,
        latitude: data.latitude,
        longitude: data.longitude,
        budget_estimated: data.budget_estimated || 0,
        start_date: data.start_date,
        estimated_duration_days: data.estimated_duration_days || 0,
        status: 'planifie',
      });
      if (error) throw error;
      toast.success('Projet créé !');
      await fetchProjects();
      return true;
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
      return false;
    } finally { setSaving(false); }
  };

  const updateProject = async (id: string, data: Partial<BTPProject>) => {
    const { error } = await supabase.from('btp_projects').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erreur mise à jour'); return; }
    toast.success('Projet mis à jour');
    await fetchProjects();
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('btp_projects').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression'); return; }
    toast.success('Projet supprimé');
    await fetchProjects();
  };

  // ===== PROFESSIONALS =====
  const addProfessional = async (data: Partial<BTPProfessional>) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('btp_professionals').insert({
        professional_service_id: serviceId,
        name: data.name!,
        phone: data.phone,
        email: data.email,
        specialty: data.specialty || 'macon',
        experience_years: data.experience_years || 0,
        description: data.description,
        city: data.city,
        hourly_rate: data.hourly_rate,
      });
      if (error) throw error;
      toast.success('Professionnel ajouté !');
      await fetchProfessionals();
      return true;
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
      return false;
    } finally { setSaving(false); }
  };

  // ===== QUOTES =====
  const createQuote = async (data: Partial<BTPQuote>) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('btp_quotes').insert({
        professional_service_id: serviceId,
        client_name: data.client_name!,
        client_phone: data.client_phone,
        client_email: data.client_email,
        project_type: data.project_type || 'maison',
        description: data.description!,
        location: data.location,
        budget_range: data.budget_range,
        status: 'en_attente',
      });
      if (error) throw error;
      toast.success('Demande de devis envoyée !');
      await fetchQuotes();
      return true;
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
      return false;
    } finally { setSaving(false); }
  };

  const respondToQuote = async (id: string, data: { estimated_cost: number; estimated_duration: string; response_details: string }) => {
    const { error } = await supabase.from('btp_quotes').update({
      ...data,
      status: 'repondu',
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error('Erreur réponse'); return; }
    toast.success('Devis envoyé au client');
    await fetchQuotes();
  };

  // ===== MATERIALS =====
  const addMaterial = async (data: Partial<BTPMaterial>) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('btp_materials').insert({
        professional_service_id: serviceId,
        name: data.name!,
        category: data.category || 'general',
        unit: data.unit || 'unité',
        unit_price: data.unit_price || 0,
        quantity_available: data.quantity_available || 0,
        supplier_name: data.supplier_name,
        supplier_phone: data.supplier_phone,
        description: data.description,
      });
      if (error) throw error;
      toast.success('Matériau ajouté !');
      await fetchMaterials();
      return true;
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
      return false;
    } finally { setSaving(false); }
  };

  // ===== TASKS =====
  const addTask = async (projectId: string, data: Partial<BTPTask>) => {
    const { error } = await supabase.from('btp_tasks').insert({
      project_id: projectId,
      title: data.title!,
      description: data.description,
      assigned_to: data.assigned_to,
      priority: data.priority || 'normal',
      start_date: data.start_date,
      due_date: data.due_date,
      status: 'a_faire',
    });
    if (error) { toast.error('Erreur ajout tâche'); return false; }
    toast.success('Tâche ajoutée');
    return true;
  };

  const fetchTasks = async (projectId: string) => {
    const { data, error } = await supabase
      .from('btp_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');
    if (error) return [];
    return (data || []) as unknown as BTPTask[];
  };

  // ===== DAILY REPORTS =====
  const addDailyReport = async (projectId: string, data: Partial<BTPDailyReport>) => {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('btp_daily_reports').insert({
      project_id: projectId,
      report_date: data.report_date || new Date().toISOString().split('T')[0],
      weather: data.weather,
      workers_present: data.workers_present || 0,
      summary: data.summary!,
      issues: data.issues,
      created_by: user.user?.id,
    });
    if (error) { toast.error('Erreur ajout rapport'); return false; }
    toast.success('Rapport ajouté');
    return true;
  };

  const fetchDailyReports = async (projectId: string) => {
    const { data, error } = await supabase
      .from('btp_daily_reports')
      .select('*')
      .eq('project_id', projectId)
      .order('report_date', { ascending: false });
    if (error) return [];
    return (data || []) as unknown as BTPDailyReport[];
  };

  // Stats
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'en_cours').length,
    completedProjects: projects.filter(p => p.status === 'termine').length,
    totalProfessionals: professionals.length,
    pendingQuotes: quotes.filter(q => q.status === 'en_attente').length,
    totalQuotes: quotes.length,
    totalMaterials: materials.length,
    totalBudget: projects.reduce((a, p) => a + (Number(p.budget_estimated) || 0), 0),
    totalSpent: projects.reduce((a, p) => a + (Number(p.budget_spent) || 0), 0),
  };

  return {
    projects, professionals, quotes, materials,
    stats, loading, saving,
    createProject, updateProject, deleteProject,
    addProfessional, createQuote, respondToQuote,
    addMaterial, addTask, fetchTasks,
    addDailyReport, fetchDailyReports,
    refresh: loadAll,
  };
}
