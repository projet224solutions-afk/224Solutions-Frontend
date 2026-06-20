import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🎓 Page COURS publique (/cours/:courseId) — vitrine + inscription payante.
 * Affiche la couverture, le curriculum (aperçus gratuits), les sessions live et permet
 * de s'inscrire (paiement atomique backend). Après inscription, accès confirmé.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { enrollInCourse, type Course, type Lesson } from '@/hooks/useEducation';
import { ArrowLeft, BookOpen, PlayCircle, FileText, Award, Eye, Lock, Loader2, CheckCircle2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

export default function CoursePage() {
  const { t } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [institution, setInstitution] = useState<string>('');
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!courseId) return;
      const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle();
      setCourse(c as unknown as Course);
      if (c) {
        const { data: ps } = await supabase.from('professional_services').select('business_name').eq('id', (c as any).professional_service_id).maybeSingle();
        setInstitution((ps as any)?.business_name || '');
      }
      const { data: l } = await supabase.from('course_lessons').select('*').eq('course_id', courseId).order('position');
      setLessons((l as unknown as Lesson[]) ?? []);
      if (user) {
        const { data: e } = await supabase.from('course_enrollments').select('id').eq('course_id', courseId).eq('student_user_id', user.id).neq('status', 'cancelled').maybeSingle();
        setEnrolled(!!e);
      }
      setLoading(false);
    })();
  }, [courseId, user]);

  const enroll = async () => {
    if (!user) { toast.error(t('coursePage.connectezVousPourVousInscrire')); navigate('/auth'); return; }
    if (!courseId) return;
    setBusy(true);
    const res = await enrollInCourse(courseId, user.user_metadata?.full_name, user.phone);
    setBusy(false);
    if (res.success) { toast.success(t('coursePage.inscriptionConfirmee')); setEnrolled(true); }
    else toast.error(res.error || 'Erreur lors de l\'inscription');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!course) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Cours introuvable.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('coursePage.retour')}</Button>

      {course.cover_image
        ? <img src={course.cover_image} alt="" className="h-44 w-full rounded-xl object-cover" />
        : <div className="h-44 w-full rounded-xl bg-gradient-to-br from-[#04439e] to-[#ff4000] flex items-center justify-center"><GraduationCap className="h-16 w-16 text-white/80" /></div>}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{course.title}</h1>
          {course.certificate_enabled && <Badge variant="outline" className="gap-1"><Award className="h-3 w-3" />Certifiant</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{institution} · {course.category} · {course.duration_label}</p>
      </div>

      {course.description && <p className="text-sm">{course.description}</p>}

      {/* Curriculum */}
      <Card><CardContent className="p-4 space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" />Programme ({lessons.length} leçons)</h2>
        {lessons.length === 0 && <p className="text-sm text-muted-foreground">{t('coursePage.programmeEnPreparation')}</p>}
        {lessons.map((l) => {
          const accessible = l.is_preview || enrolled;
          return (
            <div key={l.id} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
              {l.content_type === 'video' ? <PlayCircle className="h-4 w-4 text-[#ff4000]" /> : l.content_type === 'pdf' ? <FileText className="h-4 w-4 text-[#04439e]" /> : <BookOpen className="h-4 w-4" />}
              <span className={`flex-1 truncate ${!accessible ? 'text-muted-foreground' : ''}`}>{l.title}</span>
              {l.is_preview && !enrolled && <Badge variant="outline" className="gap-1 text-[10px]"><Eye className="h-3 w-3" />{t('coursePage.apercu')}</Badge>}
              {accessible
                ? (l.content_url ? <a href={l.content_url} target="_blank" rel="noreferrer" className="text-xs text-[#ff4000] underline">Ouvrir</a> : <span className="text-xs text-muted-foreground">{l.duration_minutes}min</span>)
                : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          );
        })}
      </CardContent></Card>

      {/* CTA inscription (barre fixe) */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div><div className="text-xs text-muted-foreground">Prix</div><div className="text-lg font-bold text-[#ff4000]">{course.price > 0 ? <Money amount={course.price} from="GNF" /> : 'Gratuit'}</div></div>
          {enrolled
            ? <Button className="ml-auto" disabled><CheckCircle2 className="h-4 w-4 mr-1" />Inscrit</Button>
            : <Button className="ml-auto" disabled={busy} onClick={enroll}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'S\'inscrire'}</Button>}
        </div>
      </div>
    </div>
  );
}
