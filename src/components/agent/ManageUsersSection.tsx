import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, UserCheck, UserX, Shield, Lock, Unlock, Trash2, Mail, Phone, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: string;
  created_at: string;
  is_active?: boolean;
  country?: string;
  city?: string;
  public_id?: string;
}

interface ManageUsersSectionProps {
  agentId: string;
}

export function ManageUsersSection({ agentId }: ManageUsersSectionProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Écouter les changements dans agent_created_users pour recharger en temps réel
  useEffect(() => {
    if (!agentId) return;

    // Charger les utilisateurs au montage
    loadUsers();

    const channel = supabase
      .channel('agent-users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_created_users',
          filter: `agent_id=eq.${agentId}`
        },
        (payload) => {
          console.log('Changement détecté dans agent_created_users:', payload);
          // Recharger les utilisateurs après un court délai pour laisser le profil se créer
          setTimeout(() => {
            loadUsers();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  useEffect(() => {
    filterUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, roleFilter, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Extraire le token de l'URL
      const currentPath = window.location.pathname;
      const tokenMatch = currentPath.match(/\/agent\/([^\/]+)/);
      const agentToken = tokenMatch ? tokenMatch[1] : null;

      if (!agentToken) {
        toast.error('Token agent introuvable');
        return;
      }

      // Backend Node (agent connecté → résolu par JWT)
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/agents/users/list', { method: 'POST', body: {} });

      if (!resp.success) throw new Error(resp.error || 'Erreur chargement');

      const users = resp.data?.users || [];
      setUsers(users);
      toast.success(`${users.length} utilisateurs chargés`);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast.error(t('manageUsersSection.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const getAgentToken = () => {
    const currentPath = window.location.pathname;
    const tokenMatch = currentPath.match(/\/agent\/([^\/]+)/);
    return tokenMatch ? tokenMatch[1] : null;
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch('/api/agents/users/toggle-status', { method: 'POST', body: { userId, currentStatus } });

      if (!resp.success) throw new Error(resp.error || 'Erreur');

      toast.success(currentStatus ? 'Utilisateur suspendu' : 'Utilisateur activé');
      loadUsers();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('manageUsersSection.erreurLorsDeLaModification'));
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch('/api/agents/users/delete', { method: 'POST', body: { userId } });

      if (!resp.success) throw new Error(resp.error || 'Erreur');

      toast.success(`Utilisateur ${userEmail} supprimé avec succès`);
      loadUsers();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('manageUsersSection.erreurLorsDeLaSuppression'));
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
      vendeur: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      client: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
      livreur: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
      taxi: 'bg-[#04439e]/10 text-[#04439e] border-[#04439e]/20',
      transitaire: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      syndicat: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20'
    };
    return colors[role as keyof typeof colors] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.is_active !== false).length}</p>
                <p className="text-sm text-muted-foreground">Utilisateurs Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <UserX className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.is_active === false).length}</p>
                <p className="text-sm text-muted-foreground">Utilisateurs Suspendus</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Utilisateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>{t('manageUsersSection.gestionDesUtilisateurs')}</CardTitle>
          <CardDescription>{t('manageUsersSection.rechercheEtFiltrage')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('manageUsersSection.rechercherParEmailNom')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48 bg-background">
                <SelectValue placeholder={t('manageUsersSection.filtrerParRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('manageUsersSection.tousLesRoles')}</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="vendeur">{t('manageUsersSection.vendeur')}</SelectItem>
                <SelectItem value="client">{t('manageUsersSection.client')}</SelectItem>
                <SelectItem value="livreur">Livreur</SelectItem>
                <SelectItem value="taxi">Taxi</SelectItem>
                <SelectItem value="transitaire">Transitaire</SelectItem>
                <SelectItem value="syndicat">Syndicat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="grid gap-4">
        {filteredUsers.map((user, index) => (
          <Card
            key={user.id}
            className="border-border bg-card hover:shadow-xl transition-all duration-200 animate-fade-in"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                        <Shield className="w-8 h-8 text-primary-foreground" />
                      </div>
                      {user.is_active !== false && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#ff4000] rounded-full border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">
                        {user.first_name || user.last_name
                          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                          : 'Sans nom'}
                      </h3>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className={getRoleBadge(user.role)}>
                          {user.role || 'client'}
                        </Badge>
                        <Badge variant="outline" className={user.is_active !== false ? 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000]' : 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000]'}>
                          {user.is_active !== false ? 'Actif' : 'Suspendu'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleUserStatus(user.id, user.is_active !== false)}
                      className={user.is_active !== false ? 'border-[#ff4000]/50 hover:bg-[#ff4000]/10 hover:text-[#ff4000]' : 'border-[#ff4000]/50 hover:bg-[#ff4000]/10 hover:text-[#ff4000]'}
                    >
                      {user.is_active !== false ? (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Suspendre
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4 mr-2" />
                          Activer
                        </>
                      )}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#ff4000]/50 hover:bg-[#ff4000]/10 hover:text-[#ff4000]"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('manageUsersSection.confirmerLaSuppression')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{user.email}</strong> ?
                            Cette action est irréversible et supprimera toutes les données associées.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('manageUsersSection.annuler')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteUser(user.id, user.email)}
                            className="bg-[#ff4000] hover:bg-[#ff4000]"
                          >
                            Supprimer définitivement
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Informations détaillées */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                    </div>

                    {user.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t('manageUsersSection.telephone')}</p>
                          <p className="font-medium">{user.phone}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t('manageUsersSection.creeLe')}</p>
                        <p className="font-medium">
                          {new Date(user.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {user.country && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 text-muted-foreground">🌍</div>
                      <div>
                        <p className="text-xs text-muted-foreground">Localisation</p>
                        <p className="font-medium">
                          {user.city ? `${user.city}, ${user.country}` : user.country}
                        </p>
                      </div>
                    </div>
                  )}

                  {user.public_id && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">ID Public</p>
                        <p className="font-medium font-mono">{user.public_id}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">{t('manageUsersSection.aucunUtilisateurTrouve')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
