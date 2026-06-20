/**
 * COMPOSANT DÉCLARATION MOTO VOLÉE
 * Interface pour déclarer une moto volée
 * 224Solutions - Module de sécurité intelligent
 */

import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    AlertTriangle,
    Shield,
    Send,
    CheckCircle,
    XCircle,
    Loader2,
    MapPin,
    Calendar,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface ReportStolenMotoProps {
    defaultNumero?: string;
    onSuccess?: () => void;
    className?: string;
}

export default function ReportStolenMoto({
    defaultNumero = '',
    onSuccess,
    className
}: ReportStolenMotoProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        numero_serie: defaultNumero,
        vin: '',
        ville: '',
        description: '',
        date_vol: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.numero_serie || !formData.ville) {
            setError('Numéro de série et ville sont obligatoires');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('🚨 DÉCLARATION DE VOL - Envoi...');

            const response = await fetch('/api/moto-security/report-stolen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    numero_serie: formData.numero_serie,
                    vin: formData.vin || null,
                    chauffeur_id: user?.id,
                    bureau_id: null, // À récupérer depuis le profil utilisateur
                    ville: formData.ville,
                    description: formData.description,
                    user_ip: 'client-ip',
                    user_agent: navigator.userAgent
                })
            });

            const result = await response.json();

            if (result.success) {
                setSuccess(true);
                toast.success(t('reportStolenMoto.motoSignaleeVoleeAvecSucces'), {
                    description: `Alerte créée: ${result.alert.id}`,
                    duration: 8000
                });

                // Réinitialiser le formulaire
                setFormData({
                    numero_serie: '',
                    vin: '',
                    ville: '',
                    description: '',
                    date_vol: new Date().toISOString().split('T')[0]
                });

                if (onSuccess) {
                    onSuccess();
                }
            } else {
                setError(result.error || 'Erreur lors de la déclaration');
                toast.error(t('reportStolenMoto.erreurLorsDeLaDeclaration'), {
                    description: result.error
                });
            }

        } catch (error) {
            console.error('❌ Erreur déclaration vol:', error);
            setError('Erreur de connexion au serveur');
            toast.error(t('reportStolenMoto.erreurDeConnexion'));
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    if (success) {
        return (
            <Card className={`border-orange-200 bg-orange-50 ${className}`}>
                <CardContent className="p-6 text-center">
                    <CheckCircle className="w-16 h-16 text-[#ff4000] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#ff4000] mb-2">
                        Moto signalée volée avec succès
                    </h3>
                    <p className="text-[#ff4000] mb-4">
                        Votre déclaration a été enregistrée et les bureaux concernés ont été alertés.
                    </p>
                    <Button
                        onClick={() => setSuccess(false)}
                        variant="outline"
                        className="border-orange-300 text-[#ff4000] hover:bg-orange-100"
                    >
                        Déclarer une autre moto
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={`border-orange-200 ${className}`}>
            <CardHeader className="bg-orange-50 border-b border-orange-200">
                <CardTitle className="flex items-center gap-2 text-[#ff4000]">
                    <AlertTriangle className="w-6 h-6" />
                    Déclarer une moto volée
                </CardTitle>
                <p className="text-[#ff4000] text-sm">
                    Cette déclaration sera transmise à tous les bureaux syndicats et au PDG
                </p>
            </CardHeader>

            <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <Alert className="border-orange-200 bg-orange-50">
                            <XCircle className="w-4 h-4 text-[#ff4000]" />
                            <AlertDescription className="text-[#ff4000]">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="numero_serie" className="text-sm font-medium">
                                Numéro de série *
                            </Label>
                            <Input
                                id="numero_serie"
                                value={formData.numero_serie}
                                onChange={(e) => handleInputChange('numero_serie', e.target.value)}
                                placeholder="Ex: TM-2024-001"
                                className="mt-1"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="vin" className="text-sm font-medium">
                                VIN (optionnel)
                            </Label>
                            <Input
                                id="vin"
                                value={formData.vin}
                                onChange={(e) => handleInputChange('vin', e.target.value)}
                                placeholder="Ex: VIN123456789"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="ville" className="text-sm font-medium">
                                Ville du vol *
                            </Label>
                            <Input
                                id="ville"
                                value={formData.ville}
                                onChange={(e) => handleInputChange('ville', e.target.value)}
                                placeholder="Ex: Conakry"
                                className="mt-1"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="date_vol" className="text-sm font-medium">
                                Date du vol
                            </Label>
                            <Input
                                id="date_vol"
                                type="date"
                                value={formData.date_vol}
                                onChange={(e) => handleInputChange('date_vol', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="description" className="text-sm font-medium">
                            Description du vol
                        </Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder={t('reportStolenMoto.decrivezLesCirconstancesDuVol')}
                            className="mt-1"
                            rows={3}
                        />
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Shield className="w-5 h-5 text-[#ff4000] mt-0.5" />
                            <div>
                                <h4 className="font-medium text-[#ff4000] mb-1">
                                    Important - Sécurité
                                </h4>
                                <ul className="text-sm text-[#ff4000] space-y-1">
                                    <li>{t('reportStolenMoto.cetteDeclarationSeraVerifieePar')}</li>
                                    <li>{t('reportStolenMoto.touteTentativeDEnregistrementDe')}</li>
                                    <li>{t('reportStolenMoto.lesAutoritesCompetentesSerontInformees')}</li>
                                    <li>{t('reportStolenMoto.votreDeclarationSeraTraceeEt')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-[#ff4000] hover:bg-[#ff4000] text-white flex-1"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Déclaration en cours...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Signaler la moto volée
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
