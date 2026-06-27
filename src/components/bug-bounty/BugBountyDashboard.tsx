import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle, Clock, Trophy } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

// ============================================
// TYPES & INTERFACES
// ============================================

type BugSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type BugCategory = 'authentication' | 'authorization' | 'injection' | 'xss' | 'csrf' | 'data_exposure' | 'crypto' | 'business_logic' | 'other';
type BugReportStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'duplicate' | 'resolved' | 'rewarded';

interface BugReport {
  id: string;
  reporter_name: string;
  reporter_email: string;
  reporter_github?: string;
  title: string;
  description: string;
  severity: BugSeverity;
  category: BugCategory;
  steps_to_reproduce: string;
  impact: string;
  proof_of_concept?: string;
  suggested_fix?: string;
  status: BugReportStatus;
  reward_amount?: number;
  admin_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface BugBountyStats {
  total: number;
  pending: number;
  resolved: number;
  rewarded: number;
  totalPaid: number;
}

// ============================================
// CONSTANTS
// ============================================

const severityColors: Record<BugSeverity, string> = {
  critical: "bg-[#ff4000]",
  high: "bg-orange-500",
  medium: "bg-[#ff4000]",
  low: "bg-blue-500",
  info: "bg-gray-500",
};

const statusColors: Record<BugReportStatus, string> = {
  pending: "bg-[#ff4000]",
  reviewing: "bg-blue-500",
  accepted: "bg-[#ff4000]",
  rejected: "bg-[#ff4000]",
  duplicate: "bg-gray-500",
  resolved: "bg-[#04439e]",
  rewarded: "bg-[#ff4000]",
};

// ============================================
// COMPONENT
// ============================================

const BugBountyDashboard = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  // States avec types stricts
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [rewardAmount, setRewardAmount] = useState<string>("");
  const [newStatus, setNewStatus] = useState<BugReportStatus | "">("");

  // Vérification admin simplifiée
  const isAdmin = profile?.role === 'admin' || profile?.role === 'ceo';

  console.log('🔍 Bug Bounty - User:', user?.id, 'Profile:', profile?.role, 'isAdmin:', isAdmin);

  const { data: reports, isLoading, error: reportsError } = useQuery<BugReport[], Error>({
    queryKey: ["bug-reports"],
    queryFn: async () => {
      console.log('🔍 Chargement bug reports...');

      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('❌ Erreur chargement bug reports:', error);
        throw error;
      }

      console.log('✅ Bug reports chargés:', data?.length || 0);
      return data as BugReport[];
    },
    enabled: !!user && isAdmin,
  });

  const { data: stats } = useQuery<BugBountyStats, Error>({
    queryKey: ["bug-bounty-stats"],
    queryFn: async () => {
      console.log('📊 Chargement stats bug bounty...');

      const { data: allReports, error } = await supabase
        .from("bug_reports")
        .select("status, severity, reward_amount");

      if (error) {
        console.error('❌ Erreur chargement stats:', error);
        throw error;
      }

      if (!allReports) {
        return { total: 0, pending: 0, resolved: 0, rewarded: 0, totalPaid: 0 };
      }

      const stats: BugBountyStats = {
        total: allReports.length,
        pending: allReports.filter(r => r.status === "pending").length,
        resolved: allReports.filter(r => r.status === "resolved").length,
        rewarded: allReports.filter(r => r.status === "rewarded").length,
        totalPaid: allReports.reduce((sum, r) => {
          const amount = r.reward_amount ?? 0;
          return sum + amount;
        }, 0),
      };

      console.log('✅ Stats calculées:', stats);
      return stats;
    },
    enabled: !!user && isAdmin,
  });

  const updateReportMutation = useMutation<void, Error, { id: string; updates: Partial<BugReport> }>({
    mutationFn: async ({ id, updates }) => {
      console.log('📝 Mise à jour rapport:', id, updates);

      const { error } = await supabase
        .from("bug_reports")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      queryClient.invalidateQueries({ queryKey: ["bug-bounty-stats"] });
      toast.success(t('bugBountyDashboard.rapportMisAJourAvec'));

      // Réinitialiser tous les states
      setSelectedReport(null);
      setAdminNotes("");
      setRewardAmount("");
      setNewStatus("");
    },
    onError: (error: Error) => {
      console.error('❌ Erreur mise à jour rapport:', error);
      toast.error(t('bugBountyDashboard.erreurLorsDeLaMise'), {
        description: error.message
      });
    },
  });

  const handleUpdateReport = () => {
    if (!selectedReport) return;

    const updates: Partial<BugReport> = {};

    if (adminNotes) updates.admin_notes = adminNotes;

    if (newStatus) {
      updates.status = newStatus as BugReportStatus;
      if (newStatus === "resolved" || newStatus === "rewarded") {
        updates.resolved_at = new Date().toISOString();
      }
    }

    if (rewardAmount) {
      const amount = parseFloat(rewardAmount);
      if (!isNaN(amount) && amount > 0) {
        updates.reward_amount = amount;
      }
    }

    console.log('🔄 Envoi mise à jour:', updates);
    updateReportMutation.mutate({ id: selectedReport.id, updates });
  };

  if (reportsError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('bugBountyDashboard.erreurDAccesAuxDonnees')}</strong>
          <p className="text-sm mt-2">
            {reportsError.message}
          </p>
          <p className="text-xs mt-2 text-muted-foreground">
            Si le problème persiste, vérifiez que les policies RLS sont correctement configurées.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">{t('bugBountyDashboard.chargementDesRapports')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Rapports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">{stats?.pending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Résolus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">{stats?.resolved || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Récompensés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">{stats?.rewarded || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('bugBountyDashboard.totalPaye')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPaid.toFixed(2)}€</div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Rapports de vulnérabilité
          </CardTitle>
          <CardDescription>
            Gérez les rapports soumis par la communauté
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports?.map((report) => (
              <Dialog
                key={report.id}
                open={selectedReport?.id === report.id}
                onOpenChange={(open) => {
                  if (!open) {
                    // Réinitialiser tous les states à la fermeture
                    setSelectedReport(null);
                    setAdminNotes("");
                    setRewardAmount("");
                    setNewStatus("");
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Card
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setSelectedReport(report);
                      setAdminNotes(report.admin_notes || "");
                      setRewardAmount(report.reward_amount?.toString() || "");
                      setNewStatus(report.status);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className={severityColors[report.severity]}>
                              {report.severity}
                            </Badge>
                            <Badge variant="outline" className={statusColors[report.status]}>
                              {report.status}
                            </Badge>
                            <Badge variant="outline">{report.category}</Badge>
                          </div>
                          <h3 className="font-semibold">{report.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {report.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Par: {report.reporter_name}</span>
                            <span>•</span>
                            <span>{format(new Date(report.created_at), "PPP", { locale: fr })}</span>
                            {report.reward_amount && (
                              <>
                                <span>•</span>
                                <span className="text-[#ff4000] font-semibold">
                                  {report.reward_amount}€
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {report.severity === "critical" && (
                          <AlertTriangle className="w-6 h-6 text-[#ff4000] flex-shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>

                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{report.title}</DialogTitle>
                    <DialogDescription>
                      Rapport #{report.id.slice(0, 8)}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    {/* Reporter Info */}
                    <div>
                      <h3 className="font-semibold mb-2">{t('bugBountyDashboard.informationsDuReporter')}</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Nom:</strong> {report.reporter_name}</p>
                        <p><strong>Email:</strong> {report.reporter_email}</p>
                        {report.reporter_github && (
                          <p><strong>GitHub:</strong> {report.reporter_github}</p>
                        )}
                      </div>
                    </div>

                    {/* Report Details */}
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-sm whitespace-pre-wrap">{report.description}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">{t('bugBountyDashboard.etapesDeReproduction')}</h3>
                      <p className="text-sm whitespace-pre-wrap">{report.steps_to_reproduce}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Impact</h3>
                      <p className="text-sm whitespace-pre-wrap">{report.impact}</p>
                    </div>

                    {report.proof_of_concept && (
                      <div>
                        <h3 className="font-semibold mb-2">{t('bugBountyDashboard.preuveDeConcept')}</h3>
                        <p className="text-sm whitespace-pre-wrap">{report.proof_of_concept}</p>
                      </div>
                    )}

                    {report.suggested_fix && (
                      <div>
                        <h3 className="font-semibold mb-2">{t('bugBountyDashboard.correctionSuggeree')}</h3>
                        <p className="text-sm whitespace-pre-wrap">{report.suggested_fix}</p>
                      </div>
                    )}

                    {/* Admin Actions */}
                    <div className="border-t pt-6 space-y-4">
                      <h3 className="font-semibold">Actions administrateur</h3>

                      <div className="space-y-2">
                        <Label htmlFor="status">Statut</Label>
                        <Select value={newStatus} onValueChange={(value) => setNewStatus(value as BugReportStatus)}>
                          <SelectTrigger id="status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="reviewing">En revue</SelectItem>
                            <SelectItem value="accepted">{t('bugBountyDashboard.accepte')}</SelectItem>
                            <SelectItem value="rejected">{t('bugBountyDashboard.rejete')}</SelectItem>
                            <SelectItem value="duplicate">Duplicata</SelectItem>
                            <SelectItem value="resolved">{t('bugBountyDashboard.resolu')}</SelectItem>
                            <SelectItem value="rewarded">{t('bugBountyDashboard.recompense')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reward">{t('bugBountyDashboard.montantDeLaRecompense')}</Label>
                        <Input
                          id="reward"
                          type="number"
                          value={rewardAmount}
                          onChange={(e) => setRewardAmount(e.target.value)}
                          placeholder="Ex: 500"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes administrateur</Label>
                        <Textarea
                          id="notes"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Notes internes..."
                          className="min-h-[100px]"
                        />
                      </div>

                      <Button onClick={handleUpdateReport} className="w-full">
                        Mettre à jour le rapport
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}

            {reports?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Aucun rapport de vulnérabilité pour le moment
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BugBountyDashboard;