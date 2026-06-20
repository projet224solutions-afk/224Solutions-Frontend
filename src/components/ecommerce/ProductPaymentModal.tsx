/**
 * MODAL PAIEMENT PRODUITS
 * Support: Wallet, Card (Stripe), Orange Money, MTN MoMo (ChapChapPay PULL), Cash
 * Inclut le calcul et la facturation des commissions
 */

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Wallet, Banknote, Loader2, AlertCircle, Shield, Info, Phone, Truck, CreditCard, Smartphone, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SecureButton } from "@/components/ui/SecureButton";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useChapChapPay } from "@/hooks/useChapChapPay";
import { usePriceConverter } from "@/hooks/usePriceConverter";
import { createOrder } from '@/services/orderBackendService';

const StripeCheckoutButton = lazy(() => import("@/components/payment/StripeCheckoutButton"));

export type ProductPaymentMethod = 'wallet' | 'cash' | 'cash_on_delivery' | 'orange_money' | 'mtn_money' | 'card';

type PaymentStep = 'select_method' | 'card_form' | 'mobile_money_form' | 'processing' | 'success';

interface CartItem {
  id: string;
  name: string;
  price: number;
  vendorId?: string;
  quantity?: number;
}

interface CommissionConfig {
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  min_amount?: number;
}

interface ProductPaymentModalProps {
  open: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalAmount: number;
  onPaymentSuccess: () => void;
  userId: string;
  customerId: string | null;
  /** Devise source du produit/vendeur (ex: 'XOF', 'GNF'). Défaut: 'GNF' */
  currency?: string;
}

export default function ProductPaymentModal({
  open,
  onClose,
  cartItems,
  totalAmount,
  onPaymentSuccess,
  userId,
  customerId,
  currency = 'GNF'
}: ProductPaymentModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const fc = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();
  const cur = currency.toUpperCase();

  /** Affiche le montant converti en devise locale, avec l'original en dessous si conversion */
  const renderPrice = (amount: number, className?: string) => {
    const converted = convert(amount, cur);
    if (!converted.wasConverted) {
      return <span className={className}>{converted.formatted}</span>;
    }
    return (
      <span className={`inline-flex flex-col ${className || ''}`}>
        <span>{converted.formatted}</span>
        <span className="text-xs text-muted-foreground font-normal">({converted.originalFormatted})</span>
      </span>
    );
  };

  /** Version inline texte pour les boutons / toasts */
  const priceText = (amount: number) => {
    const converted = convert(amount, cur);
    return converted.formatted;
  };
  const { initiatePullPayment, pollStatus, isLoading: ccpLoading } = useChapChapPay();

  const [paymentMethod, setPaymentMethod] = useState<ProductPaymentMethod>('wallet');
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('select_method');
  const [showCardInline, setShowCardInline] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [vendorCode, setVendorCode] = useState<string | null>(null);
  const [loadingVendorCode, setLoadingVendorCode] = useState(false);
  const [codPhone, setCodPhone] = useState('');
  const [codCity, setCodCity] = useState('');

  const [mobilePhone, setMobilePhone] = useState('');
  const [mobileProcessing, setMobileProcessing] = useState(false);

  const [sellerUserId, setSellerUserId] = useState<string>('');

  const [commissionConfig, setCommissionConfig] = useState<CommissionConfig | null>(null);
  const [loadingCommission, setLoadingCommission] = useState(false);
  const [commissionFee, setCommissionFee] = useState(0);
  const [grandTotal, setGrandTotal] = useState(totalAmount);
  const isCashOnDelivery = paymentMethod === 'cash' || paymentMethod === 'cash_on_delivery';
  const effectiveCommissionFee = isCashOnDelivery ? 0 : commissionFee;
  const effectiveGrandTotal = isCashOnDelivery ? totalAmount : grandTotal;
  // L'acheteur paie depuis SON wallet (devise = userCurrency), pas la devise du produit.
  // On convertit le total (en devise produit `cur`) vers la devise du wallet acheteur pour
  // comparer au solde (le backend fait la même conversion au débit réel).
  const effectiveGrandTotalInWallet = convert(effectiveGrandTotal, cur).convertedAmount;
  const isVendorDashboardRoute = location.pathname === '/vendeur' || location.pathname.startsWith('/vendeur/');
  const isDigitalVendorDashboardRoute = location.pathname === '/vendeur-digital' || location.pathname.startsWith('/vendeur-digital/');

  const postPurchasePath = useMemo(() => {
    if (isDigitalVendorDashboardRoute) {
      return '/vendeur-digital/my-purchases';
    }

    if (isVendorDashboardRoute) {
      return '/vendeur/my-purchases';
    }

    return '/my-purchases';
  }, [isDigitalVendorDashboardRoute, isVendorDashboardRoute]);

  const finalizeSuccessfulCheckout = useCallback(() => {
    onPaymentSuccess();
    onClose();
    navigate(postPurchasePath, { replace: true });
  }, [navigate, onClose, onPaymentSuccess, postPurchasePath]);

  const createMarketplaceOrder = async ({
    vendorId,
    items,
    paymentMethod,
    chargedAmount,
    paymentReference,
    markAsPaid,
    shippingAddress,
    metadata,
  }: {
    vendorId: string;
    items: CartItem[];
    paymentMethod: 'wallet' | 'card' | 'mobile_money' | 'cash';
    chargedAmount: number;
    paymentReference?: string;
    markAsPaid: boolean;
    shippingAddress: {
      full_name: string;
      phone: string;
      address_line: string;
      city: string;
      country: string;
      postal_code?: string | null;
      notes?: string | null;
      is_cod?: boolean;
      cod_phone?: string | null;
      cod_city?: string | null;
    };
    metadata?: Record<string, unknown>;
  }) => {
    const response = await createOrder({
      vendor_id: vendorId,
      items: items.map(item => ({
        product_id: item.id,
        quantity: item.quantity || 1,
        variant_id: null,
      })),
      payment_method: paymentMethod,
      payment_intent_id: paymentReference || null,
      payment_confirmed: markAsPaid,
      charged_amount: chargedAmount,
      order_metadata: {
        external_payment_id: paymentReference || null,
        ...(metadata || {}),
      },
      shipping_address: shippingAddress,
    });

    if (!response.success || !response.data?.order) {
      throw new Error(response.error || 'Erreur lors de la création de la commande');
    }

    return response.data.order;
  };

  useEffect(() => {
    if (open && cartItems.length > 0) {
      const vendorId = cartItems.find(item => item.vendorId)?.vendorId;
      if (vendorId) {
        supabase.from('vendors').select('user_id').eq('id', vendorId).single()
          .then(({ data }) => {
            if (data?.user_id) setSellerUserId(data.user_id);
          });
      }
    }
  }, [open, cartItems]);

  useEffect(() => {
    if (open) {
      setPaymentStep('select_method');
      setShowCardInline(false);
    } else {
      setPaymentStep('select_method');
      setShowCardInline(false);
      setMobilePhone('');
      setMobileProcessing(false);
      setSellerUserId('');
    }
  }, [open]);

  useEffect(() => {
    if (open && userId) {
      loadWalletBalance();
      loadCommissionConfig();
    }
  }, [open, userId, userCurrency]);

  useEffect(() => {
    if (commissionConfig && totalAmount > 0) {
      calculateCommissionFee();
    } else {
      setCommissionFee(0);
      setGrandTotal(totalAmount);
    }
  }, [totalAmount, commissionConfig]);

  useEffect(() => {
    if (open && paymentMethod === 'wallet' && cartItems.length > 0) {
      loadVendorCode();
    } else {
      setVendorCode(null);
    }
  }, [open, paymentMethod, cartItems]);

  useEffect(() => {
    if (!open) setVendorCode(null);
  }, [open]);

  const loadCommissionConfig = async () => {
    setLoadingCommission(true);
    try {
      const { data: settingsData, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'purchase_fee_percent')
        .single();

      if (error) {
        setCommissionConfig({ commission_type: 'percentage', commission_value: 10 });
      } else if (settingsData?.setting_value) {
        setCommissionConfig({ commission_type: 'percentage', commission_value: Number(settingsData.setting_value) });
      } else {
        setCommissionConfig({ commission_type: 'percentage', commission_value: 10 });
      }
    } catch {
      setCommissionConfig({ commission_type: 'percentage', commission_value: 10 });
    } finally {
      setLoadingCommission(false);
    }
  };

  const calculateCommissionFee = () => {
    if (!commissionConfig) { setCommissionFee(0); setGrandTotal(totalAmount); return; }
    if (commissionConfig.min_amount && totalAmount < commissionConfig.min_amount) { setCommissionFee(0); setGrandTotal(totalAmount); return; }
    const fee = commissionConfig.commission_type === 'percentage'
      ? Math.round(totalAmount * (commissionConfig.commission_value / 100))
      : commissionConfig.commission_value;
    setCommissionFee(fee);
    setGrandTotal(totalAmount + fee);
  };

  const loadWalletBalance = async () => {
    setLoadingBalance(true);
    try {
      // Charger le wallet de l'ACHETEUR dans SA devise (userCurrency), PAS la devise du produit.
      // Avant : `.eq('currency', cur)` (devise produit) → un acheteur en EUR achetant un produit
      // CFA ne trouvait aucun wallet → solde 0 « wallet vide » à tort.
      const { data } = await supabase.from('wallets').select('balance, currency')
        .eq('user_id', userId).eq('currency', userCurrency).maybeSingle();
      if (data) { setWalletBalance(data.balance || 0); return; }
      // Repli : prendre le wallet le plus approvisionné de l'acheteur (devise principale).
      const { data: fallbackW } = await supabase.from('wallets').select('balance, currency')
        .eq('user_id', userId).order('balance', { ascending: false }).limit(1).maybeSingle();
      setWalletBalance(fallbackW?.balance || 0);
    } catch { setWalletBalance(0); } finally { setLoadingBalance(false); }
  };

  const loadVendorCode = async () => {
    setLoadingVendorCode(true);
    try {
      const firstVendorId = cartItems.find(item => item.vendorId)?.vendorId;
      if (!firstVendorId) { setVendorCode(null); return; }
      const { data: vendorData, error: vendorError } = await supabase.from('vendors').select('user_id, vendor_code').eq('id', firstVendorId).single();
      if (vendorError || !vendorData) { setVendorCode(null); return; }
      if (vendorData.vendor_code) { setVendorCode(vendorData.vendor_code); } else {
        const { data: walletData, error: walletError } = await supabase.from('wallets').select('id').eq('user_id', vendorData.user_id).eq('currency', cur).single();
        if (walletError || !walletData) { setVendorCode(vendorData.user_id.slice(0, 8).toUpperCase()); } else { setVendorCode(String(walletData.id).slice(0, 8).toUpperCase()); }
      }
    } catch { setVendorCode(null); } finally { setLoadingVendorCode(false); }
  };

  const paymentMethods = [
    { id: 'wallet' as ProductPaymentMethod, name: 'Wallet 224Solutions', description: 'Paiement instantané depuis votre wallet', icon: Wallet, color: 'text-primary' },
    { id: 'card' as ProductPaymentMethod, name: 'Carte Bancaire', description: 'Paiement sécurisé VISA / Mastercard via Stripe', icon: CreditCard, color: 'text-primary' },
    { id: 'orange_money' as ProductPaymentMethod, name: 'Orange Money', description: 'Débit instantané sur votre téléphone', icon: Smartphone, color: 'text-orange-500' },
    { id: 'mtn_money' as ProductPaymentMethod, name: 'MTN Mobile Money', description: 'Débit instantané via MTN MoMo', icon: Smartphone, color: 'text-yellow-600' },
    { id: 'cash' as ProductPaymentMethod, name: 'Paiement à la livraison', description: 'Payez en espèces à la réception', icon: Banknote, color: 'text-green-600' },
  ];

  const createOrderAfterPayment = async (paymentId: string, method: string) => {
    let effectiveCustomerId = customerId;
    if (!effectiveCustomerId) {
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('user_id', userId).maybeSingle();
      if (existingCustomer) { effectiveCustomerId = existingCustomer.id; }
      else {
        const { data: newCustomer, error: createError } = await supabase.from('customers').insert({ user_id: userId }).select('id').single();
        if (createError || !newCustomer) { toast.error(t('productPaymentModal.impossibleDeCreerLeCompte')); return; }
        effectiveCustomerId = newCustomer.id;
      }
    }

    const itemsByVendor = cartItems.reduce((acc, item) => {
      const vendorKey = item.vendorId || 'unknown';
      if (!acc[vendorKey]) acc[vendorKey] = [];
      acc[vendorKey].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>);

    const vendorCount = Object.keys(itemsByVendor).filter(k => k !== 'unknown').length;
    const commissionPerVendor = vendorCount > 0 ? Math.round(commissionFee / vendorCount) : 0;
    const createdOrders: string[] = [];

    for (const [vendorId, items] of Object.entries(itemsByVendor)) {
      if (vendorId === 'unknown') continue;
      const vendorProductTotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      const vendorTotalWithCommission = vendorProductTotal + commissionPerVendor;
      const normalizedMethod = method === 'mtn_money' || method === 'orange_money'
        ? 'mobile_money'
        : method === 'cash' || method === 'cash_on_delivery'
          ? 'cash'
          : method;

      const order = await createMarketplaceOrder({
        vendorId,
        items,
        paymentMethod: normalizedMethod as 'wallet' | 'card' | 'mobile_money' | 'cash',
        chargedAmount: vendorTotalWithCommission,
        paymentReference: paymentId,
        markAsPaid: true,
        shippingAddress: {
          full_name: 'Client 224Solutions',
          phone: normalizedMethod === 'mobile_money' && mobilePhone.trim() ? mobilePhone.trim() : 'Non fourni',
          address_line: 'Adresse de livraison',
          city: 'Conakry',
          country: 'Guinée',
          postal_code: null,
          notes: null,
        },
        metadata: { commission_fee: commissionPerVendor, product_total: vendorProductTotal },
      });

      createdOrders.push(order.id);

      if (commissionPerVendor > 0) {
        await supabase.rpc('record_pdg_revenue', {
          p_source_type: 'frais_achat_commande', p_amount: commissionPerVendor,
          p_percentage: commissionConfig?.commission_value || 10, p_transaction_id: paymentId,
          p_user_id: userId, p_metadata: { order_id: order.id, vendor_id: vendorId, product_total: vendorProductTotal }
        });
      }
    }

    if (createdOrders.length === 0) {
      throw new Error('Le paiement a été confirmé mais aucune commande vendeur n\'a été créée');
    }

    return createdOrders;
  };

  // Handle Stripe escrow success (capture manuelle — fonds bloqués)
  const handleCardSuccess = async (data: { paymentIntentId: string; amount: number; currency: string }) => {
    setPaymentStep('processing');
    try {
      console.log('[ProductPayment] handleCardSuccess called:', { paymentIntentId: data.paymentIntentId, cartItems: cartItems.length });

      // Créer les commandes avec payment_status = 'pending' (fonds en escrow)
      let effectiveCustomerId = customerId;
      if (!effectiveCustomerId) {
        const { data: existingCustomer } = await supabase.from('customers').select('id').eq('user_id', userId).maybeSingle();
        if (existingCustomer) { effectiveCustomerId = existingCustomer.id; }
        else {
          const { data: newCustomer, error: custErr } = await supabase.from('customers').insert({ user_id: userId }).select('id').single();
          if (custErr) console.error('[ProductPayment] Customer creation error:', custErr);
          if (newCustomer) effectiveCustomerId = newCustomer.id;
        }
      }

      const itemsByVendor = cartItems.reduce((acc, item) => {
        const vendorKey = item.vendorId || 'unknown';
        if (!acc[vendorKey]) acc[vendorKey] = [];
        acc[vendorKey].push(item);
        return acc;
      }, {} as Record<string, CartItem[]>);

      const vendorEntries = Object.entries(itemsByVendor).filter(([k]) => k !== 'unknown');

      if (vendorEntries.length === 0) {
        console.error('[ProductPayment] No vendor entries found! cartItems:', JSON.stringify(cartItems));
        toast.error(t('productPaymentModal.erreurAucunVendeurIdentifiePour'));
        setPaymentStep('select_method');
        return;
      }

      const commissionPerVendor = vendorEntries.length > 0 ? Math.round(commissionFee / vendorEntries.length) : 0;
      const createdOrders: string[] = [];
      const errors: string[] = [];

      for (const [vendorId, items] of vendorEntries) {
        const vendorProductTotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        const vendorTotalWithCommission = vendorProductTotal + commissionPerVendor;

        console.log('[ProductPayment] Creating order for vendor:', { vendorId, itemCount: items.length, total: vendorTotalWithCommission });

        let order;
        try {
          order = await createMarketplaceOrder({
            vendorId,
            items,
            paymentMethod: 'card',
            chargedAmount: vendorTotalWithCommission,
            paymentReference: data.paymentIntentId,
            markAsPaid: false,
            shippingAddress: {
              full_name: 'Client 224Solutions',
              phone: 'Non fourni',
              address_line: 'Adresse de livraison',
              city: 'Conakry',
              country: 'Guinée',
              postal_code: null,
              notes: null,
            },
            metadata: {
              escrow_active: true,
              commission_fee: commissionPerVendor,
              product_total: vendorProductTotal,
              commission_percent: commissionConfig?.commission_value || 10,
            },
          });
        } catch (error: any) {
          const errMsg = error?.message || 'Résultat vide';
          console.error('[ProductPayment] Order creation failed for vendor', vendorId, ':', errMsg);
          errors.push(errMsg);
          toast.error(`Erreur commande: ${errMsg}`);
          continue;
        }

        createdOrders.push(order.id);
        console.log('[ProductPayment] Order created:', { orderId: order.id, orderNumber: order.order_number });

        // Enregistrer la commission PDG
        if (commissionPerVendor > 0) {
          await supabase.rpc('record_pdg_revenue', {
            p_source_type: 'frais_achat_commande', p_amount: commissionPerVendor,
            p_percentage: commissionConfig?.commission_value || 10, p_transaction_id: data.paymentIntentId,
            p_user_id: userId, p_metadata: { order_id: order.id, vendor_id: vendorId, product_total: vendorProductTotal }
          });
        }
      }

      if (createdOrders.length === 0) {
        console.error('[ProductPayment] NO orders created! Errors:', errors);
        toast.error(t('productPaymentModal.lePaiementAEteEffectue'), {
          description: errors[0] || 'Erreur inconnue',
          duration: 10000,
        });
        setPaymentStep('select_method');
        return;
      }

      setPaymentStep('success');
      toast.success(t('productPaymentModal.paiementSecuriseParEscrow'), {
        description: `${fc(effectiveGrandTotal, cur)} bloqués — libérés après confirmation de réception`
      });
      setTimeout(() => { finalizeSuccessfulCheckout(); }, 2000);
    } catch (err) {
      console.error('[ProductPayment] Order creation after escrow payment failed:', err);
      toast.error(t('productPaymentModal.paiementReussiMaisErreurLors'), {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        duration: 10000,
      });
      setPaymentStep('select_method');
    }
  };

  // Handle Mobile Money PULL
  const handleMobileMoneyPay = async () => {
    if (!mobilePhone.trim() || mobilePhone.trim().length < 8) {
      toast.error(t('productPaymentModal.veuillezSaisirUnNumeroDe'));
      return;
    }
    setMobileProcessing(true);
    setPaymentStep('processing');

    const ccpMethod = paymentMethod === 'orange_money' ? 'orange_money' : 'mtn_momo';
    try {
      const result = await initiatePullPayment({
        amount: grandTotal,
        currency: cur,
        paymentMethod: ccpMethod,
        customerPhone: mobilePhone.trim(),
        description: `Achat 224Solutions - ${cartItems.length} article(s)`,
        orderId: `order-${Date.now()}`,
      });

      if (!result.success) {
        toast.error(result.error || 'Échec du paiement mobile');
        setPaymentStep('mobile_money_form');
        setMobileProcessing(false);
        return;
      }

      if (result.transactionId) {
        toast.info(t('productPaymentModal.confirmezLePaiementSurVotre'));
        const finalStatus = await pollStatus(result.transactionId);

        if (finalStatus.status === 'completed') {
          await createOrderAfterPayment(result.transactionId, paymentMethod);
          setPaymentStep('success');
          toast.success(t('productPaymentModal.paiementMobileReussi'), { description: `${fc(effectiveGrandTotal, cur)} débité de votre compte` });
          setTimeout(() => { finalizeSuccessfulCheckout(); }, 2000);
        } else {
          toast.error(t('productPaymentModal.paiementNonConfirme'), { description: 'Veuillez réessayer' });
          setPaymentStep('mobile_money_form');
        }
      } else {
        await createOrderAfterPayment(`mobile-${Date.now()}`, paymentMethod);
        setPaymentStep('success');
        toast.success(t('productPaymentModal.paiementInitieAvecSucces'));
        setTimeout(() => { finalizeSuccessfulCheckout(); }, 2000);
      }
    } catch (err) {
      console.error('Mobile money payment failed:', err);
      toast.error(t('productPaymentModal.erreurLorsDuPaiementMobile'));
      setPaymentStep('mobile_money_form');
    } finally {
      setMobileProcessing(false);
    }
  };

  // Handle wallet + COD
  const executePayment = useCallback(async () => {
    if (!userId || cartItems.length === 0) { toast.error('Informations manquantes'); throw new Error('Informations manquantes'); }

    if (paymentMethod === 'card') { setShowCardInline(true); return; }
    if (paymentMethod === 'orange_money' || paymentMethod === 'mtn_money') { setPaymentStep('mobile_money_form'); return; }

    const isCODMethod = paymentMethod === 'cash' || paymentMethod === 'cash_on_delivery';
    if (isCODMethod && (!codPhone.trim() || !codCity.trim())) { toast.error(t('productPaymentModal.veuillezRemplirLeNumeroDe')); throw new Error('COD info missing'); }

    let effectiveCustomerId = customerId;
    if (!effectiveCustomerId) {
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('user_id', userId).maybeSingle();
      if (existingCustomer) { effectiveCustomerId = existingCustomer.id; }
      else {
        const { data: newCustomer, error: createError } = await supabase.from('customers').insert({ user_id: userId }).select('id').single();
        if (createError || !newCustomer) { toast.error(t('productPaymentModal.impossibleDeCreerLeCompte')); throw new Error('Customer creation failed'); }
        effectiveCustomerId = newCustomer.id;
      }
    }

    const itemsByVendor = cartItems.reduce((acc, item) => {
      const vendorKey = item.vendorId || 'unknown';
      if (!acc[vendorKey]) acc[vendorKey] = [];
      acc[vendorKey].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>);

    const vendorCount = Object.keys(itemsByVendor).filter(k => k !== 'unknown').length;
    const commissionPerVendor = isCODMethod ? 0 : vendorCount > 0 ? Math.round(commissionFee / vendorCount) : 0;

    const createdOrders: string[] = [];
    const errors: string[] = [];

    for (const [vendorId, items] of Object.entries(itemsByVendor)) {
      if (vendorId === 'unknown') continue;
      const vendorProductTotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      const vendorChargedAmount = vendorProductTotal + commissionPerVendor;

      if (paymentMethod === 'wallet') {
        if (walletBalance !== null && walletBalance < effectiveGrandTotalInWallet) {
          toast.error(t('productPaymentModal.soldeInsuffisant'), { description: `Vous avez besoin de ${fc(effectiveGrandTotal, cur)}` });
          setProcessing(false);
          return;
        }
      }

      const normalizedPaymentMethod = isCODMethod ? 'cash' : paymentMethod;
      const shippingAddress = {
        full_name: 'Client 224Solutions',
        phone: isCODMethod && codPhone ? codPhone : 'Non fourni',
        address_line: isCODMethod
          ? `Adresse à confirmer par téléphone${codCity ? ` - ${codCity}` : ''}`
          : 'Adresse de livraison',
        city: isCODMethod && codCity ? codCity : 'Conakry',
        country: 'Guinée',
        postal_code: null,
        notes: isCODMethod ? 'Paiement à la livraison' : null,
        ...(isCODMethod
          ? {
            is_cod: true,
            cod_phone: codPhone.trim(),
            cod_city: codCity.trim(),
          }
          : {}),
      };

      try {
        const order = await createMarketplaceOrder({
          vendorId,
          items,
          paymentMethod: normalizedPaymentMethod as 'wallet' | 'card' | 'mobile_money' | 'cash',
          chargedAmount: vendorChargedAmount,
          markAsPaid: paymentMethod === 'wallet',
          shippingAddress,
          metadata: {
            commission_fee: commissionPerVendor,
            product_total: vendorProductTotal,
            commission_percent: commissionConfig?.commission_value || 10,
            ...(isCODMethod ? { is_cod: true, cod_phone: codPhone, cod_city: codCity } : {}),
          },
        });

        createdOrders.push(order.id);

        // NB : la commission acheteur des paiements WALLET est désormais prélevée ET loggée dans
        // revenus_pdg côté backend (create_order_core + orders.routes), pour TOUS les chemins de
        // façon cohérente. On ne logge donc plus ici (évite le double-comptage + l'ID invalide
        // `wallet-<uuid>` que record_pdg_revenue rejetait). Les paiements non-wallet (Stripe/COD)
        // gardent leur log frontend dédié plus haut.
      } catch (error: any) {
        errors.push(error?.message || 'Erreur inconnue');
        toast.error(t('productPaymentModal.erreurCreationCommande'), { description: error?.message });
        continue;
      }
    }

    if (createdOrders.length === 0) {
      throw new Error(errors[0] || 'Aucune commande vendeur n\'a été créée');
    }

    if (paymentMethod === 'wallet') {
      toast.success(t('productPaymentModal.paiementSecuriseEffectue'), { description: `${fc(effectiveGrandTotal, cur)} bloqués en escrow. Redirection vers vos achats...` });
    } else if (isCODMethod) {
      toast.success(t('productPaymentModal.commandeCreee'), { description: `Total à payer à la livraison: ${fc(effectiveGrandTotal, cur)}. Redirection...` });
    }

    finalizeSuccessfulCheckout();
  }, [userId, customerId, cartItems, paymentMethod, totalAmount, commissionFee, effectiveGrandTotal, walletBalance, commissionConfig, codPhone, codCity, fc, finalizeSuccessfulCheckout]);

  const insufficientBalance = paymentMethod === 'wallet' && walletBalance !== null && walletBalance < effectiveGrandTotalInWallet;

  const stripeExtraParams = useMemo(() => ({
    cartItems: cartItems.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity || 1, vendorId: i.vendorId }))
  }), [cartItems]);

  const handleStripeError = useCallback((error: string) => {
    toast.error(error);
  }, []);
  const firstVendorId = cartItems.find(item => item.vendorId)?.vendorId || '';

  // ======== RENDER: Success screen ========
  if (paymentStep === 'success') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-primary">{t('productPaymentModal.paiementReussi')}</h3>
            <p className="text-muted-foreground text-center">{fc(effectiveGrandTotal, cur)} — Votre commande a été créée</p>
            <p className="text-sm text-muted-foreground animate-pulse">{t('productPaymentModal.redirectionVersVosAchats')}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ======== RENDER: Processing screen ========
  if (paymentStep === 'processing') {
    return (
      <Dialog open={open} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Traitement en cours...</h3>
            <p className="text-sm text-muted-foreground text-center">
              {paymentMethod === 'orange_money' || paymentMethod === 'mtn_money'
                ? 'Confirmez le paiement sur votre téléphone'
                : 'Veuillez patienter'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ======== RENDER: Mobile Money form ========
  if (paymentStep === 'mobile_money_form') {
    const isMTN = paymentMethod === 'mtn_money';
    const providerName = isMTN ? 'MTN Mobile Money' : 'Orange Money';
    const providerColor = isMTN ? 'text-yellow-600' : 'text-orange-500';
    const providerBg = isMTN ? 'bg-yellow-50 border-yellow-200' : 'bg-orange-50 border-orange-200';

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setPaymentStep('select_method')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className={`w-5 h-5 ${providerColor}`} />
                {providerName}
              </DialogTitle>
            </div>
            <DialogDescription>
              Un débit de {fc(effectiveGrandTotal, cur)} sera envoyé sur votre téléphone
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className={`p-4 rounded-lg border ${providerBg}`}>
              <div className="text-center space-y-1">
                <p className="text-2xl font-bold">{fc(effectiveGrandTotal, cur)}</p>
                <p className="text-sm text-muted-foreground">{t('productPaymentModal.montantADebiter')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile-phone">Numéro de téléphone {providerName} <span className="text-red-500">*</span></Label>
              <Input
                id="mobile-phone"
                type="tel"
                inputMode="tel"
                placeholder={isMTN ? "Ex: 66X XX XX XX" : "Ex: 62X XX XX XX"}
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
                className="text-lg py-3"
              />
            </div>

            <Alert className={`${providerBg}`}>
              <Phone className={`h-4 w-4 ${providerColor}`} />
              <AlertDescription className="text-sm">
                Après avoir cliqué sur "Payer", vous recevrez une demande de confirmation sur votre téléphone.
                Composez votre code PIN pour valider le paiement.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setPaymentStep('select_method')} className="flex-1" disabled={mobileProcessing}>
                Retour
              </Button>
              <Button
                onClick={handleMobileMoneyPay}
                className="flex-1"
                disabled={mobileProcessing || !mobilePhone.trim()}
              >
                {mobileProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
                ) : (
                  <>Payer {fc(effectiveGrandTotal, cur)}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ======== RENDER: Method selection (default) ========
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Paiement Sécurisé
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 mt-2">
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm items-start">
                    <span>{t('productPaymentModal.sousTotalProduits')}</span>
                    {renderPrice(totalAmount)}
                  </div>
                  {effectiveCommissionFee > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground items-start">
                      <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Frais de service ({commissionConfig?.commission_value || 1.5}%):
                      </span>
                      <span>+{priceText(effectiveCommissionFee)}</span>
                    </div>
                  )}
                  {loadingCommission && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Calcul des frais...
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2 items-start">
                    <span>{t('productPaymentModal.totalAPayer')}</span>
                    {renderPrice(effectiveGrandTotal, 'text-primary')}
                  </div>
                </div>

                {paymentMethod === 'wallet' && (
                  <>
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-green-800 dark:text-green-200">
                        Vos fonds sont protégés par notre système Escrow jusqu'à la livraison
                      </span>
                    </div>
                    <div className="text-sm">
                      Solde disponible: <span className={`font-semibold ${insufficientBalance ? 'text-destructive' : 'text-green-600'}`}>
                        {fc(walletBalance || 0, userCurrency)}
                      </span>
                    </div>
                    {walletBalance === 0 && (
                      <Alert variant="default" className="border-orange-200 bg-orange-50 dark:bg-orange-950">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900 dark:text-orange-200">
                          Votre wallet est vide. Rechargez-le d'abord ou sélectionnez un autre moyen de paiement.
                        </AlertDescription>
                      </Alert>
                    )}
                    {vendorCode && (
                      <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
                        <Wallet className="w-4 h-4 text-primary" />
                        <span className="text-sm">{t('productPaymentModal.idVendeur')} <span className="font-bold text-primary">{vendorCode}</span></span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {insufficientBalance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Solde insuffisant. Il vous manque {fc(effectiveGrandTotalInWallet - (walletBalance || 0), userCurrency)}.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v as ProductPaymentMethod); setShowCardInline(false); }}>
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <div key={method.id} className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
                    onClick={() => { setPaymentMethod(method.id); setShowCardInline(false); }}>
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Icon className={`w-6 h-6 ${method.color}`} />
                    <div className="flex-1">
                      <Label htmlFor={method.id} className="font-medium cursor-pointer">{method.name}</Label>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>

            {paymentMethod === 'cash' && (
              <div className="space-y-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg animate-in slide-in-from-top-2">
                <h4 className="font-semibold text-emerald-800 flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4" /> Informations de contact
                </h4>
                <div className="space-y-2">
                  <Label htmlFor="marketplace-cod-phone" className="text-sm">{t('productPaymentModal.numeroAContacter')} <span className="text-red-500">*</span></Label>
                  <Input id="marketplace-cod-phone" type="tel" inputMode="tel" placeholder="Ex: 620 00 00 00" value={codPhone} onChange={(e) => setCodPhone(e.target.value)} className="bg-white" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketplace-cod-city" className="text-sm">Ville <span className="text-red-500">*</span></Label>
                  <Input id="marketplace-cod-city" placeholder="Ex: Conakry, Kindia, Dakar..." value={codCity} onChange={(e) => setCodCity(e.target.value)} className="bg-white" required />
                </div>
                <Alert className="bg-emerald-50 border-emerald-200 mt-2">
                  <Truck className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-700">
                    <strong>{t('productPaymentModal.paiementALaLivraisonConfirme')}</strong><br />
                    Vous serez contacté par téléphone pour confirmer votre adresse exacte. Préparez {fc(effectiveGrandTotal, cur)} en espèces.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          {/* Carte bancaire Stripe inline */}
          {showCardInline && paymentMethod === 'card' && (
            <div className="space-y-3 py-2 border-t">
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-800 dark:text-green-200">
                  Vos fonds sont protégés par notre système Escrow jusqu'à la confirmation de réception
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">{t('productPaymentModal.paiementSecuriseParCarteEscrow')}</span>
              </div>
              <Suspense fallback={
                <div className="flex items-center justify-center p-4 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Chargement...</span>
                </div>
              }>
                <StripeCheckoutButton
                  amount={totalAmount}
                  currency={cur}
                  description={`Achat ${cartItems.length} article(s) - Marketplace 224Solutions`}
                  edgeFunction="marketplace-escrow-payment"
                  extraParams={stripeExtraParams}
                  onSuccess={handleCardSuccess}
                  onCancel={() => setShowCardInline(false)}
                  onError={handleStripeError}
                />
              </Suspense>
              <Button variant="outline" onClick={() => setShowCardInline(false)} className="w-full" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Changer de méthode
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={processing}>{t('productPaymentModal.annuler')}</Button>
            <SecureButton
              onSecureClick={executePayment}
              className="flex-1"
              disabled={insufficientBalance || loadingCommission || showCardInline}
              loadingText="Traitement..."
              debounceMs={1000}
            >
              {paymentMethod === 'card' ? `Payer maintenant ${priceText(effectiveGrandTotal)}` :
                paymentMethod === 'orange_money' || paymentMethod === 'mtn_money' ? 'Continuer' :
                  paymentMethod === 'wallet' ? `Payer ${priceText(effectiveGrandTotal)}` : `Confirmer ${priceText(effectiveGrandTotal)}`}
            </SecureButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
