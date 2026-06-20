import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { Escrow224Service, EscrowTransaction } from "@/services/escrow224Service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Lock, Unlock, DollarSign, RefreshCw, AlertCircle } from "lucide-react";

export function EscrowDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<EscrowTransaction | null>(null);
  const [actionType, setActionType] = useState<"release" | "refund" | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Vérifier que l'utilisateur est admin
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (profile?.id) {
      loadTransactions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const loadTransactions = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const result = await Escrow224Service.getUserEscrows(profile.id);
      if (result.success && result.transactions) {
        setTransactions(result.transactions);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error(t('escrowDashboard.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!selectedTransaction || !isAdmin) return;

    setProcessing(true);
    try {
      const result = await Escrow224Service.releaseEscrow({
        escrow_id: selectedTransaction.id,
        notes,
      });

      if (result.success) {
        toast.success(t('escrowDashboard.fondsLiberesAvecSucces'));
        setActionType(null);
        setSelectedTransaction(null);
        setNotes("");
        loadTransactions();
      } else {
        toast.error(result.error || "Erreur lors de la libération");
      }
    } catch (error) {
      console.error("Error releasing escrow:", error);
      toast.error(t('escrowDashboard.erreurLorsDeLaLiberation'));
    } finally {
      setProcessing(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedTransaction || !isAdmin || !reason) return;

    setProcessing(true);
    try {
      const result = await Escrow224Service.refundEscrow({
        escrow_id: selectedTransaction.id,
        reason,
      });

      if (result.success) {
        toast.success(t('escrowDashboard.remboursementEffectueAvecSucces'));
        setActionType(null);
        setSelectedTransaction(null);
        setReason("");
        loadTransactions();
      } else {
        toast.error(result.error || "Erreur lors du remboursement");
      }
    } catch (error) {
      console.error("Error refunding escrow:", error);
      toast.error(t('escrowDashboard.erreurLorsDuRemboursement'));
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20",
      held: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      released: "bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20",
      refunded: "bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20",
    };

    const icons = {
      pending: <AlertCircle className="w-3 h-3 mr-1" />,
      held: <Lock className="w-3 h-3 mr-1" />,
      released: <Unlock className="w-3 h-3 mr-1" />,
      refunded: <RefreshCw className="w-3 h-3 mr-1" />,
    };

    const labels = {
      pending: "En attente",
      held: "🔸 Bloqué",
      released: "🔹 Libéré",
      refunded: "🔻 Remboursé",
    };

    return (
      <Badge className={`${styles[status as keyof typeof styles]} flex items-center w-fit`}>
        {icons[status as keyof typeof icons]}
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            Accès réservé aux administrateurs uniquement.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Système Escrow 224SOLUTIONS
          </CardTitle>
          <CardDescription>
            Gérez les paiements sécurisés en attente de validation
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Chargement...</p>
          </CardContent>
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">{t('escrowDashboard.aucuneTransactionEscrowPourLe')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {transactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(transaction.status)}
                      <span className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-lg font-semibold">
                        {transaction.amount.toLocaleString()} {transaction.currency}
                      </span>
                    </div>
                    {transaction.order_id && (
                      <p className="text-sm text-muted-foreground">
                        Commande: {transaction.order_id}
                      </p>
                    )}
                    {transaction.notes && (
                      <p className="text-sm text-muted-foreground italic">
                        Note: {transaction.notes}
                      </p>
                    )}
                  </div>

                  {transaction.status === "held" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setActionType("release");
                        }}
                        className="bg-[#ff4000] hover:bg-[#ff4000]"
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Libérer
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setActionType("refund");
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Rembourser
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog pour libérer les fonds */}
      <Dialog
        open={actionType === "release"}
        onOpenChange={() => {
          setActionType(null);
          setSelectedTransaction(null);
          setNotes("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('escrowDashboard.libererLesFonds')}</DialogTitle>
            <DialogDescription>
              Confirmer la libération des fonds au vendeur ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">
              Montant: <strong>{selectedTransaction?.amount} {selectedTransaction?.currency}</strong>
            </p>
            <Textarea
              placeholder="Notes (optionnel)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setSelectedTransaction(null);
                setNotes("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleRelease}
              disabled={processing}
              className="bg-[#ff4000] hover:bg-[#ff4000]"
            >
              {processing ? "Traitement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour rembourser */}
      <Dialog
        open={actionType === "refund"}
        onOpenChange={() => {
          setActionType(null);
          setSelectedTransaction(null);
          setReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('escrowDashboard.rembourserLeClient')}</DialogTitle>
            <DialogDescription>
              Confirmer le remboursement au client ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">
              Montant: <strong>{selectedTransaction?.amount} {selectedTransaction?.currency}</strong>
            </p>
            <Textarea
              placeholder={t('escrowDashboard.raisonDuRemboursementRequis')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setSelectedTransaction(null);
                setReason("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleRefund}
              disabled={processing || !reason}
              variant="destructive"
            >
              {processing ? "Traitement..." : "Confirmer le remboursement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
