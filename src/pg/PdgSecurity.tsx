import { useState } from 'react';
import { Shield, AlertTriangle, Lock, Activity, Eye, Ban, FileText, Key, Bug, Brain, Database, Award } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveGrid } from '@/components/responsive/ResponsiveContainer';
import { SecurityCertifications } from '@/components/security/SecurityCertifications';
import { BugBountyProgram } from '@/components/security/BugBountyProgram';
import { AdminMfaCard } from '@/components/security/AdminMfaCard';
import Guard224Dashboard from '@/components/pdg/guard224/Guard224Dashboard';
import { MLFraudDetection } from '@/components/security/MLFraudDetection';
import { SIEMDashboard } from '@/components/security/SIEMDashboard';
import CommunicationWidget from '@/components/communication/CommunicationWidget';
import { useSecurityOps } from '@/hooks/useSecurityOps';

export default function PdgSecurity() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [selectedTab, setSelectedTab] = useState('overview');

  // Données RÉELLES de sécurité (incidents, alertes, IPs bloquées) — plus de valeurs codées en dur.
  const { stats, incidents, alerts, blockedIPs, loading: secLoading } = useSecurityOps(true);
  // Incidents ouverts + alertes en attente = problèmes actifs (critical ⊂ open → pas de double comptage).
  const activeIssues = (stats.open_incidents || 0) + (stats.pending_alerts || 0);
  const allClear = !secLoading && activeIssues === 0;

  // Badge couleur selon la sévérité (réutilisé dans les listes ci-dessous).
  const severityClass = (sev?: string) => {
    switch ((sev || '').toLowerCase()) {
      case 'critical': return 'bg-red-600/15 text-red-700 border-red-600/30';
      case 'high':     return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'medium':   return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      default:         return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    }
  };
  const fmtDateTime = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };
  const activeBlockedIPs = (blockedIPs || []).filter((b) => b.is_active);
  const openIncidents = (incidents || []).filter((i) => i.status !== 'resolved' && i.status !== 'closed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-8 h-8 text-[#ff4000]" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#ff4000] to-[#ff4000] bg-clip-text text-transparent">
                Défense & Riposte - Sécurité
              </h1>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="w-3 h-3 text-[#ff4000]" />
              Centre de sécurité et de surveillance de la plateforme
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/pdg')}
            className="gap-2"
          >
            Retour au PDG
          </Button>
        </div>

        {/* Security Status Alert — calculé sur les vraies données */}
        <Alert className={allClear ? 'border-[#ff4000]/50 bg-[#ff4000]/10' : 'border-red-500/60 bg-red-500/10'}>
          {allClear ? (
            <Activity className="h-4 w-4 text-[#ff4000]" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={allClear ? 'text-[#ff4000]' : 'text-red-600 font-medium'}>
            {secLoading
              ? 'Vérification des systèmes de sécurité…'
              : allClear
                ? 'Tous les systèmes de sécurité sont opérationnels'
                : `${activeIssues} problème(s) de sécurité actif(s) — ${stats.open_incidents || 0} incident(s) ouvert(s), ${stats.pending_alerts || 0} alerte(s) en attente${(stats.critical_incidents || 0) > 0 ? `, dont ${stats.critical_incidents} critique(s)` : ''}`}
          </AlertDescription>
        </Alert>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4 lg:grid-cols-10'} gap-1`}>
            <TabsTrigger value="overview" className="gap-1 text-xs md:text-sm">
              <Shield className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'Vue'}
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-1 text-xs md:text-sm">
              <Award className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'Certif'}
            </TabsTrigger>
            <TabsTrigger value="bugbounty" className="gap-1 text-xs md:text-sm">
              <Bug className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'Bounty'}
            </TabsTrigger>
            <TabsTrigger value="mfa" className="gap-1 text-xs md:text-sm">
              <Key className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'MFA'}
            </TabsTrigger>
            <TabsTrigger value="fraud" className="gap-1 text-xs md:text-sm">
              <Brain className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'Fraude ML'}
            </TabsTrigger>
            <TabsTrigger value="siem" className="gap-1 text-xs md:text-sm">
              <Database className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'SIEM'}
            </TabsTrigger>
            <TabsTrigger value="threats" className="gap-1 text-xs md:text-sm">
              <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'Menaces'}
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-1 text-xs md:text-sm">
              <Eye className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'Surveil'}
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-1 text-xs md:text-sm">
              <Ban className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && 'Bloqués'}
            </TabsTrigger>
            <TabsTrigger value="guard224" className="gap-1 text-xs md:text-sm">
              <Shield className="w-3 h-3 md:w-4 md:h-4" />
              {!isMobile && '224Guard'}
            </TabsTrigger>
          </TabsList>

          {/* 224Guard — monitoring d'exposition des secrets (temps réel) */}
          <TabsContent value="guard224" className="space-y-4">
            <Guard224Dashboard />
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="md">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Menaces Détectées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{stats.open_incidents || 0}</span>
                    <Badge variant="outline" className={(stats.open_incidents || 0) > 0
                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                      : 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20'}>
                      {(stats.open_incidents || 0) > 0 ? 'Alerte' : 'Sécurisé'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    IPs Bloquées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{stats.active_blocks || 0}</span>
                    <Ban className="w-5 h-5 text-[#ff4000]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Alertes Actives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{stats.pending_alerts || 0}</span>
                    <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Rapports Forensiques
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{stats.total_incidents || 0}</span>
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
            </ResponsiveGrid>

            <Card>
              <CardHeader>
                <CardTitle>{t('pdgSecurity.systemesDeProtection')}</CardTitle>
                <CardDescription>
                  État des différents systèmes de sécurité
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-[#ff4000]" />
                    <div>
                      <p className="font-medium">{t('pdgSecurity.detectionDAnomaliesIa')}</p>
                      <p className="text-sm text-muted-foreground">{t('pdgSecurity.surveillanceEnTempsReel')}</p>
                    </div>
                  </div>
                  <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">
                    Actif
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-[#ff4000]" />
                    <div>
                      <p className="font-medium">RLS (Row Level Security)</p>
                      <p className="text-sm text-muted-foreground">{t('pdgSecurity.protectionDesDonnees')}</p>
                    </div>
                  </div>
                  <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">
                    Actif
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Ban className="w-5 h-5 text-[#ff4000]" />
                    <div>
                      <p className="font-medium">Blocage automatique</p>
                      <p className="text-sm text-muted-foreground">IPs malveillantes</p>
                    </div>
                  </div>
                  <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">
                    Actif
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#ff4000]" />
                    <div>
                      <p className="font-medium">Analyse forensique</p>
                      <p className="text-sm text-muted-foreground">Investigation automatique</p>
                    </div>
                  </div>
                  <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">
                    Actif
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certifications Tab */}
          <TabsContent value="certifications" className="space-y-4">
            <SecurityCertifications />
          </TabsContent>

          {/* Bug Bounty Tab */}
          <TabsContent value="bugbounty" className="space-y-4">
            <BugBountyProgram />
          </TabsContent>

          {/* MFA Tab — 2FA RÉELLE (vérifiée serveur) sur les opérations financières sensibles. */}
          <TabsContent value="mfa" className="space-y-4">
            <AdminMfaCard />
          </TabsContent>

          {/* ML Fraud Detection Tab */}
          <TabsContent value="fraud" className="space-y-4">
            <MLFraudDetection />
          </TabsContent>

          {/* SIEM Tab */}
          <TabsContent value="siem" className="space-y-4">
            <SIEMDashboard />
          </TabsContent>

          {/* Threats Tab */}
          <TabsContent value="threats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('pdgSecurity.menacesDetectees')}</CardTitle>
                <CardDescription>
                  {openIncidents.length > 0
                    ? `${openIncidents.length} incident(s) actif(s) sur ${incidents?.length || 0} enregistré(s)`
                    : 'Aucune menace active détectée'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!incidents || incidents.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 text-[#ff4000] mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">{t('pdgSecurity.tousLesSystemesSontSecurises')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incidents.slice(0, 30).map((inc) => (
                      <div key={inc.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{inc.title || inc.incident_type}</span>
                            <Badge variant="outline" className={severityClass(inc.severity)}>{inc.severity}</Badge>
                            <Badge variant="outline" className="text-xs">{inc.status}</Badge>
                          </div>
                          {inc.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{inc.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {inc.source_ip ? `IP ${inc.source_ip} • ` : ''}{inc.target_service ? `${inc.target_service} • ` : ''}{fmtDateTime(inc.detected_at || inc.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('pdgSecurity.surveillanceEnTempsReel2')}</CardTitle>
                <CardDescription>
                  {alerts && alerts.length > 0
                    ? `${stats.pending_alerts || 0} alerte(s) en attente sur ${alerts.length} récente(s)`
                    : 'Activité du système de surveillance'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!alerts || alerts.length === 0 ? (
                  <div className="text-center py-12">
                    <Eye className="w-16 h-16 text-blue-500 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">{t('pdgSecurity.surveillanceActiveAucuneAnomalie')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.slice(0, 30).map((al) => (
                      <div key={al.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{al.message || al.alert_type}</span>
                            <Badge variant="outline" className={severityClass(al.severity)}>{al.severity}</Badge>
                            {al.acknowledged
                              ? <Badge variant="outline" className="text-xs">{t('pdgSecurity.acquittee')}</Badge>
                              : <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">en attente</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {al.source ? `${al.source} • ` : ''}{fmtDateTime(al.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocked Tab */}
          <TabsContent value="blocked" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('pdgSecurity.entitesBloquees')}</CardTitle>
                <CardDescription>
                  {activeBlockedIPs.length > 0
                    ? `${activeBlockedIPs.length} IP(s) actuellement bloquée(s)`
                    : 'IPs et utilisateurs bloqués'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeBlockedIPs.length === 0 ? (
                  <div className="text-center py-12">
                    <Ban className="w-16 h-16 text-[#ff4000] mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">{t('pdgSecurity.aucuneEntiteBloqueeActuellement')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeBlockedIPs.slice(0, 50).map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Ban className="w-4 h-4 text-[#ff4000] flex-shrink-0" />
                            <span className="font-mono font-medium truncate">{b.ip_address}</span>
                          </div>
                          {b.reason && <p className="text-sm text-muted-foreground mt-1">{b.reason}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            Bloquée le {fmtDateTime(b.blocked_at)}{b.expires_at ? ` • expire le ${fmtDateTime(b.expires_at)}` : ' • permanent'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Widget de communication flottant */}
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}
