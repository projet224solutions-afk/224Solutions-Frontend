/**
 * FORMULAIRE CRÉATION DEVIS - INTERFACE VENDEUR
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, FilePlus, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVendorId } from '@/hooks/useVendorId';
import { useFormPersistence, useAppPersistence } from '@/hooks/useAppPersistence';

interface QuoteItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export default function QuoteForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { vendorId } = useVendorId();
  const [loading, setLoading] = useState(false);

  // Persistance du formulaire client
  const { values: clientForm, setValues: setClientForm, resetForm: resetClientForm } = useFormPersistence(
    `quote_client_${vendorId}`,
    {
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      discount: 0,
      tax: 0,
      notes: '',
    },
    { enabled: !!vendorId, maxAge: 60 * 60 * 1000 } // 1 heure
  );

  // Persistance des items du devis
  const itemsPersistence = useAppPersistence<QuoteItem[]>({
    key: `quote_items_${vendorId}`,
    defaultState: [{ name: '', quantity: 1, unit_price: 0, total: 0 }],
    enabled: !!vendorId,
    maxAge: 60 * 60 * 1000,
  });

  // Aliases pour compatibilité
  const clientName = clientForm.clientName;
  const setClientName = (v: string) => setClientForm(prev => ({ ...prev, clientName: v }));
  const clientEmail = clientForm.clientEmail;
  const setClientEmail = (v: string) => setClientForm(prev => ({ ...prev, clientEmail: v }));
  const clientPhone = clientForm.clientPhone;
  const setClientPhone = (v: string) => setClientForm(prev => ({ ...prev, clientPhone: v }));
  const clientAddress = clientForm.clientAddress;
  const setClientAddress = (v: string) => setClientForm(prev => ({ ...prev, clientAddress: v }));
  const discount = clientForm.discount;
  const setDiscount = (v: number) => setClientForm(prev => ({ ...prev, discount: v }));
  const tax = clientForm.tax;
  const setTax = (v: number) => setClientForm(prev => ({ ...prev, tax: v }));
  const notes = clientForm.notes;
  const setNotes = (v: string) => setClientForm(prev => ({ ...prev, notes: v }));

  const items = itemsPersistence.state;
  const setItems = itemsPersistence.setState;

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const updateItem = (idx: number, field: keyof QuoteItem, value: string | number) => {
    const copy = [...items];
    (copy[idx] as any)[field] = value;
    // Recalculer le total de l'item
    copy[idx].total = (copy[idx].quantity || 0) * (copy[idx].unit_price || 0);
    setItems(copy);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const total = subtotal - Number(discount) + Number(tax);

  const handleGenerate = async () => {
    if (!vendorId) {
      toast.error(t('quoteForm.erreurVendeurNonIdentifie'));
      return;
    }

    if (!clientName || items.some(i => !i.name || !i.quantity || !i.unit_price)) {
      toast.error(t('quoteForm.veuillezRemplirTousLesChamps'));
      return;
    }

    try {
      setLoading(true);

      // Générer référence unique
      const ref = `DEV-${Date.now().toString().slice(-8)}`;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7); // Valide 7 jours

      // Créer le devis en base
      const { data: quote, error } = await supabase
        .from('quotes')
        .insert({
          ref,
          vendor_id: vendorId,
          client_name: clientName,
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          client_address: clientAddress || null,
          items: items as any,
          subtotal,
          tax,
          discount,
          total,
          status: 'pending',
          valid_until: validUntil.toISOString().split('T')[0],
          notes
        })
        .select()
        .single();

      if (error) throw error;

      // Générer le PDF via le backend Node
      const { backendFetch } = await import('@/services/backendApi');
      const pdfResp = await backendFetch<any>('/api/documents/quote-pdf', {
        method: 'POST',
        body: { quote_id: quote.id, ref: quote.ref }
      });

      if (!pdfResp.success) {
        console.error('Erreur génération PDF:', pdfResp.error);
        toast.error(t('quoteForm.devisCreeMaisErreurGeneration'));
      } else {
        toast.success(t('quoteForm.devisCreeAvecSucces'));
      }

      // Reset form avec persistance
      resetClientForm();
      itemsPersistence.clear();

      onSuccess?.();
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error(t('quoteForm.erreurLorsDeLaCreation'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Créer un Devis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Infos Client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">{t('quoteForm.nomClient')}</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t('quoteForm.nomCompletDuClient')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientEmail">Email</Label>
            <Input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientPhone">{t('quoteForm.telephone')}</Label>
            <Input
              id="clientPhone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="+224..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientAddress">Adresse</Label>
            <Input
              id="clientAddress"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder={t('quoteForm.adresseComplete')}
            />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Articles / Services</Label>
            <Button onClick={addItem} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une ligne
            </Button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5 space-y-2">
                <Label className="text-xs">Produit/Service</Label>
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(idx, 'name', e.target.value)}
                  placeholder={t('quoteForm.nomDuProduit')}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-xs">{t('quoteForm.qte')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                />
              </div>
              <div className="col-span-3 space-y-2">
                <Label className="text-xs">Prix unitaire (GNF)</Label>
                <Input
                  type="number"
                  min="0"
                  value={item.unit_price}
                  onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <span className="font-semibold">
                  {fc(item.total || 0)}
                </span>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(idx)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Sous-total:</span>
            <span className="font-semibold">{fc(subtotal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount">Remise (GNF)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax">Taxe (GNF)</Label>
              <Input
                id="tax"
                type="number"
                min="0"
                value={tax}
                onChange={(e) => setTax(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>TOTAL:</span>
            <span className="text-primary">{fc(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes / Conditions (optionnel)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('quoteForm.conditionsDePaiementGarantiesEtc')}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 bg-[#04439e] hover:bg-[#04439e]/90"
            size="lg"
          >
            <FilePlus className="w-5 h-5 mr-2" />
            {loading ? 'Création en cours...' : 'Créer un devis'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}