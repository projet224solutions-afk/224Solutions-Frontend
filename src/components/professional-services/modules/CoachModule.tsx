/**
 * MODULE COACH SPORTIF
 * Gestion de programmes, clients et rendez-vous de coaching
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dumbbell,
  Users,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Plus,
  User,
  Activity,
  CheckCircle,
  Star,
  MapPin
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface CoachModuleProps {
  serviceId: string;
  businessName?: string;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number;
  goal: string;
  level: 'débutant' | 'intermédiaire' | 'avancé';
  program: string;
  sessionsCompleted: number;
  totalSessions: number;
  progress: number;
  nextSession?: string;
  joinedAt: string;
}

interface Program {
  id: string;
  name: string;
  description: string;
  duration: string;
  sessionsPerWeek: number;
  level: 'débutant' | 'intermédiaire' | 'avancé';
  price: number;
  clientsEnrolled: number;
  exercises: string[];
}

interface Session {
  id: string;
  clientId: string;
  clientName: string;
  programName: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  status: 'planifiée' | 'en_cours' | 'terminée' | 'annulée';
  notes?: string;
}

export function CoachModule({ serviceId, businessName }: CoachModuleProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('clients');
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showNewProgramDialog, setShowNewProgramDialog] = useState(false);

  // Données simulées
  const [clients] = useState<Client[]>([
    {
      id: '1',
      name: 'Mamadou Diallo',
      phone: '+224 620 00 00 00',
      email: 'mamadou@email.com',
      age: 28,
      goal: 'Prise de masse',
      level: 'intermédiaire',
      program: 'Musculation intensive',
      sessionsCompleted: 12,
      totalSessions: 24,
      progress: 50,
      nextSession: new Date().toISOString(),
      joinedAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Fatou Bah',
      phone: '+224 621 00 00 00',
      email: 'fatou@email.com',
      age: 32,
      goal: 'Perte de poids',
      level: 'débutant',
      program: 'Cardio & Fitness',
      sessionsCompleted: 8,
      totalSessions: 16,
      progress: 50,
      nextSession: new Date().toISOString(),
      joinedAt: '2024-02-01'
    },
    {
      id: '3',
      name: 'Ibrahim Camara',
      phone: '+224 622 00 00 00',
      email: 'ibrahim@email.com',
      age: 25,
      goal: 'Préparation compétition',
      level: 'avancé',
      program: 'Performance athlétique',
      sessionsCompleted: 20,
      totalSessions: 30,
      progress: 67,
      joinedAt: '2024-01-01'
    }
  ]);

  const [programs] = useState<Program[]>([
    {
      id: '1',
      name: 'Musculation intensive',
      description: 'Programme pour développer la masse musculaire',
      duration: '3 mois',
      sessionsPerWeek: 4,
      level: 'intermédiaire',
      price: 500000,
      clientsEnrolled: 5,
      exercises: ['Squats', 'Développé couché', 'Soulevé de terre', 'Rowing']
    },
    {
      id: '2',
      name: 'Cardio & Fitness',
      description: 'Programme de remise en forme et perte de poids',
      duration: '2 mois',
      sessionsPerWeek: 3,
      level: 'débutant',
      price: 400000,
      clientsEnrolled: 8,
      exercises: ['Course', 'HIIT', 'Corde à sauter', 'Burpees']
    },
    {
      id: '3',
      name: 'Performance athlétique',
      description: 'Préparation pour compétitions sportives',
      duration: '4 mois',
      sessionsPerWeek: 5,
      level: 'avancé',
      price: 800000,
      clientsEnrolled: 3,
      exercises: ['Sprints', 'Pliométrie', 'Force explosive', 'Endurance']
    }
  ]);

  const [sessions] = useState<Session[]>([
    {
      id: '1',
      clientId: '1',
      clientName: 'Mamadou Diallo',
      programName: 'Musculation intensive',
      date: new Date().toISOString().split('T')[0],
      time: '08:00',
      duration: 90,
      location: 'Salle de sport Kaloum',
      status: 'planifiée'
    },
    {
      id: '2',
      clientId: '2',
      clientName: 'Fatou Bah',
      programName: 'Cardio & Fitness',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 60,
      location: 'Parc Sandervalia',
      status: 'planifiée'
    },
    {
      id: '3',
      clientId: '3',
      clientName: 'Ibrahim Camara',
      programName: 'Performance athlétique',
      date: new Date().toISOString().split('T')[0],
      time: '17:00',
      duration: 120,
      location: 'Stade 28 Septembre',
      status: 'planifiée'
    }
  ]);

  const formatPrice = useFormatCurrency();

  const getLevelBadge = (level: 'débutant' | 'intermédiaire' | 'avancé') => {
    const styles = {
      débutant: 'bg-orange-100 text-[#ff4000]',
      intermédiaire: 'bg-orange-100 text-[#ff4000]',
      avancé: 'bg-orange-100 text-[#ff4000]'
    };
    return <Badge className={styles[level]}>{level}</Badge>;
  };

  const getSessionStatusBadge = (status: Session['status']) => {
    const styles = {
      planifiée: 'bg-blue-100 text-blue-800',
      en_cours: 'bg-orange-100 text-[#ff4000]',
      terminée: 'bg-orange-100 text-[#ff4000]',
      annulée: 'bg-orange-100 text-[#ff4000]'
    };
    const labels = {
      planifiée: 'Planifiée',
      en_cours: 'En cours',
      terminée: 'Terminée',
      annulée: 'Annulée'
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const handleAddClient = () => {
    toast.success(t('coachModule.clientAjouteAvecSucces'));
    setShowNewClientDialog(false);
  };

  const handleAddSession = () => {
    toast.success(t('coachModule.seancePlanifieeAvecSucces'));
    setShowNewSessionDialog(false);
  };

  const handleAddProgram = () => {
    toast.success(t('coachModule.programmeCreeAvecSucces'));
    setShowNewProgramDialog(false);
  };

  // Statistiques
  const totalClients = clients.length;
  const todaySessions = sessions.filter(s => s.date === new Date().toISOString().split('T')[0]).length;
  const activePrograms = programs.length;
  const avgProgress = Math.round(clients.reduce((acc, c) => acc + c.progress, 0) / clients.length);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{businessName || 'Coach Sportif'}</h2>
            <p className="text-muted-foreground">{t('coachModule.gestionDuCoaching')}</p>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Clients actifs</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#ff4000]" />
              <span className="text-sm text-muted-foreground">{t('coachModule.seancesAujourdHui')}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{todaySessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#04439e]" />
              <span className="text-sm text-muted-foreground">Programmes actifs</span>
            </div>
            <p className="text-2xl font-bold mt-1">{activePrograms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Progression moy.</span>
            </div>
            <p className="text-2xl font-bold mt-1">{avgProgress}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="seances">{t('coachModule.seances')}</TabsTrigger>
          <TabsTrigger value="programmes">Programmes</TabsTrigger>
        </TabsList>

        {/* Onglet Clients */}
        <TabsContent value="clients" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Mes clients</h3>
            <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('coachModule.ajouterUnClient')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Nom complet</Label>
                    <Input placeholder={t('coachModule.nomEtPrenom')} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('coachModule.telephone')}</Label>
                      <Input placeholder="+224 6XX XX XX XX" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('coachModule.age')}</Label>
                      <Input type="number" placeholder="25" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="email@exemple.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Objectif</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder={t('coachModule.selectionner')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prise_masse">{t('coachModule.priseDeMasse')}</SelectItem>
                          <SelectItem value="perte_poids">{t('coachModule.perteDePoids')}</SelectItem>
                          <SelectItem value="endurance">Endurance</SelectItem>
                          <SelectItem value="competition">{t('coachModule.preparationCompetition')}</SelectItem>
                          <SelectItem value="remise_forme">Remise en forme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Niveau</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder={t('coachModule.selectionner')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="débutant">{t('coachModule.debutant')}</SelectItem>
                          <SelectItem value="intermédiaire">{t('coachModule.intermediaire')}</SelectItem>
                          <SelectItem value="avancé">{t('coachModule.avance')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Programme</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder={t('coachModule.assignerUnProgramme')} />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewClientDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAddClient}>
                    Ajouter
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {clients.map((client) => (
              <Card key={client.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{client.name}</h4>
                          {getLevelBadge(client.level)}
                        </div>
                        <p className="text-sm text-muted-foreground">{client.goal}</p>
                        <p className="text-sm text-primary">{client.program}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{client.age} ans</p>
                      <p className="text-xs text-muted-foreground">{client.phone}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-medium">{client.sessionsCompleted}/{client.totalSessions} séances</span>
                    </div>
                    <Progress value={client.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Onglet Séances */}
        <TabsContent value="seances" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('coachModule.planningDesSeances')}</h3>
            <Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle séance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('coachModule.planifierUneSeance')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>{t('coachModule.client')}</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder={t('coachModule.selectionnerUnClient')} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label>Heure</Label>
                      <Input type="time" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('coachModule.dureeMinutes')}</Label>
                      <Input type="number" placeholder="60" />
                    </div>
                    <div className="space-y-2">
                      <Label>Lieu</Label>
                      <Input placeholder={t('coachModule.lieuDeLaSeance')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea placeholder={t('coachModule.notesPourLaSeance')} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewSessionDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAddSession}>
                    Planifier
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{session.clientName}</h4>
                          {getSessionStatusBadge(session.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{session.programName}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.duration} min
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{session.date}</p>
                      <p className="text-sm text-primary">{session.time}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Onglet Programmes */}
        <TabsContent value="programmes" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Mes programmes</h3>
            <Dialog open={showNewProgramDialog} onOpenChange={setShowNewProgramDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau programme
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('coachModule.creerUnProgramme')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>{t('coachModule.nomDuProgramme')}</Label>
                    <Input placeholder="Ex: Musculation intensive" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea placeholder={t('coachModule.decrivezLeProgramme')} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t('coachModule.duree')}</Label>
                      <Input placeholder="Ex: 3 mois" />
                    </div>
                    <div className="space-y-2">
                      <Label>Séances/semaine</Label>
                      <Input type="number" placeholder="4" />
                    </div>
                    <div className="space-y-2">
                      <Label>Niveau</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Niveau" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="débutant">{t('coachModule.debutant')}</SelectItem>
                          <SelectItem value="intermédiaire">{t('coachModule.intermediaire')}</SelectItem>
                          <SelectItem value="avancé">{t('coachModule.avance')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prix (GNF)</Label>
                    <Input type="number" placeholder="500000" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewProgramDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAddProgram}>
                    Créer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <Card key={program.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    {getLevelBadge(program.level)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{program.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('coachModule.duree')}</span>
                      <span className="font-medium">{program.duration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Séances/semaine</span>
                      <span className="font-medium">{program.sessionsPerWeek}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clients inscrits</span>
                      <span className="font-medium">{program.clientsEnrolled}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-lg font-bold text-primary">{formatPrice(program.price)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CoachModule;
