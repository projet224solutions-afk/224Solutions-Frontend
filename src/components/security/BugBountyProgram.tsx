/**
 * PROGRAMME BUG BOUNTY
 * Gestion du programme de chasse aux vulnérabilités - Connecté à Supabase
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bug, DollarSign, Users, TrendingUp, RefreshCw, ExternalLink } from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";
import { ResponsiveGrid } from "@/components/responsive/ResponsiveContainer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface BountyReport {
  id: string;
  severity: string;
  title: string;
  reporter_name: string;
  reward_amount: number | null;
  status: string;
  created_at: string;
}

interface BugBountyStats {
  totalReports: number;
  resolvedVulnerabilities: number;
  totalRewards: number;
  activeHunters: number;
  pendingReports: number;
}

export function BugBountyProgram() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [reports, setReports] = useState<BountyReport[]>([]);
  const [stats, setStats] = useState<BugBountyStats>({
    totalReports: 0,
    resolvedVulnerabilities: 0,
    totalRewards: 0,
    activeHunters: 0,
    pendingReports: 0
  });
  const [loading, setLoading] = useState(true);

  const loadBugBountyData = useCallback(async () => {
    try {
      setLoading(true);

      // Charger les rapports récents
      const { data: reportsData, error: reportsError } = await supabase
        .from('bug_reports')
        .select('id, severity, title, reporter_name, reward_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (reportsError) {
        console.error('Erreur chargement rapports:', reportsError);
        setReports([]);
      } else {
        setReports(reportsData || []);
      }

      // Charger les statistiques
      const { data: allReports, error: allError } = await supabase
        .from('bug_reports')
        .select('status, reward_amount, reporter_name');

      if (allError) {
        console.error('Erreur chargement stats:', allError);
      } else {
        const reports = allReports || [];
        const uniqueReporters = new Set(reports.map(r => r.reporter_name)).size;
        const totalRewards = reports
          .filter(r => r.status === 'resolved' && r.reward_amount)
          .reduce((sum, r) => sum + (r.reward_amount || 0), 0);

        setStats({
          totalReports: reports.length,
          resolvedVulnerabilities: reports.filter(r => r.status === 'resolved').length,
          totalRewards: totalRewards,
          activeHunters: uniqueReporters,
          pendingReports: reports.filter(r => r.status === 'pending').length
        });
      }

      // Charger depuis hall of fame si disponible
      const { data: hallOfFame } = await supabase
        .from('bug_bounty_hall_of_fame')
        .select('total_rewards')
        .order('total_rewards', { ascending: false })
        .limit(10);

      if (hallOfFame && hallOfFame.length > 0) {
        const totalFromHall = hallOfFame.reduce((sum, h) => sum + (h.total_rewards || 0), 0);
        if (totalFromHall > stats.totalRewards) {
          setStats(prev => ({ ...prev, totalRewards: totalFromHall }));
        }
      }

    } catch (error) {
      console.error('Erreur Bug Bounty:', error);
      toast.error(t('bugBountyProgram.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBugBountyData();
  }, [loadBugBountyData]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-[#ff4000]';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-[#ff4000]';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return <Badge className="bg-[#ff4000]">{t('bugBountyProgram.resolu')}</Badge>;
      case 'in_review': return <Badge className="bg-blue-500">En revue</Badge>;
      case 'confirmed': return <Badge className="bg-[#04439e]">{t('bugBountyProgram.confirme')}</Badge>;
      case 'rejected': return <Badge variant="destructive">{t('bugBountyProgram.rejete')}</Badge>;
      default: return <Badge variant="outline">En attente</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary animate-pulse" />
            Programme Bug Bounty
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Chargement des données Bug Bounty...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-primary" />
              Programme Bug Bounty
            </CardTitle>
            <CardDescription>
              Communauté de chercheurs en sécurité
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadBugBountyData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/bug-bounty')}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Page publique
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistiques */}
        <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="sm">
          <div className="p-4 bg-muted rounded-lg">
            <Bug className="w-8 h-8 text-primary mb-2" />
            <div className="text-2xl font-bold">{stats.totalReports}</div>
            <div className="text-xs text-muted-foreground">Rapports totaux</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <TrendingUp className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{stats.resolvedVulnerabilities}</div>
            <div className="text-xs text-muted-foreground">{t('bugBountyProgram.vulnerabilitesCorrigees')}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <DollarSign className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{fc(stats.totalRewards)}</div>
            <div className="text-xs text-muted-foreground">{t('bugBountyProgram.recompensesVersees')}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <Users className="w-8 h-8 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{stats.activeHunters}</div>
            <div className="text-xs text-muted-foreground">Chasseurs actifs</div>
          </div>
        </ResponsiveGrid>

        {/* Alerte rapports en attente */}
        {stats.pendingReports > 0 && (
          <div className="p-3 bg-orange-50 dark:bg-[#ff4000] rounded-lg border border-orange-200 dark:border-[#ff4000]">
            <div className="flex items-center gap-2 text-[#ff4000] dark:text-orange-300">
              <Bug className="w-5 h-5" />
              <span className="font-medium">{stats.pendingReports} rapport(s) en attente de revue</span>
            </div>
          </div>
        )}

        {/* Rapports récents */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{t('bugBountyProgram.rapportsRecents')}</h4>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('bugBountyProgram.aucunRapportDeBugSoumis')}</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="p-3 border rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={getSeverityColor(report.severity)}>
                        {report.severity}
                      </Badge>
                      {getStatusBadge(report.status)}
                    </div>
                    <h5 className="font-medium text-sm truncate">{report.title}</h5>
                    <p className="text-xs text-muted-foreground">
                      Par {report.reporter_name} • {new Date(report.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {report.reward_amount && report.reward_amount > 0 && (
                    <div className="text-right">
                      <div className="font-bold text-[#ff4000]">{fc(report.reward_amount)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <Button className="w-full" onClick={() => navigate('/bug-bounty')}>
          Voir tous les rapports
        </Button>
      </CardContent>
    </Card>
  );
}