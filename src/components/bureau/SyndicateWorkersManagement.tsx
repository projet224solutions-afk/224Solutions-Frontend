import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Shield,
  UserCheck,
  UserX,
  Trash2,
  Edit,
  Crown,
  Key,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useSyndicateWorkersData, SyndicateWorker } from '@/hooks/useSyndicateWorkersData';
import { SyndicateWorkerPermissionsDialog } from './SyndicateWorkerPermissionsDialog';

interface SyndicateWorkersManagementProps {
  bureauId: string;
  bureauName?: string;
}

export function SyndicateWorkersManagement({ bureauId, bureauName }: SyndicateWorkersManagementProps) {
  const { t } = useTranslation();
  const { workers, loading, stats, createWorker, updateWorker, deleteWorker, toggleWorkerStatus, refetch } = useSyndicateWorkersData(bureauId);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterLevel, setFilterLevel] = useState<'all' | 'president' | 'secretary' | 'member'>('all');

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<SyndicateWorker | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<SyndicateWorker | null>(null);

  const [newWorker, setNewWorker] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    access_level: 'member',
  });
  const [creating, setCreating] = useState(false);

  // Filter workers
  const filteredWorkers = workers.filter(worker => {
    const matchesSearch =
      worker.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.telephone?.includes(searchTerm) ||
      worker.custom_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && worker.is_active) ||
      (filterStatus === 'inactive' && !worker.is_active);

    const matchesLevel =
      filterLevel === 'all' ||
      worker.access_level === filterLevel;

    return matchesSearch && matchesStatus && matchesLevel;
  });

  const handleCreateWorker = async () => {
    if (!newWorker.nom) {
      return;
    }

    setCreating(true);
    await createWorker(newWorker);
    setCreating(false);
    setShowAddDialog(false);
    setNewWorker({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      access_level: 'member',
    });
  };

  const handleOpenPermissions = (worker: SyndicateWorker) => {
    setSelectedWorker(worker);
    setShowPermissionsDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (workerToDelete) {
      await deleteWorker(workerToDelete.id);
      setWorkerToDelete(null);
    }
  };

  const getAccessLevelBadge = (level: string) => {
    switch (level) {
      case 'president':
        return <Badge className="bg-[#ff4000] text-white"><Crown className="w-3 h-3 mr-1" />{t('syndicateWorkersManagement.president')}</Badge>;
      case 'secretary':
        return <Badge className="bg-blue-500 text-white">{t('syndicateWorkersManagement.secretaire')}</Badge>;
      default:
        return <Badge variant="secondary">Membre</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalWorkers}</p>
                <p className="text-xs text-muted-foreground">Total Membres</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeWorkers}</p>
                <p className="text-xs text-muted-foreground">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Crown className="w-5 h-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.presidentCount}</p>
                <p className="text-xs text-muted-foreground">{t('syndicateWorkersManagement.presidents')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-[#04439e]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.secretaryCount}</p>
                <p className="text-xs text-muted-foreground">{t('syndicateWorkersManagement.secretaires')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.memberCount}</p>
                <p className="text-xs text-muted-foreground">Membres simples</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gestion des Membres
            </CardTitle>
            {bureauName && (
              <p className="text-sm text-muted-foreground mt-1">{bureauName}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rafraîchir
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau Membre
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('syndicateWorkersManagement.ajouterUnMembre')}</DialogTitle>
                  <DialogDescription>
                    Créez un nouveau membre du bureau syndicat
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom">Nom *</Label>
                      <Input
                        id="nom"
                        value={newWorker.nom}
                        onChange={(e) => setNewWorker({ ...newWorker, nom: e.target.value })}
                        placeholder={t('syndicateWorkersManagement.nomDeFamille')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prenom">{t('syndicateWorkersManagement.prenom')}</Label>
                      <Input
                        id="prenom"
                        value={newWorker.prenom}
                        onChange={(e) => setNewWorker({ ...newWorker, prenom: e.target.value })}
                        placeholder={t('syndicateWorkersManagement.prenom')}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newWorker.email}
                      onChange={(e) => setNewWorker({ ...newWorker, email: e.target.value })}
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">{t('syndicateWorkersManagement.telephone')}</Label>
                    <Input
                      id="telephone"
                      value={newWorker.telephone}
                      onChange={(e) => setNewWorker({ ...newWorker, telephone: e.target.value })}
                      placeholder="+224 XXX XXX XXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="access_level">{t('syndicateWorkersManagement.niveauDAcces')}</Label>
                    <Select
                      value={newWorker.access_level}
                      onValueChange={(value) => setNewWorker({ ...newWorker, access_level: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="president">{t('syndicateWorkersManagement.president')}</SelectItem>
                        <SelectItem value="secretary">{t('syndicateWorkersManagement.secretaire')}</SelectItem>
                        <SelectItem value="member">Membre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCreateWorker}
                    disabled={!newWorker.nom || creating}
                    className="w-full"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Créer le Membre
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('syndicateWorkersManagement.rechercherParNomEmailTelephone')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={(v: 'all' | 'active' | 'inactive') => setFilterStatus(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('syndicateWorkersManagement.tous')}</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={(v: 'all' | 'president' | 'secretary' | 'member') => setFilterLevel(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('syndicateWorkersManagement.tousNiveaux')}</SelectItem>
                <SelectItem value="president">{t('syndicateWorkersManagement.presidents')}</SelectItem>
                <SelectItem value="secretary">{t('syndicateWorkersManagement.secretaires')}</SelectItem>
                <SelectItem value="member">Membres</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Workers List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>{t('syndicateWorkersManagement.aucunMembreTrouve')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md ${
                    worker.is_active ? 'bg-background' : 'bg-muted/50 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">
                        {worker.nom?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{worker.nom} {worker.prenom}</span>
                        {worker.custom_id && (
                          <Badge variant="outline" className="text-xs">
                            {worker.custom_id}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {worker.email && <span>{worker.email}</span>}
                        {worker.telephone && <span>• {worker.telephone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getAccessLevelBadge(worker.access_level)}
                    <Badge variant={worker.is_active ? 'default' : 'secondary'}>
                      {worker.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenPermissions(worker)}>
                          <Shield className="w-4 h-4 mr-2" />
                          Gérer les Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleWorkerStatus(worker.id, !worker.is_active)}>
                          {worker.is_active ? (
                            <>
                              <UserX className="w-4 h-4 mr-2" />
                              Désactiver
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 mr-2" />
                              Activer
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setWorkerToDelete(worker)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <SyndicateWorkerPermissionsDialog
        worker={selectedWorker}
        open={showPermissionsDialog}
        onOpenChange={setShowPermissionsDialog}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!workerToDelete} onOpenChange={() => setWorkerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('syndicateWorkersManagement.confirmerLaSuppression')}</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le membre "{workerToDelete?.nom} {workerToDelete?.prenom}" ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('syndicateWorkersManagement.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
