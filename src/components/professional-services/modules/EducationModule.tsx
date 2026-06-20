/**
 * 🎓 MODULE ÉDUCATION / FORMATION — réel (Udemy / Coursera).
 * Cours + curriculum (leçons/PDF/vidéo) + sessions live + étudiants (progression &
 * certificat QR). Données live (Supabase + backend atomique). Wallet/Copilot/abonnement
 * sont fournis par le ServiceDashboard parent.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  GraduationCap, Users, BookOpen, Calendar, Plus, Award, Video, FileText,
  Trash2, Link2, PlayCircle, Loader2, Eye, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import {
  useCourses, useCourseContent, useCourseStudents, type Course,
} from '@/hooks/useEducation';

interface EducationModuleProps { serviceId: string; businessName?: string; }

const LEVELS = [{ v: 'debutant', l: 'Débutant' }, { v: 'intermediaire', l: 'Intermédiaire' }, { v: 'avance', l: 'Avancé' }];
const FORMATS = [{ v: 'en_ligne', l: '🖥️ En ligne' }, { v: 'presentiel', l: '🏫 Présentiel' }, { v: 'hybride', l: '🔄 Hybride' }];

export function EducationModule({ serviceId, businessName }: EducationModuleProps) {
  const { courses, loading, createCourse, setStatus, removeCourse } = useCourses(serviceId);
  const { enrollments, setProgress, issueCertificate, stats } = useCourseStudents(serviceId);
  const { uploadFile, isUploading } = useStorageUpload();

  const [showNew, setShowNew] = useState(false);
  const [manageCourse, setManageCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<any>({ level: 'debutant', format: 'en_ligne', certificate_enabled: true, price: 0, max_students: 0 });

  const activeCourses = courses.filter((c) => c.status === 'active').length;

  const submit = async () => {
    if (!form.title) { toast.error('Titre requis'); return; }
    const ok = await createCourse({
      title: form.title, category: form.category, level: form.level, format: form.format,
      description: form.description, cover_image: form.cover_image, instructor_name: form.instructor_name || businessName,
      duration_label: form.duration_label, price: Number(form.price) || 0, max_students: Number(form.max_students) || 0,
      certificate_enabled: !!form.certificate_enabled, status: 'draft',
    });
    if (ok) { setShowNew(false); setForm({ level: 'debutant', format: 'en_ligne', certificate_enabled: true, price: 0, max_students: 0 }); }
  };

  const onCover = async (file?: File) => {
    if (!file) return;
    const res = await uploadFile(file, { folder: 'documents' as any, subfolder: `courses/${serviceId}` });
    if (res.success && res.publicUrl) setForm((f: any) => ({ ...f, cover_image: res.publicUrl }));
    else toast.error(res.error || 'Upload échoué');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#04439e] rounded-xl"><GraduationCap className="w-8 h-8 text-white" /></div>
          <div>
            <h2 className="text-2xl font-bold">{businessName || 'Centre de Formation'}</h2>
            <p className="text-muted-foreground">Cours, sessions live & certificats</p>
          </div>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nouveau cours</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer un cours</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2"><Label>Titre</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Anglais des affaires B2" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Catégorie</Label><Input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Langues, Tech…" /></div>
                <div className="space-y-2"><Label>Niveau</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map((l) => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Format</Label>
                  <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FORMATS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Durée</Label><Input value={form.duration_label || ''} onChange={(e) => setForm({ ...form, duration_label: e.target.value })} placeholder="Ex: 3 mois" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Prix (GNF)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div className="space-y-2"><Label>Places max (0 = illimité)</Label><Input type="number" value={form.max_students} onChange={(e) => setForm({ ...form, max_students: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div className="space-y-2">
                <Label>Image de couverture</Label>
                <div className="flex items-center gap-3">
                  <Input type="file" accept="image/*" onChange={(e) => onCover(e.target.files?.[0])} disabled={isUploading} />
                  {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.cover_image && <img src={form.cover_image} alt="" className="h-10 w-10 rounded object-cover" />}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2"><Award className="h-4 w-4 text-[#ff4000]" /><Label>Certificat à la fin</Label></div>
                <Switch checked={!!form.certificate_enabled} onCheckedChange={(v) => setForm({ ...form, certificate_enabled: v })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
              <Button onClick={submit}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#04439e] text-white"><CardContent className="p-4"><BookOpen className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{activeCourses}</p><p className="text-xs opacity-80">Cours actifs</p></CardContent></Card>
        <Card className="bg-[#ff4000] text-white"><CardContent className="p-4"><Users className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.active}</p><p className="text-xs opacity-80">Élèves actifs</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-[#ff4000] to-[#04439e] text-white"><CardContent className="p-4"><Award className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{stats.completed}</p><p className="text-xs opacity-80">Diplômés</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-[#04439e] to-[#ff4000] text-white"><CardContent className="p-4"><p className="text-lg font-bold mt-1"><Money amount={stats.revenue} from="GNF" /></p><p className="text-xs opacity-80">Revenus</p></CardContent></Card>
      </div>

      <Tabs defaultValue="courses">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="courses"><BookOpen className="h-4 w-4 mr-1 hidden sm:inline" /> Cours</TabsTrigger>
          <TabsTrigger value="students"><Users className="h-4 w-4 mr-1 hidden sm:inline" /> Étudiants</TabsTrigger>
        </TabsList>

        {/* COURS */}
        <TabsContent value="courses" className="space-y-3">
          {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#ff4000]" /></div>}
          {!loading && courses.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Aucun cours. Créez votre premier cours.</p>}
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {course.cover_image
                    ? <img src={course.cover_image} alt="" className="h-16 w-16 rounded object-cover shrink-0" />
                    : <div className="h-16 w-16 rounded bg-muted flex items-center justify-center shrink-0"><BookOpen className="h-6 w-6 text-muted-foreground" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{course.title}</h4>
                      <Badge className={course.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>{course.status === 'active' ? 'Publié' : course.status === 'draft' ? 'Brouillon' : 'Archivé'}</Badge>
                      {course.certificate_enabled && <Badge variant="outline" className="gap-1 text-[10px]"><Award className="h-3 w-3" />Certifiant</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{course.category} · {LEVELS.find((l) => l.v === course.level)?.l} · {course.duration_label}</p>
                    <p className="font-bold text-[#ff4000] text-sm mt-1"><Money amount={course.price} from="GNF" /></p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setManageCourse(course)}><FileText className="h-4 w-4 mr-1" />Contenu</Button>
                    <div className="flex items-center gap-2">
                      <Switch checked={course.status === 'active'} onCheckedChange={(v) => setStatus(course.id, v ? 'active' : 'draft')} />
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm('Supprimer ce cours ?')) removeCourse(course.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ÉTUDIANTS */}
        <TabsContent value="students" className="space-y-3">
          {enrollments.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Aucune inscription pour le moment.</p>}
          {enrollments.map((e) => (
            <Card key={e.id}><CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="font-bold text-primary">{(e.student_name || '?')[0]}</span></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm">{e.student_name || 'Élève'}</h4>
                    <Badge className={e.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>{e.status === 'completed' ? '🎓 Diplômé' : 'Actif'}</Badge>
                    <span className="text-xs text-muted-foreground">{e.course_title}</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-0.5"><span>Progression</span><span className="font-bold">{e.progress_percent}%</span></div>
                    <Progress value={e.progress_percent} className="h-1.5" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {[25, 50, 75, 100].map((p) => <Button key={p} size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setProgress(e.id, p)}>{p}%</Button>)}
                    {e.certificate_code
                      ? <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/certificat/${e.certificate_code}`); toast.success('Lien certificat copié'); }}><Copy className="h-3 w-3 mr-1" />{e.certificate_code}</Button>
                      : <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => issueCertificate(e.id)}><Award className="h-3 w-3 mr-1" />Délivrer le certificat</Button>}
                  </div>
                </div>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>

      {manageCourse && <CourseContentDialog course={manageCourse} onClose={() => setManageCourse(null)} />}
    </div>
  );
}

/** Éditeur de curriculum (leçons) + sessions live d'un cours. */
function CourseContentDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const { lessons, sessions, addLesson, removeLesson, addSession, setSessionStatus } = useCourseContent(course.id);
  const { uploadFile, isUploading } = useStorageUpload();
  const [lesson, setLesson] = useState<any>({ content_type: 'video', is_preview: false });
  const [sess, setSess] = useState<any>({});

  const onLessonFile = async (file?: File) => {
    if (!file) return;
    const res = await uploadFile(file, { folder: 'documents' as any, subfolder: `courses/${course.id}` });
    if (res.success && res.publicUrl) setLesson((l: any) => ({ ...l, content_url: res.publicUrl }));
    else toast.error(res.error || 'Upload échoué');
  };

  const submitLesson = async () => {
    if (!lesson.title) { toast.error('Titre de la leçon requis'); return; }
    await addLesson({
      title: lesson.title, content_type: lesson.content_type, content_url: lesson.content_url,
      content_text: lesson.content_text, duration_minutes: Number(lesson.duration_minutes) || 0, is_preview: !!lesson.is_preview,
    });
    setLesson({ content_type: 'video', is_preview: false });
  };

  const submitSession = async () => {
    if (!sess.title || !sess.scheduled_at) { toast.error('Titre et date requis'); return; }
    await addSession({ title: sess.title, scheduled_at: new Date(sess.scheduled_at).toISOString(), meeting_url: sess.meeting_url });
    setSess({});
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Contenu — {course.title}</DialogTitle></DialogHeader>
        <Tabs defaultValue="lessons">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lessons"><BookOpen className="h-4 w-4 mr-1" />Curriculum ({lessons.length})</TabsTrigger>
            <TabsTrigger value="live"><Video className="h-4 w-4 mr-1" />Sessions live ({sessions.length})</TabsTrigger>
          </TabsList>

          {/* CURRICULUM */}
          <TabsContent value="lessons" className="space-y-3">
            {lessons.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <span className="text-muted-foreground">{l.position + 1}.</span>
                {l.content_type === 'video' ? <PlayCircle className="h-4 w-4 text-[#ff4000]" /> : l.content_type === 'pdf' ? <FileText className="h-4 w-4 text-[#04439e]" /> : <BookOpen className="h-4 w-4" />}
                <span className="flex-1 truncate">{l.title}</span>
                {l.is_preview && <Badge variant="outline" className="gap-1 text-[10px]"><Eye className="h-3 w-3" />Aperçu</Badge>}
                <span className="text-xs text-muted-foreground">{l.duration_minutes}min</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLesson(l.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            ))}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Titre de la leçon" value={lesson.title || ''} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} />
                <Select value={lesson.content_type} onValueChange={(v) => setLesson({ ...lesson, content_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vidéo</SelectItem><SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="text">Texte</SelectItem><SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {lesson.content_type === 'text'
                ? <Textarea placeholder="Contenu de la leçon" value={lesson.content_text || ''} onChange={(e) => setLesson({ ...lesson, content_text: e.target.value })} rows={3} />
                : <div className="flex items-center gap-2">
                    <Input type="file" onChange={(e) => onLessonFile(e.target.files?.[0])} disabled={isUploading} />
                    {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {lesson.content_url && <Link2 className="h-4 w-4 text-green-600" />}
                  </div>}
              <div className="flex items-center gap-3">
                <Input type="number" className="w-28" placeholder="Durée (min)" value={lesson.duration_minutes || ''} onChange={(e) => setLesson({ ...lesson, duration_minutes: e.target.value })} />
                <div className="flex items-center gap-2"><Switch checked={!!lesson.is_preview} onCheckedChange={(v) => setLesson({ ...lesson, is_preview: v })} /><Label className="text-xs">Aperçu gratuit</Label></div>
                <Button size="sm" className="ml-auto" onClick={submitLesson}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
              </div>
            </div>
          </TabsContent>

          {/* LIVE */}
          <TabsContent value="live" className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <Calendar className="h-4 w-4 text-[#04439e]" />
                <div className="flex-1 min-w-0"><div className="truncate font-medium">{s.title}</div><div className="text-xs text-muted-foreground">{new Date(s.scheduled_at).toLocaleString()}</div></div>
                <Select value={s.status} onValueChange={(v) => setSessionStatus(s.id, v as any)}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Planifiée</SelectItem><SelectItem value="live">En direct</SelectItem>
                    <SelectItem value="ended">Terminée</SelectItem><SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="space-y-2 rounded-lg border p-3">
              <Input placeholder="Titre de la session" value={sess.title || ''} onChange={(e) => setSess({ ...sess, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="datetime-local" value={sess.scheduled_at || ''} onChange={(e) => setSess({ ...sess, scheduled_at: e.target.value })} />
                <Input placeholder="Lien visio (Meet/Zoom)" value={sess.meeting_url || ''} onChange={(e) => setSess({ ...sess, meeting_url: e.target.value })} />
              </div>
              <Button size="sm" className="w-full" onClick={submitSession}><Plus className="h-4 w-4 mr-1" />Planifier la session</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default EducationModule;
