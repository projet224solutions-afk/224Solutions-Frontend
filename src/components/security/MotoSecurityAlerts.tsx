/**
 * COMPOSANT GESTION ALERTES SÉCURITÉ MOTOS
 * Interface pour gérer les alertes de motos volées
 * 224Solutions - Module de sécurité intelligent
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Shield,
    AlertTriangle,
    CheckCircle,
    Clock,
    MapPin,
    User,
    Building,
    Calendar,
    Eye,
    RefreshCw,
    Search,
    Loader2,
    FileText,
    Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MotoAlert {
    id: string;
    numero_serie: string;
    vin?: string;
    statut: 'en_cours' | 'resolue' | 'faux_positif';
    ville_signalement: string;
    ville_detection?: string;
    description: string;
    created_at: string;
    resolved_at?: string;
    bureau_origine?: {
        bureau_code: string;
        prefecture: string;
        commune: string;
    };
    bureau_detection?: {
        bureau_code: string;
        prefecture: string;
        commune: string;
    };
    chauffeur?: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
    };
}

interface SecurityStats {
    total_alertes: number;
    alertes_en_cours: number;
    alertes_resolues: number;
    faux_positifs: number;
    motos_uniques_signalées: number;
    temps_moyen_resolution_heures: number;
}

interface MotoSecurityAlertsProps {
    bureauId?: string;
    isPDG?: boolean;
    className?: string;
}

export default function MotoSecurityAlerts({
    bureauId,
    _isPDG = false,
    className
}: MotoSecurityAlertsProps) {
    const { t } = useTranslation();
    const [alerts, setAlerts] = useState<MotoAlert[]>([]);
    const [stats, setStats] = useState<SecurityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'en_cours' | 'resolue' | 'faux_positif'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadAlerts();
        loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bureauId, filter]);

    const loadAlerts = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (bureauId) params.append('bureau_id', bureauId);
            if (filter !== 'all') params.append('statut', filter);

            const response = await fetch(`/api/moto-security/alerts?${params}`);
            const result = await response.json();

            if (result.success) {
                setAlerts(result.alerts || []);
            } else {
                toast.error(t('motoSecurityAlerts.erreurLorsDuChargementDes'));
            }
        } catch (error) {
            console.error('❌ Erreur chargement alertes:', error);
            toast.error(t('motoSecurityAlerts.erreurDeConnexion'));
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const params = new URLSearchParams();
            if (bureauId) params.append('bureau_id', bureauId);

            const response = await fetch(`/api/moto-security/stats?${params}`);
            const result = await response.json();

            if (result.success) {
                setStats(result.global_stats);
            }
        } catch (error) {
            console.error('❌ Erreur chargement stats:', error);
        }
    };

    const resolveAlert = async (alertId: string) => {
        try {
            setResolving(alertId);

            const response = await fetch(`/api/moto-security/alerts/${alertId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: 'current-user-id', // À remplacer par l'ID utilisateur réel
                    resolution_type: 'resolue'
                })
            });

            const result = await response.json();

            if (result.success) {
                toast.success(t('motoSecurityAlerts.alerteResolueAvecSucces'));
                loadAlerts();
                loadStats();
            } else {
                toast.error(t('motoSecurityAlerts.erreurLorsDeLaResolution'));
            }
        } catch (error) {
            console.error('❌ Erreur résolution alerte:', error);
            toast.error(t('motoSecurityAlerts.erreurDeConnexion'));
        } finally {
            setResolving(null);
        }
    };

    const getStatusColor = (statut: string) => {
        switch (statut) {
            case 'en_cours': return 'bg-orange-100 text-[#ff4000] border-orange-200';
            case 'resolue': return 'bg-orange-100 text-[#ff4000] border-orange-200';
            case 'faux_positif': return 'bg-orange-100 text-[#ff4000] border-orange-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (statut: string) => {
        switch (statut) {
            case 'en_cours': return <AlertTriangle className="w-4 h-4" />;
            case 'resolue': return <CheckCircle className="w-4 h-4" />;
            case 'faux_positif': return <Clock className="w-4 h-4" />;
            default: return <Activity className="w-4 h-4" />;
        }
    };

    const getStatusLabel = (statut: string) => {
        switch (statut) {
            case 'en_cours': return 'En cours';
            case 'resolue': return 'Résolue';
            case 'faux_positif': return 'Faux positif';
            default: return statut;
        }
    };

    const filteredAlerts = alerts.filter(alert => {
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                alert.numero_serie.toLowerCase().includes(searchLower) ||
                alert.ville_signalement.toLowerCase().includes(searchLower) ||
                alert.description.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Statistiques */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border-orange-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#ff4000]">Alertes en cours</p>
                                    <p className="text-2xl font-bold text-[#ff4000]">{stats.alertes_en_cours}</p>
                                </div>
                                <AlertTriangle className="w-8 h-8 text-[#ff4000]" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-orange-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#ff4000]">{t('motoSecurityAlerts.resolues')}</p>
                                    <p className="text-2xl font-bold text-[#ff4000]">{stats.alertes_resolues}</p>
                                </div>
                                <CheckCircle className="w-8 h-8 text-[#ff4000]" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-blue-600">Total alertes</p>
                                    <p className="text-2xl font-bold text-blue-800">{stats.total_alertes}</p>
                                </div>
                                <Shield className="w-8 h-8 text-blue-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#04439e]">Motos uniques</p>
                                    <p className="text-2xl font-bold text-[#04439e]">{stats.motos_uniques_signalées}</p>
                                </div>
                                <Activity className="w-8 h-8 text-[#04439e]" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Interface principale */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-6 h-6 text-blue-600" />
                            Alertes de sécurité motos
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button
                                onClick={loadAlerts}
                                variant="outline"
                                size="sm"
                                disabled={loading}
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Actualiser
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {/* Filtres */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder={t('motoSecurityAlerts.rechercherParNumeroDeSerie')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {['all', 'en_cours', 'resolue', 'faux_positif'].map((status) => (
                                <Button
                                    key={status}
                                    variant={filter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilter(status as unknown)}
                                >
                                    {status === 'all' ? 'Toutes' :
                                     status === 'en_cours' ? 'En cours' :
                                     status === 'resolue' ? 'Résolues' : 'Faux positifs'}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Liste des alertes */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-2">{t('motoSecurityAlerts.chargementDesAlertes')}</span>
                        </div>
                    ) : filteredAlerts.length === 0 ? (
                        <div className="text-center py-8">
                            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">{t('motoSecurityAlerts.aucuneAlerteTrouvee')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredAlerts.map((alert) => (
                                <Card key={alert.id} className="border-l-4 border-l-red-500">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Badge className={getStatusColor(alert.statut)}>
                                                        {getStatusIcon(alert.statut)}
                                                        <span className="ml-1">{getStatusLabel(alert.statut)}</span>
                                                    </Badge>
                                                    <span className="font-mono text-sm text-gray-600">
                                                        {alert.numero_serie}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                    <div>
                                                        <p className="text-sm text-gray-600 mb-1">
                                                            <MapPin className="w-4 h-4 inline mr-1" />
                                                            Ville signalement: {alert.ville_signalement}
                                                        </p>
                                                        {alert.ville_detection && (
                                                            <p className="text-sm text-gray-600 mb-1">
                                                                <MapPin className="w-4 h-4 inline mr-1" />
                                                                Ville détection: {alert.ville_detection}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600 mb-1">
                                                            <Calendar className="w-4 h-4 inline mr-1" />
                                                            {formatDistanceToNow(new Date(alert.created_at), {
                                                                addSuffix: true,
                                                                locale: fr
                                                            })}
                                                        </p>
                                                        {alert.chauffeur && (
                                                            <p className="text-sm text-gray-600">
                                                                <User className="w-4 h-4 inline mr-1" />
                                                                {alert.chauffeur.first_name} {alert.chauffeur.last_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {alert.description && (
                                                    <p className="text-sm text-gray-700 mb-3">
                                                        <FileText className="w-4 h-4 inline mr-1" />
                                                        {alert.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    {alert.bureau_origine && (
                                                        <span>
                                                            <Building className="w-3 h-3 inline mr-1" />
                                                            Origine: {alert.bureau_origine.bureau_code}
                                                        </span>
                                                    )}
                                                    {alert.bureau_detection && (
                                                        <span>
                                                            <Building className="w-3 h-3 inline mr-1" />
                                                            Détection: {alert.bureau_detection.bureau_code}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 ml-4">
                                                {alert.statut === 'en_cours' && (
                                                    <Button
                                                        onClick={() => resolveAlert(alert.id)}
                                                        disabled={resolving === alert.id}
                                                        size="sm"
                                                        className="bg-[#ff4000] hover:bg-[#ff4000]"
                                                    >
                                                        {resolving === alert.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle className="w-4 h-4 mr-1" />
                                                        )}
                                                        Résoudre
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    Détails
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
