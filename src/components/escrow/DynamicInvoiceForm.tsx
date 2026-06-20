/**
 * 📝 FORMULAIRE DE FACTURATION DYNAMIQUE - 224SECURE
 * Interface pour que le livreur crée des factures et liens de paiement
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import {
    Receipt,
    MapPin,
    DollarSign,
    User,
    Phone,
    Link,
    QrCode,
    Copy,
    Share2,
    Clock,
    Shield
} from 'lucide-react';
import useGeolocation from '../../hooks/useGeolocation';
import EscrowService, { EscrowInvoice } from '../../services/escrow/EscrowService';
import { Position } from '../../services/geolocation/GeolocationService';
import { tryNativeShare } from '@/utils/nativeShare';

interface DynamicInvoiceFormProps {
    driverId: string;
    onInvoiceCreated?: (invoice: EscrowInvoice) => void;
    onCancel?: () => void;
}

const DynamicInvoiceForm: React.FC<DynamicInvoiceFormProps> = ({
    driverId,
    onInvoiceCreated,
    onCancel
}) => {
    const fc = useFormatCurrency();
    const [amount, setAmount] = useState('');
    const [startLocation, setStartLocation] = useState('');
    const [endLocation, setEndLocation] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [startCoordinates, setStartCoordinates] = useState<Position | null>(null);
    const [endCoordinates, _setEndCoordinates] = useState<Position | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [createdInvoice, setCreatedInvoice] = useState<EscrowInvoice | null>(null);
    const [feeAmount, setFeeAmount] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);

    const geolocation = useGeolocation();
    const escrowService = EscrowService.getInstance();

    // Calculer les frais et le total
    useEffect(() => {
        const amountNum = parseFloat(amount) || 0;
        const fee = Math.round(amountNum * 0.01); // 1% de frais
        setFeeAmount(fee);
        setTotalAmount(amountNum + fee);
    }, [amount]);

    // Utiliser la position actuelle comme point de départ
    const useCurrentLocation = async () => {
        try {
            const position = await geolocation.getCurrentLocation();
            setStartCoordinates({
                latitude: position.latitude,
                longitude: position.longitude,
                timestamp: Date.now()
            });
            setStartLocation(`${position.latitude}, ${position.longitude}`);
        } catch (error) {
            console.error('Erreur position actuelle:', error);
        }
    };

    // Rechercher l'adresse de départ
    const searchStartLocation = async () => {
        if (!startLocation.trim()) return;
        // TODO: Implémenter la recherche d'adresse
    };

    // Rechercher l'adresse de destination
    const searchEndLocation = async () => {
        if (!endLocation.trim()) return;
        // TODO: Implémenter la recherche d'adresse
    };

    // Créer la facture
    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!amount || !startLocation || !endLocation) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
        }

        setIsCreating(true);
        try {
            const invoice = await escrowService.createDynamicInvoice(
                driverId,
                parseFloat(amount),
                startLocation,
                endLocation,
                undefined, // clientId sera défini lors du paiement
                clientName || undefined,
                clientPhone || undefined,
                startCoordinates || undefined,
                endCoordinates || undefined,
                notes || undefined
            );

            setCreatedInvoice(invoice);

            if (onInvoiceCreated) {
                onInvoiceCreated(invoice);
            }

            console.log('📝 Facture créée:', invoice.id);
        } catch (error) {
            console.error('Erreur création facture:', error);
            alert('Erreur lors de la création de la facture');
        } finally {
            setIsCreating(false);
        }
    };

    // Copier le lien de paiement
    const copyPaymentLink = async () => {
        if (createdInvoice) {
            try {
                await navigator.clipboard.writeText(createdInvoice.paymentLink);
                alert('Lien copié dans le presse-papiers !');
            } catch (error) {
                console.error('Erreur copie:', error);
            }
        }
    };

    // Partager le lien
    const sharePaymentLink = async () => {
        if (createdInvoice) {
            try {
                const result = await tryNativeShare({
                    title: 'Facture 224SOLUTIONS',
                    text: `Facture de ${amount} GNF pour trajet de ${startLocation} vers ${endLocation}`,
                    url: createdInvoice.paymentLink
                });

                if (result === 'fallback') {
                    await copyPaymentLink();
                }
            } catch (error) {
                console.error('Erreur partage:', error);
            }
        }
    };

    if (createdInvoice) {
        return (
            <div className="max-w-2xl mx-auto p-6 space-y-6">
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[#ff4000]">
                            <Shield className="w-5 h-5" />
                            Facture créée avec succès !
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-600">ID Facture</Label>
                                <p className="text-sm font-mono bg-gray-100 p-2 rounded">{createdInvoice.id}</p>
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-600">Statut</Label>
                                <Badge variant="outline" className="ml-2">
                                    {createdInvoice.status}
                                </Badge>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-600">Lien de paiement</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={createdInvoice.paymentLink}
                                    readOnly
                                    className="flex-1 text-sm"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={copyPaymentLink}
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={sharePaymentLink}
                                >
                                    <Share2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {createdInvoice.qrCode && (
                            <div className="text-center">
                                <Label className="text-sm font-medium text-gray-600">QR Code</Label>
                                <div className="mt-2 p-4 bg-white rounded-lg border">
                                    <img
                                        src={createdInvoice.qrCode}
                                        alt="QR Code"
                                        className="w-32 h-32 mx-auto"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-800 mb-2">Instructions pour le client :</h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                                <li>• Le client clique sur le lien ou scanne le QR code</li>
                                <li>• Il choisit sa méthode de paiement</li>
                                <li>• Le système ajoute automatiquement 1% de frais</li>
                                <li>• Le paiement est sécurisé par 224SECURE</li>
                                <li>• Vous serez payé après confirmation de livraison</li>
                            </ul>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreatedInvoice(null)}
                                className="flex-1"
                            >
                                Créer une autre facture
                            </Button>
                            <Button
                                type="button"
                                onClick={onCancel}
                                className="flex-1"
                            >
                                Terminer
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-blue-600" />
                        Créer une facture dynamique
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateInvoice} className="space-y-6">
                        {/* Montant */}
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-[#ff4000]" />
                                Montant du trajet (GNF) *
                            </Label>
                            <Input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="1000"
                                min="100"
                                step="100"
                                required
                            />
                        </div>

                        {/* Point de départ */}
                        <div className="space-y-2">
                            <Label htmlFor="start-location" className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-600" />
                                Point de départ *
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="start-location"
                                    value={startLocation}
                                    onChange={(e) => setStartLocation(e.target.value)}
                                    placeholder="Adresse de départ"
                                    className="flex-1"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={searchStartLocation}
                                    disabled={!startLocation.trim()}
                                >
                                    🔍
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={useCurrentLocation}
                                >
                                    Ma position
                                </Button>
                            </div>
                        </div>

                        {/* Point de destination */}
                        <div className="space-y-2">
                            <Label htmlFor="end-location" className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[#ff4000]" />
                                Destination *
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="end-location"
                                    value={endLocation}
                                    onChange={(e) => setEndLocation(e.target.value)}
                                    placeholder="Adresse de destination"
                                    className="flex-1"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={searchEndLocation}
                                    disabled={!endLocation.trim()}
                                >
                                    🔍
                                </Button>
                            </div>
                        </div>

                        {/* Informations client (optionnel) */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-800">Informations client (optionnel)</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="client-name" className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-600" />
                                        Nom du client
                                    </Label>
                                    <Input
                                        id="client-name"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        placeholder="Nom du client"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="client-phone" className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-gray-600" />
                                        Téléphone
                                    </Label>
                                    <Input
                                        id="client-phone"
                                        value={clientPhone}
                                        onChange={(e) => setClientPhone(e.target.value)}
                                        placeholder="+224 XXX XX XX XX"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (optionnel)</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Instructions spéciales, description du trajet..."
                                rows={3}
                            />
                        </div>

                        {/* Résumé des frais */}
                        {amount && (
                            <Card className="bg-gray-50">
                                <CardContent className="p-4">
                                    <h4 className="font-semibold text-gray-800 mb-3">Résumé de la facture</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Montant du trajet:</span>
                                            <span className="font-medium">{fc(parseFloat(amount) || 0)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Frais 224SECURE (1%):</span>
                                            <span className="font-medium">{fc(feeAmount)}</span>
                                        </div>
                                        <div className="border-t pt-2 flex justify-between font-semibold">
                                            <span>Total client paiera:</span>
                                            <span className="text-[#ff4000]">{fc(totalAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-600">
                                            <span>Vous recevrez:</span>
                                            <span>{fc(parseFloat(amount) || 0)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Boutons d'action */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                disabled={isCreating}
                                className="flex-1"
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={!amount || !startLocation || !endLocation || isCreating}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {isCreating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Création...
                                    </>
                                ) : (
                                    <>
                                        <Receipt className="w-4 h-4 mr-2" />
                                        Créer la facture
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default DynamicInvoiceForm;
