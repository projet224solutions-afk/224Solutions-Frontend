import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, User, Search, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  transferToWallet,
  previewWalletTransfer,
  type WalletTransferPreviewResult,
} from '@/services/walletBackendService';
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

interface TransferMoneyProps {
  walletId: number;
  currentBalance: number;
  currency: string;
  onTransferComplete?: () => void;
  senderUserId?: string;
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  type: 'bureau' | 'agent' | 'vendor' | 'user' | 'driver';
  wallet_id?: number;
  user_id?: string;
}

export default function TransferMoney({ walletId, currentBalance, currency, onTransferComplete, senderUserId }: TransferMoneyProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState('');
  const [searching, setSearching] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [preview, setPreview] = useState<WalletTransferPreviewResult | null>(null);

  // Resolve the destination user ID for non-bureau transfers
  const getReceiverUserId = async (): Promise<string | null> => {
    if (!selectedUser) return null;
    if (selectedUser.type === 'bureau') return null;
    if (selectedUser.type === 'agent') {
      if (selectedUser.user_id) return selectedUser.user_id;
      const { data } = await supabase
        .from('agents_management')
        .select('user_id')
        .eq('id', selectedUser.id)
        .single();
      return data?.user_id || null;
    }
    return selectedUser.id; // user/vendor/driver: selectedUser.id is profile UUID
  };

  const handleOpenConfirm = async () => {
    const transferAmount = parseFloat(amount);
    if (!selectedUser || isNaN(transferAmount) || transferAmount <= 0) return;

    setShowConfirm(true);
    setPreview(null);

    if (selectedUser.type !== 'bureau') {
      const receiverId = await getReceiverUserId();
      if (receiverId) {
        setPreviewing(true);
        try {
          const result = await previewWalletTransfer(receiverId, transferAmount);
          if (result.success) setPreview(result);
        } catch {
          // Preview failure is non-blocking
        } finally {
          setPreviewing(false);
        }
      }
    }
  };

  const searchUsers = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      toast.error(t('transferMoney.entrezAuMoins2Caracteres'));
      return;
    }

    setSearching(true);
    const results: UserSearchResult[] = [];
    const query = searchQuery.trim();
    const queryUpper = query.toUpperCase();

    try {
      // 1. Par ID dans user_ids (VND..., CLT..., DRV..., PDG..., etc.)
      const { data: userIds } = await supabase
        .from('user_ids')
        .select('user_id, custom_id')
        .ilike('custom_id', `%${queryUpper}%`)
        .limit(15);

      if (userIds && userIds.length > 0) {
        for (const uid of userIds) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('id', uid.user_id)
            .maybeSingle();

          if (profile) {
            const { data: userWallet } = await supabase
              .from('wallets')
              .select('id')
              .eq('user_id', profile.id)
              .maybeSingle();

            if (userWallet) {
              results.push({
                id: profile.id,
                name: `${uid.custom_id} - ${profile.full_name || 'Utilisateur'}`,
                email: profile.email || '',
                type: profile.role === 'vendeur' ? 'vendor' : profile.role === 'livreur' ? 'driver' : 'user',
                wallet_id: userWallet.id,
              });
            }
          }
        }
      }

      // 2. Par code bureau (BST...)
      const { data: bureaux } = await supabase
        .from('bureaus')
        .select('id, bureau_code, prefecture, commune')
        .ilike('bureau_code', `%${queryUpper}%`)
        .limit(10);

      if (bureaux && bureaux.length > 0) {
        for (const bureau of bureaux) {
          const { data: bureauWallet } = await supabase
            .from('bureau_wallets')
            .select('id')
            .eq('bureau_id', bureau.id)
            .maybeSingle();

          if (bureauWallet) {
            results.push({
              id: bureau.id,
              name: `${bureau.bureau_code} - ${bureau.prefecture || bureau.commune || 'Bureau'}`,
              email: bureau.commune || '',
              type: 'bureau',
              wallet_id: Number(bureauWallet.id),
            });
          }
        }
      }

      // 3. Par code agent (AGT...)
      const { data: agents } = await supabase
        .from('agents_management')
        .select('id, name, email, agent_code, user_id')
        .ilike('agent_code', `%${queryUpper}%`)
        .limit(10);

      if (agents && agents.length > 0) {
        for (const agent of agents) {
          if (!agent.user_id) continue;
          const { data: agentWallet } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', agent.user_id)
            .maybeSingle();

          if (agentWallet && agentWallet.id !== walletId && !results.find(r => r.wallet_id === agentWallet.id)) {
            results.push({
              id: agent.id,
              name: `${agent.agent_code} - ${agent.name}`,
              email: agent.email || '',
              type: 'agent',
              wallet_id: agentWallet.id,
              user_id: agent.user_id,
            });
          }
        }
      }

      // 4. Par nom/email/téléphone dans profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);

      if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
          if (results.find(r => r.id === profile.id)) continue;
          const { data: wallet } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', profile.id)
            .maybeSingle();

          if (wallet) {
            const { data: userId } = await supabase
              .from('user_ids')
              .select('custom_id')
              .eq('user_id', profile.id)
              .maybeSingle();

            results.push({
              id: profile.id,
              name: userId?.custom_id
                ? `${userId.custom_id} - ${profile.full_name || 'Utilisateur'}`
                : profile.full_name || 'Utilisateur',
              email: profile.email || profile.phone || '',
              type: profile.role === 'vendeur' ? 'vendor' : profile.role === 'livreur' ? 'driver' : 'user',
              wallet_id: wallet.id,
            });
          }
        }
      }

      // 5. Par nom vendeur
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, business_name, email, user_id')
        .or(`business_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (vendors && vendors.length > 0) {
        for (const vendor of vendors) {
          if (results.find(r => r.id === vendor.user_id)) continue;
          const { data: vendorWallet } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', vendor.user_id)
            .maybeSingle();

          if (vendorWallet && !results.find(r => r.wallet_id === vendorWallet.id)) {
            results.push({
              id: vendor.user_id,
              name: vendor.business_name || 'Vendeur',
              email: vendor.email || '',
              type: 'vendor',
              wallet_id: vendorWallet.id,
            });
          }
        }
      }

      // 6. Par nom agent (fallback)
      if (results.filter(r => r.type === 'agent').length === 0) {
        const { data: agentsByName } = await supabase
          .from('agents_management')
          .select('id, name, email, agent_code, user_id')
          .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);

        if (agentsByName && agentsByName.length > 0) {
          for (const agent of agentsByName) {
            if (!agent.user_id) continue;
            const { data: agentWallet } = await supabase
              .from('wallets')
              .select('id')
              .eq('user_id', agent.user_id)
              .maybeSingle();

            if (agentWallet && agentWallet.id !== walletId && !results.find(r => r.wallet_id === agentWallet.id)) {
              results.push({
                id: agent.id,
                name: `${agent.agent_code} - ${agent.name}`,
                email: agent.email || '',
                type: 'agent',
                wallet_id: agentWallet.id,
                user_id: agent.user_id,
              });
            }
          }
        }
      }

      const uniqueResults = results.filter((result, index, self) =>
        index === self.findIndex(r => r.wallet_id === result.wallet_id)
      );

      setSearchResults(uniqueResults);
      if (uniqueResults.length === 0) {
        toast.info(t('transferMoney.aucunUtilisateurTrouveAvecCet'));
      } else {
        toast.success(`${uniqueResults.length} résultat(s) trouvé(s)`);
      }
    } catch (error: any) {
      toast.error(t('transferMoney.erreurLorsDeLaRecherche'));
    } finally {
      setSearching(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedUser) {
      toast.error(t('transferMoney.selectionnezUnDestinataire'));
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast.error(t('transferMoney.montantInvalide'));
      return;
    }
    if (transferAmount > currentBalance) {
      toast.error(t('transferMoney.soldeInsuffisant'));
      return;
    }

    setTransferring(true);
    try {
      if (selectedUser.type === 'bureau') {
        // Bureaux utilisent la table bureau_wallets — rester sur le RPC Supabase
        let senderId = senderUserId;
        if (!senderId) {
          const { data: walletData } = await supabase
            .from('wallets')
            .select('user_id')
            .eq('id', walletId)
            .single();
          if (!walletData?.user_id) throw new Error('Wallet non trouvé ou non lié à un utilisateur');
          senderId = walletData.user_id;
        }

        const { data, error } = await supabase.rpc('process_secure_wallet_transfer', {
          p_sender_id: senderId,
          p_receiver_id: selectedUser.id,
          p_amount: transferAmount,
          p_description: description || `Transfert vers ${selectedUser.name}`,
          p_sender_type: 'user',
          p_receiver_type: 'bureau',
        });

        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error || 'Échec de la transaction');

        toast.success(`Transfert de ${transferAmount.toLocaleString()} ${currency} effectué avec succès`);
      } else {
        // User / agent / vendor / driver — backend Node.js avec conversion FX BCRG live
        const receiverUserId = await getReceiverUserId();
        if (!receiverUserId) throw new Error('Destinataire introuvable');

        const result = await transferToWallet(
          receiverUserId,
          transferAmount,
          description || `Transfert vers ${selectedUser.name}`,
          pin || undefined,
        );

        if (!result.success) throw new Error(result.error || 'Échec du transfert');

        const receivedInfo = preview?.is_international
          ? ` → ${preview.amount_received.toLocaleString()} ${preview.currency_received} reçus`
          : '';

        toast.success(`Transfert de ${transferAmount.toLocaleString()} ${currency} effectué avec succès${receivedInfo}`);
      }

      setAmount('');
      setDescription('');
      setPin('');
      setSelectedUser(null);
      setSearchResults([]);
      setSearchQuery('');
      setShowConfirm(false);
      setPreview(null);

      if (onTransferComplete) onTransferComplete();
      window.dispatchEvent(new CustomEvent('wallet-updated'));
    } catch (error: any) {
      toast.error(`Erreur lors du transfert: ${error.message}`);
    } finally {
      setTransferring(false);
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'bureau': return '🏢 Bureau Syndicat';
      case 'driver': return '🏍️ Chauffeur';
      case 'agent': return '👤 Agent';
      case 'vendor': return '🏪 Vendeur';
      case 'user': return '👥 Client';
      default: return '👤 Utilisateur';
    }
  };

  const transferAmount = parseFloat(amount || '0');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="w-5 h-5" />
          Transférer de l'argent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recherche */}
        <div className="space-y-2">
          <Label>{t('transferMoney.rechercherUnDestinataire')}</Label>
          <div className="flex gap-2">
            <Input
              placeholder={t('transferMoney.idCltVndBstAgt')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            />
            <Button onClick={searchUsers} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Résultats */}
        {searchResults.length > 0 && !selectedUser && (
          <div className="space-y-2">
            <Label>{t('transferMoney.selectionnezUnDestinataire')}</Label>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
              {searchResults.map((user) => (
                <button
                  key={`${user.type}-${user.id}`}
                  onClick={() => { setSelectedUser(user); setSearchResults([]); }}
                  className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="text-xs">{getUserTypeLabel(user.type)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Destinataire sélectionné */}
        {selectedUser && (
          <div className="p-3 bg-accent rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {selectedUser.name}
                </p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                <p className="text-xs mt-1">{getUserTypeLabel(selectedUser.type)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(null); setSearchResults([]); setPreview(null); }}>
                Changer
              </Button>
            </div>
          </div>
        )}

        {/* Montant et description */}
        {selectedUser && (
          <>
            <div className="space-y-2">
              <Label htmlFor="agent-transfer-amount">Montant ({currency})</Label>
              <Input
                id="agent-transfer-amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                max={currentBalance}
              />
              <p className="text-xs text-muted-foreground">
                Solde disponible: {currentBalance.toLocaleString()} {currency}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-transfer-description">Description (optionnelle)</Label>
              <Input
                id="agent-transfer-description"
                placeholder={t('transferMoney.exPaiementPourService')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleOpenConfirm}
              disabled={!amount || transferAmount <= 0 || transferAmount > currentBalance || transferring}
            >
              <Send className="w-4 h-4 mr-2" />
              Envoyer {amount ? `${transferAmount.toLocaleString()} ${currency}` : ''}
            </Button>
          </>
        )}

        {/* Dialog de confirmation */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('transferMoney.confirmerLeTransfert')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 my-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('transferMoney.montantEnvoye')}</span>
                    <span className="text-lg font-bold text-foreground">
                      {transferAmount.toLocaleString()} {currency}
                    </span>
                  </div>

                  {/* Aperçu conversion internationale */}
                  {previewing && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('transferMoney.calculDuTauxDeChange')}</span>
                    </div>
                  )}

                  {preview?.is_international && !previewing && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 space-y-1">
                      <p className="font-semibold text-blue-800 dark:text-blue-200 text-xs uppercase tracking-wide">
                        Transfert international
                      </p>
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <span>{transferAmount.toLocaleString()} {preview.currency_sent}</span>
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        <span className="text-[#ff4000] dark:text-[#ff4000]">
                          {preview.amount_received.toLocaleString()} {preview.currency_received}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Taux: 1 {preview.currency_sent} = {preview.rate_displayed.toFixed(4)} {preview.currency_received}
                        {preview.rate_is_official ? ' (source officielle BCRG)' : ''}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-muted-foreground">Destinataire: </span>
                    <span className="font-semibold text-foreground">
                      {selectedUser?.name} ({getUserTypeLabel(selectedUser?.type || '')})
                    </span>
                  </div>

                  {description && (
                    <div>
                      <span className="text-muted-foreground">Motif: </span>
                      <span className="text-foreground italic">{description}</span>
                    </div>
                  )}

                  {/* PIN requis si activé */}
                  {selectedUser?.type !== 'bureau' && (
                    <div className="space-y-1 pt-1">
                      <Label htmlFor="transfer-pin" className="text-xs">
                        Code PIN (si configuré)
                      </Label>
                      <Input
                        id="transfer-pin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        className="w-32 text-center tracking-widest"
                      />
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground pt-1">
                    Cette action est irréversible. Vérifiez les informations avant de confirmer.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={transferring}>{t('transferMoney.annuler')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleTransfer} disabled={transferring || previewing}>
                {transferring ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transfert en cours...</>
                ) : (
                  'Confirmer le transfert'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
