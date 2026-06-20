/**
 * DIALOG DE MODIFICATION DE DEVIS
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuoteItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  ref: string;
  vendor_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  valid_until: string;
  notes: string | null;
  status: string;
}

interface QuoteEditDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function QuoteEditDialog({
  quote,
  open,
  onOpenChange,
  onSuccess,
}: QuoteEditDialogProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([
    { name: '', quantity: 1, unit_price: 0, total: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quote) {
      setClientName(quote.client_name);
      setClientEmail(quote.client_email || '');
      setClientPhone(quote.client_phone || '');
      setClientAddress(quote.client_address || '');

      // Normaliser les items qui peuvent avoir des structures différentes (qty/price vs quantity/unit_price)
      const normalizedItems = (quote.items && quote.items.length > 0)
        ? quote.items.map((item: any) => ({
            name: item.name || '',
            quantity: item.quantity ?? item.qty ?? 1,
            unit_price: item.unit_price ?? item.price ?? 0,
            total: item.total ?? ((item.quantity ?? item.qty ?? 1) * (item.unit_price ?? item.price ?? 0))
          }))
        : [{ name: '', quantity: 1, unit_price: 0, total: 0 }];

      setItems(normalizedItems);
      setDiscount(quote.discount || 0);
      setTax(quote.tax || 0);
      setValidUntil(quote.valid_until || '');
      setNotes(quote.notes || '');
    }
  }, [quote]);

  const updateItemTotal = (index: number, qty: number, price: number) => {
    const newItems = [...items];
    newItems[index].quantity = qty || 1;
    newItems[index].unit_price = price || 0;
    newItems[index].total = (qty || 1) * (price || 0);
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - discount + tax;
    return { subtotal, total };
  };

  const handleSubmit = async () => {
    if (!quote) return;

    if (!clientName.trim() || items.some((item) => !item.name.trim())) {
      toast.error(t('quoteEditDialog.veuillezRemplirTousLesChamps'));
      return;
    }

    try {
      setSaving(true);

      const { subtotal, total } = calculateTotals();

      const { error } = await supabase
        .from('quotes')
        .update({
          client_name: clientName,
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          client_address: clientAddress || null,
          items: items as any,
          subtotal,
          discount,
          tax,
          total,
          valid_until: validUntil,
          notes: notes || null,
          pdf_url: null, // Réinitialiser le PDF pour forcer une régénération
        })
        .eq('id', quote.id);

      if (error) throw error;

      toast.success(t('quoteEditDialog.devisModifieAvecSucces'));
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur modification devis:', error);
      toast.error(t('quoteEditDialog.erreurLorsDeLaModification'));
    } finally {
      setSaving(false);
    }
  };

  const { subtotal, total } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le devis {quote?.ref}</DialogTitle>
          <DialogDescription>
            Modifiez les informations du devis et enregistrez les changements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations client */}
          <div className="space-y-4">
            <h3 className="font-semibold">{t('quoteEditDialog.informationsClient')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('quoteEditDialog.nomDuClient')}</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nom complet"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>{t('quoteEditDialog.telephone')}</Label>
                <Input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+224 XXX XXX XXX"
                />
              </div>
              <div>
                <Label>Adresse</Label>
                <Input
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder={t('quoteEditDialog.adresseComplete')}
                />
              </div>
            </div>
          </div>

          {/* Articles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Articles / Services</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un article
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label>{t('quoteEditDialog.designation')}</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].name = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Nom du produit/service"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>{t('quoteEditDialog.quantite')}</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemTotal(index, parseInt(e.target.value) || 0, item.unit_price)
                          }
                        />
                      </div>
                      <div>
                        <Label>Prix unitaire (GNF)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItemTotal(index, item.quantity, parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div>
                        <Label>Total</Label>
                        <Input value={(item.total || 0).toLocaleString()} disabled />
                      </div>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="mt-8"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="space-y-4">
            <h3 className="font-semibold">Totaux</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Remise (GNF)</Label>
                <Input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>TVA (GNF)</Label>
                <Input
                  type="number"
                  min="0"
                  value={tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>{t('quoteEditDialog.validiteJusquAu')}</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes additionnelles..."
              rows={3}
            />
          </div>

          {/* Récapitulatif */}
          <div className="border-t pt-4">
            <div className="flex justify-between text-lg mb-2">
              <span>Sous-total:</span>
              <span className="font-semibold">{fc(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Remise:</span>
                <span>-{fc(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>TVA:</span>
                <span>+{fc(tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-primary border-t pt-2">
              <span>TOTAL:</span>
              <span>{fc(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
