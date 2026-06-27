/**
 * Modal de réservation restaurant professionnel
 * Inspiré des systèmes OpenTable, TheFork, et des restaurants étoilés Michelin
 * Experience utilisateur premium avec sélection de date, heure, menu et paiement
 * v2 - Ajout paiement carte bancaire, reçu et suivi statut
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar, Clock, Users, Phone, Mail, User, Sparkles, Check, AlertCircle,
  UtensilsCrossed, CreditCard, ShoppingCart, Plus, Minus, ChevronRight, Receipt, Eye, Wallet
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRestaurantReservations, TimeSlot, ReservationFormData } from '@/hooks/useRestaurantReservations';
import { useRestaurantMenu, MenuItem } from '@/hooks/useRestaurantMenu';
import { useAuth } from '@/hooks/useAuth';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { StripePaymentWrapper } from '@/components/payment/StripePaymentWrapper';
import { useAppPersistence } from '@/hooks/useAppPersistence';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  restaurantName: string;
  restaurantPhone?: string;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

type Step = 'guests' | 'datetime' | 'menu' | 'details' | 'payment' | 'confirmation';

export function ReservationModal({
  isOpen,
  onClose,
  serviceId,
  restaurantName,
  restaurantPhone
}: ReservationModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fc = useFormatCurrency();
  const { createReservation, checkAvailability } = useRestaurantReservations(serviceId);
  const { categories, menuItems, loading: menuLoading } = useRestaurantMenu(serviceId);

  const [step, setStep] = useState<Step>('guests');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Persistance du formulaire de réservation avec useAppPersistence (supporte serialize/deserialize)
  interface ReservationFormState {
    partySize: number;
    selectedDate: Date | undefined;
    selectedTime: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    specialRequests: string;
    wantToPreorder: boolean;
    wantToPrepay: boolean;
    paymentMethod: 'card' | 'mobile';
    selectedCategory: string;
  }

  const defaultReservationForm: ReservationFormState = {
    partySize: 2,
    selectedDate: undefined,
    selectedTime: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    specialRequests: '',
    wantToPreorder: false,
    wantToPrepay: false,
    paymentMethod: 'mobile',
    selectedCategory: 'all',
  };

  const reservationPersistence = useAppPersistence<ReservationFormState>({
    key: `reservation_${serviceId}`,
    defaultState: defaultReservationForm,
    enabled: !!serviceId && isOpen,
    maxAge: 30 * 60 * 1000, // 30 minutes
    serialize: (state) => ({
      ...state,
      selectedDate: state.selectedDate?.toISOString(),
    }),
    deserialize: (data) => ({
      ...data,
      selectedDate: data.selectedDate ? new Date(data.selectedDate) : undefined,
    }),
  });

  const reservationForm = reservationPersistence.state;
  const setReservationForm = reservationPersistence.setState;
  const _resetReservationForm = reservationPersistence.clear;

  // Persistance du panier de précommande
  const cartPersistence = useAppPersistence<CartItem[]>({
    key: `reservation_cart_${serviceId}`,
    defaultState: [],
    enabled: !!serviceId && isOpen,
    maxAge: 30 * 60 * 1000,
  });

  // Aliases pour compatibilité
  const partySize = reservationForm.partySize;
  const setPartySize = (v: number) => setReservationForm(prev => ({ ...prev, partySize: v }));
  const selectedDate = reservationForm.selectedDate;
  const setSelectedDate = (v: Date | undefined) => setReservationForm(prev => ({ ...prev, selectedDate: v }));
  const selectedTime = reservationForm.selectedTime;
  const setSelectedTime = (v: string) => setReservationForm(prev => ({ ...prev, selectedTime: v }));
  const customerName = reservationForm.customerName;
  const setCustomerName = (v: string) => setReservationForm(prev => ({ ...prev, customerName: v }));
  const customerPhone = reservationForm.customerPhone;
  const setCustomerPhone = (v: string) => setReservationForm(prev => ({ ...prev, customerPhone: v }));
  const customerEmail = reservationForm.customerEmail;
  const setCustomerEmail = (v: string) => setReservationForm(prev => ({ ...prev, customerEmail: v }));
  const specialRequests = reservationForm.specialRequests;
  const setSpecialRequests = (v: string) => setReservationForm(prev => ({ ...prev, specialRequests: v }));
  const wantToPreorder = reservationForm.wantToPreorder;
  const setWantToPreorder = (v: boolean) => setReservationForm(prev => ({ ...prev, wantToPreorder: v }));
  const wantToPrepay = reservationForm.wantToPrepay;
  const setWantToPrepay = (v: boolean) => setReservationForm(prev => ({ ...prev, wantToPrepay: v }));
  const paymentMethod = reservationForm.paymentMethod;
  const setPaymentMethod = (v: 'card' | 'mobile') => setReservationForm(prev => ({ ...prev, paymentMethod: v }));
  const selectedCategory = reservationForm.selectedCategory;
  const setSelectedCategory = (v: string) => setReservationForm(prev => ({ ...prev, selectedCategory: v }));

  const cart = cartPersistence.state;
  const setCart = cartPersistence.setState;

  // États non persistés (temporaires)
  const [_paymentProcessing, _setPaymentProcessing] = useState(false);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [_showReceiptDownload, setShowReceiptDownload] = useState(false);

  // Préremplir avec les infos de l'utilisateur connecté
  useEffect(() => {
    if (user) {
      setCustomerEmail(user.email || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Charger les créneaux quand la date change
  useEffect(() => {
    if (selectedDate && serviceId) {
      loadTimeSlots();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, partySize]);

  const loadTimeSlots = async () => {
    if (!selectedDate) return;

    setLoadingSlots(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const slots = await checkAvailability(dateStr, partySize);
      setTimeSlots(slots);
    } catch (error) {
      console.error('Erreur chargement créneaux:', error);
      toast.error(t('reservationModal.erreurLorsDuChargementDes'));
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fonctions panier
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c =>
          c.menuItem.id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(c =>
          c.menuItem.id === itemId
            ? { ...c, quantity: c.quantity - 1 }
            : c
        );
      }
      return prev.filter(c => c.menuItem.id !== itemId);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Filtrer les plats
  const filteredMenuItems = selectedCategory === 'all'
    ? menuItems.filter(i => i.is_available)
    : menuItems.filter(i => i.is_available && i.category_id === selectedCategory);

  const handleSubmit = async (paymentIntentId?: string) => {
    if (!selectedDate || !selectedTime || !customerName) {
      toast.error(t('reservationModal.veuillezRemplirTousLesChamps'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Préparer les données de précommande
      const preorderData = wantToPreorder && cart.length > 0
        ? JSON.stringify(cart.map(c => ({
            item_id: c.menuItem.id,
            name: c.menuItem.name,
            quantity: c.quantity,
            unit_price: c.menuItem.price,
            total: c.menuItem.price * c.quantity
          })))
        : null;

      const paymentInfo = paymentIntentId
        ? `\n\n💳 Paiement carte effectué (Réf: ${paymentIntentId.substring(0, 12)})`
        : (wantToPrepay ? '\n\n📱 Paiement mobile en attente' : '');

      const reservationData: ReservationFormData = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        party_size: partySize,
        reservation_date: format(selectedDate, 'yyyy-MM-dd'),
        reservation_time: selectedTime,
        special_requests: specialRequests
          ? (preorderData
            ? `${specialRequests}\n\n--- Précommande ---\n${cart.map(c => `${c.quantity}x ${c.menuItem.name}`).join(', ')}\nTotal: ${fc(cartTotal)}${paymentInfo}`
            : `${specialRequests}${paymentInfo}`)
          : (preorderData
            ? `--- Précommande ---\n${cart.map(c => `${c.quantity}x ${c.menuItem.name}`).join(', ')}\nTotal: ${fc(cartTotal)}${paymentInfo}`
            : (paymentInfo ? paymentInfo.trim() : undefined)),
      };

      const result = await createReservation(reservationData);

      if (result) {
        setConfirmationData({
          ...result,
          preorder: wantToPreorder ? cart : null,
          preorderTotal: cartTotal,
          paymentMethod: wantToPrepay ? paymentMethod : 'on_site',
          paymentIntentId
        });
        setShowReceiptDownload(true);
        setStep('confirmation');
        toast.success(t('reservationModal.reservationConfirmee'));
      }
    } catch (error: any) {
      console.error('Erreur création réservation:', error);
      toast.error(error.message || 'Erreur lors de la réservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('guests');
    setPartySize(2);
    setSelectedDate(undefined);
    setSelectedTime('');
    setCustomerName('');
    setCustomerPhone('');
    setSpecialRequests('');
    setConfirmationData(null);
    setCart([]);
    setWantToPreorder(false);
    setWantToPrepay(false);
    setPaymentMethod('mobile');
    setShowStripePayment(false);
    setShowReceiptDownload(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Générer et télécharger le reçu
  const generateReceipt = () => {
    if (!confirmationData) return;

    const receiptContent = `
╔═══════════════════════════════════════════════╗
║           REÇU DE RÉSERVATION                 ║
║               224Solutions                    ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  Restaurant: ${restaurantName.substring(0, 30).padEnd(30)}║
║                                               ║
║  Date: ${format(selectedDate!, 'EEEE d MMMM yyyy', { locale: fr }).substring(0, 35).padEnd(35)}║
║  Heure: ${selectedTime.padEnd(34)}║
║  Convives: ${partySize.toString().padEnd(31)}║
║                                               ║
╠═══════════════════════════════════════════════╣
║  Réservation au nom de:                       ║
║  ${customerName.substring(0, 43).padEnd(43)}║
║  Tel: ${(customerPhone || 'Non renseigné').substring(0, 37).padEnd(37)}║
║  Email: ${(customerEmail || 'Non renseigné').substring(0, 35).padEnd(35)}║
║                                               ║
${cart.length > 0 ? `╠═══════════════════════════════════════════════╣
║  PRÉCOMMANDE:                                 ║
${cart.map(c => `║  ${c.quantity}x ${c.menuItem.name.substring(0, 25).padEnd(25)} ${(c.menuItem.price * c.quantity).toLocaleString().padStart(10)} GNF║`).join('\n')}
║                                               ║
║  TOTAL: ${cartTotal.toLocaleString().padStart(35)} GNF║
║                                               ║` : ''}
╠═══════════════════════════════════════════════╣
║  Statut: EN ATTENTE DE CONFIRMATION           ║
║  Référence: ${confirmationData.id?.substring(0, 8).toUpperCase().padEnd(30) || 'N/A'.padEnd(30)}║
║  Créée le: ${format(new Date(), 'dd/MM/yyyy à HH:mm').padEnd(31)}║
║                                               ║
╚═══════════════════════════════════════════════╝

Merci pour votre réservation !
Contact restaurant: ${restaurantPhone || 'Non disponible'}
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu-reservation-${restaurantName.replace(/\s+/g, '-')}-${format(selectedDate!, 'dd-MM-yyyy')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('reservationModal.recuTelecharge'));
  };

  // Callback paiement Stripe réussi
  const handleStripeSuccess = async (paymentIntentId: string) => {
    toast.success(t('reservationModal.paiementParCarteEffectueAvec'));
    setShowStripePayment(false);
    await handleSubmit(paymentIntentId);
  };

  // Callback erreur paiement Stripe
  const handleStripeError = (error: string) => {
    toast.error(`Erreur de paiement: ${error}`);
    setShowStripePayment(false);
  };

  // Navigation entre étapes
  const goToNextStep = () => {
    switch (step) {
      case 'guests': setStep('datetime'); break;
      case 'datetime': setStep('menu'); break;
      case 'menu': setStep('details'); break;
      case 'details':
        if (wantToPrepay && cartTotal > 0) {
          setStep('payment');
        } else {
          handleSubmit();
        }
        break;
      case 'payment': handleSubmit(); break;
    }
  };

  const goToPreviousStep = () => {
    switch (step) {
      case 'datetime': setStep('guests'); break;
      case 'menu': setStep('datetime'); break;
      case 'details': setStep('menu'); break;
      case 'payment': setStep('details'); break;
    }
  };

  // Séparer les créneaux midi et soir
  const lunchSlots = timeSlots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour >= 11 && hour < 15;
  });

  const dinnerSlots = timeSlots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour >= 18 && hour <= 22;
  });

  const renderStep = () => {
    switch (step) {
      case 'guests':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">{t('reservationModal.combienDeConvives')}</h3>
              <p className="text-muted-foreground mt-1">{t('reservationModal.selectionnezLeNombreDePersonnes')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <Button
                  key={num}
                  variant={partySize === num ? 'default' : 'outline'}
                  className={cn(
                    'h-16 text-lg font-semibold transition-all',
                    partySize === num && 'ring-2 ring-primary ring-offset-2'
                  )}
                  onClick={() => setPartySize(num)}
                >
                  {num}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center mt-4">
              <AlertCircle className="w-4 h-4" />
              <span>{t('reservationModal.pourPlusDe8Personnes')}</span>
            </div>

            <Button
              className="w-full h-12 text-lg"
              onClick={goToNextStep}
            >
              Continuer
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        );

      case 'datetime':
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold">{t('reservationModal.choisissezDateEtHeure')}</h3>
              <p className="text-muted-foreground">{partySize} {partySize > 1 ? 'personnes' : 'personne'}</p>
            </div>

            {/* Sélection de la date */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-12',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })
                      : 'Sélectionner une date'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999] bg-background border shadow-lg" align="start" sideOffset={5}>
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) =>
                      isBefore(date, startOfDay(new Date())) ||
                      isBefore(addDays(new Date(), 60), date)
                    }
                    initialFocus
                    className="pointer-events-auto p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Créneaux horaires */}
            {selectedDate && (
              <div className="space-y-4">
                {loadingSlots ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                    <p className="text-muted-foreground mt-2">{t('reservationModal.rechercheDesDisponibilites')}</p>
                  </div>
                ) : (
                  <>
                    {lunchSlots.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <span className="text-lg">🌞</span> Service du midi
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {lunchSlots.map(slot => (
                            <Button
                              key={slot.time}
                              variant={selectedTime === slot.time ? 'default' : 'outline'}
                              className={cn(
                                'h-10 text-sm',
                                !slot.available && 'opacity-50 cursor-not-allowed',
                                selectedTime === slot.time && 'ring-2 ring-primary ring-offset-1'
                              )}
                              disabled={!slot.available}
                              onClick={() => setSelectedTime(slot.time)}
                            >
                              {slot.time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {dinnerSlots.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <span className="text-lg">🌙</span> Service du soir
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {dinnerSlots.map(slot => (
                            <Button
                              key={slot.time}
                              variant={selectedTime === slot.time ? 'default' : 'outline'}
                              className={cn(
                                'h-10 text-sm',
                                !slot.available && 'opacity-50 cursor-not-allowed',
                                selectedTime === slot.time && 'ring-2 ring-primary ring-offset-1'
                              )}
                              disabled={!slot.available}
                              onClick={() => setSelectedTime(slot.time)}
                            >
                              {slot.time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={goToPreviousStep}
              >
                Retour
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={goToNextStep}
                disabled={!selectedDate || !selectedTime}
              >
                Continuer
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'menu':
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold">{t('reservationModal.decouvrezNotreMenu')}</h3>
              <p className="text-muted-foreground">{t('reservationModal.precommandezVosPlatsPreferes')}</p>
            </div>

            {/* Toggle précommande */}
            <Card className="bg-[#ff4000]/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium">{t('reservationModal.precommanderDesPlats')}</p>
                    <p className="text-xs text-muted-foreground">{t('reservationModal.vosPlatsSerontPretsA')}</p>
                  </div>
                </div>
                <Switch checked={wantToPreorder} onCheckedChange={setWantToPreorder} />
              </CardContent>
            </Card>

            {wantToPreorder && (
              <>
                {/* Catégories */}
                {categories.length > 0 && (
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex gap-2 pb-2">
                      <Badge
                        variant={selectedCategory === 'all' ? 'filter-active' : 'filter'}
                        className="cursor-pointer"
                        onClick={() => setSelectedCategory('all')}
                      >
                        Tous
                      </Badge>
                      {categories.map(cat => (
                        <Badge
                          key={cat.id}
                          variant={selectedCategory === cat.id ? 'filter-active' : 'filter'}
                          className="cursor-pointer whitespace-nowrap"
                          onClick={() => setSelectedCategory(cat.id)}
                        >
                          {cat.icon && <span className="mr-1">{cat.icon}</span>}
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Liste des plats */}
                <ScrollArea className="h-[250px] pr-4">
                  {menuLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    </div>
                  ) : filteredMenuItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <UtensilsCrossed className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('reservationModal.aucunPlatDisponible')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredMenuItems.map(item => {
                        const inCart = cart.find(c => c.menuItem.id === item.id);
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-all",
                              inCart ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                            )}
                          >
                            {/* Image */}
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{item.name}</span>
                                {item.is_featured && (
                                  <Badge variant="secondary" className="text-xs">⭐</Badge>
                                )}
                                {item.spicy_level && item.spicy_level > 0 && (
                                  <span className="text-[#ff4000]">
                                    {Array(item.spicy_level).fill('🌶️').join('')}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-semibold text-primary">
                                  {fc(item.price)}
                                </span>
                                {item.preparation_time && (
                                  <span className="text-xs text-muted-foreground">
                                    ~{item.preparation_time}min
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              {inCart ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => removeFromCart(item.id)}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="w-6 text-center font-semibold">
                                    {inCart.quantity}
                                  </span>
                                  <Button
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => addToCart(item)}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addToCart(item)}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Ajouter
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Panier récapitulatif */}
                {cart.length > 0 && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4" />
                          Votre précommande
                        </span>
                        <Badge>{cartItemsCount} article{cartItemsCount > 1 ? 's' : ''}</Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        {cart.map(c => (
                          <div key={c.menuItem.id} className="flex justify-between">
                            <span>{c.quantity}x {c.menuItem.name}</span>
                            <span>{fc(c.menuItem.price * c.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-primary">{fc(cartTotal)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={goToPreviousStep}>
                Retour
              </Button>
              <Button className="flex-1 h-12" onClick={goToNextStep}>
                Continuer
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold">{t('reservationModal.vosCoordonnees')}</h3>
              <p className="text-muted-foreground">
                {format(selectedDate!, 'EEEE d MMMM', { locale: fr })} à {selectedTime}
              </p>
            </div>

            {/* Récapitulatif */}
            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4 flex-wrap">
              <Badge variant="secondary" className="h-10 px-4">
                <Users className="w-4 h-4 mr-2" />
                {partySize} pers.
              </Badge>
              <Badge variant="secondary" className="h-10 px-4">
                <Calendar className="w-4 h-4 mr-2" />
                {format(selectedDate!, 'd MMM', { locale: fr })}
              </Badge>
              <Badge variant="secondary" className="h-10 px-4">
                <Clock className="w-4 h-4 mr-2" />
                {selectedTime}
              </Badge>
              {cart.length > 0 && (
                <Badge className="h-10 px-4 bg-orange-500">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {fc(cartTotal)}
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nom complet *
                </Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="h-12 mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Téléphone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+224 620 00 00 00"
                  className="h-12 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="jean@exemple.com"
                  className="h-12 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="requests" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Demandes spéciales (optionnel)
                </Label>
                <Textarea
                  id="requests"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder={t('reservationModal.anniversaireAllergiesPreferencesDeTable')}
                  className="mt-1 min-h-[80px]"
                />
              </div>

              {/* Option paiement */}
              {cartTotal > 0 && (
                <Card className="bg-[#ff4000]/5">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-[#ff4000]" />
                      <div>
                        <p className="font-medium">Payer maintenant</p>
                        <p className="text-xs text-muted-foreground">{t('reservationModal.payezVotrePrecommandeEnAvance')}</p>
                      </div>
                    </div>
                    <Switch checked={wantToPrepay} onCheckedChange={setWantToPrepay} />
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={goToPreviousStep}>
                Retour
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={goToNextStep}
                disabled={!customerName || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Confirmation...
                  </>
                ) : wantToPrepay && cartTotal > 0 ? (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Passer au paiement
                  </>
                ) : (
                  'Confirmer la réservation'
                )}
              </Button>
            </div>
          </div>
        );

      case 'payment':
        // Si on affiche Stripe
        if (showStripePayment) {
          return (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold">{t('reservationModal.paiementParCarte')}</h3>
                <p className="text-muted-foreground">Montant: {fc(cartTotal)}</p>
              </div>

              <StripePaymentWrapper
                amount={cartTotal}
                currency="GNF"
                sellerId={serviceId}
                sellerName={restaurantName}
                orderDescription={`Précommande restaurant - ${restaurantName}`}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
              />

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowStripePayment(false)}
              >
                Retour aux options de paiement
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-orange-100 dark:bg-[#ff4000]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-[#ff4000]" />
              </div>
              <h3 className="text-xl font-semibold">{t('reservationModal.choisissezVotreModeDePaiement')}</h3>
              <p className="text-muted-foreground">{t('reservationModal.payezVotrePrecommandeEnAvance')}</p>
            </div>

            {/* Récapitulatif de la commande */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">{t('reservationModal.recapitulatif')}</h4>
                {cart.map(c => (
                  <div key={c.menuItem.id} className="flex justify-between text-sm">
                    <span>{c.quantity}x {c.menuItem.name}</span>
                    <span>{fc(c.menuItem.price * c.quantity)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>{t('reservationModal.totalAPayer')}</span>
                  <span className="text-primary">{fc(cartTotal)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Sélection méthode de paiement */}
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as 'card' | 'mobile')}
              className="space-y-3"
            >
              <div className={cn(
                "flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer",
                paymentMethod === 'card' && "border-primary bg-primary/5"
              )}>
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-medium">Carte bancaire</p>
                    <p className="text-xs text-muted-foreground">Visa, Mastercard, etc.</p>
                  </div>
                </Label>
              </div>

              <div className={cn(
                "flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer",
                paymentMethod === 'mobile' && "border-primary bg-primary/5"
              )}>
                <RadioGroupItem value="mobile" id="mobile" />
                <Label htmlFor="mobile" className="flex items-center gap-3 cursor-pointer flex-1">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Orange_Money_logo.png"
                    alt="Orange Money"
                    className="w-6 h-6 rounded"
                  />
                  <div>
                    <p className="font-medium">Orange Money</p>
                    <p className="text-xs text-muted-foreground">{t('reservationModal.paiementMobile')}</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Options de paiement */}
            <div className="space-y-3">
              <Button
                className={cn(
                  "w-full h-14",
                  paymentMethod === 'card' ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-500 hover:bg-orange-600"
                )}
                onClick={() => {
                  if (paymentMethod === 'card') {
                    setShowStripePayment(true);
                  } else {
                    handleSubmit();
                  }
                }}
                disabled={isSubmitting}
              >
                {paymentMethod === 'card' ? (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Payer par carte bancaire
                  </>
                ) : (
                  <>
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Orange_Money_logo.png"
                      alt="Orange Money"
                      className="w-5 h-5 mr-2 rounded"
                    />
                    Payer avec Orange Money
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => {
                  setWantToPrepay(false);
                  handleSubmit();
                }}
                disabled={isSubmitting}
              >
                Payer sur place
              </Button>
            </div>

            <Button variant="ghost" className="w-full" onClick={goToPreviousStep}>
              Retour
            </Button>
          </div>
        );

      case 'confirmation':
        return (
          <div className="space-y-6 text-center py-4">
            <div className="w-20 h-20 bg-orange-100 dark:bg-[#ff4000]/30 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-[#ff4000] dark:text-[#ff4000]" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#ff4000] dark:text-[#ff4000]">
                Réservation confirmée !
              </h3>
              <p className="text-muted-foreground mt-2">
                Votre table vous attend chez {restaurantName}
              </p>
            </div>

            {/* Statut en attente de confirmation restaurant */}
            <Card className="bg-orange-50 dark:bg-[#ff4000]/20 border-orange-200">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-[#ff4000] flex-shrink-0" />
                <div className="text-left">
                  <p className="font-medium text-[#ff4000] dark:text-orange-200">{t('reservationModal.enAttenteDeConfirmation')}</p>
                  <p className="text-xs text-[#ff4000] dark:text-orange-300">
                    Le restaurant confirmera votre réservation sous peu. Vous recevrez une notification.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/50 rounded-xl p-6 text-left space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date</span>
                <span className="font-semibold">
                  {format(selectedDate!, 'EEEE d MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Heure</span>
                <span className="font-semibold">{selectedTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Convives</span>
                <span className="font-semibold">{partySize} personne{partySize > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Nom</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              {confirmationData?.preorder && confirmationData.preorder.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('reservationModal.precommande')}</span>
                    <span className="font-semibold text-orange-600">
                      {fc(confirmationData.preorderTotal)}
                    </span>
                  </div>
                  {confirmationData?.paymentIntentId && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-muted-foreground">{t('reservationModal.paiement')}</span>
                      <Badge className="bg-[#ff4000]">
                        <Check className="w-3 h-3 mr-1" />
                        Carte payée
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bouton télécharger le reçu */}
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={generateReceipt}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Télécharger le reçu
            </Button>

            {/* Lien pour suivre la réservation */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="text-left flex-1">
                    <p className="font-medium text-blue-800 dark:text-blue-200">{t('reservationModal.suivezVotreReservation')}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Consultez vos réservations dans votre espace client pour voir le statut de confirmation
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {restaurantPhone && (
              <p className="text-sm text-muted-foreground">
                Besoin de modifier ? Appelez le{' '}
                <a href={`tel:${restaurantPhone}`} className="text-primary underline">
                  {restaurantPhone}
                </a>
              </p>
            )}

            <Button className="w-full h-12" onClick={handleClose}>
              Terminé
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Réserver chez {restaurantName}
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        {step !== 'confirmation' && (
          <div className="flex gap-1 mb-4">
            {['guests', 'datetime', 'menu', 'details', ...(wantToPrepay && cartTotal > 0 ? ['payment'] : [])].map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  ['guests', 'datetime', 'menu', 'details', 'payment'].indexOf(step) >= i
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}

        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
