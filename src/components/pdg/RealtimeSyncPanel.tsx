/**
 * PANEL SYNCHRONISATION TEMPS RÉEL PDG
 * Affichage des mises à jour en temps réel
 * 224Solutions - Bureau Syndicat System
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Activity,
    RefreshCw,
    Wifi,
    WifiOff,
    Clock,
    Users,
    Building2,
    AlertTriangle,
    DollarSign,
    CheckCircle,
    Trash2
} from 'lucide-react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RealtimeSyncPanelProps {
    className?: string;
}

export default function RealtimeSyncPanel({ className }: RealtimeSyncPanelProps) {
    const { t } = useTranslation();
    const {
        stats,
        updates,
        isConnected,
        lastSyncTime,
        forceSync,
        clearUpdates
    } = useRealtimeSync();

    const [showDetails, setShowDetails] = useState(false);

    const getUpdateIcon = (updateType: string) => {
        switch (updateType) {
            case 'member_added':
                return <Users className="w-4 h-4 text-[#ff4000]" />;
            case 'revenue_update':
                return <DollarSign className="w-4 h-4 text-blue-600" />;
            case 'sos_alert':
                return <AlertTriangle className="w-4 h-4 text-[#ff4000]" />;
            case 'status_change':
                return <Building2 className="w-4 h-4 text-[#04439e]" />;
            default:
                return <Activity className="w-4 h-4 text-gray-600" />;
        }
    };

    const getUpdateColor = (updateType: string) => {
        switch (updateType) {
            case 'member_added':
                return 'bg-orange-100 text-[#ff4000]';
            case 'revenue_update':
                return 'bg-blue-100 text-blue-800';
            case 'sos_alert':
                return 'bg-orange-100 text-[#ff4000]';
            case 'status_change':
                return 'bg-blue-100 text-[#04439e]';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getUpdateLabel = (updateType: string) => {
        switch (updateType) {
            case 'member_added':
                return 'Nouveau membre';
            case 'revenue_update':
                return 'Revenu mis à jour';
            case 'sos_alert':
                return 'Alerte SOS';
            case 'status_change':
                return 'Statut changé';
            default:
                return 'Mise à jour';
        }
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Statistiques en temps réel */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Synchronisation Temps Réel
                        <Badge
                            variant={isConnected ? "default" : "destructive"}
                            className={isConnected ? "bg-orange-100 text-[#ff4000]" : "bg-orange-100 text-[#ff4000]"}
                        >
                            {isConnected ? (
                                <>
                                    <Wifi className="w-3 h-3 mr-1" />
                                    Connecté
                                </>
                            ) : (
                                <>
                                    <WifiOff className="w-3 h-3 mr-1" />
                                    Déconnecté
                                </>
                            )}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{stats.totalBureaus}</div>
                            <div className="text-sm text-gray-600">Total Bureaux</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-[#ff4000]">{stats.activeBureaus}</div>
                            <div className="text-sm text-gray-600">Bureaux Actifs</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-[#04439e]">{stats.totalMembers}</div>
                            <div className="text-sm text-gray-600">Total Membres</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{stats.activeSOS}</div>
                            <div className="text-sm text-gray-600">Alertes SOS</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            Dernière sync: {formatDistanceToNow(lastSyncTime, {
                                addSuffix: true,
                                locale: fr
                            })}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={forceSync}
                                size="sm"
                                variant="outline"
                                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Forcer Sync
                            </Button>
                            <Button
                                onClick={() => setShowDetails(!showDetails)}
                                size="sm"
                                variant="outline"
                            >
                                {showDetails ? 'Masquer' : 'Détails'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Détails des mises à jour */}
            {showDetails && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                Mises à jour récentes
                            </span>
                            <div className="flex gap-2">
                                <Badge variant="outline">
                                    {updates.length} mise{updates.length > 1 ? 's' : ''} à jour
                                </Badge>
                                {updates.length > 0 && (
                                    <Button
                                        onClick={clearUpdates}
                                        size="sm"
                                        variant="outline"
                                        className="text-[#ff4000] border-orange-300 hover:bg-orange-50"
                                    >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Nettoyer
                                    </Button>
                                )}
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {updates.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>{t('realtimeSyncPanel.aucuneMiseAJourRecente')}</p>
                                <p className="text-sm">{t('realtimeSyncPanel.lesMisesAJourApparaitront')}</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-64">
                                <div className="space-y-3">
                                    {updates.map((update, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                                        >
                                            {getUpdateIcon(update.updateType)}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{update.bureauCode}</span>
                                                    <Badge className={getUpdateColor(update.updateType)}>
                                                        {getUpdateLabel(update.updateType)}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {formatDistanceToNow(new Date(update.timestamp), {
                                                        addSuffix: true,
                                                        locale: fr
                                                    })}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {update.updateType === 'sos_alert' && (
                                                    <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                                                )}
                                                {update.updateType === 'member_added' && (
                                                    <CheckCircle className="w-5 h-5 text-[#ff4000]" />
                                                )}
                                                {update.updateType === 'status_change' && (
                                                    <Building2 className="w-5 h-5 text-[#04439e]" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
