/**
 * PANEL DE SYNCHRONISATION OFFLINE
 * Interface utilisateur pour la gestion du mode hors-ligne
 * 224SOLUTIONS - Interface Vendeur
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
    _Clock,
    Upload,
    Download,
    _History,
    Trash2,
    Eye,
    FileText,
    _Image,
    Receipt
} from "lucide-react";
import { toast } from "sonner";
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineSyncPanel() {
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
        _updateSyncStats,
        hasPendingEvents,
        hasFailedEvents
    } = useOfflineSync();

    const [syncHistory, setSyncHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // Mettre à jour l'historique
    const updateHistory = async () => {
        const history = await getSyncHistory();
        setSyncHistory(history);
    };

    useEffect(() => {
        updateHistory();
        const interval = setInterval(updateHistory, 10000); // Mise à jour toutes les 10s
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Gestionnaire de synchronisation forcée
    const handleForceSync = async () => {
        await forceSync();
        await updateHistory();
    };

    // Gestionnaire de nettoyage des erreurs
    const handleClearErrors = () => {
        clearSyncErrors();
        toast.success(t('offlineSyncPanel.erreursEffacees'));
    };

    // Icône de statut de connexion
    const getConnectionIcon = () => {
        if (isSyncing) {
            return <RefreshCw className="w-4 h-4 animate-spin" />;
        }
        return isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;
    };

    // Couleur du badge de statut
    const getStatusColor = () => {
        if (isSyncing) return "bg-blue-500";
        if (!isOnline) return "bg-[#ff4000]";
        if (hasFailedEvents) return "bg-orange-500";
        if (hasPendingEvents) return "bg-[#ff4000]";
        return "bg-[#ff4000]";
    };

    // Texte du statut
    const getStatusText = () => {
        if (isSyncing) return "Synchronisation...";
        if (!isOnline) return "Hors ligne";
        if (hasFailedEvents) return "Erreurs de sync";
        if (hasPendingEvents) return "En attente";
        return "Synchronisé";
    };

    // Icône par type d'événement
    const getEventIcon = (type) => {
        switch (type) {
            case 'sale': return <Receipt className="w-4 h-4" />;
            case 'receipt': return <FileText className="w-4 h-4" />;
            case 'invoice': return <FileText className="w-4 h-4" />;
            case 'payment': return <Download className="w-4 h-4" />;
            case 'upload': return <Upload className="w-4 h-4" />;
            default: return <FileText className="w-4 h-4" />;
        }
    };

    // Couleur par statut
    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'synced': return 'bg-orange-100 text-[#ff4000]';
            case 'pending': return 'bg-orange-100 text-[#ff4000]';
            case 'failed': return 'bg-orange-100 text-[#ff4000]';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50 shadow-lg">
            <CardHeader className="bg-[#04439e] text-white rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getConnectionIcon()}
                        <span>Synchronisation Offline</span>
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

                    {/* Onglet Statut */}
                    <TabsContent value="status" className="space-y-4">
                        {/* Statistiques générales */}
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
                                <div className="text-sm text-gray-600">{t('offlineSyncPanel.synchronises')}</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                <div className="text-2xl font-bold text-[#ff4000]">{syncStats.failed}</div>
                                <div className="text-sm text-gray-600">{t('offlineSyncPanel.echoues')}</div>
                            </div>
                        </div>

                        {/* Barre de progression */}
                        {syncStats.total > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>{t('offlineSyncPanel.progressionDeSynchronisation')}</span>
                                    <span>{Math.round((syncStats.synced / syncStats.total) * 100)}%</span>
                                </div>
                                <Progress
                                    value={(syncStats.synced / syncStats.total) * 100}
                                    className="h-2"
                                />
                            </div>
                        )}

                        {/* Dernière synchronisation */}
                        {lastSyncTime && (
                            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-center gap-2 text-[#ff4000]">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="font-medium">{t('offlineSyncPanel.derniereSynchronisation')}</span>
                                </div>
                                <div className="text-sm text-[#ff4000] mt-1">
                                    {new Date(lastSyncTime).toLocaleString()}
                                </div>
                            </div>
                        )}

                        {/* Erreurs de synchronisation */}
                        {syncErrors.length > 0 && (
                            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[#ff4000]">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="font-medium">{t('offlineSyncPanel.erreursDeSynchronisation')}</span>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={handleClearErrors}>
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        Effacer
                                    </Button>
                                </div>
                                <div className="text-sm text-[#ff4000] mt-2">
                                    {syncErrors.slice(0, 3).map((error, index) => (
                                        <div key={index}>• {error}</div>
                                    ))}
                                    {syncErrors.length > 3 && (
                                        <div>... et {syncErrors.length - 3} autres erreurs</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Onglet Historique */}
                    <TabsContent value="history" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-gray-800">{t('offlineSyncPanel.historiqueDesEvenements')}</h3>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowHistory(!showHistory)}
                            >
                                <Eye className="w-4 h-4 mr-1" />
                                {showHistory ? 'Masquer' : 'Afficher'}
                            </Button>
                        </div>

                        {showHistory && (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {syncHistory.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500">
                                        Aucun événement dans l'historique
                                    </div>
                                ) : (
                                    syncHistory.slice(0, 20).map((event) => (
                                        <div key={event.client_event_id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3">
                                                {getEventIcon(event.type)}
                                                <div>
                                                    <div className="font-medium text-gray-800 capitalize">
                                                        {event.type}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {new Date(event.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge className={getStatusBadgeColor(event.status)}>
                                                {event.status}
                                            </Badge>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* Onglet Actions */}
                    <TabsContent value="actions" className="space-y-4">
                        <div className="space-y-3">
                            {/* Bouton de synchronisation forcée */}
                            <Button
                                onClick={handleForceSync}
                                disabled={!isOnline || isSyncing}
                                className="w-full"
                                variant={isOnline ? "default" : "outline"}
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

                            {/* Informations de connexion */}
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    {isOnline ? (
                                        <>
                                            <Wifi className="w-4 h-4 text-[#ff4000]" />
                                            <span className="font-medium text-[#ff4000]">{t('offlineSyncPanel.connexionActive')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff className="w-4 h-4 text-[#ff4000]" />
                                            <span className="font-medium text-[#ff4000]">Mode hors-ligne</span>
                                        </>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {isOnline
                                        ? "Vos données se synchronisent automatiquement"
                                        : "Vos données seront synchronisées à la reconnexion"
                                    }
                                </div>
                            </div>

                            {/* Statistiques par type */}
                            {Object.keys(syncStats.by_type).length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-medium text-gray-800">{t('offlineSyncPanel.parTypeDEvenement')}</h4>
                                    {Object.entries(syncStats.by_type).map(([type, stats]) => (
                                        <div key={type} className="flex items-center justify-between p-2 bg-white rounded border">
                                            <div className="flex items-center gap-2">
                                                {getEventIcon(type)}
                                                <span className="capitalize">{type}</span>
                                            </div>
                                            <div className="flex gap-2 text-sm">
                                                <span className="text-[#ff4000]">{(stats as unknown)?.pending || 0}</span>
                                                <span className="text-[#ff4000]">{(stats as unknown)?.synced || 0}</span>
                                                <span className="text-[#ff4000]">{(stats as unknown)?.failed || 0}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
