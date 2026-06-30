/**
 * INTERFACE BUREAU SYNDICAT ULTRA-PROFESSIONNELLE
 * Toutes les fonctionnalités intégrées et opérationnelles
 * 224Solutions - Syndicate Dashboard Ultra Pro
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useSyndicatUltraProData } from '@/hooks/useSyndicatUltraProData';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Building2,
    Users,
    Car,
    Activity,
    Crown,
    Shield,
    Bike,
    UserPlus,
    Wallet,
    Settings,
    BarChart3,
    TrendingUp,
    Phone,
    Mail,
    QrCode,
    Download,
    RefreshCw,
    Eye,
    Receipt,
    Star,
    Bell,
    LogOut,
    Home,
    Ticket,
    Siren
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRoleRedirect } from "@/hooks/useRoleRedirect";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import UniversalWalletDashboard from '@/components/wallet/UniversalWalletDashboard';
import AutoDownloadDetector from '@/components/download/AutoDownloadDetector';
import { UserIdDisplay } from '@/components/UserIdDisplay';
import { WalletBalanceDisplay } from '@/components/wallet/WalletBalanceDisplay';
import CommunicationWidget from '@/components/communication/CommunicationWidget';
import TransportTicketGenerator from '@/components/syndicate/TransportTicketGenerator';
import { BureauSyndicatSOSDashboard } from '@/components/bureau-syndicat/BureauSyndicatSOSDashboard';
import { SyndicateWorkersManagement } from '@/components/bureau/SyndicateWorkersManagement';
interface _SyndicateMember {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'president' | 'secretary' | 'member';
    badge_number: string;
    wallet_balance: number;
    status: 'active' | 'inactive';
    joined_date: string;
}

interface _TaxiMotard {
    id: string;
    name: string;
    phone: string;
    email?: string;
    gilet_number?: string;
    plate_number: string;
    moto_serial: string;
    badge_number: string;
    badge_code: string;
    wallet_balance: number;
    status: 'active' | 'inactive' | 'suspended';
    created_date: string;
}

export default function SyndicatDashboardUltraPro() {
    const { t } = useTranslation();
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    useRoleRedirect();

    // États principaux
    const [activeTab, setActiveTab] = useState('dashboard');
    const [_loading, setLoading] = useState(false);
    const [showDownloadDialog, setShowDownloadDialog] = useState(false);

    // Données du bureau
    const { members: syndicateMembers, drivers: taxiMotards, stats: syndicateStats, loading: dataLoading, error, refresh, bureauId, bureauName } = useSyndicatUltraProData();

    useEffect(() => {
        setLoading(dataLoading);
    }, [dataLoading]);

    /**
     * Charge les données du bureau syndicat
     */
    const loadSyndicateData = async () => { await refresh(); };

    /**
     * Déconnexion
     */
    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    /**
     * Formate la date
     */
    const _formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    /**
     * Obtient la couleur du rôle
     */
    const _getRoleColor = (role: string) => {
        switch (role) {
            case 'president': return 'bg-blue-100 text-[#04439e] border-blue-200';
            case 'secretary': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'member': return 'bg-orange-100 text-[#ff4000] border-orange-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    /**
     * Obtient le libellé du rôle
     */
    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'president': return 'Président';
            case 'secretary': return 'Secrétaire';
            case 'member': return 'Membre';
            default: return role;
        }
    };

    return (
        <div className="min-h-screen bg-blue-50">
            {/* Header Ultra-Professionnel - Mobile Optimized */}
            <div className="bg-white shadow-xl border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 sm:gap-6">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#04439e] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                                    <h1 className="text-base sm:text-2xl font-bold bg-[#04439e] bg-clip-text text-transparent truncate">
                                        Bureau Syndicat
                                    </h1>
                                    <UserIdDisplay layout="horizontal" showBadge={true} />
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                    <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">Interface Ultra-Pro</p>
                                    <WalletBalanceDisplay userId={user?.id} compact={true} className="max-w-[150px] sm:max-w-xs" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 sm:pb-0">
                            <div className="text-right hidden sm:block flex-shrink-0">
                                <p className="font-semibold text-gray-800 text-sm">{profile?.first_name} {profile?.last_name}</p>
                                <p className="text-xs text-gray-600 flex items-center gap-1 justify-end">
                                    <Crown className="w-3 h-3" />
                                    {profile?.role}
                                </p>
                            </div>

                            <Button
                                onClick={() => setShowDownloadDialog(true)}
                                variant="outline"
                                size="sm"
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg sm:rounded-xl text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                            >
                                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">{t('syndicatDashboardUltraPro.telecharger')}</span> App
                            </Button>

                            <Button
                                onClick={handleSignOut}
                                variant="outline"
                                size="sm"
                                className="border-orange-200 text-[#ff4000] hover:bg-orange-50 rounded-lg sm:rounded-xl text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                            >
                                <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">{t('syndicatDashboardUltraPro.deconnexion')}</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contenu principal - Mobile Optimized */}
            <div className="max-w-7xl mx-auto p-3 sm:p-6 pb-20 sm:pb-6">
                {/* Statistiques en temps réel - 2x2 grid on mobile */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8">
                    <Card className="border-0 shadow-lg bg-[#04439e] text-white">
                        <CardContent className="p-3 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-xs sm:text-sm font-medium">Membres</p>
                                    <p className="text-xl sm:text-3xl font-bold">{syndicateStats.active_members}</p>
                                    <p className="text-blue-100 text-[10px] sm:text-xs">/{syndicateStats.total_members}</p>
                                </div>
                                <Users className="w-8 h-8 sm:w-12 sm:h-12 text-blue-200" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-[#ff4000] text-white">
                        <CardContent className="p-3 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-100 text-xs sm:text-sm font-medium">Motards</p>
                                    <p className="text-xl sm:text-3xl font-bold">{syndicateStats.active_taxi_motards}</p>
                                    <p className="text-orange-100 text-[10px] sm:text-xs">/{syndicateStats.total_taxi_motards}</p>
                                </div>
                                <Bike className="w-8 h-8 sm:w-12 sm:h-12 text-orange-200" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-[#04439e] text-white">
                        <CardContent className="p-3 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-xs sm:text-sm font-medium">{t('syndicatDashboardUltraPro.solde')}</p>
                                    <p className="text-lg sm:text-2xl font-bold">
                                        {syndicateStats.total_balance.toLocaleString()}
                                    </p>
                                    <p className="text-blue-100 text-[10px] sm:text-xs">FCFA</p>
                                </div>
                                <Wallet className="w-8 h-8 sm:w-12 sm:h-12 text-blue-200" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-orange-500 text-white">
                        <CardContent className="p-3 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-100 text-xs sm:text-sm font-medium">Revenus</p>
                                    <p className="text-lg sm:text-2xl font-bold">
                                        {syndicateStats.monthly_revenue.toLocaleString()}
                                    </p>
                                    <p className="text-orange-100 text-[10px] sm:text-xs">FCFA/mois</p>
                                </div>
                                <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 text-orange-200" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Navigation par onglets - Mobile Scrollable */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mx-3 px-3 sm:mx-0 sm:px-0">
                        <TabsList className="inline-flex sm:grid sm:w-full sm:grid-cols-8 bg-white shadow-lg rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-gray-100 mb-4 sm:mb-8 min-w-max sm:min-w-0">
                            <TabsTrigger
                                value="dashboard"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-[#04439e] data-[state=active]: data-[state=active]: data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Home className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Dashboard</span>
                                <span className="sm:hidden">Accueil</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="sos"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff4000] data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Siren className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                SOS
                            </TabsTrigger>
                            <TabsTrigger
                                value="members"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-[#04439e] data-[state=active]: data-[state=active]: data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                Membres
                            </TabsTrigger>
                            <TabsTrigger
                                value="taxi-motards"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-[#04439e] data-[state=active]: data-[state=active]: data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Bike className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                Motards
                            </TabsTrigger>
                            <TabsTrigger
                                value="tickets"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff4000] data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Ticket className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                Tickets
                            </TabsTrigger>
                            <TabsTrigger
                                value="wallet"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-[#04439e] data-[state=active]: data-[state=active]: data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                Wallet
                            </TabsTrigger>
                            <TabsTrigger
                                value="gestion"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-[#04439e] data-[state=active]: data-[state=active]: data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                Gestion
                            </TabsTrigger>
                            <TabsTrigger
                                value="analytics"
                                className="rounded-lg sm:rounded-xl data-[state=active]:bg-[#04439e] data-[state=active]: data-[state=active]: data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                            >
                                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                Stats
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Onglet SOS Alertes */}
                    <TabsContent value="sos" className="space-y-6">
                        {bureauId ? (
                            <BureauSyndicatSOSDashboard bureauId={bureauId} />
                        ) : (
                            <Card className="border-0 shadow-xl rounded-2xl border-orange-200">
                                <CardContent className="p-12 text-center">
                                    <Siren className="w-16 h-16 mx-auto mb-4 text-[#ff4000]" />
                                    <p className="text-gray-600">{t('syndicatDashboardUltraPro.chargementDuSystemeSos')}</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Onglet Dashboard */}
                    <TabsContent value="dashboard" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Activite recente */}
                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardHeader className="bg-[#04439e]/5 rounded-t-2xl">
                                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Activity className="w-5 h-5" />
                                        Activité récente
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {syndicateMembers.length === 0 && taxiMotards.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p>{t('syndicatDashboardUltraPro.aucuneActiviteRecente')}</p>
                                            <p className="text-sm">{t('syndicatDashboardUltraPro.lesDonneesApparaitrontIciQuand')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {syndicateMembers.slice(0, 2).map((m) => (
                                                <div key={m.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-200">
                                                    <div className="flex items-center gap-3">
                                                        <UserPlus className="w-8 h-8 text-[#ff4000]" />
                                                        <div>
                                                            <p className="font-semibold text-gray-800">{m.name}</p>
                                                            <p className="text-sm text-gray-600">{getRoleLabel(m.role)} - {m.badge_number || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    <Badge className={m.status === 'active' ? 'bg-orange-100 text-[#ff4000]' : 'bg-gray-100 text-gray-600'}>
                                                        {m.status === 'active' ? 'Actif' : 'Inactif'}
                                                    </Badge>
                                                </div>
                                            ))}
                                            {taxiMotards.slice(0, 1).map((d) => (
                                                <div key={d.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                                                    <div className="flex items-center gap-3">
                                                        <Bike className="w-8 h-8 text-blue-600" />
                                                        <div>
                                                            <p className="font-semibold text-gray-800">{d.name}</p>
                                                            <p className="text-sm text-gray-600">{d.plate_number}</p>
                                                        </div>
                                                    </div>
                                                    <Badge className="bg-blue-100 text-blue-700">{d.status}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Actions rapides */}
                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardHeader className="bg-orange-50 rounded-t-2xl">
                                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Star className="w-5 h-5" />
                                        Actions Rapides
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <Button
                                        onClick={() => setActiveTab('taxi-motards')}
                                        variant="outline"
                                        className="w-full rounded-xl border-orange-200 text-[#ff4000] hover:bg-orange-50"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Gérer les Taxi-Motards
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('members')}
                                        variant="outline"
                                        className="w-full rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Gérer les Membres Bureau
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('wallet')}
                                        variant="outline"
                                        className="w-full rounded-xl border-blue-200 text-[#04439e] hover:bg-blue-50"
                                    >
                                        <Wallet className="w-4 h-4 mr-2" />
                                        Gérer la Trésorerie
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('gestion')}
                                        variant="outline"
                                        className="w-full rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Paramètres Bureau
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Onglet Membres - Avec gestion des permissions */}
                    <TabsContent value="members" className="space-y-6">
                        {bureauId ? (
                            <SyndicateWorkersManagement
                                bureauId={bureauId}
                                bureauName={bureauName}
                            />
                        ) : (
                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardContent className="p-12 text-center">
                                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                                    <p className="text-gray-600">{t('syndicatDashboardUltraPro.chargementDesMembres')}</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Onglet Taxi-Motards */}
                    <TabsContent value="taxi-motards" className="space-y-6">
                        <Card className="border-0 shadow-xl rounded-2xl">
                            <CardHeader className="bg-orange-50 rounded-t-2xl">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Bike className="w-5 h-5" />
                                        Taxi-Motards ({taxiMotards.length})
                                    </CardTitle>
                                    <Button
                                        onClick={() => setActiveTab('members')}
                                        size="sm"
                                        className="bg-[#ff4000] hover:bg-[#ff4000] shadow-lg shadow-[#ff4000]/40"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Ajouter
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {taxiMotards.map((taxiMotard) => (
                                        <Card key={taxiMotard.id} className="border border-gray-200 hover:shadow-lg transition-all duration-300">
                                            <CardContent className="p-6">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="w-12 h-12 bg-[#ff4000] rounded-full flex items-center justify-center text-white font-bold text-lg">
                                                        {taxiMotard.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-gray-800">{taxiMotard.name}</h3>
                                                        <Badge className="bg-orange-100 text-[#ff4000] border-orange-200 text-xs">
                                                            {taxiMotard.badge_number}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-gray-400" />
                                                        <span className="text-gray-600">{taxiMotard.phone}</span>
                                                    </div>
                                                    {taxiMotard.email && (
                                                        <div className="flex items-center gap-2">
                                                            <Mail className="w-4 h-4 text-gray-400" />
                                                            <span className="text-gray-600">{taxiMotard.email}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <Car className="w-4 h-4 text-gray-400" />
                                                        <span className="text-gray-600">{taxiMotard.plate_number}</span>
                                                    </div>
                                                    {taxiMotard.gilet_number && (
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="w-4 h-4 text-gray-400" />
                                                            <span className="text-gray-600">Gilet {taxiMotard.gilet_number}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <Wallet className="w-4 h-4 text-gray-400" />
                                                        <span className="text-[#ff4000] font-semibold">
                                                            {taxiMotard.wallet_balance.toLocaleString()} FCFA
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 mt-4">
                                                    <Button size="sm" variant="outline" className="flex-1 rounded-lg">
                                                        <QrCode className="w-3 h-3 mr-1" />
                                                        Badge
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="flex-1 rounded-lg">
                                                        <Eye className="w-3 h-3 mr-1" />
                                                        Détails
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="wallet" className="space-y-6">
                        {user?.id && (
                            <UniversalWalletDashboard
                                userId={user.id}
                                userCode={profile?.email || ''}
                                showTransactions={true}
                            />
                        )}
                    </TabsContent>

                    {/* Onglet Gestion - MAINTENANT OPÉRATIONNEL */}
                    <TabsContent value="gestion" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Paramètres du Bureau */}
                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardHeader className="bg-blue-50 rounded-t-2xl">
                                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Settings className="w-5 h-5" />
                                        Paramètres du Bureau
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <Button
                                        onClick={() => setActiveTab('members')}
                                        variant="outline"
                                        className="w-full rounded-xl border-blue-200 text-[#04439e] hover:bg-blue-50"
                                    >
                                        <Shield className="w-4 h-4 mr-2" />
                                        Gérer les Membres & Permissions
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('sos')}
                                        variant="outline"
                                        className="w-full rounded-xl border-orange-200 text-[#ff4000] hover:bg-orange-50"
                                    >
                                        <Siren className="w-4 h-4 mr-2" />
                                        Alertes SOS
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('sos')}
                                        variant="outline"
                                        className="w-full rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
                                    >
                                        <Bell className="w-4 h-4 mr-2" />
                                        Paramètres Notifications
                                    </Button>

                                    <Button
                                        onClick={() => setShowDownloadDialog(true)}
                                        variant="outline"
                                        className="w-full rounded-xl border-orange-200 text-[#ff4000] hover:bg-orange-50"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Télécharger Applications
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Outils de Gestion */}
                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardHeader className="bg-blue-50 rounded-t-2xl">
                                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Activity className="w-5 h-5" />
                                        Outils de Gestion
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <Button
                                        onClick={() => {
                                            loadSyndicateData();
                                            toast.success(t('syndicatDashboardUltraPro.donneesSynchronisees'));
                                        }}
                                        className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/40"
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Synchroniser les Données
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('analytics')}
                                        variant="outline"
                                        className="w-full rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
                                    >
                                        <Receipt className="w-4 h-4 mr-2" />
                                        Voir les Statistiques
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('tickets')}
                                        variant="outline"
                                        className="w-full rounded-xl border-orange-200 text-[#ff4000] hover:bg-orange-50"
                                    >
                                        <Ticket className="w-4 h-4 mr-2" />
                                        Tickets de Transport
                                    </Button>

                                    <Button
                                        onClick={() => setActiveTab('wallet')}
                                        variant="outline"
                                        className="w-full rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50"
                                    >
                                        <Wallet className="w-4 h-4 mr-2" />
                                        Finances & Wallet
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Onglet Analytics */}
                    <TabsContent value="analytics" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold text-gray-800">{t('syndicatDashboardUltraPro.statistiquesGenerales')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
                                            <span className="font-medium text-gray-700">{t('syndicatDashboardUltraPro.tauxDActiviteMembres')}</span>
                                            <span className="font-bold text-blue-600">
                                                {syndicateStats.total_members > 0
                                                    ? `${Math.round((syndicateStats.active_members / syndicateStats.total_members) * 100)}%`
                                                    : '0%'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl">
                                            <span className="font-medium text-gray-700">Revenus mensuels</span>
                                            <span className="font-bold text-[#ff4000]">{syndicateStats.monthly_revenue.toLocaleString()} FCFA</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
                                            <span className="font-medium text-gray-700">Motards actifs</span>
                                            <span className="font-bold text-[#04439e]">
                                                {syndicateStats.active_taxi_motards}/{syndicateStats.total_taxi_motards}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl">
                                            <span className="font-medium text-gray-700">Alertes actives</span>
                                            <span className="font-bold text-orange-600">{syndicateStats.active_alerts}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold text-gray-800">Tendances</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center py-8">
                                        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                        <p className="text-gray-600">{t('syndicatDashboardUltraPro.graphiquesDetaillesDisponibles')}</p>
                                        <p className="text-sm text-gray-500">{t('syndicatDashboardUltraPro.analyseDesPerformancesEnTemps')}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Onglet Tickets de Transport */}
                    <TabsContent value="tickets" className="space-y-6">
                        {bureauId ? (
                            <TransportTicketGenerator
                                bureauId={bureauId}
                                bureauName={bureauName || undefined}
                            />
                        ) : (
                            <Card className="border-0 shadow-xl rounded-2xl">
                                <CardContent className="p-12 text-center">
                                    <Ticket className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                    <p className="text-gray-600">{t('syndicatDashboardUltraPro.chargementDuBureau')}</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Dialog de téléchargement */}
            <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
                <DialogContent className="max-w-6xl rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold bg-[#04439e] bg-clip-text text-transparent">
                            Télécharger 224Solutions
                        </DialogTitle>
                    </DialogHeader>
                    <AutoDownloadDetector />
                </DialogContent>
            </Dialog>

            {/* Widget de communication flottant */}
            <CommunicationWidget position="bottom-right" showNotifications={true} />
        </div>
    );
}
