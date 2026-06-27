/**
 * LISTE DES UTILISATEURS CRÉÉS PAR L'AGENT
 * Affiche les utilisateurs que l'agent a créés avec leurs informations
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Phone,
  Mail,
  RefreshCw,
  UserCheck,
  UserX,
  Calendar,
  ShoppingBag,
  Truck,
  Car,
  Building2,
  User
} from 'lucide-react';

interface CreatedUser {
  id: string;
  public_id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

interface AgentCreatedUsersListProps {
  agentId: string;
}

const roleConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  client: { label: "Client", icon: <User className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700' },
  vendeur: { label: "Vendeur", icon: <ShoppingBag className="w-3 h-3" />, color: 'bg-orange-100 text-[#ff4000]' },
  livreur: { label: 'Livreur', icon: <Truck className="w-3 h-3" />, color: 'bg-orange-100 text-[#ff4000]' },
  taxi: { label: 'Taxi', icon: <Car className="w-3 h-3" />, color: 'bg-blue-100 text-[#04439e]' },
  syndicat: { label: 'Syndicat', icon: <Building2 className="w-3 h-3" />, color: 'bg-orange-100 text-[#ff4000]' },
};

export function AgentCreatedUsersList({ agentId }: AgentCreatedUsersListProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<CreatedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Backend Node (agent connecté → résolu par JWT)
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/agents/users/list', { method: 'POST', body: {} });

      if (!resp.success) {
        console.error('Erreur chargement utilisateurs:', resp.error);
        toast.error(resp.error || 'Erreur lors du chargement des utilisateurs');
        return;
      }

      setUsers(resp.data?.users || []);
    } catch (err) {
      console.error('Exception:', err);
      toast.error(t('agentCreatedUsersList.erreurDeConnexionAuServeur'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    setIsRefreshing(false);
    toast.success(t('agentCreatedUsersList.listeActualisee'));
  };

  useEffect(() => {
    if (agentId) {
      loadUsers();
    }
  }, [agentId]);

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.public_id?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.phone?.includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  };

  const getRoleConfig = (role: string) => {
    return roleConfig[role] || { label: role, icon: <User className="w-3 h-3" />, color: 'bg-gray-100 text-gray-700' };
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-[#04439e]/5 border-b">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Users className="w-5 h-5 text-blue-600" />
            Mes Utilisateurs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-[#04439e]/5 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Users className="w-5 h-5 text-blue-600" />
            Mes Utilisateurs
            <Badge variant="secondary" className="ml-2">
              {users.length}
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('agentCreatedUsersList.rechercherParNomEmailTelephone')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users List */}
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              {searchQuery ? 'Aucun résultat' : 'Aucun utilisateur créé'}
            </h3>
            <p className="text-slate-500 text-sm">
              {searchQuery
                ? 'Aucun utilisateur ne correspond à votre recherche'
                : 'Commencez à créer des utilisateurs pour les voir ici'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const roleInfo = getRoleConfig(user.role);
                return (
                  <div
                    key={user.id}
                    className="flex items-start gap-4 p-4 rounded-xl border bg-white hover:shadow-md transition-all duration-200"
                  >
                    <Avatar className="h-12 w-12 border-2 border-white shadow">
                      <AvatarFallback className="bg-[#04439e] text-white font-medium">
                        {getInitials(user.first_name, user.last_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-slate-900 truncate">
                          {user.first_name} {user.last_name}
                        </h4>
                        {user.public_id && (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-mono">
                            {user.public_id}
                          </Badge>
                        )}
                        {user.is_active ? (
                          <Badge variant="outline" className="bg-orange-50 text-[#ff4000] border-orange-200 text-xs">
                            <UserCheck className="w-3 h-3 mr-1" />
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-orange-50 text-[#ff4000] border-orange-200 text-xs">
                            <UserX className="w-3 h-3 mr-1" />
                            Inactif
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        {user.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3.5 h-3.5" />
                            {user.email}
                          </span>
                        )}
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {user.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <Badge className={`${roleInfo.color} border-0 text-xs`}>
                          {roleInfo.icon}
                          <span className="ml-1">{roleInfo.label}</span>
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
