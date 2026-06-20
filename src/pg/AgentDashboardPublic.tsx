/**
 * INTERFACE AGENT PUBLIQUE - 224SOLUTIONS
 * Architecture avec Sidebar professionnelle
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  UserCheck, Mail, Phone, AlertCircle,
  UserCog, Plus, Copy, Check, Wallet, Key
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

// Components
import AgentSidebar from '@/components/agent/AgentSidebar';
import AgentHeader from '@/components/agent/AgentHeader';
import { AgentStatsCards } from '@/components/agent/AgentStatsCards';
import { CreateUserForm } from '@/components/agent/CreateUserForm';
import { ManageUsersSection } from '@/components/agent/ManageUsersSection';
import ManageProductsSection from '@/components/agent/ManageProductsSection';
import { ViewReportsSection } from '@/components/agent/ViewReportsSection';
import { ManageCommissionsSection } from '@/components/agent/ManageCommissionsSection';
import AgentWalletManagement from '@/components/agent/AgentWalletManagement';
import { AgentAffiliateLinksSection } from '@/components/agent/AgentAffiliateLinksSection';
import CommunicationWidget from '@/components/communication/CommunicationWidget';
import { useAgentPermissionsUnified } from '@/hooks/useAgentPermissionsUnified';
import { AgentPermissionsDisplay } from '@/components/agent/AgentPermissionsDisplay';
import { AgentFullFinanceModule } from '@/components/agent/modules/AgentFullFinanceModule';
import { AgentBankingModule } from '@/components/agent/modules/AgentBankingModule';
import { AgentVendorsModule } from '@/components/agent/modules/AgentVendorsModule';
import { AgentOrdersModule } from '@/components/agent/modules/AgentOrdersModule';
import { AgentServiceSubscriptionsModule } from '@/components/agent/modules/AgentServiceSubscriptionsModule';

// Schéma de validation pour le sous-agent
const subAgentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(15).regex(/^[0-9]+$/),
  commission_rate: z.number().min(0).max(100)
});

interface Agent {
  id: string;
  pdg_id: string;
  name: string;
  email: string;
  phone?: string;
  agent_code: string;
  commission_rate: number;
  is_active: boolean;
  permissions: string[];
  total_users_created?: number;
  total_commissions_earned?: number;
  total_sub_agents?: number;
  can_create_sub_agent?: boolean;
  created_at: string;
  access_token?: string;
  type_agent?: string;
}

interface SubAgent extends Agent {
  parent_agent_id: string;
}

const SECTION_TITLES: Record<string, string> = {
  'overview': 'Tableau de bord',
  'wallet': 'Gestion du Wallet',
  'create-user': 'Créer un Utilisateur',
  'sub-agents': 'Gestion des Sous-Agents',
  'users': 'Gestion des Utilisateurs',
  'products': 'Gestion des Produits',
  'reports': 'Rapports & Statistiques',
  'commissions': 'Gestion des Commissions',
  'finance': 'Gestion Financière',
  'banking': 'Système Bancaire',
  'wallet-transactions': 'Transactions Wallet',
  'kyc-management': 'Gestion KYC',
  'vendors-management': 'Gestion des Vendeurs',
  'orders-management': 'Gestion des Commandes',
  'service-subscriptions': 'Abonnements Services',
  'affiliate': 'Liens d\'Affiliation'
};

export default function AgentDashboardPublic() {
  const { t } = useTranslation();
  const { token } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [isSubAgentDialogOpen, setIsSubAgentDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [loadingSubAgents, setLoadingSubAgents] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pdgUserId, setPdgUserId] = useState<string | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [subAgentFormData, setSubAgentFormData] = useState({
    name: '',
    email: '',
    phone: '',
    agent_type: '',
    password: '',
    commission_rate: 5,
    permissions: {
      create_users: true,
      view_reports: false,
      manage_commissions: false,
      manage_users: false,
      manage_products: false,
      create_sub_agents: false
    }
  });

  // Hook pour les permissions unifiées (nouvelle table + legacy)
  const { permissions: unifiedPermissions, hasPermission, loading: permissionsLoading } = useAgentPermissionsUnified(agent?.id);

  useEffect(() => {
    if (token) {
      loadAgentData();
    } else {
      toast.error(t('agentDashboardPublic.tokenDAccesManquant'));
      navigate('/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (agent && (activeSection === 'users' || activeSection === 'sub-agents')) {
      loadSubAgents();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, activeSection]);

  // Real-time updates
  useEffect(() => {
    if (!token) return;

    const channel = supabase
      .channel('agent-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agents_management',
          filter: `access_token=eq.${token}`
        },
        (payload) => {
          setAgent(prev => ({
            ...(prev ?? {}),
            ...payload.new,
            permissions: Array.isArray(payload.new.permissions)
              ? payload.new.permissions as string[]
              : (prev?.permissions ?? []),
          }) as Agent);
          toast.success(t('agentDashboardPublic.donneesMisesAJour'));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [token]);

  const loadAgentData = async () => {
    try {
      setLoading(true);

      const { data: agentData, error: agentError } = await supabase
        .from('agents_management')
        .select('*')
        .eq('access_token', token)
        .single();

      if (agentError) throw agentError;
      if (!agentData) {
        toast.error(t('agentDashboardPublic.agentNonTrouve'));
        navigate('/');
        return;
      }

      const { count: usersCount } = await supabase
        .from('agent_created_users')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentData.id);

      setAgent({
        ...agentData,
        permissions: Array.isArray(agentData.permissions) ? agentData.permissions as string[] : [],
        total_users_created: usersCount || 0
      } as Agent);
      setPdgUserId(agentData.pdg_id);
      toast.success(`Bienvenue ${agentData.name}!`);
    } catch (error) {
      console.error('Erreur chargement agent:', error);
      toast.error(t('agentDashboardPublic.erreurLorsDuChargement'));
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadSubAgents = async () => {
    if (!agent) return;

    try {
      setLoadingSubAgents(true);
      const { data, error } = await supabase
        .from('agents_management')
        .select('*')
        .eq('parent_agent_id', agent.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const subAgentsWithCounts = await Promise.all(
        (data || []).map(async (subAgent) => {
          const { count } = await supabase
            .from('agent_created_users')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', subAgent.id);

          return { ...subAgent, total_users_created: count || 0 };
        })
      );

      setSubAgents(subAgentsWithCounts as SubAgent[]);
    } catch (error) {
      console.error('Erreur chargement sous-agents:', error);
    } finally {
      setLoadingSubAgents(false);
    }
  };

  const handleCreateSubAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;

    const validationResult = subAgentSchema.safeParse({
      name: subAgentFormData.name,
      email: subAgentFormData.email,
      phone: subAgentFormData.phone,
      commission_rate: subAgentFormData.commission_rate
    });

    if (!validationResult.success) {
      toast.error(validationResult.error.issues[0].message);
      return;
    }

    try {
      setIsSubmitting(true);

      const permissions = Object.entries(subAgentFormData.permissions)
        .filter(([_, value]) => value)
        .map(([key]) => key);

      const { data, error } = await supabase.functions.invoke('create-sub-agent', {
        body: {
          pdg_id: agent.pdg_id,
          parent_agent_id: agent.id,
          agent_code: `SAG-${Date.now().toString(36).toUpperCase()}`,
          name: subAgentFormData.name.trim(),
          email: subAgentFormData.email.trim().toLowerCase(),
          phone: subAgentFormData.phone.trim(),
          agent_type: subAgentFormData.agent_type,
          password: subAgentFormData.password,
          permissions,
          commission_rate: subAgentFormData.commission_rate,
          access_token: token
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(t('agentDashboardPublic.sousAgentCreeAvecSucces'));
      setIsSubAgentDialogOpen(false);
      setSubAgentFormData({
        name: '', email: '', phone: '', agent_type: '', password: '',
        commission_rate: 5,
        permissions: { create_users: true, view_reports: false, manage_commissions: false, manage_users: false, manage_products: false, create_sub_agents: false }
      });
      await loadAgentData();
      await loadSubAgents();
    } catch (error: any) {
      console.error('Erreur création sous-agent:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('agentDashboardPublic.lesMotsDePasseNe'));
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error(t('agentDashboardPublic.minimum8Caracteres'));
      return;
    }

    setIsChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('change-agent-password', {
        body: {
          agent_id: agent.id,
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(t('agentDashboardPublic.motDePasseModifie'));
        setIsPasswordDialogOpen(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(data?.error || 'Erreur');
      }
    } catch (_error) {
      toast.error(t('agentDashboardPublic.erreurLorsDuChangement'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem('agent_token');
    toast.success(t('agentDashboardPublic.deconnexionReussie'));
    navigate('/login');
  };

  const copySubAgentLink = async (subAgent: SubAgent) => {
    if (!subAgent.access_token) {
      toast.error('Token non disponible');
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/agent/${subAgent.access_token}`);
      setCopiedId(subAgent.id);
      toast.success(t('agentDashboardPublic.lienCopie'));
      setTimeout(() => setCopiedId(null), 3000);
    } catch (_error) {
      toast.error(t('agentDashboardPublic.erreurDeCopie'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-[#ff4000] mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t('agentDashboardPublic.accesNonAutorise')}</h2>
            <p className="text-muted-foreground">{t('agentDashboardPublic.tokenInvalideOuExpire')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Stats */}
            <AgentStatsCards
              stats={{
                totalUsersCreated: agent.total_users_created || 0,
                usersThisMonth: 0,
                subAgentsCount: subAgents.length,
                activeSubAgentsCount: subAgents.filter(s => s.is_active).length
              }}
              commissionRate={agent.commission_rate}
              walletBalance={0}
            />

            {/* Agent Info */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-[#04439e] text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Informations Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nom complet</p>
                    <p className="text-lg font-semibold">{agent.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Code Agent</p>
                    <code className="text-lg font-mono font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded">
                      {agent.agent_code}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{agent.email}</span>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{agent.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Permissions - nouveau composant avec catégories */}
            <AgentPermissionsDisplay
              permissions={unifiedPermissions}
              loading={permissionsLoading}
            />
          </div>
        );

      case 'wallet':
        return agent?.id ? (
          <AgentWalletManagement
            agentId={agent.id}
            agentCode={agent.agent_code}
            showTransactions={true}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Wallet className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-muted-foreground">{t('agentDashboardPublic.impossibleDeChargerLeWallet')}</p>
            </CardContent>
          </Card>
        );

      case 'create-user':
        return (
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#ff4000] to-[#ff4000] text-white rounded-t-lg">
              <CardTitle>{t('agentDashboardPublic.creerUnNouvelUtilisateur')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <CreateUserForm
                agentId={agent.id}
                agentCode={agent.agent_code}
                accessToken={token}
                onUserCreated={loadAgentData}
              />
            </CardContent>
          </Card>
        );

      case 'sub-agents':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Mes Sous-Agents ({subAgents.length})</h2>
              <Dialog open={isSubAgentDialogOpen} onOpenChange={setIsSubAgentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#04439e] hover:bg-[#04439e] shadow-lg shadow-[#04439e]/40">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Sous-Agent
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t('agentDashboardPublic.creerUnSousAgent')}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateSubAgent} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nom Complet *</Label>
                        <Input
                          required
                          value={subAgentFormData.name}
                          onChange={(e) => setSubAgentFormData({ ...subAgentFormData, name: e.target.value })}
                          placeholder="Jean Dupont"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          required
                          value={subAgentFormData.email}
                          onChange={(e) => setSubAgentFormData({ ...subAgentFormData, email: e.target.value })}
                          placeholder="agent@exemple.com"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('agentDashboardPublic.telephone')}</Label>
                        <Input
                          required
                          value={subAgentFormData.phone}
                          onChange={(e) => setSubAgentFormData({ ...subAgentFormData, phone: e.target.value })}
                          placeholder="622123456"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type d'Agent</Label>
                        <Input
                          value={subAgentFormData.agent_type}
                          onChange={(e) => setSubAgentFormData({ ...subAgentFormData, agent_type: e.target.value })}
                          placeholder="Agent Commercial..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('agentDashboardPublic.motDePasse')}</Label>
                        <Input
                          type="password"
                          required
                          minLength={6}
                          value={subAgentFormData.password}
                          onChange={(e) => setSubAgentFormData({ ...subAgentFormData, password: e.target.value })}
                          placeholder={t('agentDashboardPublic.min6Caracteres')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Commission (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={subAgentFormData.commission_rate}
                          onChange={(e) => setSubAgentFormData({ ...subAgentFormData, commission_rate: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <Label className="text-base font-semibold mb-3 block">Permissions</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'create_users', label: 'Créer utilisateurs' },
                          { key: 'view_reports', label: 'Voir rapports' },
                          { key: 'manage_commissions', label: 'Gérer commissions' },
                          { key: 'manage_users', label: 'Gérer utilisateurs' },
                          { key: 'manage_products', label: 'Gérer produits' },
                          { key: 'create_sub_agents', label: 'Créer sous-agents' }
                        ].map(({ key, label }) => {
                          const permKey = key as keyof typeof subAgentFormData.permissions;
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => {
                                const currentValue = subAgentFormData.permissions[permKey];
                                setSubAgentFormData(prev => ({
                                  ...prev,
                                  permissions: {
                                    ...prev.permissions,
                                    [key]: !currentValue
                                  }
                                }));
                              }}
                            >
                              <Checkbox
                                id={`perm-${key}`}
                                checked={subAgentFormData.permissions[permKey]}
                                onCheckedChange={(checked) => {
                                  // Empêcher la propagation et mettre à jour l'état
                                  if (typeof checked === 'boolean') {
                                    setSubAgentFormData(prev => ({
                                      ...prev,
                                      permissions: {
                                        ...prev.permissions,
                                        [key]: checked
                                      }
                                    }));
                                  }
                                }}
                              />
                              <span className="text-sm select-none">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsSubAgentDialogOpen(false)} className="flex-1">
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isSubmitting} className="flex-1">
                        {isSubmitting ? 'Création...' : 'Créer'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingSubAgents ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#04439e] mx-auto"></div>
              </div>
            ) : subAgents.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-16 text-center">
                  <UserCog className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">{t('agentDashboardPublic.aucunSousAgentCree')}</p>
                  <Button onClick={() => setIsSubAgentDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer votre premier sous-agent
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {subAgents.map((subAgent) => (
                  <Card key={subAgent.id} className="border-0 shadow-lg hover:shadow-xl transition-all">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-blue-100 to-orange-100 rounded-xl">
                            <UserCog className="w-6 h-6 text-[#04439e]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{subAgent.name}</h3>
                            <p className="text-sm text-muted-foreground">{subAgent.agent_code}</p>
                            <div className="flex items-center gap-2 mt-1 text-sm">
                              <Mail className="w-3 h-3" /> {subAgent.email}
                              {subAgent.phone && <><Phone className="w-3 h-3 ml-2" /> {subAgent.phone}</>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={subAgent.is_active ? "default" : "secondary"}>
                            {subAgent.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                          <Button
                            size="sm"
                            variant={copiedId === subAgent.id ? "default" : "outline"}
                            onClick={() => copySubAgentLink(subAgent)}
                          >
                            {copiedId === subAgent.id ? (
                              <><Check className="w-4 h-4 mr-1" /> {t('agentDashboardPublic.copie')}</>
                            ) : (
                              <><Copy className="w-4 h-4 mr-1" /> Lien</>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="outline">Commission: {subAgent.commission_rate}%</Badge>
                        <Badge variant="outline">{subAgent.total_users_created || 0} utilisateurs</Badge>
                        {subAgent.permissions?.map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 'users':
        return <ManageUsersSection agentId={agent.id} />;

      case 'products':
        return hasPermission('manage_products') || agent.permissions.includes('manage_products') ? (
          <ManageProductsSection agentId={agent.id} />
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">{t('agentDashboardPublic.permissionNonAccordee')}</CardContent></Card>
        );

      case 'reports':
        return hasPermission('view_reports') || agent.permissions.includes('view_reports') ? (
          <ViewReportsSection
            agentId={agent.id}
            agentData={{
              total_users_created: agent.total_users_created,
              total_commissions_earned: agent.total_commissions_earned,
              commission_rate: agent.commission_rate
            }}
          />
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">{t('agentDashboardPublic.permissionNonAccordee')}</CardContent></Card>
        );

      case 'commissions':
        return hasPermission('manage_commissions') || agent.permissions.includes('manage_commissions') ? (
          <ManageCommissionsSection
            agentId={agent.id}
            totalCommissions={agent.total_commissions_earned || 0}
            commissionRate={agent.commission_rate}
          />
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">{t('agentDashboardPublic.permissionNonAccordee')}</CardContent></Card>
        );

      case 'finance':
        return (
          <AgentFullFinanceModule
            agentId={agent.id}
            canManage={hasPermission('manage_finance')}
          />
        );

      case 'banking':
        return (
          <AgentBankingModule
            agentId={agent.id}
            canManage={hasPermission('manage_banking') || hasPermission('manage_finance')}
          />
        );

      case 'wallet-transactions':
        return (
          <AgentBankingModule
            agentId={agent.id}
            canManage={hasPermission('manage_wallet_transactions') || hasPermission('manage_banking') || hasPermission('manage_finance')}
          />
        );

      case 'kyc-management':
        return (
          <AgentVendorsModule
            agentId={agent.id}
            canManage={hasPermission('manage_kyc') || hasPermission('manage_vendor_kyc')}
          />
        );

      case 'vendors-management':
        return (
          <AgentVendorsModule
            agentId={agent.id}
            canManage={hasPermission('manage_vendors') || hasPermission('manage_vendor_kyc')}
          />
        );

      case 'orders-management':
        return (
          <AgentOrdersModule
            agentId={agent.id}
            canManage={hasPermission('manage_orders')}
          />
        );

      case 'service-subscriptions':
        return (
          <AgentServiceSubscriptionsModule
            agentId={agent.id}
            canManage={hasPermission('manage_service_subscriptions') || hasPermission('manage_service_plans')}
          />
        );

      case 'affiliate':
        return <AgentAffiliateLinksSection agentId={agent.id} agentToken={token} />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/30 flex">
      {/* Sidebar */}
      <AgentSidebar
        agent={agent}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onChangePassword={() => setIsPasswordDialogOpen(true)}
        onLogout={handleLogout}
        unifiedPermissions={unifiedPermissions}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <AgentHeader
          agentCode={agent.agent_code}
          pdgUserId={pdgUserId}
          sectionTitle={SECTION_TITLES[activeSection] || 'Dashboard'}
        />

        <main className="flex-1 p-4 lg:p-8">
          {renderContent()}
        </main>
      </div>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              Changer le mot de passe
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('agentDashboardPublic.motDePasseActuel')}</Label>
              <Input
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('agentDashboardPublic.nouveauMotDePasse')}</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmer</Label>
              <Input
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" disabled={isChangingPassword} className="flex-1">
                {isChangingPassword ? 'Modification...' : 'Modifier'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Communication Widget */}
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}
