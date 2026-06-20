import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PaymentMethodsManager } from '@/components/payment/PaymentMethodsManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { signedInvoke } from '@/lib/security/hmacSigner';
import { toast } from 'sonner';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  RefreshCw,
  History,
  AlertCircle,
  CreditCard,
  Smartphone,
  Shield,
  Loader2
} from 'lucide-react';
import { Building2 } from 'lucide-react';
import _StripeInlineDeposit from './StripeWalletDeposit';
import StripeWalletTopup from './StripeWalletTopup';
import PayPalInlineDeposit from './PayPalInlineDeposit';
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { formatCurrency } from '@/lib/formatters';
import { InternationalTransferConfirmation, type InternationalPreviewData } from './InternationalTransferConfirmation';
import {
  changeWalletPin,
  depositToWallet,
  getWalletPinStatus,
  previewWalletTransfer,
  resetWalletPin,
  resolveWalletRecipient,
  setupWalletPin,
  transferToWallet,
  withdrawFromWallet,
} from '@/services/walletBackendService';
import { WalletPinPromptDialog, WalletPinSetupDialog } from './WalletPinDialogs';

interface UniversalWalletTransactionsProps {
  userId?: string;
  showBalance?: boolean;
}

interface WalletInfo {
  id: string | number;
  balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_custom_id?: string;
  receiver_custom_id?: string;
  sender_name?: string;
  receiver_name?: string;
  amount: number;
  method: string;
  status: string;
  currency: string;
  created_at: string;
  metadata: any;
}

export const UniversalWalletTransactions = ({ userId: propUserId, showBalance: _showBalance = true }: UniversalWalletTransactionsProps = {}) => {
  // Utiliser le contexte Auth comme tous les autres composants de l'application
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { currency: vendorCurrency } = useVendorCurrency();
  // Convertisseur fiable (devise d'affichage = devise synchronisée du profil/wallet) pour
  // convertir les montants historiques (ex. transactions/abonnements en GNF) vers la devise du wallet.
  const { convert: convertPrice } = usePriceConverter();
  // Utiliser propUserId si fourni, sinon utiliser user?.id
  const effectiveUserId = propUserId || user?.id;

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [agentInfo, setAgentInfo] = useState<{ id: string; agent_code: string; name: string } | null>(null);
  const [userCustomId, setUserCustomId] = useState<string | null>(null);

  // États pour les formulaires
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState<'card' | 'mobile_money' | 'card_stripe'>('card');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState<'orange' | 'mtn'>('orange');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'mobile_money' | 'bank' | 'paypal'>('mobile_money');
  // Bank withdrawal states
  const [bankName, setBankName] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  // PayPal card deposit states
  const [_cardDepositStep, _setCardDepositStep] = useState<'input' | 'approve' | 'capturing'>('input');
  const [_cardDepositOrderId, _setCardDepositOrderId] = useState<string | null>(null);
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawProvider, setWithdrawProvider] = useState<'orange' | 'mtn'>('orange');
  // PayPal states
  const [_paypalDepositAmount, _setPaypalDepositAmount] = useState('');
  const [_paypalDepositStep, _setPaypalDepositStep] = useState<'input' | 'approve' | 'capturing'>('input');
  const [_paypalOrderId, _setPaypalOrderId] = useState<string | null>(null);
  const [paypalWithdrawEmail, setPaypalWithdrawEmail] = useState('');
  const [paypalWithdrawAmount, setPaypalWithdrawAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  // États des dialogs
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [showTransferPreview, setShowTransferPreview] = useState(false);
  const [transferPreview, setTransferPreview] = useState<any>(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [intlPreview, setIntlPreview] = useState<InternationalPreviewData | null>(null);
  const [showIntlConfirm, setShowIntlConfirm] = useState(false);
  const [intlExecuting, setIntlExecuting] = useState(false);
  // Ref pour conserver intlPreview quand AlertDialogAction ferme le dialog avant la saisie du PIN
  const intlPreviewRef = useRef<InternationalPreviewData | null>(null);
  // Ref pour tracker le wallet ID précis et éviter les mélanges multi-wallets
  const walletIdRef = useRef<string | number | null>(null);
  const [pinStatus, setPinStatus] = useState<{ pin_enabled: boolean; pin_locked_until: string | null } | null>(null);
  const [pinAction, setPinAction] = useState<'withdraw' | 'transfer' | 'intl-transfer' | null>(null);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [pinSetupMode, setPinSetupMode] = useState<'setup' | 'change' | 'reset'>('setup');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveUserId) {
      checkIfAgent();
      void loadPinStatus();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Souscription temps réel : met à jour le wallet si le PDG (autre session) change la devise/solde
  useEffect(() => {
    if (!effectiveUserId) return;

    const channel = supabase
      .channel(`wallet-realtime-${effectiveUserId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${effectiveUserId}`,
      }, (payload) => {
        const updated = payload.new as { id?: string | number; balance?: number; currency?: string } | null;
        if (!updated) return;
        // Ignorer les mises à jour pour un wallet différent du wallet principal suivi
        const trackedId = walletIdRef.current;
        if (trackedId && String(updated.id) !== String(trackedId)) return;
        setWallet(prev => prev ? {
          ...prev,
          balance: updated.balance ?? prev.balance,
          currency: updated.currency ?? prev.currency,
        } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Listener wallet-updated (même session — dépôt, retrait, transfert)
  useEffect(() => {
    if (!effectiveUserId) return;

    const handleWalletUpdate = async () => {
      const trackedId = walletIdRef.current;
      let query = supabase.from('wallets').select('id, balance, currency');
      if (trackedId) {
        // Requêter directement le wallet connu par son ID
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = (query as any).eq('id', trackedId) as typeof query;
      } else {
        // Fallback : wallet le plus récemment mis à jour pour cet utilisateur
        query = query.eq('user_id', effectiveUserId).order('updated_at', { ascending: false }) as typeof query;
      }
      const { data } = await query.maybeSingle();
      if (data) {
        walletIdRef.current = (data as any).id;
        setWallet(data as { id: string | number; balance: number; currency: string });
      }
    };

    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const loadPinStatus = async () => {
    const response = await getWalletPinStatus();
    if (response.success && response.data) {
      setPinStatus({
        pin_enabled: response.data.pin_enabled,
        pin_locked_until: response.data.pin_locked_until,
      });
    }
  };

  const requestTransactionPin = (action: 'withdraw' | 'transfer' | 'intl-transfer') => {
    setPinError(null);
    setPinAction(action);

    if (!pinStatus?.pin_enabled) {
      setPinSetupMode('setup');
      setPinSetupOpen(true);
      return;
    }

    setPinPromptOpen(true);
  };

  const checkIfAgent = async () => {
    if (!effectiveUserId) return;

    try {
      // Vérifier si l'utilisateur est un agent
      const { data: agentData, error: _agentError } = await supabase
        .from('agents_management')
        .select('id, agent_code, name')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      let isAgentUser = false;
      let agentInfoData = null;

      if (agentData) {
        isAgentUser = true;
        agentInfoData = { id: agentData.id, agent_code: agentData.agent_code, name: agentData.name };
        setIsAgent(true);
        setAgentInfo(agentInfoData);
      } else {
        // Si ce n'est pas un agent, charger le public_id depuis profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('public_id')
          .eq('id', effectiveUserId)
          .maybeSingle();

        if (profileData?.public_id) {
          setUserCustomId(profileData.public_id);
        }
      }

      // Charger les données avec les valeurs calculées localement (pas le state)
      await loadWalletData(isAgentUser, agentInfoData);
      await loadTransactions();
    } catch (error) {
      console.error('Erreur vérification agent:', error);
      await loadWalletData(false, null);
      await loadTransactions();
    }
  };

  const loadWalletData = async (_isAgentUser: boolean = false, _agentInfoData: any = null) => {
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    try {
      // IMPORTANT: Tous les utilisateurs (y compris les agents) utilisent la table 'wallets'
      // car c'est là que les transferts sont crédités via process_wallet_transaction
      // ORDER BY updated_at DESC garantit de toujours retourner le wallet principal (le plus récemment actif)
      // même si l'utilisateur possède plusieurs wallets (GNF + XAF)
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance, currency')
        .eq('user_id', effectiveUserId)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      if (walletError && walletError.code !== 'PGRST116') {
        throw walletError;
      }

      if (walletData) {
        walletIdRef.current = (walletData as any).id;
        setWallet(walletData);
      } else {
        // Détecter la devise native de l'utilisateur depuis le profil
        let nativeCurrency = 'GNF';
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('detected_currency')
            .eq('id', effectiveUserId)
            .maybeSingle();
          if (profileData?.detected_currency) {
            nativeCurrency = profileData.detected_currency;
          }
        } catch (_e) {
          console.warn('Could not detect user currency, defaulting to GNF');
        }

        // Créer le wallet avec la devise détectée
        const { data: newWallet, error: insertError } = await supabase
          .from('wallets')
          .insert({
            user_id: effectiveUserId,
            balance: 0,
            currency: nativeCurrency,
            wallet_status: 'active'
          })
          .select('id, balance, currency')
          .single();

        if (insertError) {
          console.error('❌ Erreur création wallet:', insertError);
          toast.error(t('wallet.cannotCreate'));
          setLoading(false);
          return;
        }

        if (newWallet) {
          setWallet(newWallet);
          console.log('✅ Wallet créé avec succès');
          toast.success(t('wallet.created'));
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement wallet:', error);
      toast.error(t('wallet.loadError'));
      setLoading(false);
    }
  };


  const loadTransactions = async () => {
    if (!effectiveUserId) return;

    console.info('[WalletTx] loadTransactions v3', { effectiveUserId });

    try {
      // Charger depuis enhanced_transactions
      const { data: enhancedData, error: enhancedError } = await (supabase
        .from('enhanced_transactions' as any)
        .select('*')
        .or(`sender_id.eq.${effectiveUserId},receiver_id.eq.${effectiveUserId}`)
        .order('created_at', { ascending: false })
        .limit(20) as any);

      if (enhancedError) console.error('Erreur enhanced_transactions:', enhancedError);

      // Récupérer le wallet principal (ORDER BY updated_at DESC pour wallet multi-devises)
      const { data: userWallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', effectiveUserId)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      const userWalletId = userWallet?.id ?? null;

      // Charger les wallet_transactions : filtre combiné wallet_id ET user_id
      // pour capturer toutes les transactions même si le wallet principal a changé
      let walletTxData: any[] = [];
      {
        const orParts: string[] = [`sender_user_id.eq.${effectiveUserId}`, `receiver_user_id.eq.${effectiveUserId}`];
        if (userWalletId) {
          orParts.push(`sender_wallet_id.eq.${userWalletId}`, `receiver_wallet_id.eq.${userWalletId}`);
        }
        const wtResult: any = await (supabase as any)
          .from('wallet_transactions')
          .select('*')
          .or(orParts.join(','))
          .order('created_at', { ascending: false })
          .limit(30);
        const walletError = wtResult.error;
        if (walletError) console.error('Erreur wallet_transactions:', walletError);
        walletTxData = wtResult.data || [];
      }

      // -------- Résolution des identités (nom + ID standardisé) --------
      // 1) Pour wallet_transactions: convertir wallet_id -> user_id (contrepartie)
      const otherWalletIds = userWalletId
        ? Array.from(
            new Set(
              walletTxData
                .map((tx) => (tx.sender_wallet_id === userWalletId ? tx.receiver_wallet_id : tx.sender_wallet_id))
                .filter(Boolean)
            )
          )
        : [];

      let otherWalletRows: Array<{ id: string; user_id: string }> = [];
      if (otherWalletIds.length > 0) {
        const { data } = await supabase
          .from('wallets')
          .select('id, user_id')
          .in('id', otherWalletIds);
        otherWalletRows = (data ?? []) as any;
      }

      const walletIdToUserId = new Map(otherWalletRows.map((w) => [String(w.id), w.user_id]));

      // 2) Collecter tous les user_id à résoudre (enhanced + wallet_transactions)
      const userIdsToResolve = new Set<string>();

      if (enhancedData) {
        for (const tx of enhancedData as any[]) {
          if (tx.sender_id) userIdsToResolve.add(tx.sender_id);
          if (tx.receiver_id) userIdsToResolve.add(tx.receiver_id);
        }
      }

      // Ajouter les user_id DIRECTS depuis wallet_transactions (sender_user_id / receiver_user_id)
      // Ces champs sont stockés par persistTransferHistory et permettent la résolution sans passer par le wallet
      for (const tx of walletTxData) {
        if (tx.sender_user_id) userIdsToResolve.add(tx.sender_user_id);
        if (tx.receiver_user_id) userIdsToResolve.add(tx.receiver_user_id);
      }

      for (const w of otherWalletRows) {
        if (w.user_id) userIdsToResolve.add(w.user_id);
      }

      // 3) Charger en batch: profiles (company_name n'est PAS dans la table profiles)
      const idsArray = Array.from(userIdsToResolve);
      let profilesRows: Array<{ id: string; public_id: string | null; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null }> = [];

      if (idsArray.length > 0) {
        const { data: profilesRes } = await supabase
          .from('profiles')
          .select('id, public_id, full_name, first_name, last_name, email')
          .in('id', idsArray);

        profilesRows = (profilesRes ?? []) as any;
      }

      const userIdToPublicId = new Map(profilesRows.map((r) => [r.id, r.public_id]));
      const userIdToProfile = new Map(profilesRows.map((r) => [r.id, r]));

      const getUserDisplay = (uid?: string | null) => {
        if (!uid) {
          return { name: 'Système', customId: 'SYS' };
        }
        const p = userIdToProfile.get(uid);
        let name = '';
        if (p) {
          // Priorité: full_name > first_name + last_name > email
          if (p.full_name && p.full_name !== 'Utilisateur') {
            name = p.full_name;
          } else if (p.first_name || p.last_name) {
            name = [p.first_name, p.last_name].filter(Boolean).join(' ');
          } else if (p.email) {
            name = p.email.split('@')[0];
          }
        }
        return {
          name: name || 'Utilisateur',
          customId: userIdToPublicId.get(uid) || uid.slice(0, 8),
        };
      };

      // -------- Construction liste finale --------
      const allTransactions: any[] = [];

      // Ajouter les enhanced_transactions
      if (enhancedData) {
        for (const tx of enhancedData as any[]) {
          const sender = getUserDisplay(tx.sender_id);
          const receiver = getUserDisplay(tx.receiver_id);
          // Fallback sur les noms stockés dans metadata (résolution côté backend avec admin access)
          // nécessaire quand la RLS profiles empêche de lire le profil d'un autre utilisateur
          const txMeta = (tx.metadata || {}) as any;
          const senderNameResolved = (sender.name && sender.name !== 'Utilisateur')
            ? sender.name
            : (txMeta.sender_name || sender.name);
          const receiverNameResolved = (receiver.name && receiver.name !== 'Utilisateur')
            ? receiver.name
            : (txMeta.receiver_name || receiver.name);

          // Pour un transfert INTERNATIONAL, le DESTINATAIRE doit voir le montant
          // qu'il a RÉELLEMENT reçu, dans SA devise (pas le montant/devise de l'expéditeur).
          const isReceiverHere = tx.receiver_id === effectiveUserId;
          const intlReceived = isReceiverHere
            && !!txMeta.is_international
            && Number.isFinite(Number(txMeta.amount_received))
            && Number(txMeta.amount_received) > 0;
          const displayAmount = intlReceived ? Number(txMeta.amount_received) : tx.amount;
          const displayCurrency = intlReceived ? (txMeta.receiver_currency || tx.currency) : tx.currency;

          allTransactions.push({
            ...tx,
            amount: displayAmount,
            currency: displayCurrency,
            sender_custom_id: sender.customId,
            receiver_custom_id: receiver.customId,
            sender_name: senderNameResolved,
            receiver_name: receiverNameResolved,
            source: 'enhanced',
          });
        }
      }

      // Ajouter les wallet_transactions
      if (walletTxData.length > 0) {
        for (const tx of walletTxData as any[]) {
          const metadata = (tx.metadata ?? {}) as any;
          const isBureauTransfer = metadata?.recipient_type === 'bureau' || !!metadata?.bureau_id;

          // Filtrer les doublons : chaque transfert génère 2 records (transfer_out + transfer_in).
          // N'afficher transfer_out que si l'utilisateur est l'expéditeur, transfer_in que s'il est le destinataire.
          const txType = (tx.transaction_type as string) || '';
          const isOutgoingType = ['transfer_out', 'international_transfer', 'withdrawal', 'mobile_money_out'].includes(txType);
          const isIncomingType = ['transfer_in', 'deposit', 'mobile_money_in', 'admin_credit'].includes(txType);
          // Déterminer si l'utilisateur est l'expéditeur ou le destinataire
          // Priorité au user_id direct, fallback sur wallet_id
          const isUserSender = tx.sender_user_id === effectiveUserId
            || (userWalletId && tx.sender_wallet_id === userWalletId);
          const isUserReceiver = tx.receiver_user_id === effectiveUserId
            || (userWalletId && tx.receiver_wallet_id === userWalletId);
          if (isOutgoingType && !isUserSender) continue;
          if (isIncomingType && !isUserReceiver) continue;
          // 💡 Paiement marketplace « Fonds bloqués en Escrow » : l'argent part en ESCROW, il n'est
          // PAS crédité au vendeur (create_order_core ne débite que l'acheteur). Le vendeur le reçoit
          // RÉELLEMENT à la libération (transaction escrow_release). On ne montre donc PAS ce paiement
          // côté vendeur (receiver) — sinon il croit être payé deux fois. L'acheteur (sender) le voit.
          if (txType === 'payment' && metadata?.source === 'create_order_core' && !isUserSender) continue;

          const isOutgoing = Boolean(isUserSender);
          const otherWalletId = isOutgoing ? tx.receiver_wallet_id : tx.sender_wallet_id;
          // Priorité 1 : user_id direct stocké dans la transaction (plus fiable)
          // Priorité 2 : résolution via wallet_id → user_id
          const directUserId = isOutgoing ? tx.receiver_user_id : tx.sender_user_id;
          const otherUserId = directUserId || (otherWalletId ? walletIdToUserId.get(String(otherWalletId)) : null);

          // Résoudre la contrepartie : local profile map → metadata names → fallback
          const resolvedDisplay = getUserDisplay(otherUserId);
          const metaSenderName = metadata?.sender_name;
          const metaReceiverName = metadata?.receiver_name;
          const counterpartyNameFromMeta = isOutgoing ? metaReceiverName : metaSenderName;

          const counterparty = isBureauTransfer
            ? {
                id: metadata?.bureau_id ?? null,
                name: metadata?.bureau_name || metadata?.bureau_code || 'Bureau',
                customId: metadata?.bureau_code || 'Bureau',
              }
            : {
                id: otherUserId,
                name: (() => {
                  const isGenericName = !resolvedDisplay.name || resolvedDisplay.name === 'Utilisateur' || resolvedDisplay.name === 'Système';
                  return !isGenericName ? resolvedDisplay.name : (counterpartyNameFromMeta || resolvedDisplay.name);
                })(),
                customId: resolvedDisplay.customId,
              };

          const sender_id = isOutgoing ? effectiveUserId : counterparty.id || 'system';
          const receiver_id = isOutgoing ? counterparty.id || 'system' : effectiveUserId;

          allTransactions.push({
            id: tx.id,
            sender_id,
            receiver_id,
            amount: tx.amount,
            method: tx.transaction_type,
            status: tx.status,
            // La colonne wallet_transactions.currency n'est pas toujours renseignée (ex. paiement
            // marketplace via create_order_core). Le montant est alors dans la devise du WALLET
            // débité, présente dans metadata.wallet_currency (ou metadata.currency). On l'utilise
            // pour éviter d'étiqueter à tort « GNF » un montant en EUR/XOF (et pour la conversion).
            currency: tx.currency ?? metadata?.wallet_currency ?? metadata?.currency ?? 'GNF',
            created_at: tx.created_at,
            metadata: {
              ...metadata,
              description: tx.description ?? metadata?.description,
              fee_amount: tx.fee ?? metadata?.fee_amount,
              net_amount: tx.net_amount ?? metadata?.net_amount,
            },
            sender_custom_id: isOutgoing ? 'Vous' : (counterparty.customId || 'SYS'),
            receiver_custom_id: isOutgoing ? (counterparty.customId || 'SYS') : 'Vous',
            sender_name: isOutgoing ? 'Vous' : (counterparty.name || metaSenderName || 'Système'),
            receiver_name: isOutgoing ? (counterparty.name || metaReceiverName || 'Système') : 'Vous',
            source: 'wallet',
            is_bureau_transfer: isBureauTransfer,
          });
        }
      }

      // Dédupliquer : chaque transfert persistTransferHistory crée un record enhanced_transactions
      // ET un wallet_transaction. On garde uniquement le wallet_transaction.
      // Critère 1 : même idempotency_key (nouveaux records)
      // Critère 2 : même (sender_id, receiver_id) dans la même minute (anciens records sans idempotency_key)
      const walletTxDedup = new Set<string>();
      allTransactions
        .filter((tx) => tx.source === 'wallet')
        .forEach((tx) => {
          if (tx.metadata?.idempotency_key) {
            walletTxDedup.add(`key:${tx.metadata.idempotency_key}`);
          }
          const timeBucket = Math.floor(new Date(tx.created_at).getTime() / 60000);
          const sid = tx.sender_id || '';
          const rid = tx.receiver_id || '';
          if (sid && rid && sid !== 'system' && rid !== 'system') {
            walletTxDedup.add(`pair:${sid}:${rid}:${timeBucket}`);
          }
        });

      const deduped = allTransactions.filter((tx) => {
        if (tx.source !== 'enhanced') return true;
        if (tx.metadata?.idempotency_key && walletTxDedup.has(`key:${tx.metadata.idempotency_key}`)) return false;
        const timeBucket = Math.floor(new Date(tx.created_at).getTime() / 60000);
        const sid = tx.sender_id || '';
        const rid = tx.receiver_id || '';
        if (sid && rid && sid !== 'system' && rid !== 'system' && walletTxDedup.has(`pair:${sid}:${rid}:${timeBucket}`)) return false;
        return true;
      });

      // Trier par date décroissante et limiter
      deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const visible = deduped.slice(0, 25);
      setTransactions(visible);

      const unresolved = visible
        .filter((t) => t.sender_name === 'Utilisateur' || t.receiver_name === 'Utilisateur')
        .slice(0, 3);

      console.info('[WalletTx] loaded', {
        enhancedCount: enhancedData?.length ?? 0,
        walletTxCount: walletTxData.length,
        resolvedUserIds: idsArray.length,
        profilesCount: profilesRows.length,
        sampleUnresolved: unresolved,
      });
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
    }
  };

  /**
   * Vérifie les permissions de l'utilisateur pour une action spécifique
   */
  const checkPermissions = (action: 'send' | 'receive' | 'withdraw' | 'deposit'): boolean => {
    // Si un userId est fourni en prop, on considère que les permissions ont été vérifiées en amont
    if (propUserId) {
      return true;
    }

    const normalizedRole = (profile?.role || '').toString().toLowerCase().trim();

    if (!normalizedRole) {
      toast.error(t('wallet.roleUndefined'));
      return false;
    }

    const permissions: Record<string, string[]> = {
      send: ['admin', 'pdg', 'ceo', 'agent', 'vendor_agent', 'vendeur', 'client', 'livreur', 'taxi', 'syndicat', 'transitaire', 'bureau'],
      receive: ['admin', 'pdg', 'ceo', 'agent', 'vendor_agent', 'vendeur', 'client', 'livreur', 'taxi', 'syndicat', 'transitaire', 'bureau'],
      withdraw: ['admin', 'pdg', 'ceo', 'agent', 'vendor_agent', 'vendeur', 'client', 'livreur', 'taxi', 'syndicat', 'transitaire', 'bureau'],
      deposit: ['admin', 'pdg', 'ceo', 'agent', 'vendor_agent', 'vendeur', 'client', 'livreur', 'taxi', 'syndicat', 'transitaire', 'bureau']
    };

    if (!permissions[action].includes(normalizedRole)) {
      toast.error(`UNAUTHORIZED_ACTION: Votre rôle (${normalizedRole}) ne permet pas cette action`);
      return false;
    }

    return true;
  };

  const handleDeposit = async () => {
    if (!effectiveUserId || !depositAmount) {
      toast.error(t('wallet.enterAmount'));
      return;
    }

    // Vérifier les permissions
    if (!checkPermissions('deposit')) {
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('wallet.invalidAmount'));
      return;
    }

    if (amount < 1000) {
      toast.error(`INVALID_AMOUNT: Montant minimum 1000 ${wallet?.currency || 'GNF'}`);
      return;
    }

    // Si Mobile Money, utiliser ChapChapPay
    if (depositMethod === 'mobile_money') {
      await handleMobileMoneyDeposit(amount);
      return;
    }

    // Sinon, dépôt manuel (dev mode)
    setProcessing(true);
    console.log('🔄 Dépôt manuel en cours:', { amount, userId: effectiveUserId });

    try {
      // Créer ou récupérer le wallet de l'utilisateur
      // eslint-disable-next-line prefer-const
      let { data: _walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();

      if (walletError && walletError.code === 'PGRST116') {
        // Wallet n'existe pas, initialiser via RPC
        console.log('⚠️ Wallet non trouvé, initialisation via RPC...');

        try {
          const { data: initResult, error: rpcError } = await supabase
            .rpc('initialize_user_wallet', { p_user_id: effectiveUserId });

          if (rpcError) throw rpcError;

          const result = initResult as any;
          if (!result?.success) {
            throw new Error('Échec initialisation wallet');
          }

          // Recharger le wallet
          const { data: reloadedWallet, error: reloadError } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', effectiveUserId)
            .single();

          if (reloadError) throw reloadError;
          _walletData = reloadedWallet;
        } catch (initError) {
          console.error('❌ Erreur initialisation:', initError);
          toast.error(t('universalWalletTransactions.impossibleDInitialiserLeWallet'));
          setProcessing(false);
          return;
        }
      } else if (walletError) {
        throw walletError;
      }

      // Créer une transaction de dépôt
      const referenceNumber = `DEP${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const backendResult = await depositToWallet(amount, 'Dépôt manuel sur le wallet', referenceNumber);
      if (!backendResult.success) {
        throw new Error(backendResult.error || 'Échec du dépôt wallet');
      }

      console.log('✅ Dépôt effectué avec succès');

      toast.success(`Dépôt de ${formatWalletBalance(amount)} effectué avec succès !`);
      setDepositAmount('');
      setDepositOpen(false);
      await Promise.all([loadWalletData(), loadTransactions()]);
    } catch (error: any) {
      console.error('❌ Erreur dépôt:', error);
      toast.error(error.message || 'Erreur lors du dépôt');
    } finally {
      setProcessing(false);
    }
  };

  const handleMobileMoneyDeposit = async (amount: number) => {
    // Nettoyer et valider le numéro
    const cleanPhone = mobileMoneyPhone.replace(/[^0-9]/g, '').replace(/^(224|00224)/, '');

    if (!cleanPhone || cleanPhone.length !== 9) {
      toast.error(t('wallet.invalidPhone'), {
        description: `${t('wallet.enter9DigitsEx')}: ${cleanPhone.length}`
      });
      return;
    }

    setProcessing(true);
    const loadingToast = toast.loading(t('wallet.initMobileMoney'));

    try {
      // ✅ ChapChapPay pour les depots Mobile Money
      const paymentMethod = mobileMoneyProvider === 'orange' ? 'orange_money' : 'mtn_momo';

      const { data, error } = await supabase.functions.invoke('chapchappay-pull', {
        body: {
          amount: amount,
          currency: 'GNF',
          paymentMethod: paymentMethod,
          customerPhone: `224${cleanPhone}`,
          description: `Recharge wallet - ${amount.toLocaleString()} ${wallet?.currency || 'GNF'}`,
          orderId: `WLT-${Date.now()}`,
        }
      });

      toast.dismiss(loadingToast);

      if (error) throw error;

      if (data?.success) {
        toast.success(t('wallet.paymentRequestSent'), {
          description: `Confirmez le paiement sur votre téléphone ${paymentMethod === 'orange_money' ? 'Orange Money' : 'MTN MoMo'}`
        });

        // Polling pour vérifier le statut
        pollPaymentStatus(data.transactionId, amount);
      } else {
        throw new Error(data?.error || data?.message || 'Erreur initialisation paiement');
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('❌ Erreur paiement Mobile Money:', error);
      toast.error(t('wallet.mobileMoneyFailed'), {
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const pollPaymentStatus = async (transactionId: string, amount: number) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes

    const checkStatus = setInterval(async () => {
      attempts++;

      try {
        // Vérifier si le solde a augmenté (simple check)
        const { data: walletData } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', effectiveUserId)
          .single();

        if (walletData && wallet && walletData.balance > wallet.balance) {
          clearInterval(checkStatus);
          toast.success(`✅ ${t('wallet.paymentConfirmed')}`, {
            description: `${formatWalletBalance(amount)} ajoutés à votre wallet`
          });
          setDepositAmount('');
          setMobileMoneyPhone('');
          setDepositOpen(false);
          await Promise.all([loadWalletData(), loadTransactions()]);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkStatus);
          toast.warning(`⏱️ ${t('wallet.timeoutExceeded')}`, {
            description: t('wallet.checkStatusManually')
          });
        }
      } catch (error) {
        console.error('Erreur poll status:', error);
      }
    }, 5000);
  };

  const executeWithdraw = async (pin: string) => {
    if (!effectiveUserId || !withdrawAmount) {
      toast.error(t('wallet.enterAmount'));
      return;
    }

    // Vérifier les permissions
    if (!checkPermissions('withdraw')) {
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('wallet.invalidAmount'));
      return;
    }

    const minAmount = withdrawMethod === 'bank' ? 50000 : 5000;
    if (amount < minAmount) {
      toast.error(`INVALID_AMOUNT: Montant minimum ${formatWalletBalance(minAmount)}`);
      return;
    }

    if (!wallet || wallet.balance < amount) {
      toast.error(`INSUFFICIENT_FUNDS: Solde insuffisant (${formatWalletBalance(wallet?.balance || 0)} disponible)`);
      return;
    }

    // Validation spécifique à la méthode
    if (withdrawMethod === 'mobile_money') {
      const cleanPhone = withdrawPhone.replace(/[^0-9]/g, '').replace(/^(224|00224)/, '');
      if (!cleanPhone || cleanPhone.length !== 9) {
        toast.error(t('wallet.invalidPhone9'));
        return;
      }
    }

    setProcessing(true);
    console.log('🔄 Retrait en cours:', { amount, method: withdrawMethod, userId: effectiveUserId });

    try {
      if (withdrawMethod === 'mobile_money') {
        // Appeler l'edge function Mobile Money Withdrawal
        const cleanPhone = withdrawPhone.replace(/[^0-9]/g, '').replace(/^(224|00224)/, '');

        const { data, error } = await supabase.functions.invoke('mobile-money-withdrawal', {
          body: {
            amount,
            phoneNumber: cleanPhone,
            provider: withdrawProvider,
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erreur lors du retrait');

        console.log('✅ Retrait Mobile Money:', data);

        const providerLabel = withdrawProvider === 'orange' ? 'Orange Money' : 'MTN MoMo';
        if (data.status === 'completed') {
          toast.success(`Retrait ${providerLabel} effectué !`, {
            description: `${formatWalletBalance(data.netAmount)} envoyés vers +224${cleanPhone}`
          });
        } else {
          toast.success(`Demande de retrait ${providerLabel} enregistrée !`, {
            description: `${formatWalletBalance(data.netAmount)} seront envoyés sous 24-48h`
          });
        }

      } else if (withdrawMethod === 'bank') {
        // Validation côté client
        if (!bankAccountHolder || bankAccountHolder.trim().length < 3) {
          throw new Error('Nom du titulaire invalide (3 caractères minimum)');
        }
        if (!bankName || bankName.trim().length < 2) {
          throw new Error('Nom de la banque invalide');
        }
        if (!bankIban || bankIban.replace(/\s/g, '').length < 10) {
          throw new Error('IBAN/numéro de compte invalide (10 caractères minimum)');
        }

        // Retrait bancaire via Edge Function (flux manuel admin)
        const { data, error } = await supabase.functions.invoke('stripe-withdrawal', {
          body: {
            amount,
            currency: wallet?.currency || 'gnf',
            bankDetails: {
              bank_name: bankName.trim(),
              iban: bankIban.replace(/\s/g, '').trim(),
              account_holder: bankAccountHolder.trim(),
            }
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erreur lors du retrait bancaire');

        console.log('✅ Demande de retrait bancaire enregistrée:', data);

        toast.success(t('wallet.withdrawRequestSaved'), {
          description: `${formatWalletBalance(data.netAmount || amount)} net (${formatWalletBalance(data.withdrawalFee || 0)}). ${t('wallet.reviewedByTeam')}`
        });
      }

      setWithdrawAmount('');
      setWithdrawPhone('');
      setBankName('');
      setBankIban('');
      setBankAccountHolder('');
      setWithdrawOpen(false);
      await Promise.all([loadWalletData(), loadTransactions()]);
      return true;
    } catch (error: any) {
      console.error('❌ Erreur retrait:', error);

      // Fallback robuste: retrait interne wallet via backend v2
      try {
        const fallback = await withdrawFromWallet(amount, `Retrait wallet (${withdrawMethod})`, pin);
        if (fallback.success) {
          toast.success(`Retrait ${formatWalletBalance(amount)} effectué via fallback backend`);
          setWithdrawAmount('');
          setWithdrawPhone('');
          setBankName('');
          setBankIban('');
          setBankAccountHolder('');
          setWithdrawOpen(false);
          await Promise.all([loadWalletData(), loadTransactions()]);
          return true;
        }
      } catch {
        // Ignore fallback error and show original message
      }

      toast.error(error.message || t('wallet.withdrawError'));
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!effectiveUserId || !withdrawAmount) {
      toast.error(t('wallet.enterAmount'));
      return;
    }

    requestTransactionPin('withdraw');
  };

  const handlePreviewTransfer = async () => {
    if (!user?.id || !transferAmount || !recipientId || !transferDescription) {
      toast.error(t('wallet.fillAllFields'));
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('wallet.amountInvalid'));
      return;
    }

    // Pas de minimum codé en dur dans la devise du wallet (100 EUR = absurde). Le backend
    // applique le vrai minimum sur l'ÉQUIVALENT GNF (≈ 100 GNF) — sensible à la devise.
    if (amount > (wallet?.balance || 0)) {
      toast.error(t('wallet.insufficientBalance'));
      return;
    }

    setProcessing(true);

    try {
      console.log('🔍 Recherche du destinataire:', recipientId);

      const searchTerm = recipientId.trim();
      const isEmail = searchTerm.includes('@');
      const isPhone = /^[+]?\d{6,}$/.test(searchTerm.replace(/[\s\-()]/g, ''));

      let recipientUuid: string | null = null;
      let recipientName: string | null = null;

      // 0. Résolution fiable côté backend (service role) pour UUID, ID public/custom, email, téléphone.
      const resolved = await resolveWalletRecipient(searchTerm);
      if (resolved.success && resolved.data?.userId) {
        recipientUuid = resolved.data.userId;
        recipientName = resolved.data.displayName
          || resolved.data.customId
          || resolved.data.publicId
          || resolved.data.email
          || resolved.data.phone
          || 'Utilisateur';
      }

      // 1. Chercher dans profiles par email, téléphone ou ID
      let profileQuery = supabase
        .from('profiles')
        .select('id, email, first_name, last_name, custom_id, public_id, phone');

      if (isEmail) {
        profileQuery = profileQuery.ilike('email', searchTerm);
      } else if (isPhone) {
        const cleanPhone = searchTerm.replace(/[\s\-()]/g, '');
        profileQuery = profileQuery.or(`phone.ilike.%${cleanPhone}%`);
      } else {
        profileQuery = profileQuery.or(`custom_id.eq.${searchTerm.toUpperCase()},public_id.eq.${searchTerm.toUpperCase()}`);
      }

      const { data: profileData, error: profileError } = recipientUuid
        ? ({ data: null, error: null } as any)
        : await profileQuery.maybeSingle();

      if (profileError) {
        console.error('❌ Erreur recherche profil:', profileError);
        toast.error(t('wallet.recipientSearchError'));
        return;
      }

      // Si trouvé dans profiles
      if (!recipientUuid && profileData) {
        console.log('📋 Profil trouvé:', profileData);
        recipientUuid = profileData.id;
        recipientName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() ||
                       profileData.custom_id ||
                       profileData.public_id ||
                       'Utilisateur';
      } else if (!recipientUuid && !isEmail && !isPhone) {
        // 2. Sinon, chercher dans agents_management (agent_code) - seulement pour les IDs
        console.log('🔍 Recherche dans agents_management...');
        const { data: agentData, error: agentError } = await supabase
          .from('agents_management')
          .select('user_id, name, agent_code')
          .eq('agent_code', searchTerm.toUpperCase())
          .eq('is_active', true)
          .maybeSingle();

        if (agentError) {
          console.error('❌ Erreur recherche agent:', agentError);
          toast.error(t('wallet.agentSearchError'));
          return;
        }

        if (agentData && agentData.user_id) {
          console.log('📋 Agent trouvé:', agentData);
          recipientUuid = agentData.user_id;
          recipientName = agentData.name || agentData.agent_code;
        } else {
          // 3. Sinon, chercher dans bureaus (bureau_code)
          console.log('🔍 Recherche dans bureaus...');
          const { data: bureauData, error: bureauError } = await supabase
            .from('bureaus')
            .select('id, bureau_code, president_name, commune, prefecture')
            .eq('bureau_code', searchTerm.toUpperCase())
            .eq('status', 'active')
            .maybeSingle();

          if (bureauError) {
            console.error('❌ Erreur recherche bureau:', bureauError);
            toast.error(t('wallet.bureauSearchError'));
            return;
          }

          if (bureauData) {
            console.log('📋 Bureau trouvé:', bureauData);
            // Vérifier que le bureau a un wallet
            const { data: bureauWallet, error: walletError } = await supabase
              .from('bureau_wallets')
              .select('id, balance')
              .eq('bureau_id', bureauData.id)
              .single();

            if (walletError || !bureauWallet) {
              console.error('❌ Bureau sans wallet:', walletError);
              toast.error(t('wallet.bureauNoWallet'));
              return;
            }

            // Utiliser l'ID du bureau comme identifiant spécial avec préfixe
            recipientUuid = `bureau:${bureauData.id}:${bureauWallet.id}`;
            recipientName = `Bureau ${bureauData.bureau_code} - ${bureauData.commune} (${bureauData.president_name || 'Président'})`;
          }
        }
      }

      // Si aucun destinataire trouvé
      if (!recipientUuid) {
        console.error('❌ Aucun destinataire trouvé avec ID:', recipientId);
        toast.error(`${t('wallet.recipientNotFound')}: ${recipientId}`);
        return;
      }

      // Vérifier si c'est un transfert vers un bureau
      const isBureauTransfer = recipientUuid.startsWith('bureau:');

      if (!isBureauTransfer && recipientUuid === effectiveUserId) {
        toast.error(t('wallet.cannotTransferSelf'));
        return;
      }

      console.log('🔍 Prévisualisation pour:', {
        sender: effectiveUserId,
        receiver: recipientUuid,
        recipient_name: recipientName,
        amount,
        isBureauTransfer
      });

      if (isBureauTransfer) {
        // Pour les transferts vers bureau, calculer les frais manuellement
        const feeRate = 0.01; // 1% de frais
        const feeAmount = Math.ceil(amount * feeRate);
        const totalDebit = amount + feeAmount;

        if (totalDebit > (wallet?.balance || 0)) {
          toast.error(t('wallet.insufficientForFees'));
          return;
        }

        setTransferPreview({
          success: true,
          amount: amount,
          fee_amount: feeAmount,
          fee_percent: 1,
          total_debit: totalDebit,
          amount_received: amount,
          current_balance: wallet?.balance || 0,
          balance_after: (wallet?.balance || 0) - totalDebit,
          recipient_uuid: recipientUuid,
          recipient_name: recipientName,
          is_bureau_transfer: true,
          currency_sent: wallet?.currency || 'GNF',
          currency_received: wallet?.currency || 'GNF',
        });
        setShowTransferPreview(true);
        setTransferOpen(false);
      } else {
        const previewResponse = await previewWalletTransfer(recipientUuid, amount);

        if (!previewResponse.success) {
          console.error('❌ Erreur preview:', previewResponse.error);
          toast.error(previewResponse.error || 'Erreur lors de la prévisualisation');
          return;
        }
        const data = previewResponse.data;

        console.log('✅ Réponse prévisualisation:', data);

        if (!data?.success) {
          console.error('❌ Preview échouée:', data?.error);
          toast.error(data?.error || 'Erreur inconnue');
          return;
        }

        // ✅ International = devises différentes → afficher le dialogue international
        if (data.is_international) {
          setIntlPreview({
            success: true,
            amount_sent: data.amount_sent || amount,
            currency_sent: data.currency_sent || 'GNF',
            fee_percentage: data.fee_percentage || 0,
            fee_amount: data.fee_amount || 0,
            amount_after_fee: data.amount_after_fee || 0,
            rate_displayed: data.rate_displayed || 1,
            official_rate: data.official_rate,
            fx_margin: data.fx_margin,
            rate_source: data.rate_source,
            rate_fetched_at: data.rate_fetched_at,
            rate_source_type: data.rate_source_type,
            rate_source_url: data.rate_source_url,
            rate_is_official: data.rate_is_official,
            rate_is_stale: data.rate_is_stale,
            amount_received: data.amount_received || 0,
            currency_received: data.currency_received || 'GNF',
            is_international: true,
            sender_country: data.sender_country || '',
            receiver_country: data.receiver_country || '',
            commission_conversion: data.commission_conversion || 0,
            frais_international: data.frais_international || 0,
            total_debit: data.total_debit,
            // Solde actuel + après transfert (devise de l'expéditeur) — comme le transfert national.
            current_balance: data.sender_balance ?? (wallet?.balance || 0),
            balance_after: data.balance_after ?? ((data.sender_balance ?? (wallet?.balance || 0)) - (data.total_debit || data.amount_sent || amount)),
            rate_lock_seconds: data.rate_lock_seconds || 60,
            receiver_name: recipientName || data.receiver_name,
            receiver_code: recipientUuid,
          });
          setShowIntlConfirm(true);
          setTransferOpen(false);
          return;
        }

        // ✅ Local = même devise → dialogue simple
        setTransferPreview({
          success: true,
          amount: data.amount_sent || amount,
          fee_percent: data.fee_percentage || 0,
          fee_amount: data.fee_amount || 0,
          total_debit: data.total_debit || amount,
          amount_received: data.amount_received || amount,
          current_balance: data.sender_balance || (wallet?.balance || 0),
          balance_after: data.balance_after ?? ((wallet?.balance || 0) - (data.total_debit || amount)),
          recipient_uuid: recipientUuid,
          recipient_name: recipientName,
          is_bureau_transfer: false,
          currency_sent: data.currency_sent || wallet?.currency || 'GNF',
          currency_received: data.currency_received || wallet?.currency || 'GNF',
        });
        setShowTransferPreview(true);
        setTransferOpen(false);
      }
    } catch (error: any) {
      console.error('❌ Erreur prévisualisation:', error);
      toast.error(error.message || 'Erreur lors de la prévisualisation');
    } finally {
      setProcessing(false);
    }
  };

  const executeConfirmTransfer = async (pin: string) => {
    console.log('🔵 handleConfirmTransfer appelé', {
      userId: user?.id,
      effectiveUserId,
      hasPreview: !!transferPreview,
      preview: transferPreview
    });

    if (!effectiveUserId || !transferPreview) {
      console.error('❌ Transfert annulé: données manquantes', { effectiveUserId, transferPreview });
      toast.error(t('wallet.transferDataMissing'));
      return false;
    }

    setProcessing(true);
    setShowTransferPreview(false);

    try {
      console.log('🔄 Exécution du transfert:', {
        sender: effectiveUserId,
        receiver: transferPreview.recipient_uuid,
        amount: transferPreview.amount,
        description: transferDescription,
        is_bureau_transfer: transferPreview.is_bureau_transfer
      });

      if (transferPreview.is_bureau_transfer) {
        // Transfert vers un bureau - gestion manuelle
        const parts = transferPreview.recipient_uuid.split(':');
        const bureauId = parts[1];
        const bureauWalletId = parts[2];

        // 1. Débiter le wallet de l'expéditeur
        const { data: senderWallet, error: senderError } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', effectiveUserId)
          .single();

        if (senderError || !senderWallet) {
          throw new Error('Impossible de trouver votre portefeuille');
        }

        if (senderWallet.balance < transferPreview.total_debit) {
          throw new Error('Solde insuffisant');
        }

        // 2. Mettre à jour le solde de l'expéditeur
        const { error: updateSenderError } = await supabase
          .from('wallets')
          .update({
            balance: senderWallet.balance - transferPreview.total_debit,
            updated_at: new Date().toISOString()
          })
          .eq('id', senderWallet.id);

        if (updateSenderError) throw updateSenderError;

        // 3. Créditer le wallet du bureau
        const { data: bureauWallet, error: bureauWalletError } = await supabase
          .from('bureau_wallets')
          .select('balance')
          .eq('id', bureauWalletId)
          .single();

        if (bureauWalletError || !bureauWallet) {
          throw new Error('Impossible de trouver le portefeuille du bureau');
        }

        const { error: updateBureauError } = await supabase
          .from('bureau_wallets')
          .update({
            balance: bureauWallet.balance + transferPreview.amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', bureauWalletId);

        if (updateBureauError) {
          console.error('❌ Erreur update bureau_wallets:', updateBureauError);
          throw new Error('Impossible de créditer le portefeuille du bureau: ' + updateBureauError.message);
        }

        console.log('✅ Bureau wallet crédité avec succès');

        // 4. Enregistrer la transaction dans wallet_transactions
        const transactionId = `TRX-BUREAU-${Date.now()}`;
        const { error: txError } = await (supabase
          .from('wallet_transactions')
          .insert([
            {
              amount: transferPreview.total_debit,
              net_amount: transferPreview.amount,
              fee: transferPreview.fee_amount,
              currency: wallet?.currency || 'GNF',
              status: 'completed',
              description: `${transferDescription} (vers Bureau ${recipientId})`,
              sender_wallet_id: senderWallet.id,
              receiver_wallet_id: bureauWalletId,
              completed_at: new Date().toISOString(),
              metadata: {
                transaction_type: 'transfer',
                reference: transactionId,
                recipient_type: 'bureau',
                bureau_id: bureauId,
                bureau_wallet_id: bureauWalletId,
                bureau_code: recipientId
              }
            } as any
          ] as any));

        if (txError) {
          console.error('❌ Erreur insert wallet_transactions:', txError);
          // Ne pas throw car le transfert est déjà fait
        }

        // 5. Enregistrer aussi dans bureau_transactions
        const { error: bureauTxError } = await supabase.from('bureau_transactions').insert({
          bureau_id: bureauId,
          type: 'credit',
          amount: transferPreview.amount,
          date: new Date().toISOString(),
          description: `Transfert reçu: ${transferDescription || 'Sans description'}`,
          status: 'completed'
        });

        if (bureauTxError) {
          console.error('❌ Erreur insert bureau_transactions:', bureauTxError);
          // Ne pas throw car le transfert est déjà fait
        }

        console.log('✅ Transfert bureau réussi');
      } else {
        // ✅ Transfert normal via edge function (local ET international)
        const result = await transferToWallet(
          transferPreview.recipient_uuid,
          transferPreview.amount,
          transferDescription || 'Transfert wallet',
          pin
        );
        if (!result.success) {
          throw new Error(result.error || 'Erreur lors du transfert');
        }

        console.log('✅ Transfert backend réussi:', result);
      }

      const cur = transferPreview.currency_sent || wallet?.currency || 'GNF';
      toast.success(
        `✅ Transfert réussi vers ${transferPreview.recipient_name || 'le destinataire'}\n💸 Frais: ${transferPreview.fee_amount?.toLocaleString()} ${cur}\n📤 Total débité: ${transferPreview.total_debit?.toLocaleString()} ${cur}\n📥 Reçu: ${transferPreview.amount_received?.toLocaleString()} ${transferPreview.currency_received || cur}`,
        { duration: 6000 }
      );

      setTransferAmount('');
      setRecipientId('');
      setTransferDescription('');
      setTransferPreview(null);
      await Promise.all([loadWalletData(), loadTransactions()]);
      return true;
    } catch (error: any) {
      console.error('❌ Erreur transfert:', error);
      // Afficher le message d'erreur spécifique
      const errorMessage = error.message || error.error || 'Erreur lors du transfert';
      toast.error(errorMessage);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmTransfer = async () => {
    requestTransactionPin('transfer');
  };

  const executeIntlConfirmTransfer = async (pin: string) => {
    // AlertDialogAction ferme le dialog et vide intlPreview avant la saisie du PIN ;
    // on utilise la ref sauvegardée dans handleIntlConfirmTransfer comme source de vérité.
    const preview = intlPreviewRef.current ?? intlPreview;
    if (!effectiveUserId || !preview) return;
    setIntlExecuting(true);
    try {
      const receiverId = preview.receiver_code || recipientId.trim();
      const result = await transferToWallet(
        receiverId,
        preview.amount_sent,
        transferDescription || 'Transfert international wallet',
        pin,
        preview.rate_displayed, // taux NET du preview → garde anti-dérive backend
      );
      if (!result.success) throw new Error(result.error || 'Erreur lors du transfert');

      toast.success(
        '🌍 Transfert international réussi !',
        { duration: 5000 }
      );

      setTransferAmount('');
      setRecipientId('');
      setTransferDescription('');
      setIntlPreview(null);
      intlPreviewRef.current = null;
      setShowIntlConfirm(false);
      await Promise.all([loadWalletData(), loadTransactions()]);
      window.dispatchEvent(new CustomEvent('wallet-updated'));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du transfert international');
      return false;
    } finally {
      setIntlExecuting(false);
    }
  };

  const handleIntlConfirmTransfer = async () => {
    // Sauvegarder le preview avant que AlertDialogAction ferme le dialog et vide intlPreview
    intlPreviewRef.current = intlPreview;
    requestTransactionPin('intl-transfer');
  };

  const handlePinConfirm = async (pin: string) => {
    const currentAction = pinAction;
    if (!currentAction) return;

    let success = false;

    try {
      setPinLoading(true);
      setPinError(null);

      if (currentAction === 'withdraw') {
        success = Boolean(await executeWithdraw(pin));
      }

      if (currentAction === 'transfer') {
        success = Boolean(await executeConfirmTransfer(pin));
      }

      if (currentAction === 'intl-transfer') {
        success = Boolean(await executeIntlConfirmTransfer(pin));
      }

      if (!success) {
        setPinError('Opération non validée. Vérifiez le code PIN et réessayez.');
      }
    } catch (error: any) {
      setPinError(error?.message || 'Erreur de validation du code PIN');
    } finally {
      setPinLoading(false);
      await loadPinStatus();
    }

    if (success) {
      setPinPromptOpen(false);
      setPinAction(null);
      setPinError(null);
    }
  };

  const handlePinSetup = async ({
    currentPin,
    accountPassword,
    pin,
    confirmPin,
  }: {
    currentPin?: string;
    accountPassword?: string;
    pin: string;
    confirmPin: string;
  }) => {
    try {
      setPinLoading(true);
      setPinError(null);

      const response = pinSetupMode === 'change'
        ? await changeWalletPin(currentPin || '', pin, confirmPin)
        : pinSetupMode === 'reset'
          ? await resetWalletPin(accountPassword || '', pin, confirmPin)
          : await setupWalletPin(pin, confirmPin);

      if (!response.success) {
        throw new Error(response.error || 'Erreur configuration code PIN');
      }

      await loadPinStatus();
      setPinSetupOpen(false);

      if (pinSetupMode === 'setup' && pinAction) {
        toast.success(t('wallet.pinActivated'));
        setPinPromptOpen(true);
        return;
      }

      toast.success(
        pinSetupMode === 'change'
          ? 'Code PIN modifié'
          : pinSetupMode === 'reset'
            ? 'Code PIN réinitialisé'
            : 'Code PIN activé'
      );
      setPinAction(null);
    } catch (error: any) {
      setPinError(error?.message || 'Erreur configuration code PIN');
    } finally {
      setPinLoading(false);
    }
  };

  // Devise officielle d'affichage = celle du WALLET (l'argent réellement détenu, gérée par le PDG).
  const formatWalletBalance = (amount: number, currency?: string) => {
    const walletCur = (wallet?.currency || vendorCurrency || 'GNF').toUpperCase();
    const from = (currency || walletCur).toUpperCase();
    // Montant DÉJÀ dans la devise du wallet (ex. le SOLDE, déjà converti en base) → affichage DIRECT
    // (pas de reconversion, sinon double conversion = montant faux).
    if (from === walletCur) return formatCurrency(amount, walletCur);
    // Montant dans une autre devise (transaction/abonnement historique en GNF) → converti vers la
    // devise d'affichage, synchronisée sur la devise du wallet via CurrencySync.
    return convertPrice(amount, from).formatted;
  };

  const getTransactionType = (tx: Transaction) => {
    if (tx.sender_id === effectiveUserId && tx.receiver_id === effectiveUserId) {
      return tx.method === 'deposit' ? 'Dépôt' : 'Retrait';
    }
    return tx.sender_id === effectiveUserId ? 'Envoi' : 'Réception';
  };

  const getTransactionColor = (tx: Transaction) => {
    if (tx.sender_id === effectiveUserId && tx.receiver_id === effectiveUserId) {
      return tx.method === 'deposit' ? 'text-[#ff4000]' : 'text-orange-600';
    }
    return tx.sender_id === effectiveUserId ? 'text-[#ff4000]' : 'text-[#ff4000]';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Attendre que le profil soit chargé (uniquement si aucun userId n'est fourni en prop)
  if (!profile && !propUserId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground" />
            <div>
              <p className="font-semibold">{t('wallet.loadingProfile')}</p>
              <p className="text-sm text-muted-foreground">{t('wallet.pleaseWait')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="shadow-elegant border-0 sm:border">
      <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-client-gradient flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg truncate">{t('wallet.history')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm truncate">{t('wallet.manageTransactions')}</CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => Promise.all([loadWalletData(), loadTransactions()])}
            className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 p-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
        {/* Solde - optimisé mobile */}
        <div className="bg-client-gradient rounded-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <p className="text-xs sm:text-sm opacity-90">{t('wallet.currentBalance')}</p>
            {isAgent && agentInfo ? (
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-[10px] sm:text-xs px-1.5 sm:px-2">
                {agentInfo.agent_code}
              </Badge>
            ) : userCustomId ? (
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-[10px] sm:text-xs px-1.5 sm:px-2">
                {userCustomId}
              </Badge>
            ) : profile?.role ? (
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-[10px] sm:text-xs px-1.5 sm:px-2">
                {profile.role}
              </Badge>
            ) : null}
          </div>
          <p className="text-2xl sm:text-3xl font-bold">
            {wallet ? formatWalletBalance(wallet.balance) : 'Chargement...'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <div className="text-xs sm:text-sm text-muted-foreground">
            {pinStatus?.pin_enabled ? 'Code PIN actif pour retraits et transferts' : 'Code PIN non configuré'}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setPinAction(null);
              setPinSetupMode(pinStatus?.pin_enabled ? 'change' : 'setup');
              setPinError(null);
              setPinSetupOpen(true);
            }}
          >
            <Shield className="w-4 h-4 mr-2" />
            {pinStatus?.pin_enabled ? 'Modifier PIN' : 'Activer PIN'}
          </Button>
        </div>

        {/* Boutons d'actions - optimisés mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {/* Dépôt */}
          <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex flex-col h-16 sm:h-20 gap-1 sm:gap-2 px-1 sm:px-4">
                <ArrowDownToLine className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff4000]" />
                <span className="text-[10px] sm:text-xs">{t('wallet.deposit')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-md max-h-[90vh] overflow-y-auto"
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onFocusOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{t('wallet.makeDeposit')}</DialogTitle>
                <DialogDescription>
                  {t('wallet.addFunds')}
                </DialogDescription>
              </DialogHeader>
              <Tabs value={depositMethod} onValueChange={(v) => setDepositMethod(v as 'card' | 'mobile_money' | 'card_stripe')}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="card" className="gap-1 text-xs">
                    <CreditCard className="w-3 h-3" />
                    {t('wallet.card')}
                  </TabsTrigger>
                  <TabsTrigger value="mobile_money" className="gap-1 text-xs">
                    <Smartphone className="w-3 h-3" />
                    {t('wallet.mobile')}
                  </TabsTrigger>
                  <TabsTrigger value="card_stripe" className="gap-1 text-xs">
                    PayPal
                  </TabsTrigger>
                </TabsList>

                {/* Onglet Carte Bancaire - via Stripe */}
                <TabsContent value="card" className="space-y-4 mt-4">
                  {effectiveUserId && wallet ? (
                    <StripeWalletTopup
                      userId={effectiveUserId}
                      walletId={wallet.id}
                      onSuccess={async () => {
                        setDepositAmount('');
                        setDepositOpen(false);
                        await Promise.all([loadWalletData(), loadTransactions()]);
                      }}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      Chargement...
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="mobile_money" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="mobile-provider">{t('wallet.operator')}</Label>
                    <Select value={mobileMoneyProvider} onValueChange={(v) => setMobileMoneyProvider(v as 'orange' | 'mtn')}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('wallet.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="orange">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                            Orange Money
                          </div>
                        </SelectItem>
                        <SelectItem value="mtn">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#ff4000]" />
                            MTN MoMo
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="mobile-phone">{t('auth.phoneNumber')}</Label>
                    <div className="flex gap-2">
                      <Input
                        value="224"
                        disabled
                        className="w-16"
                      />
                      <Input
                        id="mobile-phone"
                        type="tel"
                        placeholder="621234567"
                        maxLength={9}
                        value={mobileMoneyPhone}
                        onChange={(e) => setMobileMoneyPhone(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t('wallet.digits9')}</p>
                  </div>

                  <div>
                    <Label htmlFor="mobile-amount">Montant ({wallet?.currency || 'GNF'})</Label>
                    <Input
                      id="mobile-amount"
                      type="number"
                      placeholder="10000"
                      min="1000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum: 1 000 {wallet?.currency || 'GNF'}</p>
                  </div>

                  <Button
                    onClick={handleDeposit}
                    disabled={processing || !depositAmount || !mobileMoneyPhone || mobileMoneyPhone.length !== 9}
                    className="w-full bg-[#ff4000] hover:bg-[#ff4000]"
                  >
                    {processing ? 'Traitement...' : `Recharger ${depositAmount ? parseFloat(depositAmount).toLocaleString() : '0'} ${wallet?.currency || 'GNF'}`}
                  </Button>
                </TabsContent>

                {/* Onglet PayPal */}
                <TabsContent value="card_stripe" className="space-y-4 mt-4">
                  <PayPalInlineDeposit
                    onSuccess={async () => {
                      setDepositAmount('');
                      setDepositOpen(false);
                      await Promise.all([loadWalletData(), loadTransactions()]);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          {/* Retrait - optimisé mobile */}
          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex flex-col h-16 sm:h-20 gap-1 sm:gap-2 px-1 sm:px-4">
                <ArrowUpFromLine className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                <span className="text-[10px] sm:text-xs">Retrait</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{t('wallet.makeWithdraw')}</DialogTitle>
                <DialogDescription>
                  {t('wallet.withdrawFundsDesc')}
                </DialogDescription>
              </DialogHeader>

              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 mb-2">
                <p className="text-sm text-orange-800">
                  {t('wallet.availableBalance')}: <span className="font-bold">{formatWalletBalance(wallet?.balance || 0)}</span>
                </p>
              </div>

              <Tabs value={withdrawMethod} onValueChange={(v) => setWithdrawMethod(v as 'mobile_money' | 'bank' | 'paypal')}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="mobile_money" className="gap-1 text-xs">
                    <Smartphone className="w-3 h-3" />
                    {t('wallet.mobile')}
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="gap-1 text-xs">
                    <Building2 className="w-3 h-3" />
                    {t('wallet.bank')}
                  </TabsTrigger>
                  <TabsTrigger value="paypal" className="gap-1 text-xs">
                    <span className="text-[10px] font-bold">PP</span>
                    PayPal
                  </TabsTrigger>
                </TabsList>

                {/* Retrait Mobile Money */}
                <TabsContent value="mobile_money" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="withdraw-provider">{t('wallet.operator')}</Label>
                    <Select value={withdrawProvider} onValueChange={(v) => setWithdrawProvider(v as 'orange' | 'mtn')}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('wallet.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="orange">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                            Orange Money
                          </div>
                        </SelectItem>
                        <SelectItem value="mtn">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#ff4000]" />
                            MTN MoMo
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="withdraw-phone">{t('auth.phoneNumber')}</Label>
                    <div className="flex gap-2">
                      <Input
                        value="224"
                        disabled
                        className="w-16"
                      />
                      <Input
                        id="withdraw-phone"
                        type="tel"
                        placeholder="621234567"
                        maxLength={9}
                        value={withdrawPhone}
                        onChange={(e) => setWithdrawPhone(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t('wallet.digits9')}</p>
                  </div>

                  <div>
                    <Label>Montants rapides</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                      {[10000, 25000, 50000, 100000, 200000, 500000].map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={withdrawAmount === amt.toString() ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setWithdrawAmount(amt.toString())}
                          className="text-xs"
                          disabled={wallet && wallet.balance < amt}
                        >
                          {amt.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="withdraw-amount-mm">Montant personnalisé ({wallet?.currency || 'GNF'})</Label>
                    <Input
                      id="withdraw-amount-mm"
                      type="number"
                      placeholder="Ex: 100000"
                      min="5000"
                      max={wallet?.balance || 0}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum: 5,000 {wallet?.currency || 'GNF'}</p>
                  </div>

                  <Button
                    onClick={handleWithdraw}
                    disabled={processing || !withdrawAmount || !withdrawPhone || withdrawPhone.length !== 9 || parseFloat(withdrawAmount) < 5000}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    {processing ? t('wallet.processing') : `${t('wallet.withdrawBtn')} ${withdrawAmount ? parseFloat(withdrawAmount).toLocaleString() : '0'} ${wallet?.currency || 'GNF'}`}
                  </Button>

                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-700">{t('wallet.withdraw2448')}</p>
                  </div>
                </TabsContent>

                {/* Retrait Virement bancaire */}
                <TabsContent value="bank" className="space-y-4 mt-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{t('wallet.bankTransferWithdraw')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('wallet.bankTransferDesc')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bank-holder">{t('wallet.accountHolder')}</Label>
                    <Input
                      id="bank-holder"
                      placeholder={t('wallet.accountHolderPlaceholder')}
                      value={bankAccountHolder}
                      onChange={(e) => setBankAccountHolder(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank-name">{t('wallet.bankName')}</Label>
                    <Input
                      id="bank-name"
                      placeholder={t('wallet.bankNamePlaceholder')}
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank-iban">IBAN / Numéro de compte</Label>
                    <Input
                      id="bank-iban"
                      placeholder="Ex: GN76 0001 0000 0000 0000"
                      value={bankIban}
                      onChange={(e) => setBankIban(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Montants rapides</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                      {[50000, 100000, 200000, 500000, 1000000, 2000000].map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={withdrawAmount === amt.toString() ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setWithdrawAmount(amt.toString())}
                          className="text-xs"
                          disabled={wallet && wallet.balance < amt}
                        >
                          {amt >= 1000000 ? `${(amt/1000000).toFixed(0)}M` : `${(amt/1000).toFixed(0)}k`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="withdraw-amount-bank">Montant à retirer ({wallet?.currency || 'GNF'})</Label>
                    <Input
                      id="withdraw-amount-bank"
                      type="number"
                      placeholder="Ex: 500000"
                      min="50000"
                      max={wallet?.balance || 0}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum: 50,000 {wallet?.currency || 'GNF'} · Frais dynamiques (configurable par l'administration)</p>
                  </div>

                  <Button
                    onClick={handleWithdraw}
                    disabled={processing || !withdrawAmount || parseFloat(withdrawAmount) < 50000 || !bankName || !bankIban || !bankAccountHolder}
                    className="w-full"
                  >
                    {processing ? 'Traitement...' : `Demander le retrait de ${withdrawAmount ? parseFloat(withdrawAmount).toLocaleString() : '0'} ${wallet?.currency || 'GNF'}`}
                  </Button>

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Les fonds sont réservés dès la demande. Si la demande est rejetée ou échoue, les fonds sont automatiquement restaurés sur votre wallet.
                    </p>
                  </div>
                </TabsContent>

                {/* Retrait PayPal */}
                <TabsContent value="paypal" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="pp-wd-email">{t('wallet.paypalEmail')}</Label>
                    <Input
                      id="pp-wd-email"
                      type="email"
                      placeholder={t('wallet.emailPlaceholder')}
                      value={paypalWithdrawEmail}
                      onChange={(e) => setPaypalWithdrawEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Montants rapides (USD)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                      {[10, 25, 50, 100, 250, 500].map((amt) => (
                        <Button
                          key={amt}
                          variant={paypalWithdrawAmount === amt.toString() ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPaypalWithdrawAmount(amt.toString())}
                          className="text-xs"
                        >
                          ${amt}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pp-wd-amt">{t('wallet.amountUsd')}</Label>
                    <Input
                      id="pp-wd-amt"
                      type="number"
                      placeholder="Ex: 50"
                      value={paypalWithdrawAmount}
                      onChange={(e) => setPaypalWithdrawAmount(e.target.value)}
                      min="5"
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum: $5 USD · Frais: 1.5%</p>
                  </div>
                  <Button
                    onClick={async () => {
                      const numAmt = parseFloat(paypalWithdrawAmount);
                      if (!numAmt || numAmt < 5) { toast.error(t('wallet.minUsd5')); return; }
                      if (!paypalWithdrawEmail || !paypalWithdrawEmail.includes('@')) { toast.error(t('wallet.invalidPaypalEmail')); return; }
                      setProcessing(true);
                      try {
                        const { data, error } = await signedInvoke('paypal-withdrawal', {
                          amount: numAmt, currency: 'USD', paypalEmail: paypalWithdrawEmail,
                        });
                        if (error) throw new Error(error.message);
                        if (!data?.success) throw new Error(data?.error || t('wallet.withdrawError'));
                        toast.success(data.message || t('wallet.paypalWithdrawDone'));
                        setPaypalWithdrawAmount('');
                        setPaypalWithdrawEmail('');
                        setWithdrawOpen(false);
                        window.dispatchEvent(new Event('wallet-updated'));
                        await Promise.all([loadWalletData(), loadTransactions()]);
                      } catch (err: any) {
                        toast.error(err.message || t('wallet.paypalWithdrawError'));
                      } finally { setProcessing(false); }
                    }}
                    disabled={processing || !paypalWithdrawAmount || parseFloat(paypalWithdrawAmount) < 5 || !paypalWithdrawEmail}
                    className="w-full bg-[#0070BA] hover:bg-[#003087] text-white"
                    size="lg"
                  >
                    {processing ? t('wallet.processing') : `${t('wallet.withdrawBtn')} $${paypalWithdrawAmount || '0'} ${t('wallet.toPaypal')}`}
                  </Button>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">{t('wallet.securePaypal')}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          {/* Transfert - optimisé mobile */}
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex flex-col h-16 sm:h-20 gap-1 sm:gap-2 px-1 sm:px-4">
                <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <span className="text-[10px] sm:text-xs">{t('wallet.transfer')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('wallet.makeTransfer')}</DialogTitle>
                <DialogDescription>
                  {t('wallet.transferDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="recipient-id">{t('wallet.recipient')}</Label>
                  <Input
                    id="recipient-id"
                    placeholder={t('wallet.recipientPlaceholder')}
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('wallet.recipientHelp')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="transfer-amount">{t('wallet.amount')}</Label>
                  <Input
                    id="transfer-amount"
                    type="number"
                    placeholder="10000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('wallet.availableBalance')}: {formatWalletBalance(wallet?.balance || 0)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="transfer-description">{t('wallet.transferReason')}</Label>
                  <Input
                    id="transfer-description"
                    placeholder={t('wallet.transferReasonPlaceholder')}
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handlePreviewTransfer}
                  disabled={processing || !transferAmount || !recipientId || !transferDescription}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {processing ? t('wallet.processing') : t('wallet.seeFeesConfirm')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dialog de confirmation avec prévisualisation des frais */}
        <AlertDialog open={showTransferPreview} onOpenChange={setShowTransferPreview}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                {t('wallet.confirmTransfer')}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 mt-4">
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    {transferPreview?.recipient_name && (
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-sm font-medium">👤 {t('wallet.recipient')}</span>
                        <span className="text-lg font-semibold text-primary">{transferPreview.recipient_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">💰 {t('wallet.amountToTransfer')}</span>
                      <span className="text-lg font-bold">{formatWalletBalance(transferPreview?.amount || 0)}</span>
                    </div>
                    {(transferPreview?.fee_amount || 0) > 0 && (
                      <div className="flex justify-between items-center text-orange-600">
                        <span className="text-sm font-medium">💸 {t('wallet.transferFees')} ({transferPreview?.fee_percent}%)</span>
                        <span className="text-lg font-bold">{formatWalletBalance(transferPreview?.fee_amount || 0)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-sm font-medium">📉 {t('wallet.totalDebited')}</span>
                      <span className="text-xl font-bold text-destructive">{formatWalletBalance(transferPreview?.total_debit || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#ff4000]">
                      <span className="text-sm font-medium">📈 {t('wallet.netReceived')}</span>
                      <span className="text-lg font-bold">{formatWalletBalance(transferPreview?.amount_received || 0)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-muted border border-border rounded-lg">
                    <p className="text-sm">
                      <strong>{t('wallet.currentBalance')}:</strong> {formatWalletBalance(transferPreview?.current_balance || 0)}
                      <br />
                      <strong>{t('wallet.balanceAfter')}:</strong> {formatWalletBalance(transferPreview?.balance_after || 0)}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {t('wallet.confirmTransferQ')}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>{t('wallet.noCancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmTransfer();
                }}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('wallet.transferInProgress')}
                  </>
                ) : (
                  t('wallet.yesConfirm')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* International transfer confirmation with rate-lock timer */}
        <InternationalTransferConfirmation
          open={showIntlConfirm}
          onOpenChange={(val) => {
            setShowIntlConfirm(val);
            if (!val) setIntlPreview(null);
          }}
          preview={intlPreview}
          onConfirm={handleIntlConfirmTransfer}
          loading={intlExecuting}
        />

        <WalletPinPromptDialog
          open={pinPromptOpen}
          onOpenChange={(value) => {
            setPinPromptOpen(value);
            if (!value) {
              intlPreviewRef.current = null;
              setPinError(null);
              setPinAction(null);
            }
          }}
          loading={pinLoading}
          error={pinError}
          onConfirm={handlePinConfirm}
          onForgotPin={() => {
            setPinPromptOpen(false);
            setPinError(null);
            setPinSetupMode('reset');
            setPinSetupOpen(true);
          }}
        />

        <WalletPinSetupDialog
          open={pinSetupOpen}
          onOpenChange={(value) => {
            setPinSetupOpen(value);
            if (!value) {
              setPinError(null);
              if (!pinPromptOpen) {
                setPinAction(null);
              }
            }
          }}
          mode={pinSetupMode}
          loading={pinLoading}
          error={pinError}
          onSubmit={handlePinSetup}
          onForgotPin={() => {
            setPinError(null);
            setPinSetupMode('reset');
          }}
        />

        {/* Moyens de paiement — sous Dépôt/Retrait/Transfert */}
        <Button
          variant="outline"
          className="w-full gap-2 mb-4"
          onClick={() => setShowPaymentMethods(true)}
        >
          <CreditCard className="w-4 h-4" />
          Moyens de paiement
        </Button>

        <Dialog open={showPaymentMethods} onOpenChange={setShowPaymentMethods}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('wallet.paymentMethods')}</DialogTitle>
            </DialogHeader>
            <PaymentMethodsManager />
          </DialogContent>
        </Dialog>

        {/* Historique des transactions - optimisé mobile */}
        <div>
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            <h3 className="font-semibold text-sm sm:text-base">{t('wallet.recentHistory')}</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <History className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
              <p className="text-xs sm:text-sm">{t('wallet.noTransaction')}</p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {(showAllTransactions ? transactions : transactions.slice(0, 4)).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start sm:items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">
                      {getTransactionType(tx)}{' '}
                      {(tx.sender_id !== effectiveUserId || tx.receiver_id !== effectiveUserId) && (
                        <>
                          <span className="text-foreground">
                            {tx.sender_id === effectiveUserId
                              ? (tx.receiver_name || 'Utilisateur')
                              : (tx.sender_name || 'Utilisateur')}
                          </span>
                        </>
                      )}
                    </p>
                    {(tx.sender_id !== effectiveUserId || tx.receiver_id !== effectiveUserId) && (
                      <span className="font-mono text-primary text-[10px] sm:text-xs block">
                        {tx.sender_id === effectiveUserId ? tx.receiver_custom_id : tx.sender_custom_id}
                      </span>
                    )}
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {tx.metadata?.description && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground italic truncate mt-0.5 max-w-[150px] sm:max-w-full">
                        {tx.metadata.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-xs sm:text-sm ${getTransactionColor(tx)}`}>
                      {tx.sender_id === effectiveUserId && tx.receiver_id !== effectiveUserId ? '-' : '+'}
                      {formatWalletBalance(tx.amount, tx.currency)}
                    </p>
                    {/* Frais NON affichés dans l'historique : la commission est facturée en silence
                        (incluse dans le débit / le taux), pas exposée comme ligne séparée. */}
                    <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs px-1 sm:px-2 py-0 mt-0.5">
                      {tx.status === 'completed' ? 'OK' : tx.status}
                    </Badge>
                  </div>
                </div>
              ))}

              {transactions.length > 4 && (
                <Button
                  variant="ghost"
                  className="w-full mt-1 sm:mt-2 text-xs sm:text-sm h-8 sm:h-10"
                  onClick={() => setShowAllTransactions(!showAllTransactions)}
                >
                  {showAllTransactions
                    ? 'Afficher moins'
                    : `Voir tout (${transactions.length - 4} de plus)`}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {/* PayPal deposit tab content is handled inline above */}
  </>
  );
};

export default UniversalWalletTransactions;
