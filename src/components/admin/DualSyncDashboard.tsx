/**
 * TABLEAU DE BORD SYNCHRONISATION DUAL
 * Interface de gestion Firestore ↔ Supabase
 * 224SOLUTIONS - Administration
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Database,
  Cloud,
  ArrowLeftRight,
  Play,
  Pause,
  Trash2,
  BarChart3
} from "lucide-react";
import { useDualSync } from '@/hooks/useDualSync';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DualSyncDashboard() {
  const { t } = useTranslation();
  const {
    status,
    syncAll,
    enableRealTimeSync,
    disableRealTimeSync,
    clearErrors,
    hasErrors,
    isSyncing
  } = useDualSync();

  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  const handleEnableRealtime = () => {
    if (realtimeEnabled) {
      disableRealTimeSync();
      setRealtimeEnabled(false);
    } else {
      enableRealTimeSync();
      setRealtimeEnabled(true);
    }
  };

  const handleSyncFirestoreToSupabase = async () => {
    await syncAll('firestore-to-supabase');
  };

  const handleSyncSupabaseToFirestore = async () => {
    await syncAll('supabase-to-firestore');
  };

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50">
      <CardHeader className="bg-gradient-to-r from-[#04439e] to-[#04439e] text-white rounded-t-lg">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            <span>Synchronisation Dual</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.isFirestoreConnected ? "default" : "destructive"} className="bg-orange-500">
              <Database className="w-3 h-3 mr-1" />
              Firestore
            </Badge>
            <Badge variant={status.isSupabaseConnected ? "default" : "destructive"} className="bg-[#ff4000]">
              <Cloud className="w-3 h-3 mr-1" />
              Supabase
            </Badge>
          </div>
        </CardTitle>
        <CardDescription className="text-blue-100">
          Gestion de la synchronisation bidirectionnelle entre Firestore et Supabase
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6">
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Statut</TabsTrigger>
            <TabsTrigger value="sync">Synchronisation</TabsTrigger>
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
          </TabsList>

          {/* Onglet Statut */}
          <TabsContent value="status" className="space-y-4">
            {/* État de connexion */}
            <div className="grid grid-cols-2 gap-4">
              <Card className={status.isFirestoreConnected ? 'bg-orange-50 border-orange-200' : 'bg-orange-50 border-orange-200'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className={`w-5 h-5 ${status.isFirestoreConnected ? 'text-[#ff4000]' : 'text-[#ff4000]'}`} />
                      <span className="font-medium">Firestore</span>
                    </div>
                    {status.isFirestoreConnected ? (
                      <CheckCircle className="w-5 h-5 text-[#ff4000]" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                    )}
                  </div>
                  <p className="text-sm mt-2">
                    {status.isFirestoreConnected ? 'Connecté' : 'Déconnecté'}
                  </p>
                </CardContent>
              </Card>

              <Card className={status.isSupabaseConnected ? 'bg-orange-50 border-orange-200' : 'bg-orange-50 border-orange-200'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className={`w-5 h-5 ${status.isSupabaseConnected ? 'text-[#ff4000]' : 'text-[#ff4000]'}`} />
                      <span className="font-medium">Supabase</span>
                    </div>
                    {status.isSupabaseConnected ? (
                      <CheckCircle className="w-5 h-5 text-[#ff4000]" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                    )}
                  </div>
                  <p className="text-sm mt-2">
                    {status.isSupabaseConnected ? 'Connecté' : 'Déconnecté'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Synchronisation temps réel */}
            <Card className={realtimeEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 ${realtimeEnabled ? 'animate-spin text-blue-600' : ''}`} />
                      Synchronisation en temps réel
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {realtimeEnabled ? 'Actif - Les changements sont synchronisés automatiquement' : 'Inactif'}
                    </p>
                  </div>
                  <Button
                    onClick={handleEnableRealtime}
                    variant={realtimeEnabled ? "destructive" : "default"}
                    size="sm"
                  >
                    {realtimeEnabled ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Désactiver
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Activer
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Dernière synchronisation */}
            {status.lastSync && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 text-[#ff4000]">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">{t('dualSyncDashboard.derniereSynchronisation')}</span>
                </div>
                <div className="text-sm text-[#ff4000] mt-1">
                  {status.lastSync.toLocaleString('fr-FR')}
                </div>
              </div>
            )}

            {/* Erreurs */}
            {hasErrors && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>{status.syncErrors.length} erreur(s) de synchronisation</strong>
                      <div className="mt-2 space-y-1">
                        {status.syncErrors.slice(0, 3).map((error, i) => (
                          <div key={i} className="text-sm">• {error}</div>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={clearErrors}>
                      <Trash2 className="w-3 h-3 mr-1" />
                      Effacer
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Onglet Synchronisation */}
          <TabsContent value="sync" className="space-y-4">
            <div className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-orange-600" />
                    Firestore → Supabase
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Synchronise toutes les données de Firestore vers Supabase
                  </p>
                  <Button
                    onClick={handleSyncFirestoreToSupabase}
                    disabled={!status.isFirestoreConnected || isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Synchronisation...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-4 h-4 mr-2" />
                        Synchroniser
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-[#ff4000]" />
                    Supabase → Firestore
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Synchronise toutes les données de Supabase vers Firestore
                  </p>
                  <Button
                    onClick={handleSyncSupabaseToFirestore}
                    disabled={!status.isFirestoreConnected || isSyncing}
                    className="w-full"
                    variant="secondary"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Synchronisation...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-4 h-4 mr-2" />
                        Synchroniser
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Onglet Statistiques */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                  <div className="text-2xl font-bold">{status.stats.firestore}</div>
                  <div className="text-sm text-gray-600">Firestore</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
                  <div className="text-2xl font-bold">{status.stats.supabase}</div>
                  <div className="text-sm text-gray-600">Supabase</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{status.stats.synced}</div>
                  <div className="text-sm text-gray-600">{t('dualSyncDashboard.synchronises')}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
                  <div className="text-2xl font-bold">{status.stats.failed}</div>
                  <div className="text-sm text-gray-600">{t('dualSyncDashboard.echecs')}</div>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <AlertDescription>
                <strong>📊 Synchronisation automatique</strong>
                <p className="mt-2 text-sm">
                  Lorsque la synchronisation en temps réel est activée, toutes les modifications
                  dans Firestore ou Supabase sont automatiquement répliquées dans l'autre base de données.
                </p>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
