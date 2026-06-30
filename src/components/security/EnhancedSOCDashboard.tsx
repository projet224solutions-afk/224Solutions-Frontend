/**
 * SOC AVANCÉ - Security Operations Center avec analystes humains
 * Surveillance 24/7 avec analyse humaine proactive
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Clock, Users, AlertTriangle, CheckCircle, RefreshCw, Phone, Eye, FileText
} from "lucide-react";
import { ResponsiveGrid } from "@/components/responsive/ResponsiveContainer";
import { useSecurityOps } from "@/hooks/useSecurityOps";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SOCAnalyst {
  id: string;
  name: string;
  email: string;
  analyst_role: string;
  status: string;
  specialization: string[];
  current_cases: number;
  max_cases: number;
  is_on_call: boolean;
  shift_start: string;
  shift_end: string;
}

interface Investigation {
  id: string;
  title: string;
  priority: string;
  status: string;
  investigation_type: string;
  analyst_id: string;
  time_spent_minutes: number;
  created_at: string;
}

export function EnhancedSOCDashboard() {
  const { t } = useTranslation();
  const { incidents, alerts, stats, loading, loadSecurityData } = useSecurityOps(true);
  const [analysts, setAnalysts] = useState<SOCAnalyst[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loadingAnalysts, setLoadingAnalysts] = useState(true);

  const loadAnalysts = async () => {
    try {
      const { data, error } = await supabase
        .from('soc_analysts')
        .select('*')
        .order('analyst_role', { ascending: false });

      if (error) throw error;
      setAnalysts(data || []);
    } catch (error) {
      console.error('Error loading analysts:', error);
    }
  };

  const loadInvestigations = async () => {
    try {
      const { data, error } = await supabase
        .from('soc_investigations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setInvestigations(data || []);
    } catch (error) {
      console.error('Error loading investigations:', error);
    } finally {
      setLoadingAnalysts(false);
    }
  };

  useEffect(() => {
    loadAnalysts();
    loadInvestigations();
  }, []);

  const handleRefresh = () => {
    loadSecurityData();
    loadAnalysts();
    loadInvestigations();
    toast.success(t('enhancedSOCDashboard.dashboardSocActualise'));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-[#ff4000]';
      case 'busy': return 'bg-[#ff4000]';
      case 'on_call': return 'bg-blue-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'team_lead': return 'Chef d\'équipe';
      case 'senior_analyst': return 'Analyste Senior';
      case 'analyst': return 'Analyste';
      case 'manager': return 'Manager';
      default: return role;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const activeAnalysts = analysts.filter(a => a.status !== 'offline').length;
  const onCallAnalysts = analysts.filter(a => a.is_on_call).length;
  const totalCapacity = analysts.reduce((sum, a) => sum + a.max_cases, 0);
  const currentLoad = analysts.reduce((sum, a) => sum + a.current_cases, 0);
  const loadPercentage = totalCapacity > 0 ? (currentLoad / totalCapacity) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                Centre Opérationnel de Sécurité (SOC)
              </CardTitle>
              <CardDescription>
                Surveillance et réponse aux incidents 24/7 avec analyse humaine proactive
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={loading || loadingAnalysts}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 ${(loading || loadingAnalysts) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Statut SOC */}
          <div className="p-4 rounded-lg border bg-orange-50 dark:bg-[#ff4000] border-orange-200 dark:border-[#ff4000]">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
              <span className="font-semibold">SOC Opérationnel - Couverture 24/7</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {activeAnalysts} analystes actifs • {onCallAnalysts} analystes de garde •
              Capacité: {currentLoad}/{totalCapacity} cas ({loadPercentage.toFixed(0)}%)
            </p>
            <Progress value={loadPercentage} className="h-2 mt-2" />
          </div>
        </CardContent>
      </Card>

      {/* Métriques principales */}
      <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="md">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-8 h-8 text-[#ff4000]" />
              <div>
                <div className="text-2xl font-bold">{stats?.total_incidents || 0}</div>
                <div className="text-xs text-muted-foreground">Incidents totaux</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Eye className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{investigations.filter(i => i.status === 'in_progress').length}</div>
                <div className="text-xs text-muted-foreground">{t('enhancedSOCDashboard.enquetesEnCours')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-[#ff4000]" />
              <div>
                <div className="text-2xl font-bold">{activeAnalysts}</div>
                <div className="text-xs text-muted-foreground">Analystes actifs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-[#04439e]" />
              <div>
                <div className="text-2xl font-bold">&lt; 2 min</div>
                <div className="text-xs text-muted-foreground">{t('enhancedSOCDashboard.tempsDeReponse')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </ResponsiveGrid>

      {/* Équipe SOC */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Équipe SOC - Analystes
          </CardTitle>
          <CardDescription>
            Équipe dédiée à l'analyse de sécurité et réponse aux incidents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analysts.map((analyst) => (
              <div key={analyst.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{analyst.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {getRoleLabel(analyst.analyst_role)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Badge className={getStatusColor(analyst.status)}>
                      {analyst.status === 'available' ? 'Disponible' :
                       analyst.status === 'busy' ? 'Occupé' :
                       analyst.status === 'on_call' ? 'De garde' : 'Hors ligne'}
                    </Badge>
                    {analyst.is_on_call && (
                      <Badge variant="outline" className="text-blue-600">
                        <Phone className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {analyst.specialization?.map((spec, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {spec}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{t('enhancedSOCDashboard.chargeDeTravail')}</span>
                    <span>{analyst.current_cases}/{analyst.max_cases} cas</span>
                  </div>
                  <Progress
                    value={(analyst.current_cases / analyst.max_cases) * 100}
                    className="h-1.5"
                  />
                </div>

                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Shift: {analyst.shift_start} - {analyst.shift_end}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enquêtes récentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Enquêtes & Investigations
          </CardTitle>
          <CardDescription>
            Analyse approfondie des incidents de sécurité
          </CardDescription>
        </CardHeader>
        <CardContent>
          {investigations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-[#ff4000]" />
              <p>{t('enhancedSOCDashboard.aucuneEnqueteActive')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {investigations.map((inv) => (
                <div key={inv.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-medium">{inv.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Type: {inv.investigation_type} • Temps: {inv.time_spent_minutes} min
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant={getPriorityColor(inv.priority)}>
                        {inv.priority}
                      </Badge>
                      <Badge variant="outline">
                        {inv.status === 'open' ? 'Ouvert' :
                         inv.status === 'in_progress' ? 'En cours' :
                         inv.status === 'closed' ? 'Fermé' : inv.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EnhancedSOCDashboard;
