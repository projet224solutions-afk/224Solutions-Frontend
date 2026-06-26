/**
 * Confirmation de réception d'un transfert
 * 224SOLUTIONS - Gestion des pertes et manquants
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, _CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { _Table, _TableBody, _TableCell, _TableHead, _TableHeader, _TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { _Progress } from '@/components/ui/progress';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ArrowRight,
  Warehouse,
  Store,
  _XCircle,
  _FileText,
  _Camera
} from 'lucide-react';
import { StockTransfer, _ConfirmReceptionInput, useMultiWarehouse } from '@/hooks/useMultiWarehouse';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReceptionItem {
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity_sent: number;
  quantity_received: number;
  quantity_missing: number;
  loss_reason?: string;
  notes?: string;
}

interface TransferReceptionProps {
  transfer: StockTransfer;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const LOSS_REASONS = [
  { value: 'damaged', label: "Endommagé" },
  { value: 'missing', label: 'Manquant' },
  { value: 'expired', label: "Expiré" },
  { value: 'theft', label: 'Vol' },
  { value: 'wrong_item', label: 'Mauvais article' },
  { value: 'other', label: 'Autre' },
];

export default function TransferReception({ transfer, onSuccess, onCancel }: TransferReceptionProps) {
  const { t } = useTranslation();
  const { confirmTransferReception } = useMultiWarehouse();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Préparer les items à partir du transfert
  const [receptionItems, setReceptionItems] = useState<ReceptionItem[]>(() =>
    (transfer.items || []).map(item => ({
      product_id: item.product_id,
      product_name: item.product?.name || 'Produit',
      product_image: item.product?.images?.[0],
      quantity_sent: item.quantity_sent,
      quantity_received: item.quantity_sent, // Par défaut, tout reçu
      quantity_missing: 0,
      loss_reason: undefined,
      notes: undefined
    }))
  );

  // Calculer les totaux
  const totals = useMemo(() => {
    const sent = receptionItems.reduce((sum, i) => sum + i.quantity_sent, 0);
    const received = receptionItems.reduce((sum, i) => sum + i.quantity_received, 0);
    const missing = receptionItems.reduce((sum, i) => sum + i.quantity_missing, 0);
    return { sent, received, missing };
  }, [receptionItems]);

  // Vérifier si tout est reçu
  const isComplete = totals.missing === 0;

  // Mettre à jour la quantité reçue
  const updateQuantityReceived = (productId: string, value: number) => {
    setReceptionItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        const received = Math.max(0, Math.min(value, item.quantity_sent));
        return {
          ...item,
          quantity_received: received,
          quantity_missing: item.quantity_sent - received
        };
      }
      return item;
    }));
  };

  // Mettre à jour la raison de perte
  const updateLossReason = (productId: string, reason: string) => {
    setReceptionItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        return { ...item, loss_reason: reason };
      }
      return item;
    }));
  };

  // Mettre à jour les notes
  const updateNotes = (productId: string, notes: string) => {
    setReceptionItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        return { ...item, notes };
      }
      return item;
    }));
  };

  // Tout reçu
  const markAllReceived = () => {
    setReceptionItems(prev => prev.map(item => ({
      ...item,
      quantity_received: item.quantity_sent,
      quantity_missing: 0,
      loss_reason: undefined,
      notes: undefined
    })));
  };

  // Soumettre la confirmation
  const handleSubmit = async () => {
    // Vérifier que les items avec pertes ont une raison
    const missingReason = receptionItems.find(
      i => i.quantity_missing > 0 && !i.loss_reason
    );

    if (missingReason) {
      toast({
        title: "Raison manquante",
        description: `Veuillez indiquer la raison pour les manquants de "${missingReason.product_name}"`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmTransferReception({
        transfer_id: transfer.id,
        items: receptionItems.map(item => ({
          product_id: item.product_id,
          quantity_received: item.quantity_received,
          loss_reason: item.loss_reason,
          loss_notes: item.notes
        }))
      });

      if (result) {
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card className="bg-[#04439e]/5 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{transfer.transfer_number}</CardTitle>
              <CardDescription>
                Initié le {format(new Date(transfer.initiated_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Trajet */}
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center">
              <div className={cn(
                "inline-flex p-2 rounded-lg mb-1",
                transfer.from_location?.is_pos_enabled ? "bg-orange-100" : "bg-blue-100"
              )}>
                {transfer.from_location?.is_pos_enabled ? (
                  <Store className="w-5 h-5 text-[#ff4000]" />
                ) : (
                  <Warehouse className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <p className="font-medium text-sm">{transfer.from_location?.name}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 text-center">
              <div className={cn(
                "inline-flex p-2 rounded-lg mb-1",
                transfer.to_location?.is_pos_enabled ? "bg-orange-100" : "bg-blue-100"
              )}>
                {transfer.to_location?.is_pos_enabled ? (
                  <Store className="w-5 h-5 text-[#ff4000]" />
                ) : (
                  <Warehouse className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <p className="font-medium text-sm">{transfer.to_location?.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{totals.sent}</p>
            <p className="text-sm text-muted-foreground">{t('transferReception.envoyeS')}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          isComplete && "border-orange-300 bg-orange-50/50 dark:bg-[#ff4000]/20"
        )}>
          <CardContent className="pt-4 text-center">
            <p className={cn(
              "text-3xl font-bold",
              isComplete ? "text-[#ff4000]" : "text-primary"
            )}>
              {totals.received}
            </p>
            <p className="text-sm text-muted-foreground">{t('transferReception.recuS')}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          totals.missing > 0 && "border-orange-300 bg-orange-50/50 dark:bg-[#ff4000]/20"
        )}>
          <CardContent className="pt-4 text-center">
            <p className={cn(
              "text-3xl font-bold",
              totals.missing > 0 ? "text-[#ff4000]" : "text-muted-foreground"
            )}>
              {totals.missing}
            </p>
            <p className="text-sm text-muted-foreground">Manquant(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Bouton tout reçu */}
      {!isComplete && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={markAllReceived}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marquer tout comme reçu
          </Button>
        </div>
      )}

      {/* Liste des items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('transferReception.verificationDesArticles')}</CardTitle>
          <CardDescription>
            Indiquez la quantité réellement reçue pour chaque article
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {receptionItems.map((item, index) => (
              <div key={item.product_id}>
                {index > 0 && <Separator className="my-4" />}

                <div className="flex flex-col md:flex-row gap-4">
                  {/* Info produit */}
                  <div className="flex items-center gap-3 md:w-1/3">
                    <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Envoyé: <strong>{item.quantity_sent}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Quantité reçue */}
                  <div className="md:w-1/3">
                    <Label className="text-sm">{t('transferReception.quantiteRecue')}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={0}
                        max={item.quantity_sent}
                        value={item.quantity_received}
                        onChange={(e) => updateQuantityReceived(item.product_id, parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">/ {item.quantity_sent}</span>

                      {item.quantity_received === item.quantity_sent ? (
                        <Badge className="bg-orange-100 text-[#ff4000]">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Complet
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          -{item.quantity_missing}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Raison si manquant */}
                  {item.quantity_missing > 0 && (
                    <div className="md:w-1/3">
                      <Label className="text-sm">{t('transferReception.raisonDuManquant')}</Label>
                      <Select
                        value={item.loss_reason || ''}
                        onValueChange={(v) => updateLossReason(item.product_id, v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={t('transferReception.selectionner')} />
                        </SelectTrigger>
                        <SelectContent>
                          {LOSS_REASONS.map(reason => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Notes si manquant */}
                {item.quantity_missing > 0 && (
                  <div className="mt-3 pl-15 md:pl-0 md:ml-[33.33%]">
                    <Label className="text-sm">Notes (optionnel)</Label>
                    <Textarea
                      placeholder={t('transferReception.detailsSurLesManquants')}
                      value={item.notes || ''}
                      onChange={(e) => updateNotes(item.product_id, e.target.value)}
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alertes */}
      {totals.missing > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('transferReception.pertesDetectees')}</AlertTitle>
          <AlertDescription>
            {totals.missing} unité(s) seront enregistrées comme pertes dans le système.
            Un rapport sera généré pour suivi.
          </AlertDescription>
        </Alert>
      )}

      {isComplete && (
        <Alert className="border-orange-300 bg-orange-50 dark:bg-[#ff4000]/20">
          <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000] dark:text-orange-200">{t('transferReception.receptionComplete')}</AlertTitle>
          <AlertDescription className="text-[#ff4000] dark:text-orange-300">
            Tous les articles ont été reçus en totalité.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={cn(
            isComplete
              ? "bg-[#ff4000] hover:bg-[#ff4000]"
              : "bg-[#ff4000] hover:bg-[#ff4000]"
          )}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Confirmation...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isComplete ? 'Confirmer réception complète' : 'Confirmer avec manquants'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
