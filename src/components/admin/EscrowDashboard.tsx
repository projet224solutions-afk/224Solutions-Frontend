import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Clock, Users, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface EscrowDashboardData {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  available_to_release_at: string | null;
  commission_percent: number | null;
  commission_amount: number | null;
  payer_email: string;
  payer_name: string;
  receiver_email: string;
  receiver_name: string;
  log_count: number;
}

export function EscrowDashboard() {
  const { t } = useTranslation();
  const [escrows, setEscrows] = useState<EscrowDashboardData[]>([]);
  const [stats, setStats] = useState({ pending: 0, released: 0, refunded: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedEscrow, setSelectedEscrow] = useState<EscrowDashboardData | null>(null);
  const [actionType, setActionType] = useState<"release" | "refund" | "hold" | null>(null);
  const [commissionPercent, setCommissionPercent] = useState(2);

  const loadEscrows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("escrow_dashboard")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const escrowData = (data || []) as EscrowDashboardData[];
      setEscrows(escrowData);

      // Calculate stats
      setStats({
        pending: escrowData.filter(e => e.status === "pending").length,
        released: escrowData.filter(e => e.status === "released").length,
        refunded: escrowData.filter(e => e.status === "refunded").length,
        total: escrowData.length,
      });
    } catch (err: any) {
      toast.error(t('escrowDashboard.erreurLorsDuChargementDes'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEscrows();

    // Subscribe to escrow changes
    const channel = supabase
      .channel("escrow_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "escrow_transactions" }, () => {
        loadEscrows();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAction = async () => {
    if (!selectedEscrow || !actionType) return;

    try {
      if (actionType === "release") {
        // Utiliser la fonction Edge pour libérer l'escrow
        const { data, error } = await supabase.functions.invoke('escrow-release', {
          body: {
            escrow_id: selectedEscrow.id,
            notes: `Libération manuelle par admin - Commission ${commissionPercent}%`
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erreur lors de la libération');

        toast.success(t('escrowDashboard.fondsLiberesAvecSucces'));
      } else if (actionType === "refund") {
        // Utiliser la fonction Edge pour rembourser l'escrow
        const { data, error } = await supabase.functions.invoke('escrow-refund', {
          body: {
            escrow_id: selectedEscrow.id,
            notes: 'Remboursement manuel par admin'
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erreur lors du remboursement');

        toast.success(t('escrowDashboard.remboursementEffectue'));
      } else if (actionType === "hold") {
        // Utiliser la fonction Edge pour ouvrir un litige
        const { data, error } = await supabase.functions.invoke('escrow-dispute', {
          body: {
            escrow_id: selectedEscrow.id,
            reason: 'Litige ouvert par admin'
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erreur lors de l\'ouverture du litige');

        toast.success("Escrow mis en litige");
      }

      await loadEscrows();
      setSelectedEscrow(null);
      setActionType(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'action");
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-GN", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: "En attente", variant: "secondary" as const, icon: Clock },
      released: { label: t('escrowDashboard.libere'), variant: "default" as const, icon: CheckCircle },
      refunded: { label: t('escrowDashboard.rembourse'), variant: "outline" as const, icon: XCircle },
      dispute: { label: "Litige", variant: "destructive" as const, icon: AlertTriangle },
    };
    const { label, variant, icon: Icon } = config[status as keyof typeof config] || config.pending;
    return <Badge variant={variant} className="gap-1"><Icon className="h-3 w-3" />{label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Escrow</h1>
          <p className="text-muted-foreground">{t('escrowDashboard.gerezLesTransactionsEnSequestre')}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Escrows</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('escrowDashboard.liberes')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.released}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('escrowDashboard.rembourses')}</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.refunded}</div>
          </CardContent>
        </Card>
      </div>

      {/* Escrow List */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">En attente ({stats.pending})</TabsTrigger>
          <TabsTrigger value="all">Tous ({stats.total})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {escrows.filter(e => e.status === "pending").map((escrow) => (
            <Card key={escrow.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Commande #{escrow.order_id}</CardTitle>
                    <CardDescription>
                      De {escrow.payer_name} vers {escrow.receiver_name}
                    </CardDescription>
                  </div>
                  {getStatusBadge(escrow.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('escrowDashboard.montant')}</p>
                    <p className="text-lg font-semibold">{formatAmount(escrow.amount, escrow.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('escrowDashboard.liberationAuto')}</p>
                    <p className="text-sm">{escrow.available_to_release_at ? new Date(escrow.available_to_release_at).toLocaleDateString("fr-FR") : "N/A"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedEscrow(escrow);
                      setActionType("release");
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Libérer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedEscrow(escrow);
                      setActionType("refund");
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rembourser
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedEscrow(escrow);
                      setActionType("hold");
                    }}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Litige
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {escrows.map((escrow) => (
            <Card key={escrow.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Commande #{escrow.order_id}</CardTitle>
                    <CardDescription>
                      De {escrow.payer_name} vers {escrow.receiver_name}
                    </CardDescription>
                  </div>
                  {getStatusBadge(escrow.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('escrowDashboard.montant')}</p>
                    <p className="font-semibold">{formatAmount(escrow.amount, escrow.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Commission</p>
                    <p className="font-semibold">
                      {escrow.commission_amount ? formatAmount(escrow.commission_amount, escrow.currency) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('escrowDashboard.creeLe')}</p>
                    <p className="text-sm">{new Date(escrow.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <AlertDialog open={!!selectedEscrow && !!actionType} onOpenChange={() => {
        setSelectedEscrow(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "release" && "Libérer les fonds"}
              {actionType === "refund" && "Rembourser le paiement"}
              {actionType === "hold" && "Mettre en litige"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "release" && (
                <div className="space-y-4">
                  <p>Confirmer la libération de {selectedEscrow && formatAmount(selectedEscrow.amount, selectedEscrow.currency)} vers {selectedEscrow?.receiver_name}?</p>
                  <div>
                    <label className="text-sm font-medium">Commission (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(parseFloat(e.target.value))}
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
              )}
              {actionType === "refund" && `Confirmer le remboursement de ${selectedEscrow && formatAmount(selectedEscrow.amount, selectedEscrow.currency)} vers ${selectedEscrow?.payer_name}?`}
              {actionType === "hold" && "Mettre cette transaction en litige bloquera les fonds."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('escrowDashboard.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
