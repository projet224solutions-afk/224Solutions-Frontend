import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePaymentLinks } from "@/hooks/usePaymentLinks";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, AlertTriangle, CheckCircle, Clock, Filter, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const statusColors = {
  pending: 'bg-orange-100 text-[#ff4000]',
  success: 'bg-orange-100 text-[#ff4000]',
  overdue: 'bg-orange-100 text-[#ff4000]',
  expired: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-800',
  failed: 'bg-orange-100 text-[#ff4000]'
};

const statusLabels = {
  pending: 'En attente',
  success: 'Payé',
  overdue: 'En retard',
  expired: 'Expiré',
  cancelled: 'Annulé',
  failed: 'Échoué'
};

export default function PaymentManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { paymentLinks, loading, stats } = usePaymentLinks();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Calculer les statuts dynamiques basés sur le temps
  const linksWithStatus = useMemo(() => {
    return paymentLinks.map(link => {
      if (link.status === 'pending') {
        const createdAt = new Date(link.created_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        // Si plus de 24h, considérer comme en retard
        if (hoursDiff > 24) {
          return { ...link, displayStatus: 'overdue' as const };
        }
      }
      return { ...link, displayStatus: link.status };
    });
  }, [paymentLinks]);

  const filteredLinks = linksWithStatus.filter(link => {
    const matchesStatus = filterStatus === 'all' || link.displayStatus === filterStatus;
    const matchesSearch = !searchTerm ||
      link.produit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.payment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const overdueCount = linksWithStatus.filter(l => l.displayStatus === 'overdue').length;
  const pendingCount = linksWithStatus.filter(l => l.displayStatus === 'pending').length;
  const successCount = linksWithStatus.filter(l => l.displayStatus === 'success').length;
  const totalRevenue = linksWithStatus
    .filter(l => l.displayStatus === 'success')
    .reduce((sum, l) => sum + (l.net_amount || l.total), 0); // revenu NET réellement reçu par le vendeur (hors frais plateforme)

  const overdueAmount = linksWithStatus
    .filter(l => l.displayStatus === 'overdue')
    .reduce((sum, l) => sum + l.total, 0);
  const pendingAmount = linksWithStatus
    .filter(l => l.displayStatus === 'pending')
    .reduce((sum, l) => sum + l.total, 0);

  // Export CSV des paiements affichés (respecte le filtre + la recherche en cours).
  const exportCsv = () => {
    if (filteredLinks.length === 0) {
      toast({ title: "Rien à exporter", description: "Aucun paiement dans la sélection." });
      return;
    }
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Produit', 'ID', 'Client', 'Statut', 'Montant', 'Total payé', 'Net reçu', 'Devise', 'Créé le'];
    const lines = filteredLinks.map(l => [
      l.produit, l.payment_id, l.client?.name || '',
      statusLabels[l.displayStatus] || l.displayStatus,
      l.montant, l.total, l.net_amount ?? '', l.devise || 'GNF',
      new Date(l.created_at).toLocaleString('fr-FR'),
    ].map(esc).join(','));
    const csv = '﻿' + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export généré", description: `${filteredLinks.length} paiement(s) exporté(s).` });
  };

  if (loading) {
    return <div className="p-4">{t('paymentManagement.chargementDesDonneesDePaiement')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('paymentManagement.gestionDesPaiements')}</h2>
          <p className="text-muted-foreground">{t('paymentManagement.suivezVosLiensDePaiement')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-sm text-muted-foreground">{t('paymentManagement.paiementsEnRetard')}</p>
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-sm text-[#ff4000]">{fc(overdueAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-orange-600">{fc(pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-sm text-muted-foreground">{t('paymentManagement.paiementsReussis')}</p>
                <p className="text-2xl font-bold">{successCount}</p>
                <p className="text-sm text-[#ff4000]">{t('paymentManagement.totalPaye')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Revenu total</p>
                <p className="text-2xl font-bold">{fc(totalRevenue)}</p>
                <p className="text-sm text-blue-600">{t('paymentManagement.netRecu')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder={t('paymentManagement.rechercherUnPaiement')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">{t('paymentManagement.tousLesStatuts')}</option>
              <option value="pending">En attente</option>
              <option value="overdue">En retard</option>
              <option value="success">{t('paymentManagement.payes')}</option>
              <option value="expired">{t('paymentManagement.expires')}</option>
              <option value="cancelled">{t('paymentManagement.annules')}</option>
            </select>
            <Filter className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Liste des paiements */}
      <Card>
        <CardHeader>
          <CardTitle>{t('paymentManagement.liensDePaiement')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLinks.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium">
                        {link.produit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID: {link.payment_id}
                      </p>
                      {link.client && (
                        <p className="text-xs text-muted-foreground">
                          Client: {link.client.name} ({link.client.email})
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[link.displayStatus]}>
                          {statusLabels[link.displayStatus]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Créé {formatDistanceToNow(new Date(link.created_at), {
                            addSuffix: true,
                            locale: fr
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-lg font-bold">{fc(link.total)}</p>
                      {link.remise && link.remise > 0 && (
                        <p className="text-xs text-muted-foreground line-through">
                          {fc(link.montant)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {link.remise && link.remise > 0
                          ? `Remise: ${link.type_remise === 'percentage' ? `${link.remise}%` : fc(link.remise)}`
                          : 'Montant total'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredLinks.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Aucun paiement trouvé
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
