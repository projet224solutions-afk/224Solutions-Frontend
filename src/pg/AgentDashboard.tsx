import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Key, Mail, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AgentLayoutProfessional } from '@/components/agent/AgentLayoutProfessional';
import { AgentOverviewProfessional } from '@/components/agent/AgentOverviewProfessional';
import { useAgentPermissionsUnified } from '@/hooks/useAgentPermissionsUnified';
import { CreateUserForm } from '@/components/agent/CreateUserForm';
import AgentWalletManagement from '@/components/agent/AgentWalletManagement';
import AgentSubAgentsManagement from '@/components/agent/AgentSubAgentsManagement';
import { ViewReportsSection } from '@/components/agent/ViewReportsSection';
import { AgentAffiliateLinksSection } from '@/components/agent/AgentAffiliateLinksSection';
import CommunicationWidget from '@/components/communication/CommunicationWidget';
import { useAgentStats } from '@/hooks/useAgentStats';
import { AgentCreatedUsersList } from '@/components/agent/AgentCreatedUsersList';
import { AgentOrdersTracking } from '@/components/agent/AgentOrdersTracking';
import MyPurchasesOrdersList from '@/components/shared/MyPurchasesOrdersList';
import { SupportTicketsUniversal } from '@/components/shared/SupportTicketsUniversal';
// Modules opérationnels complets
import { AgentKYCManagement } from '@/components/agent/AgentKYCManagement';
import { AgentFullFinanceModule } from '@/components/agent/modules/AgentFullFinanceModule';
import { AgentWalletTransactionsManagement } from '@/components/agent/AgentWalletTransactionsManagement';
import { AgentBankingModule } from '@/components/agent/modules/AgentBankingModule';
import { AgentUsersModule } from '@/components/agent/modules/AgentUsersModule';
import { AgentVendorsModule } from '@/components/agent/modules/AgentVendorsModule';
import { AgentOrdersModule } from '@/components/agent/modules/AgentOrdersModule';
import { AgentServiceSubscriptionsModule } from '@/components/agent/modules/AgentServiceSubscriptionsModule';
import { AgentPermissionsDisplay } from '@/components/agent/AgentPermissionsDisplay';
import { Copilot224 } from '@/components/service-common/Copilot224';

export default function AgentDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [_pdgUserId, setPdgUserId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const { stats, refetch: refetchStats } = useAgentStats(agent?.id);

  // Hook pour les permissions unifiées (table agent_permissions + legacy JSON)
  const { permissions: unifiedPermissions, loading: permissionsLoading } = useAgentPermissionsUnified(agent?.id);

  // Résout si l'agent peut GÉRER un module (gère les alias: manage_finance → manage_banking, etc.)
  const resolveCanManage = useCallback((permKey: string): boolean => {
    if (unifiedPermissions[permKey] === true) return true;
    const impliedBy: Record<string, string[]> = {
      manage_banking: ['manage_finance'],
      manage_wallet_transactions: ['manage_finance', 'manage_banking'],
      manage_kyc: ['manage_vendor_kyc'],
      manage_vendor_kyc: ['manage_kyc'],
      manage_service_subscriptions: ['manage_service_plans'],
    };
    return (impliedBy[permKey] || []).some(k => unifiedPermissions[k] === true);
  }, [unifiedPermissions]);

  // Password change state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Email change state
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailData, setEmailData] = useState({
    newEmail: '',
    currentPassword: ''
  });
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadAgentData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (agent?.user_id) {
      loadWalletBalance();

      // Abonnement temps réel sur wallets (source de vérité) par user_id
      const channel = supabase
        .channel(`agent-wallet-dashboard-${agent.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallets',
            filter: `user_id=eq.${agent.user_id}`,
          },
          (payload) => {
            if (payload.new && typeof (payload.new as any).balance === 'number') {
              setWalletBalance((payload.new as any).balance);
            } else {
              loadWalletBalance();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.user_id]);

  // Écouter l'événement personnalisé de mise à jour wallet
  useEffect(() => {
    const handleWalletUpdate = () => {
      console.log('📊 Event wallet-updated reçu (dashboard)');
      loadWalletBalance();
    };

    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  const loadAgentData = async () => {
    try {
      const { data, error } = await supabase
        .from('agents_management')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setAgent(data);
      setPdgUserId(user?.id || null);
    } catch (error: any) {
      console.error('Erreur chargement agent:', error);
      toast.error(t('agentDashboard.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const loadWalletBalance = async () => {
    if (!agent?.user_id) return;

    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', agent.user_id)
        .single();

      if (!error && data) {
        setWalletBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Erreur chargement wallet:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agent) {
      toast.error(t('agentDashboard.agentNonTrouve'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('agentDashboard.lesMotsDePasseNe'));
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error(t('agentDashboard.leNouveauMotDePasse'));
      return;
    }

    setIsChangingPassword(true);

    try {
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/agents/change-password', {
        body: {
          agent_id: agent.id,
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        }
      });

      if (resp.success) {
        toast.success(t('agentDashboard.motDePasseModifieAvec'));
        setIsPasswordDialogOpen(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(resp.error || 'Erreur lors du changement de mot de passe');
      }
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      toast.error(t('agentDashboard.erreurLorsDuChangementDe'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agent) {
      toast.error(t('agentDashboard.agentNonTrouve'));
      return;
    }

    if (!emailData.newEmail || !emailData.currentPassword) {
      toast.error(t('agentDashboard.veuillezRemplirTousLesChamps'));
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.newEmail)) {
      toast.error('Format d\'email invalide');
      return;
    }

    setIsChangingEmail(true);

    try {
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/agents/change-email', {
        body: {
          agent_id: agent.id,
          new_email: emailData.newEmail,
          current_password: emailData.currentPassword
        }
      });

      if (resp.success) {
        toast.success(t('agentDashboard.emailModifieAvecSucces'));
        setIsEmailDialogOpen(false);
        setEmailData({ newEmail: '', currentPassword: '' });
        // Reload agent data to reflect new email
        loadAgentData();
      } else {
        toast.error(resp.error || 'Erreur lors du changement d\'email');
      }
    } catch (error) {
      console.error('Erreur changement email:', error);
      toast.error(t('agentDashboard.erreurLorsDuChangementD'));
    } finally {
      setIsChangingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{t('agent.loadingInterface')}</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-blue-50">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-[#ff4000] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-800 mb-2">{t('agent.profileNotFound')}</h2>
              <p className="text-slate-600 mb-4">
                {t('agent.noProfileAssociated')}
              </p>
              <Button onClick={handleSignOut} className="w-full">
                {t('common.signOut')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <AgentOverviewProfessional
            agent={agent}
            stats={stats}
            walletBalance={walletBalance}
            onNavigate={setActiveTab}
          />
        );

      case 'wallet':
        return (
          <AgentWalletManagement
            agentId={agent.id}
            agentCode={agent.agent_code}
            showTransactions={true}
          />
        );

      // --- Modules opérationnels complets ---
      case 'finance':
        return <AgentFullFinanceModule agentId={agent.id} canManage={resolveCanManage('manage_finance')} />;

      case 'banking':
        return <AgentBankingModule agentId={agent.id} canManage={resolveCanManage('manage_banking')} />;

      case 'kyc-management':
        return <AgentKYCManagement agentId={agent.id} canManage={resolveCanManage('manage_kyc')} />;

      case 'wallet-transactions':
        return <AgentWalletTransactionsManagement agentId={agent.id} />;

      case 'users-management':
        return <AgentUsersModule agentId={agent.id} canManage={resolveCanManage('manage_users')} />;

      case 'vendors-management':
        return <AgentVendorsModule agentId={agent.id} canManage={resolveCanManage('manage_vendors')} />;

      case 'orders-management':
        return <AgentOrdersModule agentId={agent.id} canManage={resolveCanManage('manage_orders')} />;

      case 'service-subscriptions':
        return <AgentServiceSubscriptionsModule agentId={agent.id} canManage={resolveCanManage('manage_service_subscriptions')} />;
      // --- Fin modules opérationnels ---

      case 'create-user':
        return (
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50 border-b">
              <CardTitle className="text-slate-800">{t('agent.createNewUser')}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <CreateUserForm
                agentId={agent.id}
                agentCode={agent.agent_code}
                accessToken={agent.access_token}
                onUserCreated={() => {
                  loadAgentData();
                  refetchStats();
                  setActiveTab('my-users'); // Aller vers la liste après création
                  toast.success(t('agent.userCreatedSuccess'));
                }}
              />
            </CardContent>
          </Card>
        );

      case 'my-users':
        return <AgentCreatedUsersList agentId={agent.id} />;

      case 'orders':
        return <AgentOrdersTracking agentId={agent.id} />;

      case 'my-purchases':
        return <MyPurchasesOrdersList title="Mes Achats Personnels" emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace" />;

      case 'sub-agents':
        return <AgentSubAgentsManagement agentId={agent.id} />;

      case 'reports':
        return (
          <ViewReportsSection
            agentId={agent.id}
            agentData={{
              total_users_created: stats.totalUsersCreated,
              total_commissions_earned: stats.totalCommissions,
              commission_rate: agent.commission_rate
            }}
            agentStats={stats}
          />
        );

      case 'affiliate':
        return <AgentAffiliateLinksSection agentId={agent.id} agentToken={agent.access_token} />;

      case 'support':
        return <SupportTicketsUniversal />;

      case 'settings':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Permissions accordées - affichage par catégorie avec le nouveau composant */}
            <div className="md:col-span-2">
              <AgentPermissionsDisplay
                permissions={unifiedPermissions}
                loading={permissionsLoading}
              />
            </div>

            {/* Email Settings */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Mail className="w-5 h-5 text-blue-600" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email actuel</p>
                  <p className="font-medium text-slate-800">{agent.email}</p>
                </div>
                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <Mail className="w-4 h-4 mr-2" />
                      Modifier l'email
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        Modifier l'email
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleChangeEmail} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newEmail">Nouvel email</Label>
                        <Input
                          id="newEmail"
                          type="email"
                          required
                          value={emailData.newEmail}
                          onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })}
                          placeholder={t('agentDashboard.nouveauEmailCom')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emailCurrentPassword">{t('agentDashboard.motDePasseActuel')}</Label>
                        <Input
                          id="emailCurrentPassword"
                          type="password"
                          required
                          value={emailData.currentPassword}
                          onChange={(e) => setEmailData({ ...emailData, currentPassword: e.target.value })}
                          placeholder={t('agentDashboard.pourConfirmerVotreIdentite')}
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setIsEmailDialogOpen(false)}
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 bg-[#04439e]"
                          disabled={isChangingEmail}
                        >
                          {isChangingEmail ? 'Modification...' : 'Modifier'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Password Settings */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Lock className="w-5 h-5 text-[#ff4000]" />
                  Mot de passe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-slate-500">
                  Changez votre mot de passe pour sécuriser votre compte agent.
                </p>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/40">
                      <Key className="w-4 h-4 mr-2" />
                      Changer le mot de passe
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-blue-600" />
                        Changer le mot de passe
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">{t('agentDashboard.motDePasseActuel')}</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          required
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          placeholder={t('agentDashboard.entrezVotreMotDePasse')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">{t('agentDashboard.nouveauMotDePasse')}</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          required
                          minLength={8}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          placeholder={t('agentDashboard.minimum8Caracteres')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t('agentDashboard.confirmerLeMotDePasse')}</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          required
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          placeholder={t('agentDashboard.confirmezLeNouveauMotDe')}
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setIsPasswordDialogOpen(false)}
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 bg-[#04439e]"
                          disabled={isChangingPassword}
                        >
                          {isChangingPassword ? 'Modification...' : 'Modifier'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <AgentLayoutProfessional
        agent={agent}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        walletBalance={walletBalance}
        stats={stats}
        onSignOut={handleSignOut}
        unifiedPermissions={unifiedPermissions}
      >
        {renderContent()}
      </AgentLayoutProfessional>

      <CommunicationWidget position="bottom-right" showNotifications={true} />
      <Copilot224 service="agent" title="Copilot Agent" />
    </>
  );
}
