import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard, Plus, Search,
  Loader2
} from 'lucide-react';

interface CreditSale {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  due_date: string;
  paid_amount: number;
  remaining_amount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface CreditFormData {
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  due_date: string;
  notes: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-[#ff4000]',
  partial: 'bg-blue-100 text-blue-800',
  paid: 'bg-orange-100 text-[#ff4000]',
  overdue: 'bg-orange-100 text-[#ff4000]'
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  partial: 'Partiellement payé',
  paid: 'Payé',
  overdue: 'En retard'
};

export default function CreditSalesForm() {
  const { t } = useTranslation();
  const { vendorId } = useCurrentVendor();
  const { toast } = useToast();
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const [formData, setFormData] = useState<CreditFormData>({
    customer_name: '',
    customer_phone: '',
    items: [{ product_name: '', quantity: 1, unit_price: 0 }],
    due_date: '',
    notes: ''
  });

  // Charger les ventes à crédit - table n'existe pas encore
  const loadCreditSales = async () => {
    if (!vendorId) return;

    setLoading(true);
    try {
      // Table vendor_credit_sales n'existe pas encore - utiliser des données mockées pour l'instant
      setCreditSales([]);
    } catch (error) {
      console.error('Erreur lors du chargement des ventes à crédit:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCreditSales();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // Ajouter une ligne d'article
  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_name: '', quantity: 1, unit_price: 0 }]
    });
  };

  // Supprimer une ligne d'article
  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  // Mettre à jour un article
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  // Calculer les totaux
  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax = subtotal * 0.1; // 10% de TVA
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  // Soumettre la vente à crédit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorId) {
      toast({
        title: "Erreur",
        description: "ID vendeur manquant",
        variant: "destructive"
      });
      return;
    }

    if (!formData.customer_name.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer le nom du client",
        variant: "destructive"
      });
      return;
    }

    if (formData.items.length === 0 || !formData.items[0].product_name) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins un article",
        variant: "destructive"
      });
      return;
    }

    if (!formData.due_date) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une date d'échéance",
        variant: "destructive"
      });
      return;
    }

    // Pour l'instant, juste afficher un message - la table n'existe pas encore
    toast({
      title: "Information",
      description: "La fonctionnalité de vente à crédit sera bientôt disponible",
    });

    setIsDialogOpen(false);
  };

  // Enregistrer un paiement
  const recordPayment = async (creditSaleId: string, amount: number) => {
    if (!vendorId || amount <= 0) return;

    toast({
      title: "Information",
      description: "La fonctionnalité de paiement sera bientôt disponible",
    });
  };

  const { subtotal, tax, total } = calculateTotals();

  // Filtrer les ventes à crédit
  const filteredSales = creditSales.filter(sale => {
    const matchesSearch = sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.order_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || sale.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: creditSales.length,
    pending: creditSales.filter(s => s.status === 'pending').length,
    partial: creditSales.filter(s => s.status === 'partial').length,
    paid: creditSales.filter(s => s.status === 'paid').length,
    overdue: creditSales.filter(s => s.status === 'overdue').length,
    totalAmount: creditSales.reduce((sum, s) => sum + s.total, 0),
    receivable: creditSales.reduce((sum, s) => sum + s.remaining_amount, 0)
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg sm:text-xl">{t('creditSalesForm.ventesACredit')}</CardTitle>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('creditSalesForm.nouvelleVente')}</span>
                <span className="sm:hidden">{t('creditSalesForm.nouveau')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('creditSalesForm.creerUneVenteACredit')}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Informations client */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">{t('creditSalesForm.informationsClient')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder={t('creditSalesForm.nomDuClient')}
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    />
                    <Input
                      placeholder={t('creditSalesForm.telephoneOptionnel')}
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Articles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Articles</h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addItem}
                    >
                      + Ajouter
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <Input
                          placeholder={t('creditSalesForm.produit')}
                          value={item.product_name}
                          onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder={t('creditSalesForm.qte')}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          min="1"
                          className="w-16"
                        />
                        <Input
                          type="number"
                          placeholder="Prix"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          className="w-24"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totaux */}
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>TVA (10%):</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Date d'échéance et notes */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('creditSalesForm.dateDEcheance')}</label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="Notes (optionnel)"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                {/* Boutons */}
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Créer la vente
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="px-3 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Onglets */}
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="list" className="text-xs sm:text-sm py-2">
              Liste ({filteredSales.length})
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs sm:text-sm py-2">
              Statistiques
            </TabsTrigger>
          </TabsList>

          {/* Contenu: Liste */}
          <TabsContent value="list" className="mt-4 space-y-4">
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('creditSalesForm.rechercherParClientOuNumero')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-background"
              >
                <option value="">{t('creditSalesForm.tousLesStatuts')}</option>
                <option value="pending">En attente</option>
                <option value="partial">{t('creditSalesForm.partiellementPaye')}</option>
                <option value="paid">{t('creditSalesForm.paye')}</option>
                <option value="overdue">En retard</option>
              </select>
            </div>

            {/* Liste des ventes */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{t('creditSalesForm.aucuneVenteACreditTrouvee')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSales.map((sale) => (
                  <Card key={sale.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Infos principales */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">{sale.customer_name}</h4>
                            <Badge className={statusColors[sale.status]}>
                              {statusLabels[sale.status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Commande: {sale.order_number}</p>
                          {sale.customer_phone && (
                            <p className="text-xs text-muted-foreground">Tél: {sale.customer_phone}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Échéance: {new Date(sale.due_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>

                        {/* Montants */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Total:</span>
                            <span className="font-semibold">${sale.total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>{t('creditSalesForm.paye2')}</span>
                            <span className="text-[#ff4000]">${sale.paid_amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>{t('creditSalesForm.du')}</span>
                            <span className="text-destructive font-semibold">
                              ${sale.remaining_amount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Articles */}
                      {sale.items && sale.items.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Articles:</p>
                          <ul className="text-xs space-y-1">
                            {sale.items.map((item: any, idx: number) => (
                              <li key={idx} className="flex justify-between text-muted-foreground">
                                <span>{item.product_name} x{item.quantity}</span>
                                <span>${(item.quantity * item.unit_price).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Bouton paiement si montant restant */}
                      {sale.remaining_amount > 0 && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" className="mt-4 w-full gap-2">
                              <CreditCard className="w-3 h-3" />
                              Enregistrer un paiement
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Paiement pour {sale.order_number}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <div className="flex justify-between text-sm mb-2">
                                  <span>{t('creditSalesForm.montantDu')}</span>
                                  <span className="font-semibold">${sale.remaining_amount.toFixed(2)}</span>
                                </div>
                              </div>
                              <Input
                                type="number"
                                placeholder={t('creditSalesForm.montantDuPaiement')}
                                step="0.01"
                                max={sale.remaining_amount}
                                id={`payment-${sale.id}`}
                              />
                              <Button
                                onClick={() => {
                                  const input = document.getElementById(`payment-${sale.id}`) as HTMLInputElement;
                                  const amount = parseFloat(input.value);
                                  if (amount > 0) {
                                    recordPayment(sale.id, amount);
                                  }
                                }}
                                className="w-full"
                              >
                                Confirmer le paiement
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Contenu: Statistiques */}
          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-primary">{stats.total}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-[#ff4000]">{stats.pending}</div>
                  <p className="text-xs text-muted-foreground mt-1">En attente</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-primary">{stats.partial}</div>
                  <p className="text-xs text-muted-foreground mt-1">Partiels</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-[#ff4000]">{stats.paid}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t('creditSalesForm.payes')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
                  <p className="text-xs text-muted-foreground mt-1">En retard</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-lg font-bold text-destructive">${stats.receivable.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t('creditSalesForm.aRecevoir')}</p>
                </CardContent>
              </Card>
              <Card className="sm:col-span-3">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-primary">${stats.totalAmount.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground mt-2">{t('creditSalesForm.montantTotalDesVentesA')}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
