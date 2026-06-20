import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinancialTransactions } from '@/hooks/useFinancialTransactions';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Wallet, Smartphone, ArrowRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VirtualCard {
  id: string;
  card_number: string;
  status: string;
}

export function FinancialTransferPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const {
    loading,
    transferCardToOrangeMoney,
    rechargeCardFromWallet,
    rechargeWalletFromCard,
    calculateFees
  } = useFinancialTransactions();

  const { balance: walletBalance, currency, loading: walletLoading } = useWalletBalance(userId);
  const [virtualCards, setVirtualCards] = useState<VirtualCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>('');

  // Formulaire Carte → Orange Money
  const [omPhone, setOmPhone] = useState('');
  const [omAmount, setOmAmount] = useState('');

  // Formulaire Wallet → Carte
  const [walletToCardAmount, setWalletToCardAmount] = useState('');

  // Formulaire Carte → Wallet
  const [cardToWalletAmount, setCardToWalletAmount] = useState('');

  useEffect(() => {
    loadVirtualCards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadVirtualCards = async () => {
    try {
      const { data, error } = await supabase
        .from('virtual_cards')
        .select('id, card_number, status')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;
      setVirtualCards(data || []);
      if (data && data.length > 0) {
        setSelectedCard(data[0].id);
      }
    } catch (error) {
      console.error('Erreur chargement cartes:', error);
    }
  };

  const getCardDisplay = (card: VirtualCard) => {
    return `**** ${card.card_number.slice(-4)}`;
  };

  const handleCardToOM = async () => {
    if (!selectedCard || !omPhone || !omAmount) {
      return;
    }
    await transferCardToOrangeMoney(selectedCard, omPhone, parseFloat(omAmount));
    setOmPhone('');
    setOmAmount('');
    loadVirtualCards();
  };

  const handleWalletToCard = async () => {
    if (!selectedCard || !walletToCardAmount) {
      return;
    }
    await rechargeCardFromWallet(selectedCard, parseFloat(walletToCardAmount));
    setWalletToCardAmount('');
    loadVirtualCards();
  };

  const handleCardToWallet = async () => {
    if (!selectedCard || !cardToWalletAmount) {
      return;
    }
    await rechargeWalletFromCard(selectedCard, parseFloat(cardToWalletAmount));
    setCardToWalletAmount('');
    loadVirtualCards();
  };

  if (virtualCards.length === 0 && !walletLoading) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Aucune carte virtuelle active. Créez une carte virtuelle pour commencer.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sélection de carte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Sélectionner une carte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCard} onValueChange={setSelectedCard}>
            <SelectTrigger>
              <SelectValue placeholder={t('financialTransferPanel.choisirUneCarte')} />
            </SelectTrigger>
            <SelectContent>
              {virtualCards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  {getCardDisplay(card)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Onglets de transfert */}
      <Tabs defaultValue="card-to-om" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="card-to-om">
            <Smartphone className="h-4 w-4 mr-2" />
            Carte → Orange Money
          </TabsTrigger>
          <TabsTrigger value="wallet-to-card">
            <Wallet className="h-4 w-4 mr-2" />
            Wallet → Carte
          </TabsTrigger>
          <TabsTrigger value="card-to-wallet">
            <CreditCard className="h-4 w-4 mr-2" />
            Carte → Wallet
          </TabsTrigger>
        </TabsList>

        {/* Carte → Orange Money */}
        <TabsContent value="card-to-om">
          <Card>
            <CardHeader>
              <CardTitle>Transfert vers Orange Money</CardTitle>
              <CardDescription>
                Frais: 2% du montant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('financialTransferPanel.numeroOrangeMoney')}</Label>
                <Input
                  type="tel"
                  placeholder="628123456"
                  value={omPhone}
                  onChange={(e) => setOmPhone(e.target.value)}
                />
              </div>
              <div>
                <Label>Montant ({currency})</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={omAmount}
                  onChange={(e) => setOmAmount(e.target.value)}
                />
                {omAmount && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Frais: {calculateFees(parseFloat(omAmount), 'card_to_om').toLocaleString()} {currency}
                    <br />
                    Total: {(parseFloat(omAmount) + calculateFees(parseFloat(omAmount), 'card_to_om')).toLocaleString()} {currency}
                  </p>
                )}
              </div>
              <Button
                onClick={handleCardToOM}
                disabled={loading || !selectedCard || !omPhone || !omAmount}
                className="w-full"
              >
                {loading ? 'Transfert en cours...' : (
                  <>
                    Transférer <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallet → Carte */}
        <TabsContent value="wallet-to-card">
          <Card>
            <CardHeader>
              <CardTitle>{t('financialTransferPanel.rechargerLaCarteDepuisLe')}</CardTitle>
              <CardDescription>
                Frais: 1% du montant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Montant ({currency})</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={walletToCardAmount}
                  onChange={(e) => setWalletToCardAmount(e.target.value)}
                />
                {walletToCardAmount && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Frais: {calculateFees(parseFloat(walletToCardAmount), 'wallet_to_card').toLocaleString()} {currency}
                    <br />
                    Total débité: {(parseFloat(walletToCardAmount) + calculateFees(parseFloat(walletToCardAmount), 'wallet_to_card')).toLocaleString()} {currency}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">{t('financialTransferPanel.soldeWallet')}</span>
                <span className="text-lg font-bold">{walletBalance.toLocaleString()} {currency}</span>
              </div>
              <Button
                onClick={handleWalletToCard}
                disabled={loading || !selectedCard || !walletToCardAmount}
                className="w-full"
              >
                {loading ? 'Recharge en cours...' : (
                  <>
                    Recharger <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carte → Wallet */}
        <TabsContent value="card-to-wallet">
          <Card>
            <CardHeader>
              <CardTitle>{t('financialTransferPanel.rechargerLeWalletDepuisLa')}</CardTitle>
              <CardDescription>
                Frais: 1% du montant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Montant ({currency})</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={cardToWalletAmount}
                  onChange={(e) => setCardToWalletAmount(e.target.value)}
                />
                {cardToWalletAmount && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Frais: {calculateFees(parseFloat(cardToWalletAmount), 'card_to_wallet').toLocaleString()} {currency}
                    <br />
                    Total débité: {(parseFloat(cardToWalletAmount) + calculateFees(parseFloat(cardToWalletAmount), 'card_to_wallet')).toLocaleString()} {currency}
                  </p>
                )}
              </div>
              <Button
                onClick={handleCardToWallet}
                disabled={loading || !selectedCard || !cardToWalletAmount}
                className="w-full"
              >
                {loading ? 'Recharge en cours...' : (
                  <>
                    Recharger <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
