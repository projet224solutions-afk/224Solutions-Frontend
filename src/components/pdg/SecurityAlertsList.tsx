// ⚠️ Liste des alertes de sécurité
import React from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Bell, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SecurityAlert } from '@/hooks/useSecurityOps';

interface Props {
  alerts: SecurityAlert[];
  onAcknowledge: (id: string) => void;
}

const SecurityAlertsList: React.FC<Props> = ({ alerts, onAcknowledge }) => {
  const { t } = useTranslation();
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-bold">{t('securityAlertsList.alertesDeSecurite')}</h3>
        <p className="text-muted-foreground">{t('securityAlertsList.alertesTempsReelNecessitantAttention')}</p>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <Card key={alert.id} className={!alert.acknowledged ? 'border-[#ff4000]' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {alert.acknowledged ? (
                    <Check className="h-5 w-5 text-[#ff4000]" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-[#ff4000] animate-pulse" />
                  )}
                  <div>
                    <CardTitle className="text-base">{alert.description}</CardTitle>
                    <CardDescription className="mt-1">
                      {alert.alert_type} • {new Date(alert.created_at).toLocaleString('fr-FR')}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant={getSeverityColor(alert.severity)}>
                    {alert.severity}
                  </Badge>
                  {!alert.acknowledged && (
                    <Button size="sm" variant="outline" onClick={() => onAcknowledge(alert.id)}>
                      <Check className="h-4 w-4 mr-1" />
                      Reconnaître
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {alert.auto_actions && (
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">Action Auto</Badge>
                  <span className="text-muted-foreground">{JSON.stringify(alert.auto_actions)}</span>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {alerts.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">{t('securityAlertsList.aucuneAlerteActive')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SecurityAlertsList;
