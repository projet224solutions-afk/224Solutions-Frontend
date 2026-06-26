/**
 * COMPOSANT DE SÉLECTION DE MÉTHODE DE PAIEMENT TAXI-MOTO
 * Affiché après validation de la commande, avant confirmation finale
 * 224Solutions - Taxi-Moto System
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    CreditCard,
    Wallet,
    Smartphone,
    Banknote,
    CheckCircle,
    ArrowLeft,
    Loader2,
    Shield
} from "lucide-react";
import { PaymentMethod } from "@/services/taxi/paymentsService";

export interface PaymentMethodOption {
    id: PaymentMethod;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    color: string;
    requiresPhone?: boolean;
}

interface PaymentMethodStepProps {
    amount: number;
    walletBalance?: number;
    onConfirm: (method: PaymentMethod, phoneNumber?: string) => void;
    onBack: () => void;
    isLoading?: boolean;
}

export const paymentMethods: PaymentMethodOption[] = [
    {
        id: 'wallet',
        name: 'Wallet 224Solutions',
        icon: Wallet,
        description: "Payez avec votre portefeuille",
        color: 'bg-[#ff4000]'
    },
    {
        id: 'card',
        name: 'Carte bancaire',
        icon: CreditCard,
        description: 'Visa, Mastercard, etc.',
        color: 'bg-blue-500'
    },
    {
        id: 'orange_money',
        name: 'Orange Money',
        icon: Smartphone,
        description: "Paiement mobile Orange",
        color: 'bg-orange-500',
        requiresPhone: true
    },
    {
        id: 'cash',
        name: 'Espèces',
        icon: Banknote,
        description: 'Payer en cash au chauffeur',
        color: 'bg-gray-500'
    }
];

export default function PaymentMethodStep({
    amount,
    walletBalance = 0,
    onConfirm,
    onBack,
    isLoading = false
}: PaymentMethodStepProps) {
    const { t } = useTranslation();
    const fc = useFormatCurrency();
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleConfirm = () => {
        if (!selectedMethod) return;

        // Vérifier le numéro de téléphone pour Orange Money
        const method = paymentMethods.find(m => m.id === selectedMethod);
        if (method?.requiresPhone && phoneNumber.length < 9) {
            return;
        }

        onConfirm(selectedMethod, phoneNumber || undefined);
    };

    const isWalletSufficient = walletBalance >= amount;

    return (
        <Card className="bg-card border-0 shadow-xl">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Shield className="w-5 h-5 text-primary" />
                            Mode de paiement
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Choisissez comment payer votre course
                        </p>
                    </div>
                </div>

                {/* Montant */}
                <div className="mt-4 p-4 bg-primary/10 rounded-xl text-center">
                    <p className="text-sm text-muted-foreground">{t('paymentMethodStep.montantAPayer')}</p>
                    <p className="text-3xl font-bold text-primary">
                        {fc(amount)}
                    </p>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Liste des méthodes de paiement */}
                <div className="space-y-3">
                    {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        const isSelected = selectedMethod === method.id;
                        const isWallet = method.id === 'wallet';

                        return (
                            <div key={method.id}>
                                <button
                                    onClick={() => setSelectedMethod(method.id)}
                                    disabled={isLoading}
                                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                                        isSelected
                                            ? 'border-primary bg-primary/5 shadow-md'
                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`${method.color} p-3 rounded-xl`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-semibold text-foreground">
                                                {method.name}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {method.description}
                                            </p>
                                            {/* Afficher le solde du wallet */}
                                            {isWallet && (
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-sm">
                                                        Solde: {fc(walletBalance)}
                                                    </span>
                                                    {isWalletSufficient ? (
                                                        <Badge variant="default" className="bg-[#ff4000] text-xs">
                                                            Suffisant
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Insuffisant
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <CheckCircle className="w-6 h-6 text-primary" />
                                        )}
                                    </div>
                                </button>

                                {/* Champ téléphone pour Orange Money */}
                                {isSelected && method.requiresPhone && (
                                    <div className="mt-3 ml-4 p-4 bg-muted/50 rounded-lg">
                                        <Label htmlFor="phone" className="text-sm font-medium">
                                            Numéro Orange Money
                                        </Label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="6XX XX XX XX"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            className="mt-2"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Info Cash */}
                {selectedMethod === 'cash' && (
                    <div className="p-3 bg-[#ff4000]/10 border border-[#ff4000]/30 rounded-lg">
                        <p className="text-sm text-[#ff4000] dark:text-[#ff4000]">
                            💵 Vous paierez directement au chauffeur à la fin de la course.
                        </p>
                    </div>
                )}

                {/* Info Wallet insuffisant */}
                {selectedMethod === 'wallet' && !isWalletSufficient && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <p className="text-sm text-destructive">
                            ⚠️ Solde insuffisant. Veuillez recharger votre wallet ou choisir un autre mode de paiement.
                        </p>
                    </div>
                )}

                {/* Bouton de confirmation */}
                <Button
                    onClick={handleConfirm}
                    disabled={
                        !selectedMethod ||
                        isLoading ||
                        (selectedMethod === 'wallet' && !isWalletSufficient) ||
                        (selectedMethod === 'orange_money' && phoneNumber.length < 9)
                    }
                    className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Traitement en cours...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Confirmer la réservation
                        </>
                    )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                    En confirmant, vous acceptez les conditions générales de 224Solutions
                </p>
            </CardContent>
        </Card>
    );
}
