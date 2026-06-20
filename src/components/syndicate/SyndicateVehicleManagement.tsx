/**
 * GESTION DES VÉHICULES ET BADGES NUMÉRIQUES ULTRA PROFESSIONNELLE
 * Interface complète pour l'enregistrement et gestion des véhicules avec QR codes
 * 224Solutions - Bureau Syndicat System
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { bureauFetch } from "@/lib/bureauApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BadgeGeneratorDialog from './BadgeGeneratorDialog';
import EditBadgeDialog from './EditBadgeDialog';
import EditVehicleDialog from './EditVehicleDialog';
import {
    Car,
    Plus,
    Search,
    QrCode,
    Download,
    Upload,
    _Eye,
    Edit,
    _Trash2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Shield,
    FileText,
    Calendar,
    _MapPin,
    Settings,
    Printer,
    _Share2,
    IdCard
} from "lucide-react";
import { toast } from "sonner";

interface SyndicateVehicle {
    id: string;
    member_id: string;
    member_name: string;
    serial_number: string;
    license_plate: string;
    vehicle_type: 'motorcycle' | 'tricycle' | 'car';
    brand?: string;
    model?: string;
    year?: number;
    color?: string;
    registration_document_url?: string;
    insurance_document_url?: string;
    technical_control_url?: string;
    digital_badge_id: string;
    qr_code_data: string;
    status: 'active' | 'suspended' | 'maintenance' | 'retired';
    verified: boolean;
    verified_at?: string;
    badge_generated_at: string;
    created_at: string;
}

interface SyndicateVehicleManagementProps {
    bureauId: string;
}

export default function SyndicateVehicleManagement({ bureauId }: SyndicateVehicleManagementProps) {
    const { t } = useTranslation();
    const [vehicles, setVehicles] = useState<SyndicateVehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<SyndicateVehicle | null>(null);
    const [showBadgeDialog, setShowBadgeDialog] = useState(false);
    const [showProfessionalBadgeDialog, setShowProfessionalBadgeDialog] = useState(false);
    const [showEditBadgeDialog, setShowEditBadgeDialog] = useState(false);
    const [showEditVehicleDialog, setShowEditVehicleDialog] = useState(false);
    const [selectedVehicleForEdit, setSelectedVehicleForEdit] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [bureauName, setBureauName] = useState<string>('VOTRE BUREAU');
    const [bureauCode, setBureauCode] = useState<string>('');
    const [bureauPrefecture, setBureauPrefecture] = useState<string>('');
    const [bureauCommune, setBureauCommune] = useState<string>('');
    const [bureauPhone, setBureauPhone] = useState<string>('');

    // Formulaire d'ajout de véhicule
    const [formData, setFormData] = useState({
        member_id: '',
        owner_name: '',
        serial_number: '',
        license_plate: '',
        vehicle_type: 'motorcycle' as SyndicateVehicle['vehicle_type'],
        brand: '',
        model: '',
        year: '',
        color: '',
        driver_photo_url: '',
        driver_date_of_birth: ''
    });

    // États pour les fichiers uploadés
    const [uploadedFiles, setUploadedFiles] = useState({
        registration_document: null as File | null,
        insurance_document: null as File | null,
        technical_control: null as File | null,
        vehicle_photo: null as File | null
    });

    // Liste des membres (chargée depuis Supabase)
    const [members, setMembers] = useState<{ id: string; name: string; member_id: string }[]>([]);

    useEffect(() => {
        loadBureauInfo();
        loadVehicles();
        loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bureauId]);

    /**
     * Charge les informations du bureau
     */
    const loadBureauInfo = async () => {
        try {
            const { data, error } = await supabase
                .from('bureaus')
                .select('bureau_code, commune, prefecture, president_phone')
                .eq('id', bureauId)
                .single();

            if (error) throw error;

            if (data) {
                // Stocker toutes les informations
                setBureauCode((data as any).bureau_code || '');
                setBureauPrefecture((data as any).prefecture || '');
                setBureauCommune((data as any).commune || '');
                setBureauPhone((data as any).president_phone || '');

                // Pour l'affichage du nom dans les badges
                const name = (data as any).commune || (data as any).prefecture || 'VOTRE BUREAU';
                setBureauName(name);
            }
        } catch (error) {
            console.error('Erreur chargement bureau:', error);
        }
    };

    /**
     * Charge la liste des membres
     */
    /**
     * Charge la liste des membres
     */
    const loadMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('syndicate_workers')
                .select('id, nom')
                .eq('bureau_id', bureauId)
                .eq('is_active', true);

            if (error) throw error;

            setMembers(data?.map(m => ({
                id: m.id,
                name: m.nom,
                member_id: m.id
            })) || []);
        } catch (error) {
            console.error('Erreur chargement membres:', error);
        }
    };

    /**
     * Charge la liste des véhicules depuis Supabase
     */
    /**
     * Charge la liste des véhicules depuis Supabase
     */
    const loadVehicles = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('vehicles')
                .select('*')
                .eq('bureau_id', bureauId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Récupérer les noms des membres
            const memberIds = [...new Set(data?.map(v => v.owner_member_id).filter(Boolean))];
            let memberNames: Record<string, string> = {};

            if (memberIds.length > 0) {
                const { data: workersData } = await supabase
                    .from('syndicate_workers')
                    .select('id, nom')
                    .in('id', memberIds);

                memberNames = workersData?.reduce((acc, w) => {
                    acc[w.id] = w.nom;
                    return acc;
                }, {} as Record<string, string>) || {};
            }

            const formattedVehicles: SyndicateVehicle[] = (data || []).map(v => ({
                id: v.id,
                member_id: v.owner_member_id || '',
                member_name: memberNames[v.owner_member_id] || 'N/A',
                serial_number: v.serial_number || '',
                license_plate: v.license_plate || v.serial_number || '',
                vehicle_type: (v.type?.toLowerCase() || 'motorcycle') as SyndicateVehicle['vehicle_type'],
                brand: v.brand || undefined,
                model: v.model || undefined,
                year: v.year || undefined,
                color: v.color || undefined,
                registration_document_url: v.registration_document_url || undefined,
                insurance_document_url: v.insurance_document_url || undefined,
                technical_control_url: v.technical_control_url || undefined,
                digital_badge_id: v.digital_badge_id || `BDG-${v.id?.substring(0, 8)}`,
                qr_code_data: v.qr_code_data || JSON.stringify({
                    vehicle_id: v.id,
                    serial_number: v.serial_number,
                    owner: memberNames[v.owner_member_id] || 'N/A',
                    bureau: bureauId,
                    issued_date: v.created_at
                }),
                status: (v.status || 'active') as SyndicateVehicle['status'],
                verified: v.verified || false,
                verified_at: v.verified_at,
                badge_generated_at: v.badge_generated_at || v.created_at,
                created_at: v.created_at,
                driver_photo_url: v.driver_photo_url,
                driver_date_of_birth: v.driver_date_of_birth,
                badge_title: v.badge_title,
            } as any));

            setVehicles(formattedVehicles);
        } catch (error) {
            console.error('Erreur chargement véhicules:', error);
            toast.error(t('syndicateVehicleManagement.impossibleDeChargerLesVehicules'));
        } finally {
            setLoading(false);
        }
    };

    /**
     * Upload de la photo du conducteur
     */
    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Vérifier le type de fichier
        if (!file.type.startsWith('image/')) {
            toast.error(t('syndicateVehicleManagement.veuillezSelectionnerUneImage'));
            return;
        }

        // Vérifier la taille (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error(t('syndicateVehicleManagement.lImageNeDoitPas'));
            return;
        }

        try {
            setUploadingPhoto(true);
            toast.info(t('syndicateVehicleManagement.uploadDeLaPhotoEn'));

            // Créer un nom de fichier unique
            const fileExt = file.name.split('.').pop();
            const fileName = `temp-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload vers Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('driver-photos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Obtenir l'URL publique
            const { data: { publicUrl } } = supabase.storage
                .from('driver-photos')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, driver_photo_url: publicUrl }));
            toast.success(t('syndicateVehicleManagement.photoUploadeeAvecSucces'));
        } catch (error) {
            console.error('Error uploading photo:', error);
            toast.error(t('syndicateVehicleManagement.erreurLorsDeLUpload'));
        } finally {
            setUploadingPhoto(false);
        }
    };

    /**
     * Ajoute un nouveau véhicule dans Supabase
     */
    const addVehicle = async () => {
        console.log('[VehicleAdd] Début ajout véhicule:', formData);

        if (!formData.serial_number || !formData.license_plate) {
            toast.error(t('syndicateVehicleManagement.veuillezRemplirLeNumeroDe'));
            return;
        }

        // Vérifier qu'un membre existe ou qu'un nouveau nom est fourni
        if (!formData.member_id && !formData.owner_name) {
            toast.error(t('syndicateVehicleManagement.veuillezSelectionnerUnMembreExistant'));
            return;
        }

        try {
            console.log('[VehicleAdd] Appel RPC add_vehicle_for_bureau:', {
                bureau_id: bureauId,
                owner_name: formData.owner_name,
                member_id: formData.member_id || null,
                serial_number: formData.serial_number,
                license_plate: formData.license_plate
            });

            // Via le BACKEND (JWT bureau) — le bureau_id vient du token, jamais du client.
            const resp = await bureauFetch<any>('/api/v2/bureau/vehicle', {
                method: 'POST',
                body: {
                    owner_name: formData.member_id ? null : formData.owner_name,
                    member_id: formData.member_id || null,
                    serial_number: formData.serial_number,
                    license_plate: formData.license_plate,
                    vehicle_type: formData.vehicle_type || 'motorcycle',
                    brand: formData.brand || null,
                    model: formData.model || null,
                    year: formData.year ? parseInt(formData.year) : null,
                    color: formData.color || null,
                    driver_photo_url: formData.driver_photo_url || null,
                    driver_date_of_birth: formData.driver_date_of_birth || null,
                },
            });

            if (!resp.success) {
                console.error('[VehicleAdd] Erreur backend:', resp.error);
                throw new Error(resp.error || 'Erreur lors de l\'ajout du véhicule');
            }

            const result = (resp as any).result;
            console.log('[VehicleAdd] Résultat:', result);

            // Vérifier le résultat de la fonction
            if (result && result.success === false) {
                const errorMsg = result?.error || 'Erreur inconnue lors de l\'ajout du véhicule';
                console.error('[VehicleAdd] Échec:', errorMsg);
                toast.error(errorMsg);
                return;
            }

            console.log('[VehicleAdd] Véhicule créé avec succès:', result);

            // Réinitialiser le formulaire
            setFormData({
                member_id: '',
                owner_name: '',
                serial_number: '',
                license_plate: '',
                vehicle_type: 'motorcycle',
                brand: '',
                model: '',
                year: '',
                color: '',
                driver_photo_url: '',
                driver_date_of_birth: ''
            });

            // Réinitialiser les fichiers
            setUploadedFiles({
                registration_document: null,
                insurance_document: null,
                technical_control: null,
                vehicle_photo: null
            });

            // Recharger la liste
            await loadVehicles();

            setShowAddDialog(false);

            // Message de succès avec détails
            toast.success(`Véhicule ajouté avec succès ! Badge: ${result.badge_id}`);

        } catch (error: any) {
            console.error('Erreur ajout véhicule:', error);
            toast.error(error.message || 'Erreur lors de l\'ajout du véhicule');
        }
    };

    /**
     * Génère un ID de badge unique
     */
    const generateBadgeId = (): string => {
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 10).toUpperCase();
        return `BDG-${date}-${random}`;
    };

    /**
     * Vérifie un véhicule dans Supabase
     */
    /**
     * Vérifie un véhicule dans Supabase
     */
    const verifyVehicle = async (vehicleId: string) => {
        try {
            const { error } = await supabase
                .from('vehicles')
                .update({
                    verified: true,
                    verified_at: new Date().toISOString(),
                    status: 'active'
                })
                .eq('id', vehicleId);

            if (error) throw error;

            await loadVehicles();
            toast.success(t('syndicateVehicleManagement.vehiculeVerifieAvecSucces'));
        } catch (error) {
            console.error('Erreur vérification véhicule:', error);
            toast.error(t('syndicateVehicleManagement.erreurLorsDeLaVerification'));
        }
    };

    /**
     * Suspend un véhicule dans Supabase
     */
    /**
     * Suspend un véhicule dans Supabase
     */
    const suspendVehicle = async (vehicleId: string) => {
        try {
            const { error } = await supabase
                .from('vehicles')
                .update({ status: 'suspended' })
                .eq('id', vehicleId);

            if (error) throw error;

            await loadVehicles();
            toast.success(t('syndicateVehicleManagement.vehiculeSuspendu'));
        } catch (error) {
            console.error('Erreur suspension véhicule:', error);
            toast.error(t('syndicateVehicleManagement.erreurLorsDeLaSuspension'));
        }
    };

    /**
     * Réactive un véhicule suspendu dans Supabase
     */
    const reactivateVehicle = async (vehicleId: string) => {
        try {
            const { error } = await supabase
                .from('vehicles')
                .update({ status: 'active' })
                .eq('id', vehicleId);

            if (error) throw error;

            await loadVehicles();
            toast.success(t('syndicateVehicleManagement.vehiculeReactiveAvecSucces'));
        } catch (error) {
            console.error('Erreur réactivation véhicule:', error);
            toast.error(t('syndicateVehicleManagement.erreurLorsDeLaReactivation'));
        }
    };

    /**
     * Génère un nouveau badge
     */
    const _regenerateBadge = (vehicleId: string) => {
        const newBadgeId = generateBadgeId();

        setVehicles(prev => prev.map(v =>
            v.id === vehicleId
                ? {
                    ...v,
                    digital_badge_id: newBadgeId,
                    badge_generated_at: new Date().toISOString()
                }
                : v
        ));

        toast.success(t('syndicateVehicleManagement.nouveauBadgeGenereAvecSucces'));
    };

    /**
     * Ouvre le dialog de génération de badge professionnel
     */
    const openProfessionalBadge = (vehicle: SyndicateVehicle) => {
        setSelectedVehicle(vehicle);
        setShowProfessionalBadgeDialog(true);
    };

    /**
     * Télécharge le badge (legacy - ouvre maintenant le badge professionnel)
     */
    const downloadBadge = (vehicle: SyndicateVehicle) => {
        openProfessionalBadge(vehicle);
    };

    /**
     * Imprime le badge (legacy - ouvre maintenant le badge professionnel)
     */
    const printBadge = (vehicle: SyndicateVehicle) => {
        openProfessionalBadge(vehicle);
    };

    /**
     * Filtre les véhicules
     */
    const filteredVehicles = vehicles.filter(vehicle => {
        const matchesSearch =
            vehicle.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
        const matchesType = typeFilter === 'all' || vehicle.vehicle_type === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
    });

    /**
     * Obtient la couleur du statut
     */
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-orange-100 text-[#ff4000]';
            case 'suspended': return 'bg-orange-100 text-[#ff4000]';
            case 'maintenance': return 'bg-orange-100 text-[#ff4000]';
            case 'retired': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    /**
     * Obtient le libellé du statut
     */
    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return 'Actif';
            case 'suspended': return 'Suspendu';
            case 'maintenance': return 'Maintenance';
            case 'retired': return 'Retiré';
            default: return status;
        }
    };

    /**
     * Obtient le libellé du type
     */
    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'motorcycle': return 'Moto';
            case 'tricycle': return 'Tricycle';
            case 'car': return 'Voiture';
            default: return type;
        }
    };

    /**
     * Formate la date
     */
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">{t('syndicateVehicleManagement.chargementDesVehicules')}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header avec statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <Car className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold text-blue-600">{vehicles.length}</div>
                        <div className="text-sm text-gray-600">{t('syndicateVehicleManagement.totalVehicules')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
                        <div className="text-2xl font-bold text-[#ff4000]">
                            {vehicles.filter(v => v.verified).length}
                        </div>
                        <div className="text-sm text-gray-600">{t('syndicateVehicleManagement.verifies')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <QrCode className="w-8 h-8 mx-auto mb-2 text-[#04439e]" />
                        <div className="text-2xl font-bold text-[#04439e]">
                            {vehicles.filter(v => v.digital_badge_id).length}
                        </div>
                        <div className="text-sm text-gray-600">{t('syndicateVehicleManagement.badgesGeneres')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                        <div className="text-2xl font-bold text-orange-600">
                            {vehicles.filter(v => v.status === 'maintenance').length}
                        </div>
                        <div className="text-sm text-gray-600">En Maintenance</div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions et filtres */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex gap-4 items-center flex-1">
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                <Input
                                    placeholder={t('syndicateVehicleManagement.rechercherUnVehicule')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Statut" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('syndicateVehicleManagement.tousLesStatuts')}</SelectItem>
                                    <SelectItem value="active">Actifs</SelectItem>
                                    <SelectItem value="suspended">Suspendus</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('syndicateVehicleManagement.tousLesTypes')}</SelectItem>
                                    <SelectItem value="motorcycle">Motos</SelectItem>
                                    <SelectItem value="tricycle">Tricycles</SelectItem>
                                    <SelectItem value="car">Voitures</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Ajouter un Véhicule
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{t('syndicateVehicleManagement.enregistrementDeVehicule')}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 pb-4">
                                    <div>
                                        <Label htmlFor="member_select">{t('syndicateVehicleManagement.proprietaire')}</Label>
                                        <Select
                                            value={formData.member_id || 'new'}
                                            onValueChange={(value) => {
                                                if (value === 'new') {
                                                    setFormData(prev => ({ ...prev, member_id: '', owner_name: '' }));
                                                } else {
                                                    const member = members.find(m => m.id === value);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        member_id: value,
                                                        owner_name: member?.name || ''
                                                    }));
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('syndicateVehicleManagement.selectionnerUnMembreExistantOu')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new">{t('syndicateVehicleManagement.nouveauProprietaire')}</SelectItem>
                                                {members.map(member => (
                                                    <SelectItem key={member.id} value={member.id}>
                                                        {member.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(!formData.member_id || formData.member_id === '') && (
                                        <div>
                                            <Label htmlFor="owner_name">{t('syndicateVehicleManagement.nomDuNouveauProprietaire')}</Label>
                                            <Input
                                                id="owner_name"
                                                value={formData.owner_name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                                                placeholder={t('syndicateVehicleManagement.nomCompletDuProprietaire')}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <Label htmlFor="serial_number">{t('syndicateVehicleManagement.numeroDeSerie')}</Label>
                                        <Input
                                            id="serial_number"
                                            value={formData.serial_number}
                                            onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                                            placeholder="MT-2024-001234"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="license_plate">Plaque d'Immatriculation *</Label>
                                        <Input
                                            id="license_plate"
                                            value={formData.license_plate}
                                            onChange={(e) => setFormData(prev => ({ ...prev, license_plate: e.target.value }))}
                                            placeholder="DK-1234-AB"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="vehicle_type">{t('syndicateVehicleManagement.typeDeVehicule')}</Label>
                                        <Select
                                            value={formData.vehicle_type}
                                            onValueChange={(value: unknown) => setFormData(prev => ({ ...prev, vehicle_type: value }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="motorcycle">Moto</SelectItem>
                                                <SelectItem value="tricycle">Tricycle</SelectItem>
                                                <SelectItem value="car">Voiture</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="brand">Marque</Label>
                                            <Input
                                                id="brand"
                                                value={formData.brand}
                                                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                                                placeholder="Yamaha"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="model">{t('syndicateVehicleManagement.modele')}</Label>
                                            <Input
                                                id="model"
                                                value={formData.model}
                                                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                                                placeholder="XTZ 125"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="year">{t('syndicateVehicleManagement.annee')}</Label>
                                            <Input
                                                id="year"
                                                type="number"
                                                value={formData.year}
                                                onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                                                placeholder="2024"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="color">Couleur</Label>
                                            <Input
                                                id="color"
                                                value={formData.color}
                                                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                                placeholder="Rouge"
                                            />
                                        </div>
                                    </div>

                                    {/* Section de téléchargement de documents et photos */}
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mt-6 bg-gray-50">
                                        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-blue-600">
                                            <Upload className="w-5 h-5" />
                                            Téléchargement de Documents et Photos
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-4">{t('syndicateVehicleManagement.formatsAcceptesPdfJpgPng')}</p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Document d'immatriculation */}
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                                                <Label htmlFor="registration_document" className="flex items-center gap-2 text-sm font-semibold mb-2 text-gray-700">
                                                    <FileText className="w-4 h-4 text-blue-600" />
                                                    Document d'Immatriculation
                                                </Label>
                                                <Input
                                                    id="registration_document"
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 5 * 1024 * 1024) {
                                                                toast.error(t('syndicateVehicleManagement.leFichierNeDoitPas'));
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            setUploadedFiles(prev => ({ ...prev, registration_document: file }));
                                                            toast.success(t('syndicateVehicleManagement.documentDImmatriculationAjoute'));
                                                        }
                                                    }}
                                                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                                {uploadedFiles.registration_document && (
                                                    <div className="mt-2 p-2 bg-orange-50 rounded-md">
                                                        <p className="text-xs text-[#ff4000] flex items-center gap-1 font-medium">
                                                            <CheckCircle className="w-4 h-4" />
                                                            {uploadedFiles.registration_document.name} ({(uploadedFiles.registration_document.size / 1024).toFixed(2)} KB)
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Assurance */}
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                                                <Label htmlFor="insurance_document" className="flex items-center gap-2 text-sm font-semibold mb-2 text-gray-700">
                                                    <Shield className="w-4 h-4 text-blue-600" />
                                                    Document d'Assurance
                                                </Label>
                                                <Input
                                                    id="insurance_document"
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 5 * 1024 * 1024) {
                                                                toast.error(t('syndicateVehicleManagement.leFichierNeDoitPas'));
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            setUploadedFiles(prev => ({ ...prev, insurance_document: file }));
                                                            toast.success(t('syndicateVehicleManagement.documentDAssuranceAjoute'));
                                                        }
                                                    }}
                                                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                                {uploadedFiles.insurance_document && (
                                                    <div className="mt-2 p-2 bg-orange-50 rounded-md">
                                                        <p className="text-xs text-[#ff4000] flex items-center gap-1 font-medium">
                                                            <CheckCircle className="w-4 h-4" />
                                                            {uploadedFiles.insurance_document.name} ({(uploadedFiles.insurance_document.size / 1024).toFixed(2)} KB)
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Contrôle technique */}
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                                                <Label htmlFor="technical_control" className="flex items-center gap-2 text-sm font-semibold mb-2 text-gray-700">
                                                    <Settings className="w-4 h-4 text-blue-600" />
                                                    Contrôle Technique
                                                </Label>
                                                <Input
                                                    id="technical_control"
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 5 * 1024 * 1024) {
                                                                toast.error(t('syndicateVehicleManagement.leFichierNeDoitPas'));
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            setUploadedFiles(prev => ({ ...prev, technical_control: file }));
                                                            toast.success(t('syndicateVehicleManagement.documentDeControleTechniqueAjoute'));
                                                        }
                                                    }}
                                                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                                {uploadedFiles.technical_control && (
                                                    <div className="mt-2 p-2 bg-orange-50 rounded-md">
                                                        <p className="text-xs text-[#ff4000] flex items-center gap-1 font-medium">
                                                            <CheckCircle className="w-4 h-4" />
                                                            {uploadedFiles.technical_control.name} ({(uploadedFiles.technical_control.size / 1024).toFixed(2)} KB)
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Photo du véhicule */}
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                                                <Label htmlFor="vehicle_photo" className="flex items-center gap-2 text-sm font-semibold mb-2 text-gray-700">
                                                    <Car className="w-4 h-4 text-blue-600" />
                                                    Photo du Véhicule
                                                </Label>
                                                <Input
                                                    id="vehicle_photo"
                                                    type="file"
                                                    accept=".jpg,.jpeg,.png,.webp"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 5 * 1024 * 1024) {
                                                                toast.error(t('syndicateVehicleManagement.laPhotoNeDoitPas'));
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            setUploadedFiles(prev => ({ ...prev, vehicle_photo: file }));
                                                            toast.success(t('syndicateVehicleManagement.photoDuVehiculeAjoutee'));
                                                        }
                                                    }}
                                                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                                {uploadedFiles.vehicle_photo && (
                                                    <div className="mt-2 p-2 bg-orange-50 rounded-md">
                                                        <p className="text-xs text-[#ff4000] flex items-center gap-1 font-medium">
                                                            <CheckCircle className="w-4 h-4" />
                                                            {uploadedFiles.vehicle_photo.name} ({(uploadedFiles.vehicle_photo.size / 1024).toFixed(2)} KB)
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Photo du conducteur et date de naissance */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                                                <Label htmlFor="driver_photo" className="flex items-center gap-2 text-sm font-semibold mb-2 text-gray-700">
                                                    <IdCard className="w-4 h-4 text-blue-600" />
                                                    Photo du Conducteur (Badge)
                                                </Label>
                                                {formData.driver_photo_url && (
                                                    <div className="flex justify-center mb-2">
                                                        <img
                                                            src={formData.driver_photo_url}
                                                            alt={t('syndicateVehicleManagement.photoDuConducteur')}
                                                            className="w-20 h-20 object-cover rounded-lg border-2 border-border"
                                                        />
                                                    </div>
                                                )}
                                                <Input
                                                    id="driver_photo"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePhotoUpload}
                                                    disabled={uploadingPhoto}
                                                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                                {uploadingPhoto && (
                                                    <p className="text-xs text-blue-600 mt-2">Upload en cours...</p>
                                                )}
                                            </div>

                                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                                <Label htmlFor="driver_dob" className="flex items-center gap-2 text-sm font-semibold mb-2 text-gray-700">
                                                    <Calendar className="w-4 h-4 text-blue-600" />
                                                    Date de Naissance
                                                </Label>
                                                <Input
                                                    id="driver_dob"
                                                    type="date"
                                                    value={formData.driver_date_of_birth}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, driver_date_of_birth: e.target.value }))}
                                                    className="mt-8"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        <Button onClick={addVehicle} className="flex-1" disabled={uploadingPhoto}>
                                            Ajouter le Véhicule
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowAddDialog(false)}
                                            className="flex-1"
                                        >
                                            Annuler
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            {/* Liste des véhicules */}
            <Card>
                <CardHeader>
                    <CardTitle>Liste des Véhicules ({filteredVehicles.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('syndicateVehicleManagement.numeroDeSerie2')}</TableHead>
                                <TableHead>Plaque</TableHead>
                                <TableHead>{t('syndicateVehicleManagement.proprietaire2')}</TableHead>
                                <TableHead>{t('syndicateVehicleManagement.vehicule')}</TableHead>
                                <TableHead>Badge</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredVehicles.map((vehicle) => (
                                <TableRow key={vehicle.id}>
                                    <TableCell className="font-medium">{vehicle.serial_number}</TableCell>
                                    <TableCell>{vehicle.license_plate}</TableCell>
                                    <TableCell>{vehicle.member_name}</TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{getTypeLabel(vehicle.vehicle_type)}</p>
                                            {vehicle.brand && vehicle.model && (
                                                <p className="text-sm text-gray-600">
                                                    {vehicle.brand} {vehicle.model} {vehicle.year}
                                                </p>
                                            )}
                                            {vehicle.color && (
                                                <p className="text-xs text-gray-500">{vehicle.color}</p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <QrCode className="w-4 h-4 text-[#04439e]" />
                                            <div className="text-sm">
                                                <p className="font-mono">{vehicle.digital_badge_id}</p>
                                                <p className="text-xs text-gray-600">
                                                    {formatDate(vehicle.badge_generated_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <Badge className={getStatusColor(vehicle.status)}>
                                                {getStatusLabel(vehicle.status)}
                                            </Badge>
                                            {vehicle.verified && (
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3 text-[#ff4000]" />
                                                    <span className="text-xs text-[#ff4000]">{t('syndicateVehicleManagement.verifie')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-2">
                                            {/* Boutons principaux */}
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedVehicleForEdit(vehicle);
                                                        setShowEditVehicleDialog(true);
                                                    }}
                                                    title={t('syndicateVehicleManagement.modifierLeVehicule')}
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedVehicleForEdit(vehicle);
                                                        setShowEditBadgeDialog(true);
                                                    }}
                                                    title={t('syndicateVehicleManagement.modifierInfosBadge')}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openProfessionalBadge(vehicle)}
                                                    title={t('syndicateVehicleManagement.genererBadgeProfessionnel')}
                                                >
                                                    <IdCard className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => downloadBadge(vehicle)}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => printBadge(vehicle)}
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            {/* Boutons de statut - Bien visibles */}
                                            <div className="flex gap-1">
                                                {!vehicle.verified && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                                        onClick={() => verifyVehicle(vehicle.id)}
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                        Vérifier
                                                    </Button>
                                                )}
                                                {vehicle.status === 'active' && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => suspendVehicle(vehicle.id)}
                                                        title="Suspendre"
                                                    >
                                                        <XCircle className="w-4 h-4 mr-1" />
                                                        Suspendre
                                                    </Button>
                                                )}
                                                {vehicle.status === 'suspended' && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-[#ff4000] hover:bg-[#ff4000] text-white"
                                                        onClick={() => reactivateVehicle(vehicle.id)}
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                        Réactiver
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Dialog pour afficher le badge */}
            <Dialog open={showBadgeDialog} onOpenChange={setShowBadgeDialog}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('syndicateVehicleManagement.badgeNumerique')}</DialogTitle>
                    </DialogHeader>
                    {selectedVehicle && (
                        <div className="space-y-4">
                            <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                                <QrCode className="w-24 h-24 mx-auto mb-4 text-gray-600" />
                                <p className="text-sm text-gray-600 mb-2">{t('syndicateVehicleManagement.qrCodeDuBadge')}</p>
                                <p className="font-mono text-xs bg-gray-100 p-2 rounded">
                                    {selectedVehicle.digital_badge_id}
                                </p>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">{t('syndicateVehicleManagement.vehicule2')}</span>
                                    <span className="font-medium">{selectedVehicle.serial_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Plaque:</span>
                                    <span className="font-medium">{selectedVehicle.license_plate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">{t('syndicateVehicleManagement.proprietaire3')}</span>
                                    <span className="font-medium">{selectedVehicle.member_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">{t('syndicateVehicleManagement.genereLe')}</span>
                                    <span className="font-medium">{formatDate(selectedVehicle.badge_generated_at)}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={() => downloadBadge(selectedVehicle)} className="flex-1">
                                    <Download className="w-4 h-4 mr-2" />
                                    Télécharger
                                </Button>
                                <Button onClick={() => printBadge(selectedVehicle)} variant="outline" className="flex-1">
                                    <Printer className="w-4 h-4 mr-2" />
                                    Imprimer
                                </Button>
                             </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog de génération de badge professionnel */}
            {selectedVehicle && (
                <BadgeGeneratorDialog
                    open={showProfessionalBadgeDialog}
                    onOpenChange={setShowProfessionalBadgeDialog}
                    vehicleData={{
                        id: selectedVehicle.id,
                        member_name: selectedVehicle.member_name,
                        member_id: selectedVehicle.member_id,
                        license_plate: selectedVehicle.license_plate,
                        serial_number: selectedVehicle.serial_number,
                        vehicle_type: selectedVehicle.vehicle_type,
                        badge_generated_at: selectedVehicle.badge_generated_at,
                        digital_badge_id: selectedVehicle.digital_badge_id,
                        driver_photo_url: (selectedVehicle as any).driver_photo_url,
                        driver_date_of_birth: (selectedVehicle as any).driver_date_of_birth,
                        badge_title: (selectedVehicle as any).badge_title,
                    }}
                    bureauName={bureauName}
                    bureauCommune={bureauCommune}
                    bureauPhone={bureauPhone}
                />
            )}

            {/* Dialog d'édition des informations du badge */}
            {selectedVehicleForEdit && (
                <EditBadgeDialog
                    open={showEditBadgeDialog}
                    onOpenChange={setShowEditBadgeDialog}
                    vehicleData={{
                        id: selectedVehicleForEdit.id,
                        member_name: selectedVehicleForEdit.member_name,
                        driver_photo_url: (selectedVehicleForEdit as any).driver_photo_url,
                        driver_date_of_birth: (selectedVehicleForEdit as any).driver_date_of_birth,
                    }}
                    bureauName={bureauName}
                    bureauCode={bureauCode}
                    bureauPrefecture={bureauPrefecture}
                    bureauCommune={bureauCommune}
                    onUpdate={loadVehicles}
                />
            )}

            {/* Dialog d'édition des informations du véhicule */}
            {selectedVehicleForEdit && (
                <EditVehicleDialog
                    open={showEditVehicleDialog}
                    onOpenChange={setShowEditVehicleDialog}
                    vehicleData={{
                        id: selectedVehicleForEdit.id,
                        serial_number: selectedVehicleForEdit.serial_number,
                        license_plate: selectedVehicleForEdit.license_plate,
                        vehicle_type: selectedVehicleForEdit.vehicle_type,
                        brand: selectedVehicleForEdit.brand,
                        model: selectedVehicleForEdit.model,
                        year: selectedVehicleForEdit.year,
                        color: selectedVehicleForEdit.color,
                        status: selectedVehicleForEdit.status,
                        member_name: selectedVehicleForEdit.member_name,
                    }}
                    onUpdate={loadVehicles}
                />
            )}
        </div>
    );
}
