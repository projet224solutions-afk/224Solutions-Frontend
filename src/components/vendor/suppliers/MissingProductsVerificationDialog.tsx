/**
 * Dialog de vérification des produits manquants avant validation d'achat
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Package, Truck, Building2 } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface MissingProductEntry {
  category_id: string;
  category_name: string;
  supplier_id: string;
  supplier_name: string;
  missing_count: number;
  reason: 'supplier_error' | 'shipping_loss' | 'other';
  notes: string;
}

interface MissingProductsVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  categories: Category[];
  onConfirm: (hasMissingProducts: boolean, missingEntries: MissingProductEntry[]) => void;
  purchaseNumber: string;
}

export function MissingProductsVerificationDialog({
  open,
  onOpenChange,
  suppliers,
  categories,
  onConfirm,
  purchaseNumber,
}: MissingProductsVerificationDialogProps) {
  const { t } = useTranslation();
  const [hasVerified, setHasVerified] = useState<'yes' | 'no' | null>(null);
  const [hasMissing, setHasMissing] = useState<'yes' | 'no' | null>(null);
  const [missingEntries, setMissingEntries] = useState<MissingProductEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Partial<MissingProductEntry>>({
    category_id: '',
    supplier_id: '',
    missing_count: 0,
    reason: 'supplier_error',
    notes: '',
  });

  const handleAddMissingEntry = () => {
    if (!currentEntry.category_id || !currentEntry.supplier_id || !currentEntry.missing_count) {
      return;
    }

    const category = categories.find(c => c.id === currentEntry.category_id);
    const supplier = suppliers.find(s => s.id === currentEntry.supplier_id);

    const newEntry: MissingProductEntry = {
      category_id: currentEntry.category_id,
      category_name: category?.name || '',
      supplier_id: currentEntry.supplier_id,
      supplier_name: supplier?.name || '',
      missing_count: currentEntry.missing_count || 0,
      reason: currentEntry.reason || 'supplier_error',
      notes: currentEntry.notes || '',
    };

    setMissingEntries([...missingEntries, newEntry]);
    setCurrentEntry({
      category_id: '',
      supplier_id: '',
      missing_count: 0,
      reason: 'supplier_error',
      notes: '',
    });
  };

  const handleRemoveEntry = (index: number) => {
    setMissingEntries(missingEntries.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (hasVerified === 'yes' && hasMissing === 'no') {
      onConfirm(false, []);
    } else if (hasVerified === 'yes' && hasMissing === 'yes') {
      onConfirm(true, missingEntries);
    }
  };

  const canProceed = hasVerified === 'yes' && (hasMissing === 'no' || (hasMissing === 'yes' && missingEntries.length > 0));

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'supplier_error': return 'Erreur fournisseur';
      case 'shipping_loss': return 'Perte en expédition';
      case 'other': return 'Autre';
      default: return reason;
    }
  };

  const resetDialog = () => {
    setHasVerified(null);
    setHasMissing(null);
    setMissingEntries([]);
    setCurrentEntry({
      category_id: '',
      supplier_id: '',
      missing_count: 0,
      reason: 'supplier_error',
      notes: '',
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetDialog();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Vérification des produits - {purchaseNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Question 1: Vérification */}
          <Card className="border-2 border-primary/20">
            <CardContent className="p-4">
              <Label className="text-base font-semibold mb-3 block">
                Avez-vous vérifié les produits reçus de votre fournisseur ?
              </Label>
              <RadioGroup
                value={hasVerified || ''}
                onValueChange={(v) => {
                  setHasVerified(v as 'yes' | 'no');
                  if (v === 'no') {
                    setHasMissing(null);
                    setMissingEntries([]);
                  }
                }}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="verified-yes" />
                  <Label htmlFor="verified-yes" className="flex items-center gap-2 cursor-pointer">
                    <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                    Oui, j'ai vérifié
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="verified-no" />
                  <Label htmlFor="verified-no" className="flex items-center gap-2 cursor-pointer">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Non, pas encore
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {hasVerified === 'no' && (
            <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <p className="text-sm text-orange-800 dark:text-orange-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Veuillez d'abord vérifier tous les produits reçus avant de valider cet achat.
                    Cela vous permettra de signaler tout produit manquant.
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Question 2: Produits manquants */}
          {hasVerified === 'yes' && (
            <Card className="border-2 border-muted">
              <CardContent className="p-4">
                <Label className="text-base font-semibold mb-3 block">
                  Y a-t-il des produits manquants ?
                </Label>
                <RadioGroup
                  value={hasMissing || ''}
                  onValueChange={(v) => setHasMissing(v as 'yes' | 'no')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="missing-no" />
                    <Label htmlFor="missing-no" className="flex items-center gap-2 cursor-pointer">
                      <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                      Non, tout est complet
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="missing-yes" />
                    <Label htmlFor="missing-yes" className="flex items-center gap-2 cursor-pointer">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Oui, il y a des manques
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Formulaire produits manquants */}
          {hasVerified === 'yes' && hasMissing === 'yes' && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Signaler un produit manquant
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">{t('missingProductsVerificationDialog.fournisseurConcerne')}</Label>
                      <Select
                        value={currentEntry.supplier_id}
                        onValueChange={(v) => setCurrentEntry({ ...currentEntry, supplier_id: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t('missingProductsVerificationDialog.selectionner')} />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="flex items-center gap-2">
                                <Building2 className="h-3 w-3" />
                                {s.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">{t('missingProductsVerificationDialog.categorieDuProduit')}</Label>
                      <Select
                        value={currentEntry.category_id}
                        onValueChange={(v) => setCurrentEntry({ ...currentEntry, category_id: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t('missingProductsVerificationDialog.selectionner')} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Nombre manquant *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={currentEntry.missing_count || ''}
                        onChange={(e) => setCurrentEntry({
                          ...currentEntry,
                          missing_count: parseInt(e.target.value) || 0
                        })}
                        className="h-9"
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Raison *</Label>
                      <Select
                        value={currentEntry.reason}
                        onValueChange={(v) => setCurrentEntry({
                          ...currentEntry,
                          reason: v as 'supplier_error' | 'shipping_loss' | 'other'
                        })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="supplier_error">
                            <span className="flex items-center gap-2">
                              <Building2 className="h-3 w-3" />
                              Erreur fournisseur
                            </span>
                          </SelectItem>
                          <SelectItem value="shipping_loss">
                            <span className="flex items-center gap-2">
                              <Truck className="h-3 w-3" />
                              Perte en expédition
                            </span>
                          </SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Notes (optionnel)</Label>
                    <Textarea
                      value={currentEntry.notes}
                      onChange={(e) => setCurrentEntry({ ...currentEntry, notes: e.target.value })}
                      placeholder={t('missingProductsVerificationDialog.detailsSupplementaires')}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleAddMissingEntry}
                    disabled={!currentEntry.supplier_id || !currentEntry.category_id || !currentEntry.missing_count}
                  >
                    Ajouter ce produit manquant
                  </Button>
                </CardContent>
              </Card>

              {/* Liste des produits manquants signalés */}
              {missingEntries.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Produits manquants signalés ({missingEntries.length})
                  </Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {missingEntries.map((entry, index) => (
                      <Card key={index} className="bg-destructive/5 border-destructive/20">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {entry.category_name}
                              </Badge>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-sm font-medium text-destructive">
                                {entry.missing_count} manquant(s)
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {entry.supplier_name} - {getReasonLabel(entry.reason)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEntry(index)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            ×
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Résumé avant confirmation */}
          {hasVerified === 'yes' && hasMissing === 'no' && (
            <Card className="bg-orange-50 dark:bg-[#ff4000]/20 border-orange-200 dark:border-[#ff4000]">
              <CardContent className="p-4">
                <p className="text-sm text-[#ff4000] dark:text-orange-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t('missingProductsVerificationDialog.parfaitTousLesProduitsOnt')}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed}
            className="bg-[#ff4000] hover:bg-[#ff4000] gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Continuer la validation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
