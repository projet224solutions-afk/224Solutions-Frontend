import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Shield, LogOut, Lock, Brain, Mail, Activity, AlertTriangle } from 'lucide-react';
import { NotificationBellButton } from '@/components/shared/NotificationBellButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { AdminMfaStepUpGate } from '@/components/security/AdminMfaStepUpGate';
import { usePDGAIAssistant } from '@/hooks/usePDGAIAssistant';
import { usePDGErrorBoundary } from '@/hooks/usePDGErrorBoundary';
import PDGNavigation, { NAV_TAB_PERMISSIONS } from '@/components/pdg/PDGNavigation';
import { useCurrentUserPermissions } from '@/hooks/useCurrentUserPermissions';
import { PDGDashboardHome } from '@/components/pdg/PDGDashboardHome';
import { UserIdDisplay } from '@/components/UserIdDisplay';
import CommunicationWidget from '@/components/communication/CommunicationWidget';

// Lazy-loaded tab components
const PDGFinance = lazy(() => import('@/components/pdg/PDGFinance'));
const UniversalWalletDashboard = lazy(() => import('@/components/wallet/UniversalWalletDashboard'));
const EscrowConversionMonitor = lazy(() => import('@/components/pdg/EscrowConversionMonitor'));
const WalletProvenancePanel = lazy(() => import('@/components/pdg/WalletProvenancePanel'));
const PDGUsers = lazy(() => import('@/components/pdg/PDGUsers'));
const SecurityOpsPanel = lazy(() => import('@/components/pdg/SecurityOpsPanel'));
const PDGCopilot = lazy(() => import('@/components/pdg/PDGCopilot'));
// Copilot 224 unifié en mode PDG (supervision + auto-correction) — remplace l'ancien PDGCopilot (Edge Function).
const Copilot224 = lazy(() => import('@/components/service-common/Copilot224'));
const PDGSystemMaintenance = lazy(() => import('@/components/pdg/PDGSystemMaintenance'));
const PDGProductsManagement = lazy(() => import('@/components/pdg/PDGProductsManagement'));
const PDGReportsAnalytics = lazy(() => import('@/components/pdg/PDGReportsAnalytics'));
const PDGAgentsManagement = lazy(() => import('@/components/pdg/PDGAgentsManagement'));
const PDGSyndicatManagement = lazy(() => import('@/components/pdg/PDGSyndicatManagement'));
const PDGAIAssistant = lazy(() => import('@/components/pdg/PDGAIAssistant'));
const UniversalCommunicationHub = lazy(() => import('@/components/communication/UniversalCommunicationHub'));
const _GoogleCloudMonitoring = lazy(() => import('@/components/pdg/GoogleCloudMonitoring'));
const MultiCloudDashboard = lazy(() => import('@/components/admin/MultiCloudDashboard'));
const SystemConfiguration = lazy(() => import('@/components/pdg/SystemConfiguration'));
const TransferFeeSettings = lazy(() => import('@/components/admin/TransferFeeSettings'));
const PDGOrders = lazy(() => import('@/components/pdg/PDGOrders'));
const PDGVendors = lazy(() => import('@/components/pdg/PDGVendors'));
const PDGDrivers = lazy(() => import('@/components/pdg/PDGDrivers'));
const BugBountyDashboard = lazy(() => import('@/components/bug-bounty/BugBountyDashboard'));
const QuotesInvoicesPDG = lazy(() => import('@/components/pdg/QuotesInvoicesPDG'));
const AgentWalletAudit = lazy(() => import('@/components/pdg/AgentWalletAudit'));
const CopilotAuditTrail = lazy(() => import('@/components/pdg/CopilotAuditTrail'));
const PDGKYCManagement = lazy(() => import('@/components/pdg/PDGKYCManagement'));
const BankingDashboard = lazy(() => import('@/components/pdg/BankingDashboard'));
const PDGStolenVehiclesSupervision = lazy(() => import('@/components/pdg/PDGStolenVehiclesSupervision'));
const DriverSubscriptionManagement = lazy(() => import('@/components/pdg/DriverSubscriptionManagement'));
const PDGServiceSubscriptions = lazy(() => import('@/components/pdg/PDGServiceSubscriptions'));
const PDGWalletApiManagement = lazy(() => import('@/components/pdg/PDGWalletApiManagement'));
const PDGBureauMonitoring = lazy(() => import('@/components/pdg/PDGBureauMonitoring'));
const VendorCertificationManager = lazy(() => import('@/components/ceo/VendorCertificationManager').then(m => ({ default: m.VendorCertificationManager })));
const VendorKYCReview = lazy(() => import('@/components/ceo/VendorKYCReview').then(m => ({ default: m.VendorKYCReview })));
const IdNormalizationAudit = lazy(() => import('@/components/pdg/IdNormalizationAudit'));
const LogicSurveillanceDashboard = lazy(() => import('@/components/pdg/LogicSurveillanceDashboard'));
const PDGSyncDashboard = lazy(() => import('@/components/pdg/PDGSyncDashboard'));
const BroadcastMessageCenter = lazy(() => import('@/components/pdg/BroadcastMessageCenter'));
const PDGCampaignSupervision = lazy(() => import('@/components/pdg/PDGCampaignSupervision'));
const DeletedUsersRestore = lazy(() => import('@/components/pdg/DeletedUsersRestore'));
const PDGSupportTechnique = lazy(() => import('@/components/pdg/PDGSupportTechnique'));
const PdgDocumentation = lazy(() => import('@/components/pdg/PdgDocumentation'));
const PDGShareholderManagement = lazy(() => import('@/components/pdg/PDGShareholderManagement'));

// Tabs that redirect to dedicated pages instead of inline content
const EXTERNAL_TABS: Record<string, string> = {
  'command-center': '/pdg/command-center',
  'debug': '/pdg/debug',
  'api': '/pdg/api-supervision',
  'copilot-dashboard': '/pdg/copilot',
};

const PDG_TAB_STORAGE_KEY = 'pdg_active_tab';

export default function PDG224Solutions() {
  const { t } = useTranslation();
  const { user, profile, profileLoading, signOut } = useAuth();
  const navigate = useNavigate();

  // Role check - only admin/pdg/ceo
  const isAdmin = ['admin', 'pdg', 'ceo'].includes((profile?.role || '').toString().toLowerCase());

  // MFA state - server-side verified
  const [mfaVerified, setMfaVerified] = useState<boolean>(() => {
    return sessionStorage.getItem('mfa_verified_admin') === 'true';
  });
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [sendingMfa, setSendingMfa] = useState(false);
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem(PDG_TAB_STORAGE_KEY) || 'dashboard';
  });
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [fxCriticalAlerts, setFxCriticalAlerts] = useState(0);

  const { error, clearError } = usePDGErrorBoundary();
  const { aiActive } = usePDGAIAssistant();

  // Permissions de l'utilisateur courant : un AGENT du PDG accède à cette interface
  // avec une nav filtrée + un contenu gaté par permission (le PDG a tout).
  const { isPDG, isAgent, hasPermission, loading: permsLoading } = useCurrentUserPermissions();

  // Un onglet est-il accessible à l'utilisateur courant ?
  // PDG/CEO/Admin : tout. Agent : uniquement les onglets dont la permission requise est accordée
  // (les onglets sans permission mappée — ex. 'dashboard' — sont réservés au PDG).
  const canViewTab = useCallback((tab: string): boolean => {
    if (isPDG) return true;
    if (!isAgent) return false;
    const required = NAV_TAB_PERMISSIONS[tab];
    return required ? hasPermission(required) : false;
  }, [isPDG, isAgent, hasPermission]);

  // Premier onglet réellement permis (pour l'atterrissage par défaut d'un agent).
  const firstAllowedTab = useCallback((): string | null => {
    const tabs = Object.keys(NAV_TAB_PERMISSIONS);
    return tabs.find((t) => canViewTab(t)) || null;
  }, [canViewTab]);

  const setActiveTabPersisted = useCallback((tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem(PDG_TAB_STORAGE_KEY, tab);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    // Redirect to external pages for certain tabs
    const externalUrl = EXTERNAL_TABS[tab];
    if (externalUrl) {
      navigate(externalUrl);
      return;
    }
    setActiveTabPersisted(tab);
  }, [navigate, setActiveTabPersisted]);

  // Agent : garantir un onglet AUTORISÉ (atterrissage par défaut + anti-forçage via sessionStorage).
  useEffect(() => {
    if (permsLoading || isPDG || !isAgent) return;
    if (!canViewTab(activeTab)) {
      const next = firstAllowedTab();
      if (next && next !== activeTab) setActiveTabPersisted(next);
    }
  }, [permsLoading, isPDG, isAgent, activeTab, canViewTab, firstAllowedTab, setActiveTabPersisted]);

  const loadFxCriticalAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('financial_security_alerts')
        .select('id')
        .like('alert_type', 'fx_%')
        .eq('is_resolved', false)
        .in('severity', ['critical', 'high'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return;
      setFxCriticalAlerts((data || []).length);
    } catch {
      // Silent fail on badge refresh to avoid blocking PDG UI
    }
  }, []);

  useEffect(() => {
    if (!user && !profileLoading) {
      navigate('/auth');
      return;
    }

    if (profileLoading || !profile) return;

    const currentRole = (profile.role || '').toString().toLowerCase();
    // PDG/CEO/Admin : accès total. Agent : accès filtré par permissions (nav + contenu gatés).
    if (!['admin', 'pdg', 'ceo', 'agent'].includes(currentRole)) {
      toast.error(t('pDG224Solutions.accesRefuse'));
      navigate('/home');
      return;
    }

    // MFA réservé au PDG/admin (les agents n'ont pas la MFA PDG).
    if (currentRole !== 'agent' && !mfaVerified) {
      setShowMfaDialog(true);
    }

    // Log PDG access
    if (user) {
      supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'PDG_ACCESS',
        target_type: 'dashboard',
        data_json: { timestamp: new Date().toISOString() }
      }).then(() => {
        // logged
      });
    }
  }, [user, profile, profileLoading, navigate, mfaVerified]);

  useEffect(() => {
    loadFxCriticalAlerts();
    const intervalId = window.setInterval(loadFxCriticalAlerts, 60000);
    return () => window.clearInterval(intervalId);
  }, [loadFxCriticalAlerts]);

  // Server-side MFA: send code
  const handleSendMfaCode = useCallback(async () => {
    if (!user?.email) {
      toast.error('Email introuvable');
      return;
    }
    setSendingMfa(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pdg-mfa-verify', {
        body: { action: 'send' },
      });

      if (fnError) throw fnError;

      if (data?.success) {
        toast.success(`Code MFA envoyé à ${data?.recipient_email || user.email}`);
        // In dev mode, show the code if returned
        if (data.dev_code) {
          setMfaCode(data.dev_code);
          toast.info(`Mode secours - Code: ${data.dev_code}`, { duration: 60000 });
        }
      } else {
        if (data?.error_code === 'RESEND_TEST_MODE_RECIPIENT_RESTRICTED') {
          toast.error(t('pDG224Solutions.envoiEmailBloqueParResend'));
          toast.info(`Destinataire demandé: ${data?.recipient_email || user.email}`);
        } else {
          toast.error(data?.error || 'Erreur envoi MFA');
        }

        if (data?.dev_code) {
          setMfaCode(data.dev_code);
          toast.info(`Code temporaire: ${data.dev_code}`, { duration: 60000 });
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Échec de l\'envoi du code MFA';
      console.error('MFA send error:', e);
      toast.error(msg);
    } finally {
      setSendingMfa(false);
    }
  }, [user]);

  // Server-side MFA: verify code
  const handleVerifyMfa = useCallback(async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error(t('pDG224Solutions.entrezLeCodeA6'));
      return;
    }

    setVerifyingMfa(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pdg-mfa-verify', {
        body: { action: 'verify', code: mfaCode },
      });

      if (fnError) throw fnError;

      if (data?.verified) {
        setMfaVerified(true);
        sessionStorage.setItem('mfa_verified_admin', 'true');
        setShowMfaDialog(false);
        setMfaCode('');
        toast.success(t('pDG224Solutions.mfaVerifieeAccesPdgAutorise'));
      } else {
        toast.error(data?.error || 'Code MFA invalide');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur de vérification MFA';
      console.error('MFA verify error:', e);
      toast.error(msg);
    } finally {
      setVerifyingMfa(false);
    }
  }, [mfaCode]);

  const handleUpdateEmail = useCallback(async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error(t('pDG224Solutions.veuillezEntrerUneAdresseEmail'));
      return;
    }

    setUpdatingEmail(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });
      if (updateError) throw updateError;

      toast.success(t('pDG224Solutions.emailMisAJourVerifiez'));
      setShowEmailDialog(false);
      setNewEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la mise à jour de l\'email';
      console.error('Email update error:', err);
      toast.error(msg);
    } finally {
      setUpdatingEmail(false);
    }
  }, [newEmail]);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t('pDG224Solutions.chargementDuProfil')}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="flex flex-col items-center gap-4">
          <p className="text-destructive">{t('pDG224Solutions.impossibleDeChargerLeProfil')}</p>
          <Button onClick={() => navigate('/auth')}>{t('pDG224Solutions.retourALaConnexion')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Porte step-up 2FA : prompt automatique sur les opérations financières sensibles. */}
      <AdminMfaStepUpGate />
      {/* MFA Dialog */}
      {isAdmin && !mfaVerified && (
        <Dialog open={showMfaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Vérification MFA requise
              </DialogTitle>
              <DialogDescription>
                Un code de sécurité à 6 chiffres est nécessaire pour accéder à l'interface PDG.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Button
                variant="secondary"
                onClick={handleSendMfaCode}
                disabled={sendingMfa || verifyingMfa}
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                {sendingMfa ? 'Envoi en cours...' : 'Envoyer le code par email'}
              </Button>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pDG224Solutions.codeDeVerification')}</label>
                <Input
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-widest"
                />
              </div>
              <Button
                onClick={handleVerifyMfa}
                disabled={verifyingMfa || mfaCode.length !== 6}
                className="w-full"
              >
                {verifyingMfa ? 'Vérification...' : 'Vérifier le code'}
              </Button>
            </div>
            <DialogFooter>
              <p className="text-xs text-muted-foreground">
                Le code expire après 10 minutes.
              </p>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Background */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      </div>

      <div className="relative z-10 h-screen overflow-y-auto scrollbar-thin overflow-x-hidden">
        {/* Header */}
        <div className="border-b border-border/40 bg-card/30 backdrop-blur-xl w-full">
          <div className="max-w-[1600px] mx-auto px-4 py-3 sm:px-6 sm:py-6 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6 w-full">
              <div className="flex items-center gap-3 sm:gap-6 min-w-0 w-full">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/60 blur-xl opacity-50" />
                  <div className="relative bg-gradient-to-br from-primary to-primary/80 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-2xl">
                    <Shield className="w-5 h-5 sm:w-8 sm:h-8 text-primary-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                    <h1 className="text-base sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      PDG 224SOLUTIONS
                    </h1>
                    <UserIdDisplay layout="horizontal" showBadge={true} />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 items-center gap-2 hidden sm:flex">
                    <Lock className="w-3 h-3 text-[#ff4000]" />
                    Contrôle total et sécurisé
                  </p>
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent sm:flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/pdg/command-center')}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1 sm:gap-2 shadow-lg shadow-blue-600/40 hover:shadow-xl transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                >
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{t('pDG224Solutions.centreDe')}</span> Commande
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/pdg/security')}
                  className="bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1 sm:gap-2 shadow-lg shadow-[#ff4000]/40 hover:shadow-xl transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                >
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                  Défense
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/pdg/competitive-analysis')}
                  className="bg-[#04439e] hover:bg-[#04439e] text-white gap-1 sm:gap-2 shadow-lg shadow-[#04439e]/40 hover:shadow-xl transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 hidden sm:flex"
                >
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                  Analyse IA
                </Button>
                {!mfaVerified && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMfaDialog(true)}
                    className="border-orange-500/30 text-orange-600 hover:bg-orange-500/10 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                  >
                    MFA
                  </Button>
                )}
                <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20 hover:bg-[#ff4000]/20 gap-1 text-xs flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ff4000] animate-pulse" />
                  <span className="hidden sm:inline">{t('pDG224Solutions.systeme')}</span> Actif
                </Badge>
                {fxCriticalAlerts > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setActiveTabPersisted('banking')}
                    className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                  >
                    <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
                    FX Critique ({fxCriticalAlerts})
                  </Button>
                )}
                {aiActive && (
                  <Badge className="bg-[#04439e]/10 text-[#04439e] border-[#04439e]/20 hover:bg-[#04439e]/20 gap-1 text-xs flex-shrink-0">
                    <Brain className="w-3 h-3" />
                    IA
                  </Badge>
                )}
                <NotificationBellButton className="h-8 w-8" iconSize="w-4 h-4" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailDialog(true)}
                  className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 hidden sm:flex"
                >
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{t('pDG224Solutions.modifier')}</span> Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                >
                  <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{t('pDG224Solutions.deconnexion')}</span>
                </Button>
              </div>
            </div>
            {!mfaVerified && (
              <div className="mt-4 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className="text-sm text-orange-500 flex-1">
                    MFA non vérifiée - Certaines actions critiques nécessiteront une vérification supplémentaire
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="max-w-[1600px] mx-auto px-6 pt-4">
            <ErrorBanner
              title={`Erreur ${error.type}`}
              message={error.message}
              actionLabel="Fermer"
              onAction={clearError}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 sm:pb-8">
          <PDGNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            aiActive={aiActive}
          />

          <div className="mt-4 sm:mt-8 animate-fade-in">
            {!isPDG && isAgent && !canViewTab(activeTab) ? (
              permsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="max-w-lg mx-auto mt-8 rounded-xl border bg-card p-6 text-center space-y-2">
                  <Shield className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="font-semibold">{t('pDG224Solutions.accesNonAutorise')}</p>
                  <p className="text-sm text-muted-foreground">
                    Vous n'avez pas la permission d'accéder à cette section. Contactez le PDG.
                  </p>
                </div>
              )
            ) : (
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="text-muted-foreground">Chargement...</span>
                </div>
              </div>
            }>
              {activeTab === 'dashboard' && (
                <ErrorBoundary><PDGDashboardHome onNavigate={handleTabChange} /></ErrorBoundary>
              )}
              {activeTab === 'finance' && (
                <ErrorBoundary><PDGFinance /></ErrorBoundary>
              )}
              {activeTab === 'pdg-wallet' && user && (
                <ErrorBoundary>
                  <UniversalWalletDashboard
                    userId={user.id}
                    userCode={(profile as any)?.public_id || (profile as any)?.custom_id || ''}
                  />
                </ErrorBoundary>
              )}
              {activeTab === 'escrow-monitor' && (
                <ErrorBoundary><EscrowConversionMonitor /></ErrorBoundary>
              )}
              {activeTab === 'aml-wallet' && (
                <ErrorBoundary><WalletProvenancePanel /></ErrorBoundary>
              )}
              {activeTab === 'banking' && (
                <ErrorBoundary><BankingDashboard /></ErrorBoundary>
              )}
              {activeTab === 'users' && (
                <ErrorBoundary><PDGUsers /></ErrorBoundary>
              )}
              {activeTab === 'security' && (
                <ErrorBoundary><SecurityOpsPanel /></ErrorBoundary>
              )}
              {activeTab === 'config' && (
                <ErrorBoundary><SystemConfiguration /></ErrorBoundary>
              )}
              {activeTab === 'products' && (
                <ErrorBoundary><PDGProductsManagement /></ErrorBoundary>
              )}
              {activeTab === 'maintenance' && (
                <ErrorBoundary><PDGSystemMaintenance /></ErrorBoundary>
              )}
              {activeTab === 'agents' && (
                <ErrorBoundary><PDGAgentsManagement /></ErrorBoundary>
              )}
              {activeTab === 'syndicat' && (
                <ErrorBoundary><PDGSyndicatManagement /></ErrorBoundary>
              )}
              {activeTab === 'reports' && (
                <ErrorBoundary><PDGReportsAnalytics /></ErrorBoundary>
              )}
              {activeTab === 'ai-assistant' && (
                <ErrorBoundary><PDGAIAssistant mfaVerified={mfaVerified} /></ErrorBoundary>
              )}
              {activeTab === 'copilot' && (
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">{t('pDG224Solutions.chargementDuCopilot')}</div>}>
                    <Copilot224 variant="embedded" service="pdg" title="Copilote PDG — supervision & auto-correction" height="calc(100vh - 160px)" />
                  </Suspense>
                </ErrorBoundary>
              )}
              {activeTab === 'communication' && (
                <ErrorBoundary><UniversalCommunicationHub /></ErrorBoundary>
              )}
              {activeTab === 'multi-cloud' && (
                <ErrorBoundary><MultiCloudDashboard /></ErrorBoundary>
              )}
              {activeTab === 'transfer-fees' && (
                <ErrorBoundary><TransferFeeSettings /></ErrorBoundary>
              )}
              {activeTab === 'kyc' && (
                <ErrorBoundary><PDGKYCManagement /></ErrorBoundary>
              )}
              {activeTab === 'orders' && (
                <ErrorBoundary><PDGOrders /></ErrorBoundary>
              )}
              {activeTab === 'vendors' && (
                <ErrorBoundary><PDGVendors /></ErrorBoundary>
              )}
              {activeTab === 'drivers' && (
                <ErrorBoundary><PDGDrivers /></ErrorBoundary>
              )}
              {activeTab === 'quotes-invoices' && (
                <ErrorBoundary><QuotesInvoicesPDG /></ErrorBoundary>
              )}
              {activeTab === 'bug-bounty' && (
                <ErrorBoundary><BugBountyDashboard /></ErrorBoundary>
              )}
              {activeTab === 'agent-wallet-audit' && (
                <ErrorBoundary><AgentWalletAudit /></ErrorBoundary>
              )}
              {activeTab === 'copilot-audit' && (
                <ErrorBoundary><CopilotAuditTrail /></ErrorBoundary>
              )}
              {activeTab === 'stolen-vehicles' && (
                <ErrorBoundary><PDGStolenVehiclesSupervision /></ErrorBoundary>
              )}
              {activeTab === 'driver-subscriptions' && (
                <ErrorBoundary><DriverSubscriptionManagement /></ErrorBoundary>
              )}
              {activeTab === 'service-subscriptions' && (
                <ErrorBoundary><PDGServiceSubscriptions /></ErrorBoundary>
              )}
              {activeTab === 'wallet-api' && (
                <ErrorBoundary><PDGWalletApiManagement /></ErrorBoundary>
              )}
              {activeTab === 'bureau-monitoring' && (
                <ErrorBoundary><PDGBureauMonitoring /></ErrorBoundary>
              )}
              {activeTab === 'vendor-certification' && (
                <ErrorBoundary><VendorCertificationManager /></ErrorBoundary>
              )}
              {activeTab === 'vendor-kyc-review' && (
                <ErrorBoundary><VendorKYCReview /></ErrorBoundary>
              )}
              {activeTab === 'id-normalization' && (
                <ErrorBoundary><IdNormalizationAudit /></ErrorBoundary>
              )}
              {activeTab === 'logic-surveillance' && (
                <ErrorBoundary><LogicSurveillanceDashboard /></ErrorBoundary>
              )}
              {activeTab === 'sync-dashboard' && (
                <ErrorBoundary><PDGSyncDashboard /></ErrorBoundary>
              )}
              {activeTab === 'broadcast-center' && (
                <ErrorBoundary><BroadcastMessageCenter /></ErrorBoundary>
              )}
              {activeTab === 'campaign-supervision' && (
                <ErrorBoundary><PDGCampaignSupervision /></ErrorBoundary>
              )}
              {activeTab === 'deleted-users-restore' && (
                <ErrorBoundary><DeletedUsersRestore /></ErrorBoundary>
              )}
              {activeTab === 'shareholders' && (
                <ErrorBoundary><PDGShareholderManagement /></ErrorBoundary>
              )}
              {activeTab === 'support-technique' && (
                <ErrorBoundary><PDGSupportTechnique /></ErrorBoundary>
              )}
              {activeTab === 'documentation' && (
                <ErrorBoundary><PdgDocumentation /></ErrorBoundary>
              )}
            </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* Email Update Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Modifier l'adresse email
            </DialogTitle>
            <DialogDescription>
              Entrez votre nouvelle adresse email. Un email de confirmation sera envoyé.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email actuel</label>
              <Input value={user?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nouvel email</label>
              <Input
                type="email"
                placeholder={t('pDG224Solutions.nouveauEmailCom')}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={updatingEmail}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowEmailDialog(false); setNewEmail(''); }}
              disabled={updatingEmail}
            >
              Annuler
            </Button>
            <Button onClick={handleUpdateEmail} disabled={updatingEmail || !newEmail}>
              {updatingEmail ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating communication widget */}
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}
