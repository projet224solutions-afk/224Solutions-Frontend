/**
 * AGENT USERS MODULE
 * Module Gestion Utilisateurs - miroir de PDGUsers (simplifié)
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, UserCheck, UserX, Shield, Users,
  Store, RefreshCw, Eye, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AgentUsersModuleProps {
  agentId: string;
  canManage?: boolean;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean;
  status: string | null;
  public_id: string | null;
  created_at: string;
}

export function AgentUsersModule({ agentId, canManage = false }: AgentUsersModuleProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    loadUsers();
  }, [agentId]);

  useEffect(() => {
    filterUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, roleFilter, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Récupérer les utilisateurs créés par cet agent
      const { data: createdUsers, error: cuErr } = await supabase
        .from('agent_created_users')
        .select('user_id')
        .eq('agent_id', agentId);

      if (cuErr) throw cuErr;
      if (!createdUsers || createdUsers.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = createdUsers.map((u: any) => u.user_id);

      const [profilesRes, userIdsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, is_active, status, public_id, custom_id, created_at')
          .in('id', userIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_ids')
          .select('user_id, custom_id')
          .in('user_id', userIds),
      ]);

      const { data: profiles, error } = profilesRes;
      if (error) throw error;

      const canonicalByUserId = new Map(
        (userIdsRes.data || [])
          .filter((row: any) => row?.user_id && row?.custom_id)
          .map((row: any) => [row.user_id, String(row.custom_id).toUpperCase()])
      );

      const normalizedProfiles = (profiles || []).map((profile: any) => ({
        ...profile,
        public_id: canonicalByUserId.get(profile.id) || profile.public_id || profile.custom_id || null,
      }));

      setUsers(normalizedProfiles);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast.error(t('agentUsersModule.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.first_name?.toLowerCase().includes(term) ||
        u.last_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.public_id?.toLowerCase().includes(term)
      );
    }

    setFilteredUsers(filtered);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!canManage) {
      toast.error(t('agentUsersModule.permissionRefusee'));
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      toast.success(currentStatus ? 'Utilisateur désactivé' : 'Utilisateur activé');
      loadUsers();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(t('agentUsersModule.erreurLorsDeLaModification'));
    }
  };

  const getRoleBadge = (role: string | null) => {
    const roleColors: Record<string, string> = {
      'admin': 'bg-orange-100 text-[#ff4000] border-orange-200',
      'vendeur': 'bg-blue-100 text-blue-700 border-blue-200',
      'client': 'bg-orange-100 text-[#ff4000] border-orange-200',
      'livreur': 'bg-orange-100 text-orange-700 border-orange-200',
      'agent': 'bg-blue-100 text-[#04439e] border-blue-200',
    };
    return (
      <Badge variant="outline" className={roleColors[role || ''] || 'bg-gray-100'}>
        {role || 'N/A'}
      </Badge>
    );
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    vendors: users.filter(u => u.role === 'vendeur').length,
    clients: users.filter(u => u.role === 'client').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-[#04439e]/5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#04439e] shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">{t('agentUsersModule.gestionDesUtilisateurs')}</CardTitle>
                <CardDescription>{t('agentUsersModule.listeCompleteDesUtilisateursDe')}</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadUsers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-100 rounded-xl p-4 text-center">
              <Users className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="bg-orange-100 rounded-xl p-4 text-center">
              <UserCheck className="w-6 h-6 text-[#ff4000] mx-auto mb-2" />
              <p className="text-2xl font-bold text-[#ff4000]">{stats.active}</p>
              <p className="text-xs text-[#ff4000]">Actifs</p>
            </div>
            <div className="bg-blue-100 rounded-xl p-4 text-center">
              <Store className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700">{stats.vendors}</p>
              <p className="text-xs text-blue-500">Vendeurs</p>
            </div>
            <div className="bg-blue-100 rounded-xl p-4 text-center">
              <Users className="w-6 h-6 text-[#04439e] mx-auto mb-2" />
              <p className="text-2xl font-bold text-[#04439e]">{stats.clients}</p>
              <p className="text-xs text-[#04439e]">Clients</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('agentUsersModule.rechercherParNomEmailId')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('agentUsersModule.role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentUsersModule.tousLesRoles')}</SelectItem>
                <SelectItem value="client">{t('agentUsersModule.client')}</SelectItem>
                <SelectItem value="vendeur">{t('agentUsersModule.vendeur')}</SelectItem>
                <SelectItem value="livreur">Livreur</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('agentUsersModule.aucunUtilisateurTrouve')}</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.is_active ? 'bg-orange-100' : 'bg-orange-100'
                      }`}>
                        {user.is_active ? (
                          <UserCheck className="w-5 h-5 text-[#ff4000]" />
                        ) : (
                          <UserX className="w-5 h-5 text-[#ff4000]" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {user.first_name || ''} {user.last_name || 'Sans nom'}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.email || 'N/A'}</p>
                        {user.public_id && (
                          <p className="text-xs font-mono text-muted-foreground/70">
                            ID: {user.public_id}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRoleBadge(user.role)}
                      <Badge variant={user.is_active ? 'default' : 'destructive'}>
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {format(new Date(user.created_at), 'dd/MM/yy', { locale: fr })}
                      </p>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                        >
                          {user.is_active ? (
                            <UserX className="w-4 h-4 text-[#ff4000]" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-[#ff4000]" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentUsersModule;
