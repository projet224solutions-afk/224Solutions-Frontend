import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, AlertTriangle, Plus, ClipboardList, FileText, Sun, CloudRain, Cloud } from 'lucide-react';
import type { BTPProject, BTPTask, BTPDailyReport, BTPProfessional } from '@/hooks/useBTPData';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'planifie': { label: 'Planifié', color: 'bg-muted text-muted-foreground' },
  'en_cours': { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
  'en_pause': { label: 'En pause', color: 'bg-orange-100 text-[#ff4000]' },
  'termine': { label: 'Terminé', color: 'bg-orange-100 text-[#ff4000]' },
  'annule': { label: 'Annulé', color: 'bg-orange-100 text-[#ff4000]' },
};

const TASK_STATUS_MAP: Record<string, { label: string; icon: any }> = {
  'a_faire': { label: 'À faire', icon: Clock },
  'en_cours': { label: 'En cours', icon: AlertTriangle },
  'termine': { label: 'Terminé', icon: CheckCircle2 },
};

interface Props {
  project: BTPProject;
  professionals: BTPProfessional[];
  open: boolean;
  onClose: () => void;
  onUpdateProject: (id: string, data: any) => Promise<void>;
  onAddTask: (projectId: string, data: any) => Promise<boolean>;
  onFetchTasks: (projectId: string) => Promise<BTPTask[]>;
  onAddReport: (projectId: string, data: any) => Promise<boolean>;
  onFetchReports: (projectId: string) => Promise<BTPDailyReport[]>;
}

export function ProjectDetailDialog({ project, professionals, open, onClose, onUpdateProject, onAddTask, onFetchTasks, onAddReport, onFetchReports }: Props) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<BTPTask[]>([]);
  const [reports, setReports] = useState<BTPDailyReport[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddReport, setShowAddReport] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'normal', assigned_to: '' });
  const [reportForm, setReportForm] = useState({ summary: '', weather: '', workers_present: '', issues: '' });

  useEffect(() => {
    if (open) {
      onFetchTasks(project.id).then(setTasks);
      onFetchReports(project.id).then(setReports);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  const handleAddTask = async () => {
    if (!taskForm.title) return;
    const ok = await onAddTask(project.id, { ...taskForm, assigned_to: taskForm.assigned_to || null });
    if (ok) {
      setTaskForm({ title: '', description: '', priority: 'normal', assigned_to: '' });
      setShowAddTask(false);
      onFetchTasks(project.id).then(setTasks);
    }
  };

  const handleAddReport = async () => {
    if (!reportForm.summary) return;
    const ok = await onAddReport(project.id, {
      ...reportForm,
      workers_present: parseInt(reportForm.workers_present) || 0,
    });
    if (ok) {
      setReportForm({ summary: '', weather: '', workers_present: '', issues: '' });
      setShowAddReport(false);
      onFetchReports(project.id).then(setReports);
    }
  };

  const status = STATUS_MAP[project.status] || STATUS_MAP['planifie'];
  const completedTasks = tasks.filter(t => t.status === 'termine').length;
  const progressCalc = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : project.progress_percent;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl">{project.title}</DialogTitle>
            <Badge className={status.color}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project.city} {project.location && `• ${project.location}`}</p>
        </DialogHeader>

        {/* Progress overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progression globale</span>
            <span className="font-bold">{progressCalc}%</span>
          </div>
          <Progress value={progressCalc} className="h-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="font-bold"><Money amount={Number(project.budget_estimated)} from="GNF" /></p>
              <p className="text-muted-foreground text-xs">Budget</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="font-bold">{project.estimated_duration_days}j</p>
              <p className="text-muted-foreground text-xs">{t('projectDetailDialog.dureeEstimee')}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="font-bold">{tasks.length}</p>
              <p className="text-muted-foreground text-xs">{t('projectDetailDialog.taches')}</p>
            </div>
          </div>
        </div>

        {/* Status update */}
        <div className="flex gap-2 flex-wrap">
          {['planifie', 'en_cours', 'en_pause', 'termine'].map(s => (
            <Button key={s} size="sm" variant={project.status === s ? 'default' : 'outline'}
              onClick={() => onUpdateProject(project.id, { status: s, progress_percent: s === 'termine' ? 100 : project.progress_percent })}>
              {STATUS_MAP[s]?.label}
            </Button>
          ))}
        </div>

        <Tabs defaultValue="tasks">
          <TabsList className="w-full">
            <TabsTrigger value="tasks" className="flex-1"><ClipboardList className="h-4 w-4 mr-1" /> Tâches ({tasks.length})</TabsTrigger>
            <TabsTrigger value="reports" className="flex-1"><FileText className="h-4 w-4 mr-1" /> Rapports ({reports.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-3">
            <Button size="sm" onClick={() => setShowAddTask(!showAddTask)}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter une tâche
            </Button>

            {showAddTask && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <Input placeholder={t('projectDetailDialog.titreDeLaTache')} value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={taskForm.priority} onValueChange={v => setTaskForm(p => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="faible">Faible</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={taskForm.assigned_to} onValueChange={v => setTaskForm(p => ({ ...p, assigned_to: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('projectDetailDialog.assignerA')} /></SelectTrigger>
                      <SelectContent>
                        {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea placeholder="Description..." rows={2} value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAddTask(false)}>{t('projectDetailDialog.annuler')}</Button>
                    <Button size="sm" onClick={handleAddTask} disabled={!taskForm.title}>{t('projectDetailDialog.ajouter')}</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('projectDetailDialog.aucuneTacheAjoutezEnUne')}</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => {
                  const ts = TASK_STATUS_MAP[task.status] || TASK_STATUS_MAP['a_faire'];
                  const Icon = ts.icon;
                  const assigned = professionals.find(p => p.id === task.assigned_to);
                  return (
                    <div key={task.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Icon className={`h-5 w-5 shrink-0 ${task.status === 'termine' ? 'text-[#ff4000]' : task.status === 'en_cours' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.status === 'termine' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                        {assigned && <p className="text-xs text-muted-foreground">👷 {assigned.name}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-3">
            <Button size="sm" onClick={() => setShowAddReport(!showAddReport)}>
              <Plus className="h-4 w-4 mr-1" /> Rapport journalier
            </Button>

            {showAddReport && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={reportForm.weather} onValueChange={v => setReportForm(p => ({ ...p, weather: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('projectDetailDialog.meteo')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ensoleille">{t('projectDetailDialog.ensoleille')}</SelectItem>
                        <SelectItem value="nuageux">☁️ Nuageux</SelectItem>
                        <SelectItem value="pluie">🌧️ Pluie</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder={t('projectDetailDialog.ouvriersPresents')} value={reportForm.workers_present} onChange={e => setReportForm(p => ({ ...p, workers_present: e.target.value }))} />
                  </div>
                  <Textarea placeholder={t('projectDetailDialog.resumeDesTravauxDuJour')} rows={3} value={reportForm.summary} onChange={e => setReportForm(p => ({ ...p, summary: e.target.value }))} />
                  <Textarea placeholder={t('projectDetailDialog.problemesRencontresOptionnel')} rows={2} value={reportForm.issues} onChange={e => setReportForm(p => ({ ...p, issues: e.target.value }))} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAddReport(false)}>{t('projectDetailDialog.annuler')}</Button>
                    <Button size="sm" onClick={handleAddReport} disabled={!reportForm.summary}>{t('projectDetailDialog.enregistrer')}</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('projectDetailDialog.aucunRapportAjoutezLePremier')}</p>
            ) : (
              <div className="space-y-2">
                {reports.map(report => (
                  <Card key={report.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold">{new Date(report.report_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {report.weather === 'ensoleille' && <Sun className="h-4 w-4 text-[#ff4000]" />}
                          {report.weather === 'nuageux' && <Cloud className="h-4 w-4" />}
                          {report.weather === 'pluie' && <CloudRain className="h-4 w-4 text-blue-500" />}
                          <span>👷 {report.workers_present}</span>
                        </div>
                      </div>
                      <p className="text-sm">{report.summary}</p>
                      {report.issues && <p className="text-sm text-destructive mt-1">⚠️ {report.issues}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
