import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCheck, Search, Ban, Trash2, Plus, Mail, Edit, Users, TrendingUp, Activity, ExternalLink, Copy, Eye, UserCog, KeyRound, Settings, Shield, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AgentCommissionRatesCard from './AgentCommissionRatesCard';
import { usePDGAgentsData, type Agent } from '@/hooks/usePDGAgentsData';
import { usePDGActions } from '@/hooks/usePDGActions';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { AgentPermissionsSection } from './AgentPermissionsSection';
import { PERMISSION_CATEGORIES } from '@/constants/agentPermissionCategories';
import { DialogFooter } from '@/components/ui/dialog';

interface AgentUser {
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
  user_role: string;
}

interface SubAgent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  agent_code: string;
  commission_rate: number;
  is_active: boolean;
  permissions: string[];
  access_token?: string;
  total_users_created?: number;
  created_at: string;
}

const COUNTRY_OPTIONS = [
  { code: 'GN', name: 'Guinée', currency: 'GNF', flag: '🇬🇳' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', flag: '🇸🇳' },
  { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', flag: '🇨🇮' },
  { code: 'ML', name: 'Mali', currency: 'XOF', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', flag: '🇧🇫' },
  { code: 'NE', name: 'Niger', currency: 'XOF', flag: '🇳🇪' },
  { code: 'TG', name: 'Togo', currency: 'XOF', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin', currency: 'XOF', flag: '🇧🇯' },
  { code: 'CM', name: 'Cameroun', currency: 'XAF', flag: '🇨🇲' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo', currency: 'XAF', flag: '🇨🇬' },
  { code: 'TD', name: 'Tchad', currency: 'XAF', flag: '🇹🇩' },
  { code: 'CF', name: 'Centrafrique', currency: 'XAF', flag: '🇨🇫' },
  { code: 'GQ', name: 'Guinée Équatoriale', currency: 'XAF', flag: '🇬🇶' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLL', flag: '🇸🇱' },
  { code: 'NG', name: 'Nigéria', currency: 'NGN', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  { code: 'MA', name: 'Maroc', currency: 'MAD', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algérie', currency: 'DZD', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', currency: 'TND', flag: '🇹🇳' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', currency: 'EUR', flag: '🇧🇪' },
  { code: 'US', name: 'États-Unis', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', flag: '🇬🇧' },
  { code: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  { code: 'ZA', name: 'Afrique du Sud', currency: 'ZAR', flag: '🇿🇦' },
];

export default function PDGAgentsManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { agents, pdgProfile, loading, stats, refetch } = usePDGAgentsData();
  const {
    createAgent: createAgentAction,
    updateAgent: updateAgentAction,
    deleteAgent: deleteAgentAction,
    toggleAgentStatus
  } = usePDGActions({
    onAgentCreated: refetch,
    onAgentUpdated: refetch,
    onAgentDeleted: refetch,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [expandedSubAgents, setExpandedSubAgents] = useState<Set<string>>(new Set());
  const [agentUsersMap, setAgentUsersMap] = useState<Record<string, AgentUser[]>>({});
  const [agentSubAgentsMap, setAgentSubAgentsMap] = useState<Record<string, SubAgent[]>>({});
  const [loadingUsersMap, setLoadingUsersMap] = useState<Record<string, boolean>>({});
  const [loadingSubAgentsMap, setLoadingSubAgentsMap] = useState<Record<string, boolean>>({});
  const [resetPasswordAgent, setResetPasswordAgent] = useState<Agent | null>(null);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [advancedPermissions, setAdvancedPermissions] = useState<Record<string, boolean>>({});
  const [loadingAdvancedPermissions, setLoadingAdvancedPermissions] = useState(false);
  // Currency change state
  const [currencyDialog, setCurrencyDialog] = useState<{
    open: boolean; agent: Agent | null; selectedCountry: string; saving: boolean; error: string | null;
  }>({ open: false, agent: null, selectedCountry: '', saving: false, error: null });

  const handleAgentCurrencyChange = async () => {
    const { agent, selectedCountry } = currencyDialog;
    if (!agent || !selectedCountry) return;
    const country = COUNTRY_OPTIONS.find(c => c.code === selectedCountry);
    if (!country) return;
    setCurrencyDialog(d => ({ ...d, saving: true, error: null }));
    const result = await backendFetch<any>('/api/vendors/admin/change-currency', {
      method: 'POST',
      body: { vendor_id: agent.id, new_currency: country.currency, new_country_code: country.code, reason: 'Changement manuel PDG', entity_type: 'agent' },
    });
    setCurrencyDialog(d => ({ ...d, saving: false }));
    if (!result.success) { setCurrencyDialog(d => ({ ...d, error: result.error || 'Erreur inconnue' })); return; }
    const cr = result as any;
    if (!cr.changed) { toast.info(cr.message); setCurrencyDialog(d => ({ ...d, open: false })); return; }
    toast.success(`Devise agent changée : ${cr.old_currency} → ${cr.new_currency}`, { duration: 6000 });
    setCurrencyDialog(d => ({ ...d, open: false }));
    refetch();
  };

  // Email change state
  const [changeEmailAgent, setChangeEmailAgent] = useState<Agent | null>(null);
  const [isChangeEmailDialogOpen, setIsChangeEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    type_agent: 'principal',
    commission_rate: 10,
    country_code: 'GN',
    currency: 'GNF',
    permissions: {
      create_users: true,
      create_sub_agents: false,
      view_reports: true,
      manage_commissions: false,
      manage_users: false,
      manage_products: false
    }
  });

  const saveAdvancedPermissions = async (agentId: string, permissions: Record<string, boolean>) => {
    // N'enregistrer que les permissions actives (true)
    const activePermissions = Object.entries(permissions)
      .filter(([_, v]) => v === true)
      .reduce((acc, [k]) => ({ ...acc, [k]: true }), {} as Record<string, boolean>);

    // Toujours tenter le RPC set_agent_permissions (enregistre dans agent_permissions + sync legacy)
    try {
      const { data, error } = await supabase.rpc('set_agent_permissions' as any, {
        p_agent_id: agentId,
        p_permissions: activePermissions,
      });

      const result = data as { success: boolean; error?: string } | null;
      if (!error && result?.success) return; // succès — sortie rapide
      console.warn('⚠️ set_agent_permissions:', error || result?.error);
    } catch (err) {
      console.warn('⚠️ set_agent_permissions exception:', err);
    }

    // Fallback: upsert uniquement les permissions TRUE dans agent_permissions
    // (ne jamais écrire false — évite d'écraser le legacy avec des données périmées)
    if (Object.keys(activePermissions).length > 0) {
      try {
        const upserts = Object.keys(activePermissions).map(permission_key => ({
          agent_id: agentId,
          permission_key,
          permission_value: true,
          updated_at: new Date().toISOString(),
        }));
        await supabase
          .from('agent_permissions')
          .upsert(upserts, { onConflict: 'agent_id,permission_key' });
      } catch (err) {
        console.warn('⚠️ Fallback upsert agent_permissions:', err);
      }
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pdgProfile) {
      toast.error('PDG ID manquant');
      return;
    }

    if (!formData.name || !formData.email || !formData.phone) {
      toast.error(t('pDGAgentsManagement.veuillezRemplirTousLesChamps'));
      return;
    }

    if (!editingAgent && (!formData.password || formData.password.length < 8)) {
      toast.error(t('pDGAgentsManagement.leMotDePasseDoit'));
      return;
    }

    try {
      setIsSubmitting(true);

      const basePermissions = Object.entries(formData.permissions)
        .filter(([_, value]) => value)
        .map(([key]) => key);

      // Permissions avancées sélectionnées (stockées dans agent_permissions)
      const activeAdvancedPermissionKeys = Object.entries(advancedPermissions)
        .filter(([_, value]) => value === true)
        .map(([key]) => key);

      // Compatibilité + interface agent publique (token): on synchronise aussi dans agents_management.permissions
      const combinedLegacyPermissions = Array.from(
        new Set([...basePermissions, ...activeAdvancedPermissionKeys])
      );

      if (editingAgent) {
        // Mode édition
        // Si l'email a changé, on doit aussi synchroniser Supabase Auth
        const nextEmail = formData.email.trim().toLowerCase();
        const prevEmail = (editingAgent.email || '').trim().toLowerCase();

        if (nextEmail && nextEmail !== prevEmail) {
          if (!pdgProfile?.id) {
            throw new Error('PDG ID manquant');
          }

          const { data, error } = await supabase.functions.invoke('pdg-update-agent-email', {
            body: {
              agent_id: editingAgent.id,
              new_email: nextEmail,
              pdg_id: pdgProfile.id,
            },
          });

          if (error) throw error;
          if (!data?.success) {
            throw new Error(data?.error || "Erreur lors de la synchronisation de l'email");
          }
        }

        // Mettre à jour les autres champs (sans email pour éviter une désynchronisation)
        await updateAgentAction(editingAgent.id, {
          name: formData.name,
          phone: formData.phone,
          permissions: combinedLegacyPermissions,
          commission_rate: formData.commission_rate,
          can_create_sub_agent: formData.permissions.create_sub_agents,
        });

        // Sauvegarder les permissions avancées (même si vide, pour permettre la révocation complète)
        await saveAdvancedPermissions(editingAgent.id, advancedPermissions);
      } else {
        // Mode création
        const selectedCountry = COUNTRY_OPTIONS.find(c => c.code === formData.country_code);
        const createRes = await createAgentAction({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          type_agent: formData.type_agent,
          permissions: combinedLegacyPermissions,
          commission_rate: formData.commission_rate,
          can_create_sub_agent: formData.permissions.create_sub_agents,
          country_code: formData.country_code,
          country_name: selectedCountry?.name || 'Guinée',
          currency: formData.currency,
        }, pdgProfile.id);

        if (!createRes?.success) {
          // L'erreur est déjà affichée en toast par usePDGActions, on garde le dialog ouvert
          return;
        }

        // Après création, appliquer aussi les permissions avancées en base (agent_permissions)
        if (createRes.agent?.id) {
          await saveAdvancedPermissions(createRes.agent.id, advancedPermissions);
        }
      }

      // Réinitialiser le formulaire
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        type_agent: 'principal',
        commission_rate: 10,
        country_code: 'GN',
        currency: 'GNF',
        permissions: {
          create_users: true,
          create_sub_agents: false,
          view_reports: true,
          manage_commissions: false,
          manage_users: false,
          manage_products: false
        }
      });

      setAdvancedPermissions({});

      setEditingAgent(null);
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Erreur gestion agent:', error);
      toast.error(error.message || 'Une erreur inattendue est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAgent = async (agent: Agent) => {
    setEditingAgent(agent);

    // Robust: certaines anciennes données stockent "create_sub_agents" uniquement dans le tableau permissions
    const canCreateSubAgents = Boolean(agent.can_create_sub_agent) || agent.permissions.includes('create_sub_agents');

    setFormData({
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      password: '',
      type_agent: agent.type_agent || 'principal',
      commission_rate: agent.commission_rate,
      country_code: agent.country_code || 'GN',
      currency: agent.currency || 'GNF',
      permissions: {
        create_users: agent.permissions.includes('create_users'),
        create_sub_agents: canCreateSubAgents,
        view_reports: agent.permissions.includes('view_reports'),
        manage_commissions: agent.permissions.includes('manage_commissions'),
        manage_users: agent.permissions.includes('manage_users'),
        manage_products: agent.permissions.includes('manage_products')
      }
    });

    // Charger les permissions avancées
    setLoadingAdvancedPermissions(true);
    try {
      // Base: toutes les permissions à false
      const allPermsBase: Record<string, boolean> = {};
      PERMISSION_CATEGORIES.forEach(cat =>
        cat.permissions.forEach(key => { allPermsBase[key] = false; })
      );

      // Étape 1: lire la colonne legacy agents_management.permissions (source fiable)
      // Cette colonne est mise à jour par update_agent RPC à chaque sauvegarde
      const legacyFromAgent: Record<string, boolean> = {};
      (agent.permissions || []).forEach(key => { legacyFromAgent[key] = true; });

      // Étape 2: lire depuis get_agent_permissions RPC (agent_permissions table)
      const fromRpc: Record<string, boolean> = {};
      try {
        const { data, error } = await supabase
          .rpc('get_agent_permissions' as any, { p_agent_id: agent.id });
        if (!error && data) {
          // OR logic: n'utiliser que les "true" du RPC, ne pas laisser "false" écraser le legacy
          Object.entries(data as Record<string, boolean>).forEach(([k, v]) => {
            if (v === true) fromRpc[k] = true;
          });
        }
      } catch (_e) {
        // RPC échoué — le legacy suffit
      }

      // Fusion: legacy en base, puis RPC pour les nouvelles permissions
      // Un "true" dans l'une OU l'autre source = permission accordée
      setAdvancedPermissions({ ...allPermsBase, ...legacyFromAgent, ...fromRpc });
    } catch (error) {
      console.error('Erreur chargement permissions avancées:', error);
      // En cas d'erreur totale: utiliser au moins le legacy
      const fallback: Record<string, boolean> = {};
      PERMISSION_CATEGORIES.forEach(cat =>
        cat.permissions.forEach(key => { fallback[key] = false; })
      );
      (agent.permissions || []).forEach(key => { fallback[key] = true; });
      setAdvancedPermissions(fallback);
    } finally {
      setLoadingAdvancedPermissions(false);
    }

    setIsDialogOpen(true);
  };

  const handleAdvancedPermissionChange = (key: string, value: boolean) => {
    setAdvancedPermissions(prev => ({
      ...prev,
      [key]: value
    }));
  };


  const handleResetPassword = (agent: Agent) => {
    setResetPasswordAgent(agent);
    setNewPassword('');
    setIsResetPasswordDialogOpen(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPasswordAgent || !newPassword) return;

    if (newPassword.length < 8) {
      toast.error(t('pDGAgentsManagement.leMotDePasseDoit'));
      return;
    }

    try {
      setIsResettingPassword(true);

      const { backendFetch } = await import('@/services/backendApi');
      const data = await backendFetch<any>('/api/agents/reset-password', {
        body: {
          agent_id: resetPasswordAgent.id,
          new_password: newPassword
        }
      });

      if (data?.success) {
        toast.success(`Mot de passe de ${resetPasswordAgent.name} réinitialisé avec succès`);
        setIsResetPasswordDialogOpen(false);
        setResetPasswordAgent(null);
        setNewPassword('');
      } else {
        throw new Error(data?.error || 'Erreur inconnue');
      }
    } catch (error: any) {
      console.error('Erreur réinitialisation mot de passe:', error);
      toast.error(error.message || 'Erreur lors de la réinitialisation');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleChangeEmail = (agent: Agent) => {
    setChangeEmailAgent(agent);
    setNewEmail('');
    setEmailPassword('');
    setIsChangeEmailDialogOpen(true);
  };

  const handleConfirmChangeEmail = async () => {
    if (!changeEmailAgent || !newEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nextEmail = newEmail.trim().toLowerCase();

    if (!emailRegex.test(nextEmail)) {
      toast.error("Format d'email invalide");
      return;
    }

    if (!pdgProfile?.id) {
      toast.error('PDG ID manquant');
      return;
    }

    try {
      setIsChangingEmail(true);

      const { backendFetch } = await import('@/services/backendApi');
      const data = await backendFetch<any>('/api/agents/pdg-update-email', {
        body: {
          agent_id: changeEmailAgent.id,
          new_email: nextEmail,
        },
      });

      if (data?.success) {
        toast.success(`Email de ${changeEmailAgent.name} modifié et synchronisé`);
        setIsChangeEmailDialogOpen(false);
        setChangeEmailAgent(null);
        setNewEmail('');
        setEmailPassword('');
        refetch();
      } else {
        throw new Error(data?.error || 'Erreur inconnue');
      }
    } catch (error: any) {
      console.error('Erreur changement email:', error);
      toast.error(error.message || "Erreur lors du changement d'email");
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleAgentAction = async (agentId: string, action: 'activate' | 'suspend' | 'delete') => {
    try {
      let confirmMessage = '';
      let _actionName = '';

      switch (action) {
        case 'activate':
          confirmMessage = 'Êtes-vous sûr de vouloir activer cet agent ?';
          _actionName = 'Activation';
          break;
        case 'suspend':
          confirmMessage = 'Êtes-vous sûr de vouloir suspendre cet agent ?';
          _actionName = 'Suspension';
          break;
        case 'delete':
          confirmMessage = 'Êtes-vous sûr de vouloir supprimer cet agent ? Cette action est irréversible.';
          _actionName = 'Suppression';
          break;
      }

      if (!confirm(confirmMessage)) {
        return;
      }

      switch (action) {
        case 'activate':
          await toggleAgentStatus(agentId, true);
          break;
        case 'suspend':
          await toggleAgentStatus(agentId, false);
          break;
        case 'delete':
          await deleteAgentAction(agentId);
          break;
      }
    } catch (error: any) {
      console.error(`Erreur lors de l'action:`, error);
    }
  };

  const handleToggleAgentUsers = async (agent: Agent) => {
    const isExpanded = expandedAgents.has(agent.id);

    if (isExpanded) {
      // Réduire
      const newExpanded = new Set(expandedAgents);
      newExpanded.delete(agent.id);
      setExpandedAgents(newExpanded);
    } else {
      // Étendre et charger les utilisateurs si pas déjà chargés
      const newExpanded = new Set(expandedAgents);
      newExpanded.add(agent.id);
      setExpandedAgents(newExpanded);

      if (!agentUsersMap[agent.id]) {
        setLoadingUsersMap({ ...loadingUsersMap, [agent.id]: true });

        try {
          const { backendFetch } = await import('@/services/backendApi');
          const resp = await backendFetch<any>('/api/agents/users/list', {
            method: 'POST', body: { agent_access_token: agent.access_token }
          });

          if (!resp.success) throw new Error(resp.error || 'Erreur');

          if (resp.data?.users) {
            setAgentUsersMap({ ...agentUsersMap, [agent.id]: resp.data.users });
          }
        } catch (error: any) {
          console.error('Erreur chargement utilisateurs:', error);
          toast.error(t('pDGAgentsManagement.erreurLorsDuChargementDes'));
        } finally {
          setLoadingUsersMap({ ...loadingUsersMap, [agent.id]: false });
        }
      }
    }
  };

  const handleToggleSubAgents = async (agent: Agent) => {
    const isExpanded = expandedSubAgents.has(agent.id);

    if (isExpanded) {
      // Réduire
      const newExpanded = new Set(expandedSubAgents);
      newExpanded.delete(agent.id);
      setExpandedSubAgents(newExpanded);
    } else {
      // Étendre et charger les sous-agents si pas déjà chargés
      const newExpanded = new Set(expandedSubAgents);
      newExpanded.add(agent.id);
      setExpandedSubAgents(newExpanded);

      if (!agentSubAgentsMap[agent.id]) {
        setLoadingSubAgentsMap({ ...loadingSubAgentsMap, [agent.id]: true });

        try {
          const { data, error } = await supabase
            .from('agents_management')
            .select('*')
            .eq('parent_agent_id', agent.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          // Compter les utilisateurs créés par chaque sous-agent
          const subAgentsWithCounts = await Promise.all(
            (data || []).map(async (subAgent) => {
              const { count } = await supabase
                .from('agent_created_users')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', subAgent.id);

              return {
                ...subAgent,
                total_users_created: count || 0
              } as SubAgent;
            })
          );

          setAgentSubAgentsMap({ ...agentSubAgentsMap, [agent.id]: subAgentsWithCounts });
        } catch (error: any) {
          console.error('Erreur chargement sous-agents:', error);
          toast.error(t('pDGAgentsManagement.erreurLorsDuChargementDes2'));
        } finally {
          setLoadingSubAgentsMap({ ...loadingSubAgentsMap, [agent.id]: false });
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('pDGAgentsManagement.chargementDesAgents')}</p>
        </div>
      </div>
    );
  }

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Réglage global des taux de commission agent (% des frais de transaction) */}
      <AgentCommissionRatesCard />

      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pDGAgentsManagement.gestionDesAgents')}</h2>
          <p className="text-muted-foreground mt-1">
            Gérez votre réseau d'agents - {pdgProfile?.name || 'PDG'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingAgent(null);
              setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                type_agent: 'principal',
                commission_rate: 10,
                country_code: 'GN',
                currency: 'GNF',
                permissions: {
                  create_users: true,
                  create_sub_agents: false,
                  view_reports: true,
                  manage_commissions: false,
                  manage_users: false,
                  manage_products: false
                }
              });
              // Initialiser toutes les permissions à false pour la création
              const allPerms: Record<string, boolean> = {};
              PERMISSION_CATEGORIES.forEach(cat =>
                cat.permissions.forEach(key => { allPerms[key] = false; })
              );
              setAdvancedPermissions(allPerms);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {editingAgent ? 'Modifier l\'Agent & Permissions' : 'Créer un Nouvel Agent'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateAgent}>
              {editingAgent ? (
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="general">
                      <Settings className="w-4 h-4 mr-2" />
                      Informations
                    </TabsTrigger>
                    <TabsTrigger value="permissions">
                      <Shield className="w-4 h-4 mr-2" />
                      Permissions Avancées
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="mt-4">
                    <ScrollArea className="max-h-[50vh] pr-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
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
                            <Label htmlFor="phone">{t('pDGAgentsManagement.telephone')}</Label>
                            <Input
                              id="phone"
                              required
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              placeholder="Ex: 622123456"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="Ex: agent@224solutions.com"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Type d'agent</Label>
                            <Select
                              value={formData.type_agent}
                              onValueChange={(value) => setFormData({ ...formData, type_agent: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('pDGAgentsManagement.selectionnerUnType')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="principal">Agent Principal</SelectItem>
                                <SelectItem value="agent_regional">{t('pDGAgentsManagement.agentRegional')}</SelectItem>
                                <SelectItem value="agent_local">Agent Local</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="commission">Taux commission lien d'affiliation (%)</Label>
                            <Input
                              id="commission"
                              type="number"
                              min="0"
                              max="100"
                              value={formData.commission_rate}
                              onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="space-y-3 border-t pt-4">
                          <Label>{t('pDGAgentsManagement.permissionsDeBase')}</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="create_users"
                                checked={formData.permissions.create_users}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, create_users: checked === true },
                                  }))
                                }
                              />
                              <label htmlFor="create_users" className="text-sm">{t('pDGAgentsManagement.creerDesUtilisateurs')}</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="create_sub_agents"
                                checked={formData.permissions.create_sub_agents}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, create_sub_agents: checked === true },
                                  }))
                                }
                              />
                              <label htmlFor="create_sub_agents" className="text-sm">{t('pDGAgentsManagement.creerDesSousAgents')}</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="view_reports"
                                checked={formData.permissions.view_reports}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, view_reports: checked === true },
                                  }))
                                }
                              />
                              <label htmlFor="view_reports" className="text-sm">{t('pDGAgentsManagement.voirLesRapports')}</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="manage_commissions"
                                checked={formData.permissions.manage_commissions}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, manage_commissions: checked === true },
                                  }))
                                }
                              />
                              <label htmlFor="manage_commissions" className="text-sm">{t('pDGAgentsManagement.gererLesCommissions')}</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="manage_users"
                                checked={formData.permissions.manage_users}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, manage_users: checked === true },
                                  }))
                                }
                              />
                              <label htmlFor="manage_users" className="text-sm">{t('pDGAgentsManagement.gererLesUtilisateurs')}</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="manage_products"
                                checked={formData.permissions.manage_products}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, manage_products: checked === true },
                                  }))
                                }
                              />
                              <label htmlFor="manage_products" className="text-sm">{t('pDGAgentsManagement.gererLesProduits')}</label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="permissions" className="mt-4">
                    <AgentPermissionsSection
                      permissions={advancedPermissions}
                      onPermissionChange={handleAdvancedPermissionChange}
                      loading={loadingAdvancedPermissions}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <ScrollArea className="max-h-[60vh] pr-4 mt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                        <Label htmlFor="phone">{t('pDGAgentsManagement.telephone')}</Label>
                        <Input
                          id="phone"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="Ex: 622123456"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Ex: agent@224solutions.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">{t('pDGAgentsManagement.motDePasseMin8')}</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        <Globe className="inline w-3.5 h-3.5 mr-1" />
                        Pays de l'agent *
                      </Label>
                      <Select
                        value={formData.country_code}
                        onValueChange={(code) => {
                          const country = COUNTRY_OPTIONS.find(c => c.code === code);
                          setFormData({ ...formData, country_code: code, currency: country?.currency || 'GNF' });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('pDGAgentsManagement.selectionnerUnPays')} />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.flag} {c.name} — {c.currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.currency && (
                        <p className="text-xs text-muted-foreground">
                          Devise du wallet : <span className="font-semibold text-foreground">{formData.currency}</span>
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Type d'agent</Label>
                        <Select
                          value={formData.type_agent}
                          onValueChange={(value) => setFormData({ ...formData, type_agent: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('pDGAgentsManagement.selectionnerUnType')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="principal">Agent Principal</SelectItem>
                            <SelectItem value="agent_regional">{t('pDGAgentsManagement.agentRegional')}</SelectItem>
                            <SelectItem value="agent_local">Agent Local</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="commission">Taux commission lien d'affiliation (%)</Label>
                        <Input
                          id="commission"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.commission_rate}
                          onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      <Label>{t('pDGAgentsManagement.permissionsDeBase')}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="create_users_new"
                            checked={formData.permissions.create_users}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                permissions: { ...prev.permissions, create_users: checked === true },
                              }))
                            }
                          />
                          <label htmlFor="create_users_new" className="text-sm">{t('pDGAgentsManagement.creerDesUtilisateurs')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="create_sub_agents_new"
                            checked={formData.permissions.create_sub_agents}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                permissions: { ...prev.permissions, create_sub_agents: checked === true },
                              }))
                            }
                          />
                          <label htmlFor="create_sub_agents_new" className="text-sm">{t('pDGAgentsManagement.creerDesSousAgents')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="view_reports_new"
                            checked={formData.permissions.view_reports}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                permissions: { ...prev.permissions, view_reports: checked === true },
                              }))
                            }
                          />
                          <label htmlFor="view_reports_new" className="text-sm">{t('pDGAgentsManagement.voirLesRapports')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="manage_commissions_new"
                            checked={formData.permissions.manage_commissions}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                permissions: { ...prev.permissions, manage_commissions: checked === true },
                              }))
                            }
                          />
                          <label htmlFor="manage_commissions_new" className="text-sm">{t('pDGAgentsManagement.gererLesCommissions')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="manage_users_new"
                            checked={formData.permissions.manage_users}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                permissions: { ...prev.permissions, manage_users: checked === true },
                              }))
                            }
                          />
                          <label htmlFor="manage_users_new" className="text-sm">{t('pDGAgentsManagement.gererLesUtilisateurs')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="manage_products_new"
                            checked={formData.permissions.manage_products}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                permissions: { ...prev.permissions, manage_products: checked === true },
                              }))
                            }
                          />
                          <label htmlFor="manage_products_new" className="text-sm">{t('pDGAgentsManagement.gererLesProduits')}</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
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
                      {editingAgent ? 'Modification...' : 'Création...'}
                    </>
                  ) : editingAgent ? (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Enregistrer les modifications
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Créer l'Agent
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
              Total Agents
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAgents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeAgents} actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agents Actifs
            </CardTitle>
            <UserCheck className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">{stats.activeAgents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.inactiveAgents} inactifs
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commissions Totales
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fc(stats.totalCommissionsEarned)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gagnées à ce jour
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('pDGAgentsManagement.rechercherUnAgentParNom')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Liste des agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAgents.map((agent) => (
          <Card key={agent.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                      {agent.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{agent.email}</p>
                  <p className="text-sm text-muted-foreground">{agent.phone}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Code Agent:</span>
                  <span className="font-mono font-medium">{agent.agent_code}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Commission:</span>
                  <span className="font-medium">{agent.commission_rate}%</span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleAgentUsers(agent)}
                    className="w-full justify-between"
                  >
                    <span className="text-sm font-medium">Utilisateurs créés: {agentUsersMap[agent.id]?.length ?? agent.total_users_created ?? 0}</span>
                    <Eye className={`w-4 h-4 transition-transform ${expandedAgents.has(agent.id) ? 'rotate-180' : ''}`} />
                  </Button>

                  {expandedAgents.has(agent.id) && (
                    <div className="mt-3 space-y-2">
                      {loadingUsersMap[agent.id] ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                      ) : agentUsersMap[agent.id]?.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {agentUsersMap[agent.id].map((user) => (
                            <div
                              key={user.id}
                              className="p-3 bg-muted/50 rounded-lg border text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.email}
                                </span>
                                <Badge variant={user.is_active !== false ? 'default' : 'secondary'} className="text-xs">
                                  {user.is_active !== false ? 'Actif' : 'Inactif'}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground">
                                <div>📧 {user.email}</div>
                                {user.phone && <div>📱 {user.phone}</div>}
                                {(user.city || user.country) && (
                                  <div>📍 {[user.city, user.country].filter(Boolean).join(', ')}</div>
                                )}
                                <div className="flex items-center justify-between mt-1">
                                  <span>Rôle: {user.user_role || user.role}</span>
                                  <span>{new Date(user.created_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          Aucun utilisateur créé
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section Sous-Agents */}
                {(agent.can_create_sub_agent || agent.permissions.includes('create_sub_agents')) && (
                  <div className="border-t pt-3 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleSubAgents(agent)}
                      className="w-full justify-between"
                    >
                      <span className="text-sm font-medium">
                        Sous-agents créés: {agentSubAgentsMap[agent.id]?.length ?? 0}
                      </span>
                      <Eye className={`w-4 h-4 transition-transform ${expandedSubAgents.has(agent.id) ? 'rotate-180' : ''}`} />
                    </Button>

                    {expandedSubAgents.has(agent.id) && (
                      <div className="mt-3 space-y-2">
                        {loadingSubAgentsMap[agent.id] ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                          </div>
                        ) : agentSubAgentsMap[agent.id]?.length > 0 ? (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {agentSubAgentsMap[agent.id].map((subAgent) => (
                              <div
                                key={subAgent.id}
                                className="p-3 bg-blue-50 dark:bg-[#04439e]/20 rounded-lg border border-blue-200 dark:border-[#04439e] text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium flex items-center gap-2">
                                    <UserCog className="w-3.5 h-3.5 text-[#04439e]" />
                                    {subAgent.name}
                                  </span>
                                  <Badge variant={subAgent.is_active ? 'default' : 'secondary'} className="text-xs">
                                    {subAgent.is_active ? 'Actif' : 'Inactif'}
                                  </Badge>
                                </div>
                                <div className="text-muted-foreground">
                                  <div>📧 {subAgent.email}</div>
                                  {subAgent.phone && <div>📱 {subAgent.phone}</div>}
                                  <div className="flex items-center justify-between mt-1">
                                    <span>Code: {subAgent.agent_code}</span>
                                    <span>Commission: {subAgent.commission_rate}%</span>
                                  </div>
                                  <div className="flex items-center justify-between mt-1">
                                    <span>Utilisateurs: {subAgent.total_users_created || 0}</span>
                                    <span>{new Date(subAgent.created_at).toLocaleDateString('fr-FR')}</span>
                                  </div>
                                </div>
                                {subAgent.permissions && subAgent.permissions.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {subAgent.permissions.map((perm) => (
                                      <Badge key={perm} variant="outline" className="text-xs">
                                        {perm.replace(/_/g, ' ')}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {subAgent.access_token && (
                                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-mono text-blue-600 truncate flex-1">
                                        {window.location.origin}/agent/{subAgent.access_token}
                                      </p>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => {
                                          navigator.clipboard.writeText(`${window.location.origin}/agent/${subAgent.access_token}`);
                                          toast.success(t('pDGAgentsManagement.lienCopie'));
                                        }}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            Aucun sous-agent créé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm pb-3">
                  <span className="text-muted-foreground">{t('pDGAgentsManagement.commissionsGagnees')}</span>
                  <span className="font-medium">{fc(agent.total_commissions_earned || 0)}</span>
                </div>

                {/* Lien d'accès à l'interface Agent */}
                {agent.access_token && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                          <span className="text-blue-600">🔗</span> Lien d'accès à l'interface
                        </p>
                        <p className="text-xs font-mono text-blue-600 bg-white dark:bg-gray-900 p-2 rounded border truncate">
                          {window.location.origin}/agent/{agent.access_token}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/agent/${agent.access_token}`);
                            toast.success(t('pDGAgentsManagement.lienCopie'));
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => window.open(`/agent/${agent.access_token}`, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          Ouvrir
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 flex flex-wrap gap-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditAgent(agent)}
                    className="flex-1"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Modifier & Permissions
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResetPassword(agent)}
                    className="flex-1"
                  >
                    <KeyRound className="w-4 h-4 mr-1" />
                    Mot de passe
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleChangeEmail(agent)}
                    className="flex-1"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrencyDialog({ open: true, agent, selectedCountry: '', saving: false, error: null })}
                    className="flex-1"
                  >
                    <Globe className="w-4 h-4 mr-1" />
                    Devise
                  </Button>
                  {agent.is_active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAgentAction(agent.id, 'suspend')}
                      className="flex-1"
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Suspendre
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAgentAction(agent.id, 'activate')}
                      className="flex-1"
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Activer
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAgentAction(agent.id, 'delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'Aucun agent trouvé' : 'Aucun agent pour le moment'}
            </p>
          </CardContent>
        </Card>
      )}


      {/* Dialog changement de devise agent */}
      <Dialog open={currencyDialog.open} onOpenChange={open => setCurrencyDialog(d => ({ ...d, open }))}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Changer la devise — Agent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Agent : <strong>{currencyDialog.agent?.name}</strong></p>
            <div className="space-y-2">
              <Label>{t('pDGAgentsManagement.paysDeResidence')}</Label>
              <Select value={currencyDialog.selectedCountry} onValueChange={v => setCurrencyDialog(d => ({ ...d, selectedCountry: v, error: null }))}>
                <SelectTrigger><SelectValue placeholder={t('pDGAgentsManagement.selectionnerUnPays')} /></SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} — {c.currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currencyDialog.error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{currencyDialog.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrencyDialog(d => ({ ...d, open: false }))}>{t('pDGAgentsManagement.annuler')}</Button>
            <Button onClick={handleAgentCurrencyChange} disabled={!currencyDialog.selectedCountry || currencyDialog.saving}>
              {currencyDialog.saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />En cours...</> : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de réinitialisation du mot de passe */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pDGAgentsManagement.reinitialiserLeMotDePasse')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Définir un nouveau mot de passe pour <strong>{resetPasswordAgent?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="new_password">{t('pDGAgentsManagement.nouveauMotDePasse')}</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ex: Agent123!"
              />
              <p className="text-xs text-muted-foreground">
                Min. 8 caractères avec: minuscules, MAJUSCULES, chiffres et caractères spéciaux (!@#$%...)
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsResetPasswordDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirmResetPassword}
                disabled={isResettingPassword || newPassword.length < 8}
              >
                {isResettingPassword ? 'Réinitialisation...' : 'Réinitialiser'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogue de changement d'email */}
      <Dialog open={isChangeEmailDialogOpen} onOpenChange={setIsChangeEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pDGAgentsManagement.changerLEmailDeL')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Changer l'email de <strong>{changeEmailAgent?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="current_email">Email actuel</Label>
              <Input
                id="current_email"
                type="email"
                value={changeEmailAgent?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_email">Nouvel email</Label>
              <Input
                id="new_email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t('pDGAgentsManagement.nouveauEmailCom')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_password">{t('pDGAgentsManagement.motDePasseDeL')}</Label>
              <Input
                id="email_password"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsChangeEmailDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirmChangeEmail}
                disabled={isChangingEmail || !newEmail}
              >
                {isChangingEmail ? 'Modification...' : 'Modifier'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
