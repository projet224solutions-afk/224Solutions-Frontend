/**
 * PANEL DE SYNCHRONISATION OFFLINE - BUREAU SYNDICAT
 * Interface de gestion du mode hors ligne pour le bureau
 * 224SOLUTIONS - Bureau Syndicat
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Wifi,
    WifiOff,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Bike,
    User,
    Shield,
    Trash2
} from "lucide-react";
import { useBureauOfflineSync } from '@/hooks/useBureauOfflineSync';

interface Props {
  bureauId: string;
}

export default function BureauOfflineSyncPanel({ bureauId }: Props) {
    const { t } = useTranslation();
    const {
        isOnline,
        isSyncing,
        syncStats,
        lastSyncTime,
        syncErrors,
        forceSync,
        clearSyncErrors,
        getSyncHistory,
        updateSyncStats,
        hasPendingEvents,
        hasFailedEvents
    } = useBureauOfflineSync(bureauId);

    const [syncHistory, setSyncHistory] = useState<any>(null);

    useEffect(() => {
        const loadHistory = async () => {
            const history = await getSyncHistory();
            setSyncHistory(history);
        };
        loadHistory();
        const interval = setInterval(loadHistory, 10000);
        return () => clearInterval(interval);
    }, [getSyncHistory]);

    const handleForceSync = async () => {
        await forceSync();
        const history = await getSyncHistory();
        setSyncHistory(history);
    };

    const getStatusColor = () => {
        if (isSyncing) return "bg-blue-500";
        if (!isOnline) return "bg-[#ff4000]";
        if (hasFailedEvents) return "bg-orange-500";
        if (hasPendingEvents) return "bg-[#ff4000]";
        return "bg-[#ff4000]";
    };

    const getStatusText = () => {
        if (isSyncing) return "Synchronisation...";
        if (!isOnline) return "Hors ligne";
        if (hasFailedEvents) return "Erreurs de sync";
        if (hasPendingEvents) return "En attente";
        return "Synchronisé";
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'moto_registration': return <Bike className="w-4 h-4" />;
            case 'member_update': return <User className="w-4 h-4" />;
            case 'security_alert': return <Shield className="w-4 h-4" />;
            default: return <CheckCircle className="w-4 h-4" />;
        }
    };

    return (
        <Card className="border-blue-200 bg-[#04439e]/5 shadow-lg">
            <CardHeader className="bg-[#04439e] text-white rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isSyncing ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : isOnline ? (
                            <Wifi className="w-5 h-5" />
                        ) : (
                            <WifiOff className="w-5 h-5" />
                        )}
                        <span>Synchronisation Bureau</span>
                    </div>
                    <Badge className={`${getStatusColor()} text-white`}>
                        {getStatusText()}
                    </Badge>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-6">
                <Tabs defaultValue="status" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="status">Statut</TabsTrigger>
                        <TabsTrigger value="history">Historique</TabsTrigger>
                        <TabsTrigger value="actions">Actions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="status" className="space-y-4">
                        {/* Statistiques */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                <div className="text-2xl font-bold text-blue-600">{syncStats.total}</div>
                                <div className="text-sm text-gray-600">Total</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                <div className="text-2xl font-bold text-[#ff4000]">{syncStats.pending}</div>
                                <div className="text-sm text-gray-600">En attente</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                <div className="text-2xl font-bold text-[#ff4000]">{syncStats.synced}</div>
                                <div className="text-sm text-gray-600">{t('bureauOfflineSyncPanel.synchronises')}</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                <div className="text-2xl font-bold text-[#ff4000]">{syncStats.failed}</div>
                                <div className="text-sm text-gray-600">{t('bureauOfflineSyncPanel.echoues')}</div>
                            </div>
                        </div>

                        {/* Progression */}
                        {syncStats.total > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Progression</span>
                                    <span>{Math.round((syncStats.synced / syncStats.total) * 100)}%</span>
                                </div>
                                <Progress
                                    value={(syncStats.synced / syncStats.total) * 100}
                                    className="h-2"
                                />
                            </div>
                        )}

                        {/* Dernière sync */}
                        {lastSyncTime && (
                            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-center gap-2 text-[#ff4000]">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="font-medium">{t('bureauOfflineSyncPanel.derniereSynchronisation')}</span>
                                </div>
                                <div className="text-sm text-[#ff4000] mt-1">
                                    {lastSyncTime.toLocaleString('fr-FR')}
                                </div>
                            </div>
                        )}

                        {/* Erreurs */}
                        {syncErrors.length > 0 && (
                            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[#ff4000]">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="font-medium">Erreurs ({syncErrors.length})</span>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={clearSyncErrors}>
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        Effacer
                                    </Button>
                                </div>
                                <div className="text-sm text-[#ff4000] mt-2 space-y-1">
                                    {syncErrors.slice(0, 3).map((error, index) => (
                                        <div key={index}>• {error}</div>
                                    ))}
                                    {syncErrors.length > 3 && (
                                        <div>... et {syncErrors.length - 3} autres</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                        <h3 className="font-semibold text-gray-800">{t('bureauOfflineSyncPanel.activiteRecente')}</h3>
                        {syncHistory && Object.keys(syncHistory.by_type).length > 0 ? (
                            <div className="space-y-2">
                                {Object.entries(syncHistory.by_type).map(([type, stats]: [string, any]) => (
                                    <div key={type} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            {getEventIcon(type)}
                                            <span className="capitalize font-medium">{type.replace('_', ' ')}</span>
                                        </div>
                                        <div className="flex gap-3 text-sm">
                                            <span className="text-[#ff4000]">⏳ {stats.pending || 0}</span>
                                            <span className="text-[#ff4000]">✅ {stats.synced || 0}</span>
                                            <span className="text-[#ff4000]">❌ {stats.failed || 0}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                Aucune activité récente
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="actions" className="space-y-4">
                        <Button
                            onClick={handleForceSync}
                            disabled={!isOnline || isSyncing}
                            className="w-full"
                            size="lg"
                        >
                            {isSyncing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Synchronisation en cours...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Forcer la synchronisation
                                </>
                            )}
                        </Button>

                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                                {isOnline ? (
                                    <>
                                        <Wifi className="w-5 h-5 text-[#ff4000]" />
                                        <span className="font-medium text-[#ff4000]">Mode en ligne</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="w-5 h-5 text-[#ff4000]" />
                                        <span className="font-medium text-[#ff4000]">Mode hors ligne</span>
                                    </>
                                )}
                            </div>
                            <p className="text-sm text-gray-600">
                                {isOnline
                                    ? "Toutes les données sont synchronisées automatiquement"
                                    : "Les données seront synchronisées dès la reconnexion"
                                }
                            </p>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">💡 Fonctionnement hors ligne</h4>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>{t('bureauOfflineSyncPanel.enregistrementDeMotos')}</li>
                                <li>{t('bureauOfflineSyncPanel.miseAJourDesMembres')}</li>
                                <li>{t('bureauOfflineSyncPanel.alertesDeSecurite')}</li>
                                <li>{t('bureauOfflineSyncPanel.consultationDeLHistoriqueLocal')}</li>
                            </ul>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
