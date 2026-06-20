/**
 * 🏢 Dashboard de Gestion des Agents - Interface PDG
 * Composant ultra-professionnel pour la gestion complète des agents
 */

import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users, UserPlus, Settings, DollarSign, _TrendingUp,
  Eye, Edit, Trash2, Mail, Phone, Shield, Crown,
  BarChart3, PieChart, Activity, _Calendar, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Plus, Search,
  Filter, _Download, _Upload, _MoreVertical, _Star, _MessageSquare
} from "lucide-react";
import { useAgentManagement, _usePDGManagement, useCommissionManagement, useAgentSystemOverview } from "@/hooks/useAgentSystem";
import { toast } from "sonner";
import ProfessionalMessaging from "@/components/messaging/ProfessionalMessaging";

interface AgentManagementDashboardProps {
  pdgId: string;
}

export default function AgentManagementDashboard({ pdgId }: AgentManagementDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [_isSettingsOpen, _setIsSettingsOpen] = useState(false);

  // Hooks pour les données
  const { agents, loading: agentsLoading, createAgent, _updateAgent, deleteAgent } = useAgentManagement(pdgId);
  const { settings, updateSetting } = useCommissionManagement();
  const { overview, loading: overviewLoading } = useAgentSystemOverview(pdgId);

  // États pour les formulaires
  const [newAgent, setNewAgent] = useState({
    name: '',
    email: '',
    phone: '',
    can_create_sub_agent: false,
    permissions: ['create_users']
  });

  // Filtrer les agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" ||
                         (filterStatus === "active" && agent.is_active) ||
                         (filterStatus === "inactive" && !agent.is_active);
    return matchesSearch && matchesStatus;
  });

  // Gestionnaires d'événements
  const handleCreateAgent = async () => {
    try {
      if (!newAgent.name || !newAgent.email || !newAgent.phone) {
        toast.error(t('agentManagementDashboard.veuillezRemplirTousLesChamps'));
        return;
      }

      await createAgent(newAgent);
      setNewAgent({
        name: '',
        email: '',
        phone: '',
        can_create_sub_agent: false,
        permissions: ['create_users']
      });
      setIsCreateAgentOpen(false);
    } catch (error) {
      console.error('Erreur création agent:', error);
    }
  };

  const handleUpdateCommissionSetting = async (settingKey: string, value: number) => {
    try {
      await updateSetting(settingKey, value);
    } catch (error) {
      console.error('Erreur mise à jour paramètre:', error);
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-[#ff4000] hover:bg-[#ff4000]">
        <CheckCircle className="w-3 h-3 mr-1" />
        Actif
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Inactif
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (overviewLoading || agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('agentManagementDashboard.chargementDuSystemeDAgents')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents Totaux</p>
                <p className="text-2xl font-bold text-blue-600">{overview.totalAgents}</p>
                <p className="text-xs text-[#ff4000]">
                  {overview.activeAgents} actifs
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sous-Agents</p>
                <p className="text-2xl font-bold text-[#ff4000]">{overview.totalSubAgents}</p>
                <p className="text-xs text-muted-foreground">
                  Créés par agents
                </p>
              </div>
              <UserPlus className="w-8 h-8 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('agentManagementDashboard.utilisateursCrees')}</p>
                <p className="text-2xl font-bold text-[#04439e]">{overview.totalUsers}</p>
                <p className="text-xs text-muted-foreground">
                  Par le réseau
                </p>
              </div>
              <Activity className="w-8 h-8 text-[#04439e]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commissions Totales</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(overview.totalCommissions)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overview.averageCommissionRate}% taux moyen
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets principaux */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="settings">{t('agentManagementDashboard.parametres')}</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Dialog open={isCreateAgentOpen} onOpenChange={setIsCreateAgentOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary" />
                    Créer un Nouvel Agent
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nom complet *</Label>
                      <Input
                        id="name"
                        value={newAgent.name}
                        onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Jean Dupont"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newAgent.email}
                        onChange={(e) => setNewAgent(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="jean@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">{t('agentManagementDashboard.telephone')}</Label>
                    <Input
                      id="phone"
                      value={newAgent.phone}
                      onChange={(e) => setNewAgent(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+221 77 123 45 67"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can_create_sub_agent"
                      checked={newAgent.can_create_sub_agent}
                      onCheckedChange={(checked) =>
                        setNewAgent(prev => ({ ...prev, can_create_sub_agent: checked }))
                      }
                    />
                    <Label htmlFor="can_create_sub_agent">
                      Peut créer des sous-agents
                    </Label>
                  </div>
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      L'agent recevra un email d'invitation avec ses identifiants de connexion.
                    </AlertDescription>
                  </Alert>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateAgentOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreateAgent}>
                    Créer l'Agent
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Onglet Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Performance des Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agents.slice(0, 5).map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#04439e] rounded-full flex items-center justify-center text-white font-bold">
                          {agent.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {agent.total_users_created} utilisateurs
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#ff4000]">
                          {formatCurrency(agent.total_commissions_earned)}
                        </p>
                        <p className="text-sm text-muted-foreground">commissions</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Répartition des Activités
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Agents Actifs</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-full bg-[#ff4000] rounded-full"
                          style={{ width: `${(overview.activeAgents / overview.totalAgents) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {Math.round((overview.activeAgents / overview.totalAgents) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('agentManagementDashboard.avecSousAgents')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(agents.filter(a => a.can_create_sub_agent).length / overview.totalAgents) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {Math.round((agents.filter(a => a.can_create_sub_agent).length / overview.totalAgents) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('agentManagementDashboard.performanceElevee')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-full bg-[#04439e] rounded-full"
                          style={{ width: `${(agents.filter(a => a.total_commissions_earned > 100000).length / overview.totalAgents) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {Math.round((agents.filter(a => a.total_commissions_earned > 100000).length / overview.totalAgents) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Onglet Agents */}
        <TabsContent value="agents" className="space-y-4">
          {/* Filtres et recherche */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={t('agentManagementDashboard.rechercherUnAgent')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentManagementDashboard.tous')}</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
          </div>

          {/* Table des agents */}
          <Card>
            <CardHeader>
              <CardTitle>Liste des Agents ({filteredAgents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Utilisateurs</TableHead>
                    <TableHead>Commissions</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#04439e] rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {agent.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-sm text-muted-foreground">{agent.agent_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3" />
                            {agent.email}
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3" />
                            {agent.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(agent.is_active)}
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <p className="font-bold text-lg">{agent.total_users_created}</p>
                          <p className="text-xs text-muted-foreground">{t('agentManagementDashboard.crees')}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <p className="font-bold text-[#ff4000]">
                            {formatCurrency(agent.total_commissions_earned)}
                          </p>
                          <p className="text-xs text-muted-foreground">{t('agentManagementDashboard.gagnees')}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.can_create_sub_agent && (
                            <Badge variant="secondary" className="text-xs">
                              <UserPlus className="w-3 h-3 mr-1" />
                              Sous-agents
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            Utilisateurs
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAgent(agent.id)}
                          >
                            <Trash2 className="w-4 h-4 text-[#ff4000]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Commissions */}
        <TabsContent value="commissions" className="space-y-4">
          {/* Alerte informative */}
          <Alert className="border-blue-200 bg-blue-50">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              🎯 <strong>{t('agentManagementDashboard.impactDirectSurLesPaiements')}</strong> Les modifications de commission s'appliquent immédiatement aux prochains achats.
              Les agents reçoivent automatiquement leur commission dans leur wallet.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Paramètres de Commission Agent
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Configuration du taux de commission versé aux agents créateurs lors des achats de leurs clients
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings && settings.length > 0 ? (
                settings.map((setting: unknown) => (
                  <div key={setting.id || Math.random()} className="space-y-4">
                    <div className="flex items-center justify-between p-6 border rounded-lg bg-gradient-to-r from-blue-50 to-blue-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-lg">
                            {setting.setting_key === 'base_user_commission'
                              ? '💰 Commission Agent sur Achats'
                              : setting.description || 'Configuration'}
                          </h4>
                          {setting.setting_key === 'base_user_commission' && (
                            <Badge className="bg-[#ff4000]">Actif</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {setting.setting_key === 'base_user_commission'
                            ? 'Pourcentage du montant net vendeur versé à l\'agent créateur du client acheteur'
                            : `Clé: ${setting.setting_key || 'N/A'}`}
                        </p>

                        {/* Exemple de calcul */}
                        <div className="bg-white p-3 rounded border border-blue-200 text-sm">
                          <p className="font-medium text-blue-900 mb-1">{t('agentManagementDashboard.exempleDeCalcul')}</p>
                          <div className="space-y-1 text-xs">
                            <p>{t('agentManagementDashboard.clientAchete')} <strong>50,000 GNF</strong></p>
                            <p>{t('agentManagementDashboard.agentRecoit')} <strong>{Math.round(50000 * (setting.setting_value || 0))} GNF</strong> ({((setting.setting_value || 0) * 100).toFixed(1)}%)</p>
                            <p className="text-muted-foreground mt-2">{t('agentManagementDashboard.laCommissionEstCrediteeAutomatiquement')}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-6">
                        <div className="text-right">
                          <p className="text-3xl font-bold text-blue-600">
                            {((setting.setting_value || 0) * 100).toFixed(1)}
                          </p>
                          <p className="text-sm text-muted-foreground">{t('agentManagementDashboard.pourCent')}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Input
                            type="number"
                            value={((setting.setting_value || 0) * 100).toFixed(1)}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) / 100;
                              if (newValue >= 0 && newValue <= 0.5) {
                                handleUpdateCommissionSetting(setting.setting_key || '', newValue);
                              }
                            }}
                            className="w-24 text-right font-bold"
                            step="0.5"
                            min="0"
                            max="50"
                          />
                          <span className="text-xs text-center text-muted-foreground">0-50%</span>
                        </div>
                      </div>
                    </div>

                    {/* Statistiques d'impact */}
                    {setting.setting_key === 'base_user_commission' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Card className="border-orange-200">
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">Taux Actuel</p>
                            <p className="text-2xl font-bold text-[#ff4000]">
                              {((setting.setting_value || 0) * 100).toFixed(1)}%
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-blue-200">
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">{t('agentManagementDashboard.commissionSur100k')}</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {Math.round(100000 * (setting.setting_value || 0))} GNF
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-blue-200">
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">{t('agentManagementDashboard.commissionSur1m')}</p>
                            <p className="text-2xl font-bold text-[#04439e]">
                              {Math.round(1000000 * (setting.setting_value || 0)).toLocaleString()} GNF
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Aucun paramètre de commission trouvé. Vérifiez la configuration de la base de données.
                  </AlertDescription>
                </Alert>
              )}

              {/* Aide contextuelle */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                <h5 className="font-medium mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Comment ça fonctionne ?
                </h5>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>{t('agentManagementDashboard.unAgentCreeUnClient')}</li>
                  <li>{t('agentManagementDashboard.leClientEffectueUnAchat')}</li>
                  <li>{t('agentManagementDashboard.lAgentRecoitAutomatiquementSa')}</li>
                  <li>{t('agentManagementDashboard.laCommissionEstEnregistreeDans')}</li>
                  <li>{t('agentManagementDashboard.lesModificationsSAppliquentAux')} <strong>prochains achats uniquement</strong></li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Paramètres */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Paramètres Système
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Les paramètres système sont en cours de développement.
                  Contactez l'administrateur pour les modifications avancées.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication" className="space-y-6">
          <ProfessionalMessaging />
        </TabsContent>
      </Tabs>
    </div>
  );
}
