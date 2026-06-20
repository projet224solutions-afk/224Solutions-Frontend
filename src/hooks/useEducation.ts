/**
 * 🎓 Hooks ÉDUCATION — cours, curriculum, sessions live, inscriptions & certificats.
 * Écritures catalogue via RLS (le formateur gère son service) ; paiement/progression/
 * certificat via backend atomique. Inscriptions en temps réel (Realtime).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch, generateIdempotencyKey } from '@/services/backendApi';
import { toast } from 'sonner';

export interface Course {
  id: string; professional_service_id: string; title: string; category: string | null;
  level: 'debutant' | 'intermediaire' | 'avance'; format: 'presentiel' | 'en_ligne' | 'hybride';
  description: string | null; cover_image: string | null; instructor_name: string | null;
  duration_label: string | null; price: number; max_students: number; certificate_enabled: boolean;
  rating: number; status: 'draft' | 'active' | 'archived'; start_date: string | null; created_at: string;
}
export interface Lesson {
  id: string; course_id: string; title: string; position: number;
  content_type: 'video' | 'text' | 'pdf' | 'live'; content_url: string | null; content_text: string | null;
  duration_minutes: number; is_preview: boolean;
}
export interface LiveSession {
  id: string; course_id: string; title: string; scheduled_at: string; meeting_url: string | null;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
}
export interface Enrollment {
  id: string; course_id: string; student_user_id: string | null; student_name: string | null;
  student_phone: string | null; status: 'active' | 'completed' | 'cancelled'; progress_percent: number;
  amount_paid: number; certificate_code: string | null; certificate_issued_at: string | null; created_at: string;
}

/** Catalogue de cours du formateur. */
export function useCourses(serviceId?: string) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('courses').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setCourses((data as unknown as Course[]) ?? []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const createCourse = useCallback(async (payload: Partial<Course>) => {
    if (!serviceId) return null;
    const { data, error } = await supabase.from('courses').insert({ ...payload, professional_service_id: serviceId } as any).select().single();
    if (error) { toast.error(error.message); return null; }
    toast.success('Cours créé'); await load(); return data as Course;
  }, [serviceId, load]);

  const updateCourse = useCallback(async (id: string, patch: Partial<Course>) => {
    const { error } = await supabase.from('courses').update({ ...patch, updated_at: new Date().toISOString() } as any).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await load(); return true;
  }, [load]);

  const setStatus = useCallback(async (id: string, status: Course['status']) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    const { error } = await supabase.from('courses').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); await load(); }
  }, [load]);

  const removeCourse = useCallback(async (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('courses').delete().eq('id', id);
  }, []);

  return { courses, loading, reload: load, createCourse, updateCourse, setStatus, removeCourse };
}

/** Curriculum (leçons) + sessions live d'un cours — gérés par le formateur. */
export function useCourseContent(courseId?: string) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!courseId) { setLoading(false); return; }
    const [l, s] = await Promise.all([
      supabase.from('course_lessons').select('*').eq('course_id', courseId).order('position'),
      supabase.from('course_live_sessions').select('*').eq('course_id', courseId).order('scheduled_at'),
    ]);
    setLessons((l.data as unknown as Lesson[]) ?? []);
    setSessions((s.data as unknown as LiveSession[]) ?? []);
    setLoading(false);
  }, [courseId]);
  useEffect(() => { void load(); }, [load]);

  const addLesson = useCallback(async (payload: Partial<Lesson>) => {
    if (!courseId) return;
    const position = lessons.length;
    const { error } = await supabase.from('course_lessons').insert({ ...payload, course_id: courseId, position } as any);
    if (error) { toast.error(error.message); return; }
    await load();
  }, [courseId, lessons.length, load]);

  const removeLesson = useCallback(async (id: string) => {
    setLessons((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('course_lessons').delete().eq('id', id);
  }, []);

  const addSession = useCallback(async (payload: Partial<LiveSession>) => {
    if (!courseId) return;
    const { error } = await supabase.from('course_live_sessions').insert({ ...payload, course_id: courseId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Session planifiée'); await load();
  }, [courseId, load]);

  const setSessionStatus = useCallback(async (id: string, status: LiveSession['status']) => {
    setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    await supabase.from('course_live_sessions').update({ status }).eq('id', id);
  }, []);

  return { lessons, sessions, loading, reload: load, addLesson, removeLesson, addSession, setSessionStatus };
}

/** Inscriptions des cours du formateur (temps réel) + progression + certificat. */
export function useCourseStudents(serviceId?: string) {
  const [enrollments, setEnrollments] = useState<(Enrollment & { course_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data: courses } = await supabase.from('courses').select('id,title').eq('professional_service_id', serviceId);
    const ids = (courses ?? []).map((c: any) => c.id);
    if (ids.length === 0) { setEnrollments([]); setLoading(false); return; }
    const titles = new Map((courses ?? []).map((c: any) => [c.id, c.title]));
    const { data } = await supabase.from('course_enrollments').select('*').in('course_id', ids).order('created_at', { ascending: false });
    setEnrollments(((data as unknown as Enrollment[]) ?? []).map((e) => ({ ...e, course_title: titles.get(e.course_id) })));
    setLoading(false);
  }, [serviceId]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    const ch = supabase.channel(`edu-enroll-${serviceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_enrollments' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serviceId, load]);

  const setProgress = useCallback(async (enrollmentId: string, percent: number) => {
    const res = await backendFetch(`/api/v2/education/enrollment/${enrollmentId}/progress`, { method: 'POST', body: { percent } });
    if (!res.success) { toast.error(res.error || 'Erreur'); return false; }
    await load(); return true;
  }, [load]);

  const issueCertificate = useCallback(async (enrollmentId: string) => {
    const res = await backendFetch<{ code: string }>(`/api/v2/education/enrollment/${enrollmentId}/certificate`, { method: 'POST', body: {} });
    if (!res.success) { toast.error(res.error || 'Erreur'); return null; }
    toast.success('Certificat délivré'); await load(); return res.data?.code ?? null;
  }, [load]);

  const stats = useMemo(() => ({
    total: enrollments.length,
    active: enrollments.filter((e) => e.status === 'active').length,
    completed: enrollments.filter((e) => e.status === 'completed').length,
    revenue: enrollments.reduce((s, e) => s + (e.amount_paid || 0), 0),
  }), [enrollments]);

  return { enrollments, loading, reload: load, setProgress, issueCertificate, stats };
}

/** Inscription d'un élève à un cours (paiement atomique backend). */
export async function enrollInCourse(courseId: string, studentName?: string, studentPhone?: string) {
  return backendFetch<{ enrollment_id: string; already?: boolean }>('/api/v2/education/enroll', {
    method: 'POST',
    body: { course_id: courseId, student_name: studentName, student_phone: studentPhone },
    idempotencyKey: generateIdempotencyKey(),
  });
}
