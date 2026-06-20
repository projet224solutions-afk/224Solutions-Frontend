import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DisputeService } from '@/services/DisputeService';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function DisputesList() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDisputes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const loadDisputes = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const data = profile.role === 'admin'
        ? await DisputeService.getAllDisputes()
        : await DisputeService.getUserDisputes(profile.id);

      setDisputes(data);
    } catch (error) {
      console.error('[DisputesList] Error loading disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      open: { variant: 'default', icon: AlertCircle, label: 'Ouvert' },
      negotiating: { variant: 'secondary', icon: Clock, label: 'En négociation' },
      escalated: { variant: 'destructive', icon: AlertCircle, label: 'Escaladé' },
      ai_review: { variant: 'outline', icon: Clock, label: 'Analyse IA' },
      resolved: { variant: 'default', icon: CheckCircle, label: 'Résolu' },
      closed: { variant: 'secondary', icon: XCircle, label: 'Fermé' }
    };

    const config = variants[status] || variants.open;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getDisputeTypelabel = (type: string) => {
    const labels: Record<string, string> = {
      not_received: 'Non reçu',
      defective: 'Défectueux',
      incomplete: 'Incomplet',
      wrong_item: 'Mauvais article',
      other: 'Autre'
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="text-center py-8">{t('disputesList.chargementDesLitiges')}</div>;
  }

  if (disputes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucun litige en cours
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {disputes.map((dispute) => (
        <Card key={dispute.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{dispute.dispute_number}</CardTitle>
                <CardDescription>
                  {getDisputeTypelabel(dispute.dispute_type)} •
                  {format(new Date(dispute.created_at), 'PPP', { locale: fr })}
                </CardDescription>
              </div>
              {getStatusBadge(dispute.status)}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">{dispute.description}</p>

            {dispute.vendor_response && (
              <div className="bg-muted p-3 rounded-lg mb-4">
                <p className="text-sm font-medium mb-1">{t('disputesList.reponseDuVendeur')}</p>
                <p className="text-sm text-muted-foreground">{dispute.vendor_response}</p>
              </div>
            )}

            {dispute.ai_justification && (
              <div className="bg-primary/5 p-3 rounded-lg mb-4 border border-primary/20">
                <p className="text-sm font-medium mb-1">{t('disputesList.decisionIa')}</p>
                <p className="text-sm text-muted-foreground">{dispute.ai_justification}</p>
                {dispute.ai_confidence && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Confiance: {(dispute.ai_confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}

            {dispute.resolution && (
              <div className="bg-success/5 p-3 rounded-lg mb-4 border border-success/20">
                <p className="text-sm font-medium mb-1">{t('disputesList.resolution')}</p>
                <p className="text-sm text-muted-foreground">{dispute.resolution}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                Voir les détails
              </Button>
              {dispute.status === 'open' && profile?.role === 'vendeur' && (
                <Button size="sm">
                  Répondre
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}