/**
 * SYSTÈME DE SÉCURISATION MOTOS VOLÉES
 * Interface Bureau Syndicat - Gestion des véhicules volés
 * 224Solutions - Sécurité Institutionnelle
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertTriangle,
    Shield,
    ShieldAlert,
    ShieldCheck,
    MapPin,
    Clock,
    Eye,
    FileText,
    Download,
    RefreshCw,
    Search,
    Lock,
    Unlock,
    Navigation,
    Smartphone,
    Activity,
    History,
    AlertCircle,
    CheckCircle,
    XCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StolenVehicle {
    id: string;
    serial_number: string;
    license_plate: string;
    brand: string;
    model: string;
    color: string;
    stolen_status: 'clean' | 'stolen' | 'recovered' | 'blocked';
    stolen_declared_at: string | null;
    stolen_reason: string | null;
    stolen_location: string | null;
    last_known_latitude: number | null;
    last_known_longitude: number | null;
    last_known_location_at: string | null;
    owner_member_id: string | null;
    owner_name?: string;
}

interface SecurityLog {
    id: string;
    vehicle_id: string;
    action: string;
    actor_type: string;
    description: string;
    latitude: number | null;
    longitude: number | null;
    ip_address: string | null;
    created_at: string;
    metadata: any;
}

interface FraudAlert {
    id: string;
    vehicle_id: string;
    alert_type: string;
    severity: string;
    description: string;
    detected_latitude: number | null;
    detected_longitude: number | null;
    is_resolved: boolean;
    created_at: string;
    vehicle?: StolenVehicle;
}

interface GPSTracking {
    id: string;
    vehicle_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    created_at: string;
    source?: 'syndicat' | 'taxi';
}

interface Props {
    bureauId: string;
}

export default function StolenVehicleManagement({ bureauId }: Props) {
    const { t } = useTranslation();
    const [stolenVehicles, setStolenVehicles] = useState<StolenVehicle[]>([]);
    const [allVehicles, setAllVehicles] = useState<StolenVehicle[]>([]);
    const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
    const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
    const [gpsTrackings, setGpsTrackings] = useState<GPSTracking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Dialogs
    const [showDeclareDialog, setShowDeclareDialog] = useState(false);
    const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
    const [showGPSDialog, setShowGPSDialog] = useState(false);
    const [_showLogDialog, _setShowLogDialog] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<StolenVehicle | null>(null);

    // Form states
    const [declareReason, setDeclareReason] = useState('');
    const [declareLocation, setDeclareLocation] = useState('');
    const [recoveryReason, setRecoveryReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        totalStolen: 0,
        totalRecovered: 0,
        pendingAlerts: 0,
        securityEvents30d: 0
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Charger tous les véhicules du bureau
            const { data: vehicles, error: vehiclesError } = await supabase
                .from('vehicles')
                .select(`
                    *,
                    syndicate_workers:owner_member_id(nom)
                `)
                .eq('bureau_id', bureauId);

            if (vehiclesError) throw vehiclesError;

            const formattedVehicles = (vehicles || []).map((v: any) => ({
                ...v,
                owner_name: v.syndicate_workers?.nom || 'Non assigné'
            }));

            console.log('🚗 Véhicules chargés:', {
                bureauId,
                total: formattedVehicles.length,
                stolen: formattedVehicles.filter((v: any) => v.stolen_status === 'stolen').length,
                vehicles: formattedVehicles.map((v: any) => ({ id: v.id, plate: v.license_plate, stolen_status: v.stolen_status }))
            });

            setAllVehicles(formattedVehicles);
            const stolenList = formattedVehicles.filter((v: any) => v.stolen_status === 'stolen');
            setStolenVehicles(stolenList);

            // Calculer les stats
            setStats({
                totalStolen: stolenList.length,
                totalRecovered: formattedVehicles.filter((v: any) => v.stolen_status === 'recovered').length,
                pendingAlerts: 0,
                securityEvents30d: 0
            });

            // Charger les alertes de fraude du bureau
            const { data: alerts, error: alertsError } = await supabase
                .from('vehicle_fraud_alerts')
                .select('*')
                .eq('bureau_id', bureauId)
                .eq('is_resolved', false)
                .order('created_at', { ascending: false });

            console.log('🔍 Alertes fraude chargées:', { bureauId, alerts, error: alertsError });

            if (!alertsError && alerts) {
                setFraudAlerts(alerts as FraudAlert[]);
                setStats(prev => ({ ...prev, pendingAlerts: alerts.length }));
            }

            // Charger le journal de sécurité
            const { data: logs, error: logsError } = await supabase
                .from('vehicle_security_log')
                .select('*')
                .eq('bureau_id', bureauId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (!logsError && logs) {
                setSecurityLogs(logs as SecurityLog[]);
                setStats(prev => ({ ...prev, securityEvents30d: logs.length }));
            }

        } catch (error) {
            console.error('Erreur chargement données:', error);
            toast.error(t('stolenVehicleManagement.erreurLorsDuChargementDes'));
        } finally {
            setLoading(false);
        }
    }, [bureauId]);

    useEffect(() => {
        loadData();

        // Real-time subscription pour les alertes
        const channel = supabase
            .channel(`stolen-vehicle-alerts-${bureauId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'vehicle_fraud_alerts'
            }, (payload) => {
                console.log('🚨 Nouvelle alerte fraude:', payload);
                loadData();
                if (payload.eventType === 'INSERT') {
                    toast.error(t('stolenVehicleManagement.nouvelleActiviteSuspecteDetectee'), {
                        description: t('stolenVehicleManagement.uneActiviteAEteDetectee'),
                        duration: 10000
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    const handleDeclareStolen = async () => {
        if (!selectedVehicle || !declareReason.trim()) {
            toast.error(t('stolenVehicleManagement.veuillezIndiquerLeMotifDe'));
            return;
        }

        setSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('declare_vehicle_stolen', {
                p_vehicle_id: selectedVehicle.id,
                p_bureau_id: bureauId,
                p_declared_by: bureauId, // Dans un vrai cas, utiliser l'ID de l'utilisateur
                p_reason: declareReason,
                p_location: declareLocation || null,
                p_ip_address: null,
                p_user_agent: navigator.userAgent
            });

            if (error) throw error;

            const result = data as { success: boolean; error?: string; message?: string };

            if (result.success) {
                toast.success(t('stolenVehicleManagement.motoDeclareeVolee'), {
                    description: t('stolenVehicleManagement.blocageGlobalActiveTousLes'),
                    duration: 8000
                });
                setShowDeclareDialog(false);
                setDeclareReason('');
                setDeclareLocation('');
                loadData();
            } else {
                toast.error(result.error || 'Erreur lors de la déclaration');
            }
        } catch (error: any) {
            console.error('Erreur déclaration vol:', error);
            toast.error(error.message || 'Erreur lors de la déclaration');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeclareRecovered = async () => {
        if (!selectedVehicle || !recoveryReason.trim()) {
            toast.error(t('stolenVehicleManagement.veuillezIndiquerLeMotifDe2'));
            return;
        }

        setSubmitting(true);
        try {
            // Signature réelle du RPC : (p_recovered_by, p_recovery_location, p_recovery_notes, p_vehicle_id)
            const { data, error } = await supabase.rpc('declare_vehicle_recovered', {
                p_recovered_by: bureauId,
                p_recovery_location: null,
                p_recovery_notes: recoveryReason,
                p_vehicle_id: selectedVehicle.id,
            });

            if (error) throw error;

            const result = data as { success: boolean; error?: string; message?: string };

            if (result.success) {
                toast.success(t('stolenVehicleManagement.vehiculeReactive'), {
                    description: t('stolenVehicleManagement.leBlocageAEteLeve'),
                    duration: 6000
                });
                setShowRecoveryDialog(false);
                setRecoveryReason('');
                loadData();
            } else {
                toast.error(result.error || 'Erreur lors de la réactivation');
            }
        } catch (error: any) {
            console.error('Erreur réactivation:', error);
            toast.error(error.message || 'Erreur lors de la réactivation');
        } finally {
            setSubmitting(false);
        }
    };

    const loadGPSHistory = async (vehicleId: string) => {
        try {
            // ✅ GPS unifié (positions syndicat + positions taxi) via RPC.
            // Repli sur la requête directe si le RPC n'est pas encore déployé.
            const { data: rpcData, error: rpcError } = await supabase.rpc(
                'get_vehicle_unified_gps' as any,
                { p_vehicle_id: vehicleId, p_limit: 50 }
            );

            if (!rpcError && Array.isArray(rpcData)) {
                setGpsTrackings((rpcData as any[]).map((r) => ({
                    id: crypto.randomUUID(),
                    vehicle_id: vehicleId,
                    latitude: Number(r.latitude),
                    longitude: Number(r.longitude),
                    accuracy: r.accuracy != null ? Number(r.accuracy) : null,
                    speed: r.speed != null ? Number(r.speed) : null,
                    created_at: r.created_at,
                    source: r.source as 'syndicat' | 'taxi' | undefined,
                })));
                return;
            }

            // Repli : ancienne requête directe sur la table syndicat
            const { data, error } = await supabase
                .from('vehicle_gps_tracking')
                .select('*')
                .eq('vehicle_id', vehicleId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setGpsTrackings((data || []) as GPSTracking[]);
        } catch (error) {
            console.error('Erreur chargement GPS:', error);
            toast.error(t('stolenVehicleManagement.erreurLorsDuChargementDe'));
        }
    };

    const resolveFraudAlert = async (alertId: string, notes: string) => {
        try {
            const { error } = await supabase
                .from('vehicle_fraud_alerts')
                .update({
                    is_resolved: true,
                    resolved_at: new Date().toISOString(),
                    resolved_by: bureauId,
                    resolution_notes: notes
                })
                .eq('id', alertId);

            if (error) throw error;
            toast.success(t('stolenVehicleManagement.alerteResolue'));
            loadData();
        } catch (error) {
            console.error('Erreur résolution alerte:', error);
            toast.error(t('stolenVehicleManagement.erreurLorsDeLaResolution'));
        }
    };

    const openGoogleMaps = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
    };

    const generatePDFReport = async (_vehicle: StolenVehicle) => {
        toast.info(t('stolenVehicleManagement.generationDuRapportPdfEn'));
        // TODO: Implémenter la génération PDF
    };

    const filteredVehicles = allVehicles.filter(v =>
        v.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'stolen':
                return <Badge className="bg-[#ff4000] text-white">{t('stolenVehicleManagement.volee')}</Badge>;
            case 'recovered':
                return <Badge className="bg-[#ff4000] text-white">{t('stolenVehicleManagement.retrouvee')}</Badge>;
            case 'blocked':
                return <Badge className="bg-orange-600 text-white">{t('stolenVehicleManagement.bloquee')}</Badge>;
            default:
                return <Badge className="bg-gray-500 text-white">Normal</Badge>;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-orange-100 border-[#ff4000] text-[#ff4000]';
            case 'high': return 'bg-orange-100 border-orange-500 text-orange-800';
            case 'medium': return 'bg-orange-100 border-[#ff4000] text-[#ff4000]';
            default: return 'bg-blue-100 border-blue-500 text-blue-800';
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'THEFT_DECLARED': return <ShieldAlert className="w-4 h-4 text-[#ff4000]" />;
            case 'RECOVERY_DECLARED': return <ShieldCheck className="w-4 h-4 text-[#ff4000]" />;
            case 'GPS_TRACKED': return <MapPin className="w-4 h-4 text-blue-600" />;
            case 'FRAUD_ATTEMPT': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
            default: return <Activity className="w-4 h-4 text-gray-600" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* En-tête avec statistiques */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-8 h-8 text-[#ff4000]" />
                            <div>
                                <p className="text-2xl font-bold text-[#ff4000]">{stats.totalStolen}</p>
                                <p className="text-sm text-[#ff4000]">{t('stolenVehicleManagement.motosVolees')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-8 h-8 text-[#ff4000]" />
                            <div>
                                <p className="text-2xl font-bold text-[#ff4000]">{stats.totalRecovered}</p>
                                <p className="text-sm text-[#ff4000]">{t('stolenVehicleManagement.retrouvees')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-8 h-8 text-orange-600" />
                            <div>
                                <p className="text-2xl font-bold text-orange-700">{stats.pendingAlerts}</p>
                                <p className="text-sm text-orange-600">Alertes actives</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <History className="w-8 h-8 text-blue-600" />
                            <div>
                                <p className="text-2xl font-bold text-blue-700">{stats.securityEvents30d}</p>
                                <p className="text-sm text-blue-600">{t('stolenVehicleManagement.evenements30j')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Alertes actives */}
            {fraudAlerts.length > 0 && (
                <Alert className="border-[#ff4000] bg-orange-50">
                    <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                    <AlertDescription className="text-[#ff4000]">
                        <strong>🚨 {fraudAlerts.length} alerte(s) de fraude non résolue(s)</strong>
                        <p className="text-sm mt-1">
                            Des activités suspectes ont été détectées sur des véhicules volés.
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            {/* Onglets principaux */}
            <Tabs defaultValue="vehicles" className="space-y-4">
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="vehicles" className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Véhicules
                    </TabsTrigger>
                    <TabsTrigger value="stolen" className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        Volées ({stats.totalStolen})
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Alertes ({fraudAlerts.length})
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Journal
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Tous les véhicules */}
                <TabsContent value="vehicles">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="w-5 h-5" />
                                    Gestion des véhicules
                                </CardTitle>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                        onClick={() => window.location.href = '/stolen-moto-declaration'}
                                        className="bg-[#ff4000] hover:bg-[#ff4000] text-white"
                                    >
                                        <ShieldAlert className="w-4 h-4 mr-2" />
                                        🚨 Déclarer Moto Volée
                                    </Button>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder={t('stolenVehicleManagement.rechercher')}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 w-64"
                                        />
                                    </div>
                                    <Button variant="outline" onClick={loadData}>
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('stolenVehicleManagement.nSerie')}</TableHead>
                                            <TableHead>Plaque</TableHead>
                                            <TableHead>{t('stolenVehicleManagement.vehicule')}</TableHead>
                                            <TableHead>{t('stolenVehicleManagement.proprietaire')}</TableHead>
                                            <TableHead>Statut</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredVehicles.map((vehicle) => (
                                            <TableRow key={vehicle.id} className={vehicle.stolen_status === 'stolen' ? 'bg-orange-50' : ''}>
                                                <TableCell className="font-mono">{vehicle.serial_number}</TableCell>
                                                <TableCell>{vehicle.license_plate}</TableCell>
                                                <TableCell>
                                                    {vehicle.brand} {vehicle.model}
                                                    {vehicle.color && <span className="text-muted-foreground ml-1">({vehicle.color})</span>}
                                                </TableCell>
                                                <TableCell>{vehicle.owner_name}</TableCell>
                                                <TableCell>{getStatusBadge(vehicle.stolen_status)}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        {vehicle.stolen_status !== 'stolen' ? (
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => {
                                                                    setSelectedVehicle(vehicle);
                                                                    setShowDeclareDialog(true);
                                                                }}
                                                            >
                                                                <Lock className="w-3 h-3 mr-1" />
                                                                Déclarer volée
                                                            </Button>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="border-[#ff4000] text-[#ff4000]"
                                                                    onClick={() => {
                                                                        setSelectedVehicle(vehicle);
                                                                        setShowRecoveryDialog(true);
                                                                    }}
                                                                >
                                                                    <Unlock className="w-3 h-3 mr-1" />
                                                                    Lever blocage
                                                                </Button>
                                                                {vehicle.last_known_latitude && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setSelectedVehicle(vehicle);
                                                                            loadGPSHistory(vehicle.id);
                                                                            setShowGPSDialog(true);
                                                                        }}
                                                                    >
                                                                        <MapPin className="w-3 h-3" />
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Motos volées */}
                <TabsContent value="stolen">
                    <Card className="border-orange-200">
                        <CardHeader className="bg-orange-50">
                            <CardTitle className="flex items-center gap-2 text-[#ff4000]">
                                <ShieldAlert className="w-5 h-5" />
                                Motos déclarées volées
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {stolenVehicles.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-[#ff4000]" />
                                    <p>{t('stolenVehicleManagement.aucuneMotoDeclareeVolee')}</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-4 p-4">
                                        {stolenVehicles.map((vehicle) => (
                                            <Card key={vehicle.id} className="border-orange-300 bg-orange-50">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge className="bg-[#ff4000] text-white">{t('stolenVehicleManagement.volee')}</Badge>
                                                                <span className="font-mono font-bold">{vehicle.license_plate}</span>
                                                            </div>
                                                            <p className="text-sm">
                                                                <strong>{t('stolenVehicleManagement.chassis')}</strong> {vehicle.serial_number}
                                                            </p>
                                                            <p className="text-sm">
                                                                <strong>{t('stolenVehicleManagement.vehicule2')}</strong> {vehicle.brand} {vehicle.model} {vehicle.color && `(${vehicle.color})`}
                                                            </p>
                                                            <p className="text-sm">
                                                                <strong>{t('stolenVehicleManagement.proprietaire2')}</strong> {vehicle.owner_name}
                                                            </p>
                                                            {vehicle.stolen_declared_at && (
                                                                <p className="text-sm text-[#ff4000]">
                                                                    <Clock className="w-3 h-3 inline mr-1" />
                                                                    Déclaré le {format(new Date(vehicle.stolen_declared_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                                                </p>
                                                            )}
                                                            {vehicle.stolen_location && (
                                                                <p className="text-sm text-[#ff4000]">
                                                                    <MapPin className="w-3 h-3 inline mr-1" />
                                                                    {vehicle.stolen_location}
                                                                </p>
                                                            )}
                                                            {vehicle.stolen_reason && (
                                                                <p className="text-sm italic text-[#ff4000]">
                                                                    "{vehicle.stolen_reason}"
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            {vehicle.last_known_latitude && vehicle.last_known_longitude && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => openGoogleMaps(vehicle.last_known_latitude!, vehicle.last_known_longitude!)}
                                                                >
                                                                    <Navigation className="w-3 h-3 mr-1" />
                                                                    Localiser
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setSelectedVehicle(vehicle);
                                                                    loadGPSHistory(vehicle.id);
                                                                    setShowGPSDialog(true);
                                                                }}
                                                            >
                                                                <Eye className="w-3 h-3 mr-1" />
                                                                Historique GPS
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => generatePDFReport(vehicle)}
                                                            >
                                                                <Download className="w-3 h-3 mr-1" />
                                                                Export PDF
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                className="bg-[#ff4000] hover:bg-[#ff4000]"
                                                                onClick={() => {
                                                                    setSelectedVehicle(vehicle);
                                                                    setShowRecoveryDialog(true);
                                                                }}
                                                            >
                                                                <Unlock className="w-3 h-3 mr-1" />
                                                                Lever blocage
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Alertes de fraude */}
                <TabsContent value="alerts">
                    <Card className="border-orange-200">
                        <CardHeader className="bg-orange-50">
                            <CardTitle className="flex items-center gap-2 text-orange-800">
                                <AlertTriangle className="w-5 h-5" />
                                Alertes de fraude
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {fraudAlerts.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[#ff4000]" />
                                    <p>{t('stolenVehicleManagement.aucuneAlerteDeFraudeActive')}</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-4 p-4">
                                        {fraudAlerts.map((alert) => (
                                            <Alert key={alert.id} className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
                                                <AlertTriangle className="w-5 h-5" />
                                                <AlertDescription>
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge variant="outline" className="text-xs">
                                                                    {alert.alert_type}
                                                                </Badge>
                                                                <Badge variant="destructive" className="text-xs">
                                                                    {alert.severity.toUpperCase()}
                                                                </Badge>
                                                            </div>
                                                            <p className="font-medium">{alert.description}</p>
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                <Clock className="w-3 h-3 inline mr-1" />
                                                                {format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {alert.detected_latitude && alert.detected_longitude && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => openGoogleMaps(alert.detected_latitude!, alert.detected_longitude!)}
                                                                >
                                                                    <MapPin className="w-3 h-3" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-[#ff4000] text-[#ff4000]"
                                                                onClick={() => resolveFraudAlert(alert.id, 'Résolu par bureau')}
                                                            >
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                Résoudre
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </AlertDescription>
                                            </Alert>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Journal de sécurité */}
                <TabsContent value="logs">
                    <Card className="border-blue-200">
                        <CardHeader className="bg-blue-50">
                            <CardTitle className="flex items-center gap-2 text-blue-800">
                                <History className="w-5 h-5" />
                                Journal de sécurité (inaltérable)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date/Heure</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Localisation</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {securityLogs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-sm">
                                                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {getActionIcon(log.action)}
                                                        <span className="text-sm font-medium">{log.action}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm max-w-xs truncate">
                                                    {log.description}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {log.actor_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {log.latitude && log.longitude ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => openGoogleMaps(log.latitude!, log.longitude!)}
                                                        >
                                                            <MapPin className="w-3 h-3" />
                                                        </Button>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog: Déclarer volée */}
            <Dialog open={showDeclareDialog} onOpenChange={setShowDeclareDialog}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[#ff4000]">
                            <ShieldAlert className="w-5 h-5" />
                            Déclarer une moto volée
                        </DialogTitle>
                        <DialogDescription>
                            Cette action bloquera immédiatement le véhicule dans tout le système.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedVehicle && (
                        <div className="space-y-4">
                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <h4 className="font-semibold text-[#ff4000] mb-2">{t('stolenVehicleManagement.vehiculeConcerne')}</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><strong>Plaque:</strong> {selectedVehicle.license_plate}</div>
                                    <div><strong>{t('stolenVehicleManagement.chassis')}</strong> {selectedVehicle.serial_number}</div>
                                    <div><strong>{t('stolenVehicleManagement.vehicule2')}</strong> {selectedVehicle.brand} {selectedVehicle.model}</div>
                                    <div><strong>{t('stolenVehicleManagement.proprietaire2')}</strong> {selectedVehicle.owner_name}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reason">{t('stolenVehicleManagement.motifDeLaDeclaration')}</Label>
                                <Textarea
                                    id="reason"
                                    placeholder={t('stolenVehicleManagement.decrivezLesCirconstancesDuVol')}
                                    value={declareReason}
                                    onChange={(e) => setDeclareReason(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="location">{t('stolenVehicleManagement.lieuDuVol')}</Label>
                                <Input
                                    id="location"
                                    placeholder="Ex: Conakry, Ratoma"
                                    value={declareLocation}
                                    onChange={(e) => setDeclareLocation(e.target.value)}
                                />
                            </div>

                            <Alert className="border-[#ff4000] bg-orange-50">
                                <AlertTriangle className="w-4 h-4 text-[#ff4000]" />
                                <AlertDescription className="text-[#ff4000] text-sm">
                                    <strong>Attention:</strong> Cette action est irréversible sans validation.
                                    Le véhicule sera bloqué pour toute activité et tous les bureaux seront alertés.
                                </AlertDescription>
                            </Alert>

                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowDeclareDialog(false)}
                                    disabled={submitting}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDeclareStolen}
                                    disabled={submitting || !declareReason.trim()}
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            En cours...
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4 mr-2" />
                                            Déclarer volée
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog: Lever blocage */}
            <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[#ff4000]">
                            <ShieldCheck className="w-5 h-5" />
                            Lever le blocage
                        </DialogTitle>
                        <DialogDescription>
                            Réactiver un véhicule précédemment déclaré volé.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedVehicle && (
                        <div className="space-y-4">
                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <h4 className="font-semibold text-[#ff4000] mb-2">{t('stolenVehicleManagement.vehiculeAReactiver')}</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><strong>Plaque:</strong> {selectedVehicle.license_plate}</div>
                                    <div><strong>{t('stolenVehicleManagement.chassis')}</strong> {selectedVehicle.serial_number}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="recovery-reason">{t('stolenVehicleManagement.justificationDeLaLeveeDe')}</Label>
                                <Textarea
                                    id="recovery-reason"
                                    placeholder={t('stolenVehicleManagement.expliquezPourquoiLeBlocageEst')}
                                    value={recoveryReason}
                                    onChange={(e) => setRecoveryReason(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowRecoveryDialog(false)}
                                    disabled={submitting}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="bg-[#ff4000] hover:bg-[#ff4000]"
                                    onClick={handleDeclareRecovered}
                                    disabled={submitting || !recoveryReason.trim()}
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            En cours...
                                        </>
                                    ) : (
                                        <>
                                            <Unlock className="w-4 h-4 mr-2" />
                                            Lever le blocage
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog: Historique GPS */}
            <Dialog open={showGPSDialog} onOpenChange={setShowGPSDialog}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            Surveillance GPS silencieuse
                        </DialogTitle>
                        <DialogDescription>
                            Historique des positions détectées (mode furtif)
                        </DialogDescription>
                    </DialogHeader>

                    {selectedVehicle && (
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>{selectedVehicle.license_plate}</strong> - {selectedVehicle.brand} {selectedVehicle.model}
                                </p>
                            </div>

                            {selectedVehicle.last_known_latitude && selectedVehicle.last_known_longitude && (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-[#ff4000]">{t('stolenVehicleManagement.dernierePositionConnue')}</p>
                                            <p className="text-sm text-[#ff4000]">
                                                Lat: {selectedVehicle.last_known_latitude.toFixed(6)},
                                                Lng: {selectedVehicle.last_known_longitude.toFixed(6)}
                                            </p>
                                            {selectedVehicle.last_known_location_at && (
                                                <p className="text-xs text-[#ff4000] mt-1">
                                                    {format(new Date(selectedVehicle.last_known_location_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            onClick={() => openGoogleMaps(selectedVehicle.last_known_latitude!, selectedVehicle.last_known_longitude!)}
                                        >
                                            <Navigation className="w-4 h-4 mr-2" />
                                            Ouvrir Maps
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <ScrollArea className="h-[250px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date/Heure</TableHead>
                                            <TableHead>Position</TableHead>
                                            <TableHead>{t('stolenVehicleManagement.precision')}</TableHead>
                                            <TableHead>Vitesse</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {gpsTrackings.map((gps) => (
                                            <TableRow key={gps.id}>
                                                <TableCell className="text-sm">
                                                    {format(new Date(gps.created_at), 'dd/MM HH:mm:ss')}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {gps.accuracy ? `±${gps.accuracy.toFixed(0)}m` : '-'}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {gps.speed ? `${gps.speed.toFixed(1)} km/h` : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openGoogleMaps(gps.latitude, gps.longitude)}
                                                    >
                                                        <Navigation className="w-3 h-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {gpsTrackings.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    Aucune position GPS enregistrée
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
