import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserCheck, Search, Ban, Trash2, Plus, Mail, Edit, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { AgentPermissionsSelector } from './AgentPermissionsSelector';

// Types
export interface SubAgent {
  id: string;
  pdg_id: string;
  parent_agent_id: string;
  agent_code: string;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  permissions: string[];
  commission_rate: number;
  created_at: string;
  updated_at?: string;
  total_users_created: number;
}

export interface AgentProfile {
  id: string;
  pdg_id: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  agent_code: string;
  permissions: string[];
  is_active: boolean;
  can_create_sub_agent: boolean;
  commission_rate: number;
  access_token?: string;
}

export interface SubAgentStats {
  totalSubAgents: number;
  activeSubAgents: number;
  inactiveSubAgents: number;
  averageCommission: number;
}

// Schéma de validation pour le sous-agent
const subAgentSchema = z.object({
  name: z.string()
    .trim()
    .min(2, { message: "Le nom doit contenir au moins 2 caractères" })
    .max(100, { message: "Le nom ne peut pas dépasser 100 caractères" }),
  email: z.string()
    .trim()
    .email({ message: "Email invalide" })
    .max(255, { message: "L'email ne peut pas dépasser 255 caractères" }),
  phone: z.string()
    .trim()
    .min(8, { message: "Le téléphone doit contenir au moins 8 chiffres" })
    .max(15, { message: "Le téléphone ne peut pas dépasser 15 chiffres" })
    .regex(/^[0-9]+$/, { message: "Le téléphone ne doit contenir que des chiffres" }),
  commission_rate: z.number()
    .min(0, { message: "Le taux de commission doit être positif" })
    .max(100, { message: "Le taux de commission ne peut pas dépasser 100%" })
});

export interface AgentSubAgentsManagementProps {
  agentId?: string;
}

export default function AgentSubAgentsManagement({ agentId }: AgentSubAgentsManagementProps = {}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SubAgentStats>({
    totalSubAgents: 0,
    activeSubAgents: 0,
    inactiveSubAgents: 0,
    averageCommission: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSubAgent, setEditingSubAgent] = useState<SubAgent | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    password: string;
    commission_rate: number;
    permissions: Record<string, boolean>;
  }>({
    name: '',
    email: '',
    phone: '',
    password: '',
    commission_rate: 5,
    permissions: {
      create_users: true,
      view_reports: false,
    }
  });

  // Charger le profil de l'agent
  useEffect(() => {
    const loadAgentProfile = async () => {
      if (!user?.id && !agentId) return;

      try {
        let query = supabase.from('agents_management').select('*');

        // Si agentId est fourni, charger directement cet agent
        if (agentId) {
          query = query.eq('id', agentId);
        } else {
          // Sinon charger l'agent lié à l'utilisateur
          query = query.eq('user_id', user.id).eq('is_active', true);
        }

        const { data, error } = await query.single();

        if (error) throw error;

        const profile: AgentProfile = {
          id: data.id,
          pdg_id: data.pdg_id,
          user_id: data.user_id,
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          agent_code: data.agent_code,
          permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
          is_active: data.is_active,
          can_create_sub_agent: data.can_create_sub_agent || false,
          commission_rate: Number(data.commission_rate) || 0,
        };

        setAgentProfile(profile);
      } catch (error) {
        console.error('Erreur chargement agent:', error);
        toast.error(t('agentSubAgentsManagement.erreurLorsDuChargementDu'));
      }
    };

    loadAgentProfile();
  }, [user?.id, agentId]);

  // Charger les sous-agents
  useEffect(() => {
    const loadSubAgents = async () => {
      if (!agentProfile?.id) return;

      try {
        setLoading(true);

        const { data: subAgentsData, error: subAgentsError } = await supabase
          .from('agents_management')
          .select('*')
          .eq('parent_agent_id', agentProfile.id)
          .order('created_at', { ascending: false });

        if (subAgentsError) {
          console.error('Erreur récupération sous-agents:', subAgentsError);
          throw subAgentsError;
        }

        // Récupérer les statistiques de tous les sous-agents en une seule requête
        const subAgentIds = (subAgentsData || []).map(sa => sa.id);

        let usersCountMap: Record<string, number> = {};

        if (subAgentIds.length > 0) {
          const { data: usersCounts, error: countsError } = await supabase
            .from('agent_created_users')
            .select('agent_id')
            .in('agent_id', subAgentIds);

          if (!countsError && usersCounts) {
            // Compter les utilisateurs par agent_id
            usersCountMap = usersCounts.reduce((acc: Record<string, number>, record) => {
              acc[record.agent_id] = (acc[record.agent_id] || 0) + 1;
              return acc;
            }, {});
          }
        }

        const subAgentsWithStats: SubAgent[] = (subAgentsData || []).map(subAgent => ({
          id: subAgent.id,
          pdg_id: subAgent.pdg_id,
          parent_agent_id: subAgent.parent_agent_id || agentProfile.id,
          agent_code: subAgent.agent_code,
          name: subAgent.name,
          email: subAgent.email,
          phone: subAgent.phone || '',
          is_active: subAgent.is_active,
          permissions: Array.isArray(subAgent.permissions) ? (subAgent.permissions as string[]) : [],
          commission_rate: Number(subAgent.commission_rate) || 0,
          created_at: subAgent.created_at,
          updated_at: subAgent.updated_at || undefined,
          total_users_created: usersCountMap[subAgent.id] || 0,
        }));

        setSubAgents(subAgentsWithStats);

        const activeSubAgents = subAgentsWithStats.filter(a => a.is_active).length;
        const avgCommission = subAgentsWithStats.length > 0
          ? subAgentsWithStats.reduce((sum, a) => sum + (Number(a.commission_rate) || 0), 0) / subAgentsWithStats.length
          : 0;

        setStats({
          totalSubAgents: subAgentsWithStats.length,
          activeSubAgents,
          inactiveSubAgents: subAgentsWithStats.length - activeSubAgents,
          averageCommission: avgCommission,
        });
      } catch (error) {
        console.error('Erreur chargement sous-agents:', error);
        toast.error(t('agentSubAgentsManagement.erreurLorsDuChargementDes'));
      } finally {
        setLoading(false);
      }
    };

    loadSubAgents();
  }, [agentProfile?.id]);

  const createSubAgent = async (subAgentData: {
    name: string;
    email: string;
    phone: string;
    password: string;
    permissions: string[];
    commission_rate?: number;
  }) => {
    if (!agentProfile?.id || !agentProfile?.pdg_id) {
      toast.error(t('agentSubAgentsManagement.profilAgentNonTrouve'));
      return null;
    }

    if (!agentProfile.can_create_sub_agent) {
      toast.error(t('agentSubAgentsManagement.vousNAvezPasLa'));
      return null;
    }

    try {
      const agentCode = `SAG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      console.log('📤 Création sous-agent via backend Node:', {
        parentAgentId: agentProfile.id,
        pdgId: agentProfile.pdg_id,
        email: subAgentData.email,
        agentCode
      });

      // Migré vers le backend Node (« tout en backend ») : atomique + rollback,
      // ownership vérifié côté serveur (verifyJWT → parentAgent.user_id).
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<{ agent: any }>('/api/agents/sub-agents', {
        method: 'POST',
        body: {
          parent_agent_id: agentProfile.id,
          agent_code: agentCode,
          name: subAgentData.name.trim(),
          email: subAgentData.email.trim().toLowerCase(),
          phone: subAgentData.phone.trim(),
          agent_type: 'sales', // Rôle métier par défaut
          password: subAgentData.password, // Mot de passe fourni par l'utilisateur
          permissions: subAgentData.permissions,
          commission_rate: subAgentData.commission_rate || 5,
        },
      });

      console.log('📥 Réponse backend:', resp);

      if (!resp.success) {
        throw new Error(resp.error || 'Erreur lors de la création du sous-agent');
      }

      const data = { agent: resp.data?.agent };
      console.log('✅ Sous-agent créé:', data?.agent);
      toast.success(`Sous-agent ${subAgentData.name} créé avec succès!`);

      // Recharger la liste après un délai
      setTimeout(() => {
        window.location.reload();
      }, 1000);

      return data?.agent;
    } catch (error: any) {
      console.error('Erreur création sous-agent:', error);
      toast.error(error.message || 'Erreur lors de la création du sous-agent');
      return null;
    }
  };

  const updateSubAgent = async (subAgentId: string, updates: Partial<SubAgent>) => {
    try {
      const { error } = await supabase
        .from('agents_management')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subAgentId);

      if (error) throw error;

      toast.success(t('agentSubAgentsManagement.sousAgentMisAJour'));
      window.location.reload();
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour sous-agent:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
      return false;
    }
  };

  const deleteSubAgent = async (subAgentId: string) => {
    try {
      const { error } = await supabase
        .from('agents_management')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', subAgentId);

      if (error) throw error;

      toast.success(t('agentSubAgentsManagement.sousAgentDesactiveAvecSucces'));
      window.location.reload();
      return true;
    } catch (error: any) {
      console.error('Erreur suppression sous-agent:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  };

  const toggleSubAgentStatus = async (subAgentId: string, isActive: boolean) => {
    return updateSubAgent(subAgentId, { is_active: isActive });
  };

  const handleCreateSubAgent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentProfile) {
      toast.error(t('agentSubAgentsManagement.profilAgentManquant'));
      return;
    }

    // Validation des données
    const validationResult = subAgentSchema.safeParse({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      commission_rate: formData.commission_rate
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    // Validation du mot de passe pour la création uniquement
    if (!editingSubAgent && (!formData.password || formData.password.length < 8)) {
      toast.error(t('agentSubAgentsManagement.leMotDePasseDoit'));
      return;
    }

    try {
      setIsSubmitting(true);

      const permissions = Object.entries(formData.permissions)
        .filter(([_, value]) => value)
        .map(([key]) => key);

      if (editingSubAgent) {
        // Mode édition
        await updateSubAgent(editingSubAgent.id, {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          permissions,
          commission_rate: formData.commission_rate,
        });
      } else {
        // Mode création
        await createSubAgent({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          permissions,
          commission_rate: formData.commission_rate,
        });
      }

      // Réinitialiser le formulaire
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        commission_rate: 5,
        permissions: {
          create_users: true,
          view_reports: false,
          manage_commissions: false,
          manage_users: false,
          manage_products: false
        }
      });
      setEditingSubAgent(null);
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Erreur:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubAgent = (subAgent: SubAgent) => {
    setEditingSubAgent(subAgent);
    setFormData({
      name: subAgent.name,
      email: subAgent.email,
      phone: subAgent.phone || '',
      password: '',
      commission_rate: subAgent.commission_rate,
      permissions: {
        create_users: subAgent.permissions.includes('create_users'),
        view_reports: subAgent.permissions.includes('view_reports'),
        manage_commissions: subAgent.permissions.includes('manage_commissions'),
        manage_users: subAgent.permissions.includes('manage_users'),
        manage_products: subAgent.permissions.includes('manage_products')
      }
    });
    setIsDialogOpen(true);
  };

  const handleSubAgentAction = async (subAgentId: string, action: 'activate' | 'suspend' | 'delete') => {
    if (action === 'delete') {
      if (!confirm(t('agentSubAgentsManagement.etesVousSurDeVouloir'))) return;
      await deleteSubAgent(subAgentId);
    } else if (action === 'suspend') {
      await toggleSubAgentStatus(subAgentId, false);
    } else if (action === 'activate') {
      await toggleSubAgentStatus(subAgentId, true);
    }
  };

  const filteredSubAgents = subAgents.filter(subAgent =>
    subAgent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subAgent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subAgent.agent_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!agentProfile?.can_create_sub_agent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Vous n'avez pas la permission de gérer des sous-agents
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('agentSubAgentsManagement.gestionDesSousAgents')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Créez et gérez vos sous-agents
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingSubAgent(null);
            setFormData({
              name: '',
              email: '',
              phone: '',
              password: '',
              commission_rate: 5,
              permissions: {
                create_users: true,
                view_reports: false,
                manage_commissions: false,
                manage_users: false,
                manage_products: false
              }
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Créer un Sous-Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSubAgent ? 'Modifier le Sous-Agent' : 'Créer un Sous-Agent'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubAgent} className="space-y-4">

              <div className="space-y-2">
                <Label htmlFor="name">Nom Complet *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="agent@exemple.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('agentSubAgentsManagement.telephone')}</Label>
                <Input
                  id="phone"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="622123456"
                />
              </div>

              {!editingSubAgent && (
                <div className="space-y-2">
                  <Label htmlFor="password">{t('agentSubAgentsManagement.motDePasseMin8')}</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="commission">Taux Commission (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                />
              </div>

              {/* Sélecteur de permissions avec toutes les catégories */}
              <AgentPermissionsSelector
                selectedPermissions={formData.permissions}
                onChange={(newPerms) => setFormData({ ...formData, permissions: newPerms })}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {editingSubAgent ? 'Modification...' : 'Création...'}
                    </>
                  ) : editingSubAgent ? (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Créer
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sous-Agents
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubAgents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeSubAgents} actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sous-Agents Actifs
            </CardTitle>
            <UserCheck className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">{stats.activeSubAgents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.inactiveSubAgents} inactifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commission Moyenne
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageCommission.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Taux moyen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t('agentSubAgentsManagement.rechercherUnSousAgent')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Liste des sous-agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubAgents.map((subAgent) => (
          <Card key={subAgent.id}>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{subAgent.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      {subAgent.email}
                    </div>
                    <p className="text-sm font-mono text-muted-foreground">
                      {subAgent.agent_code}
                    </p>
                  </div>
                  <Badge variant={subAgent.is_active ? 'default' : 'secondary'}>
                    {subAgent.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission:</span>
                    <span className="font-medium">{subAgent.commission_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('agentSubAgentsManagement.utilisateursCrees')}</span>
                    <span className="font-medium">{subAgent.total_users_created || 0}</span>
                  </div>
                </div>

                <div className="pt-3 flex gap-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditSubAgent(subAgent)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Modifier
                  </Button>
                  {subAgent.is_active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSubAgentAction(subAgent.id, 'suspend')}
                      className="flex-1"
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Suspendre
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSubAgentAction(subAgent.id, 'activate')}
                      className="flex-1"
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Activer
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleSubAgentAction(subAgent.id, 'delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSubAgents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'Aucun sous-agent trouvé' : 'Aucun sous-agent pour le moment'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
