import { useTranslation } from "@/hooks/useTranslation";
﻿/**
 * EMERGENCY PAGE - Page dédiée aux urgences
 * 224Solutions - Page complète de gestion des alertes
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, BarChart, Settings, History, ArrowLeft } from 'lucide-react';
import { EmergencyAlertsDashboard } from '@/components/emergency/EmergencyAlertsDashboard';
import { EmergencyStatsWidget } from '@/components/emergency/EmergencyStatsWidget';
import { useAuth } from '@/hooks/useAuth';
import { useActiveEmergencyAlerts, useEmergencyStats } from '@/hooks/useEmergency';

/**
 * Page principale Emergency
 */
export const EmergencyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Déterminer le rôle et le bureau
  const userRole = (user?.role as 'admin' | 'syndicat' | 'pdg') || 'syndicat';
  const bureauId = userRole === 'syndicat' ? (user as any)?.bureau_id : undefined;

  // Hooks
  const { alerts, count: _alertCount } = useActiveEmergencyAlerts(bureauId);
  const { stats, activeAlerts } = useEmergencyStats(bureauId);

  // Vérifier les permissions
  if (!user || !['admin', 'syndicat', 'pdg'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-16 w-16 text-[#ff4000] mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t('emergencyPage.accesRefuse')}</h2>
            <p className="text-muted-foreground mb-6">
              Seuls les administrateurs et les bureaux syndicats peuvent accéder au système d'urgence.
            </p>
            <Button onClick={() => navigate('/')}>
              Retour à l'Accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>

              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <AlertTriangle className={activeAlerts > 0 ? 'h-6 w-6 text-[#ff4000] animate-pulse' : 'h-6 w-6'} />
                  Système d'Urgence SOS
                </h1>
                <p className="text-sm text-muted-foreground">
                  {userRole === 'admin' ? 'Vue Globale' : 'Bureau Syndicat'}
                  {activeAlerts > 0 && (
                    <span className="ml-2 text-[#ff4000] font-semibold animate-pulse">
                      • {activeAlerts} alerte(s) active(s)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeAlerts > 0 && (
                <div className="bg-orange-100 text-[#ff4000] px-4 py-2 rounded-full font-bold text-sm animate-pulse">
                  🚨 {activeAlerts} URGENCE(S)
                </div>
              )}

              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('emergencyPage.connecteEnTantQue')}</p>
                <p className="text-sm font-medium">{(user as any)?.full_name || user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu Principal */}
      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl mb-6">
            <TabsTrigger value="dashboard">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Tableau de Bord
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart className="h-4 w-4 mr-2" />
              Statistiques
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Historique
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <EmergencyAlertsDashboard
              bureauId={bureauId}
              userRole={userRole}
              userId={user.id}
              userName={(user as any).full_name || user.email || 'Utilisateur'}
            />
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EmergencyStatsWidget
                bureauId={bureauId}
                compact={false}
                showDetails={true}
              />

              <Card>
                <CardHeader>
                  <CardTitle>{t('emergencyPage.analyseDesUrgences')}</CardTitle>
                  <CardDescription>
                    Données des 30 derniers jours
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Alertes</span>
                      <span className="text-2xl font-bold">{stats?.total_alerts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('emergencyPage.tauxDeResolution')}</span>
                      <span className="text-2xl font-bold text-[#ff4000]">
                        {stats?.total_alerts
                          ? Math.round(((stats.resolved_alerts || 0) / stats.total_alerts) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Taux Fausses Alertes</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {stats?.total_alerts
                          ? Math.round(((stats.false_alerts || 0) / stats.total_alerts) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>{t('emergencyPage.historiqueDesAlertes')}</CardTitle>
                <CardDescription>
                  Toutes les alertes (actives, résolues, fausses alertes)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-12">
                  Fonctionnalité en cours de développement
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>{t('emergencyPage.parametresDUrgence')}</CardTitle>
                <CardDescription>
                  Configuration du système d'alerte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3">Notifications</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">{t('emergencyPage.activerLesNotificationsPush')}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">{t('emergencyPage.activerLeSonDUrgence')}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">{t('emergencyPage.activerLesNotificationsParEmail')}</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Affichage</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">{t('emergencyPage.afficherLaCarteGpsAutomatiquement')}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">{t('emergencyPage.rafraichissementAutomatique30Secondes')}</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Les paramètres sont enregistrés automatiquement
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

/**
 * Page de détail d'une alerte spécifique
 */
export const EmergencyAlertDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!alertId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">ID d'alerte invalide</p>
            <Button onClick={() => navigate('/emergency')} className="mt-4">
              Retour aux Alertes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/emergency')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux Alertes
        </Button>

        <EmergencyAlertsDashboard
          userRole={(user?.role as any) || 'syndicat'}
          userId={user?.id || ''}
          userName={(user as any)?.full_name || user?.email || 'Utilisateur'}
        />
      </div>
    </div>
  );
};

export default EmergencyPage;
