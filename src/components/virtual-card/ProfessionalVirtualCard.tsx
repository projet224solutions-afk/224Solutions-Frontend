import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVirtualCard } from '@/hooks/useVirtualCard';
import { toast } from 'sonner';
import {
  CreditCard,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Wifi,
  Lock,
  Shield,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Snowflake,
  ShoppingBag,
  Receipt,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardTransactionsHistory } from './CardTransactionsHistory';
import { CardPaymentDialog } from './CardPaymentDialog';

interface VirtualCardData {
  id: string;
  card_number: string;
  expiry_date: string;
  status: string;
  cvv: string;
  holder_name: string | null;
  daily_limit: number | null;
  monthly_limit: number | null;
  daily_spent?: number;
  monthly_spent?: number;
  total_spent?: number;
  transaction_count?: number;
}

interface WalletData {
  id: string | number;
  balance: number;
  currency: string;
}

// ── Génération sécurisée (crypto) d'un numéro de carte Luhn-valide ──
function secureRandomInt(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  // Rejet du biais modulo pour une distribution uniforme
  const limit = Math.floor(0xffffffff / max) * max;
  while (arr[0] >= limit) crypto.getRandomValues(arr);
  return arr[0] % max;
}

function luhnCheckDigit(partial: string): number {
  let sum = 0;
  let double = true; // le chiffre de contrôle sera ajouté à droite
  for (let i = partial.length - 1; i >= 0; i--) {
    let d = partial.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

function generateSecureCardNumber(): string {
  // BIN interne 224PAY (préfixe Mastercard-like, carte FICTIVE interne) + corps aléatoire + Luhn
  const bin = '524500';
  let body = '';
  for (let i = 0; i < 9; i++) body += secureRandomInt(10).toString();
  const partial = bin + body; // 15 chiffres
  return partial + luhnCheckDigit(partial).toString(); // 16 chiffres, Luhn-valide
}

export const ProfessionalVirtualCard = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { loadStats, toggleCardStatus, stats } = useVirtualCard();
  const [card, setCard] = useState<VirtualCardData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [open, setOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('card');

  useEffect(() => {
    if (user) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // La carte opère sur le wallet GNF (devise de base débitée par process_card_payment).
      // On affiche/utilise donc CE wallet pour que l'écran reflète la réalité du débit.
      const [walletRes, cardRes] = await Promise.all([
        supabase.from('wallets').select('id, balance, currency').eq('user_id', user.id).eq('currency', 'GNF').maybeSingle(),
        supabase.from('virtual_cards').select('*').eq('user_id', user.id).maybeSingle()
      ]);
      // Repli : si pas de wallet GNF, prendre n'importe quel wallet (affichage seulement)
      let walletData = walletRes.data;
      if (!walletData) {
        const { data: anyWallet } = await supabase.from('wallets').select('id, balance, currency').eq('user_id', user.id).maybeSingle();
        walletData = anyWallet;
      }
      setWallet(walletData);
      setCard(cardRes.data);

      // Charger les stats si la carte existe
      if (cardRes.data?.id) {
        await loadStats(cardRes.data.id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCard = async () => {
    if (!user || !wallet) {
      toast.error(t('professionalVirtualCard.unWalletActifEstRequis'));
      return;
    }
    setCreating(true);
    try {
      const cardNumber = generateSecureCardNumber();
      const cvv = secureRandomInt(1000).toString().padStart(3, '0');
      const expiry = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000);
      const holderName = profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`.toUpperCase()
        : 'UTILISATEUR 224PAY';

      const { error } = await supabase.from('virtual_cards').insert({
        user_id: user.id,
        card_number: cardNumber,
        holder_name: holderName,
        expiry_date: expiry.toISOString(),
        cvv,
        daily_limit: 1000000,
        monthly_limit: 10000000,
        status: 'active'
      });

      if (error) throw error;
      toast.success(t('professionalVirtualCard.carteVirtuelleCreeeAvecSucces'));
      await loadData();
    } catch (error) {
      console.error('Error creating card:', error);
      toast.error(t('professionalVirtualCard.erreurLorsDeLaCreation'));
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié !`);
  };

  const formatCardNumber = (num: string, masked = true) => {
    if (masked) return num.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1 •••• •••• $4');
    return num.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (date: string) => {
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      active: { color: 'bg-[#ff4000]', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Active' },
      inactive: { color: 'bg-blue-500', icon: <Snowflake className="w-3 h-3" />, label: 'Gelée' },
      frozen: { color: 'bg-blue-500', icon: <Snowflake className="w-3 h-3" />, label: 'Gelée' },
      blocked: { color: 'bg-[#ff4000]', icon: <AlertTriangle className="w-3 h-3" />, label: 'Bloquée' }
    };
    return configs[status] || configs.active;
  };

  if (loading) {
    return (
      <Button disabled variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Chargement...
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={card ? "default" : "outline"}
          className={cn(
            "gap-2 transition-all",
            card && "bg-[#04439e]"
          )}
        >
          <CreditCard className="w-4 h-4" />
          {card ? 'Ma Carte' : 'Créer une Carte'}
          {card && <CheckCircle2 className="w-3 h-3 text-orange-300" />}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg p-0 overflow-hidden bg-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div className="p-2 bg-[#04439e] rounded-lg">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <span>Carte Virtuelle 224PAY</span>
              {card && (
                <Badge className={cn("ml-auto", getStatusConfig(card.status).color)}>
                  {getStatusConfig(card.status).icon}
                  <span className="ml-1">{getStatusConfig(card.status).label}</span>
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {card ? (
            <div className="space-y-4">
              {/* Card Visual */}
              <div
                className="relative cursor-pointer perspective-1000"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className={cn(
                  "relative w-full aspect-[1.586/1] rounded-2xl transition-all duration-700 transform-style-preserve-3d",
                  isFlipped && "rotate-y-180"
                )}>
                  {/* Front */}
                  <div className={cn(
                    "absolute inset-0 backface-hidden",
                    isFlipped && "invisible"
                  )}>
                    <div className="w-full h-full rounded-2xl bg-[#04439e] p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
                      {/* Background Pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/20" />
                        <div className="absolute -left-20 -bottom-20 w-60 h-60 rounded-full bg-white/10" />
                      </div>

                      {/* Header */}
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                          <div className="text-white font-bold text-lg tracking-wider">224PAY</div>
                          <Badge variant="outline" className="text-white/80 border-white/30 text-xs">
                            PREMIUM
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Wifi className="w-5 h-5 text-white/80 rotate-90" />
                          <Shield className="w-5 h-5 text-white/80" />
                        </div>
                      </div>

                      {/* Chip */}
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-9 rounded-md bg-orange-300 flex items-center justify-center">
                          <div className="w-8 h-6 border-2 border-[#ff4000]/50 rounded-sm" />
                        </div>
                      </div>

                      {/* Card Number */}
                      <div className="space-y-2 relative z-10">
                        <div className="flex items-center gap-2">
                          <p className="text-white/60 text-xs font-medium tracking-wider">{t('professionalVirtualCard.numeroDeCarte')}</p>
                          {showDetails && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 text-white/60 hover:text-white hover:bg-white/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(card.card_number, 'Numéro');
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-white text-xl font-mono tracking-[0.2em]">
                            {formatCardNumber(card.card_number, !showDetails)}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white/60 hover:text-white hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDetails(!showDetails);
                            }}
                          >
                            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-end justify-between relative z-10">
                        <div>
                          <p className="text-white/60 text-xs font-medium tracking-wider mb-1">TITULAIRE</p>
                          <p className="text-white font-semibold tracking-wide text-sm">{card.holder_name || 'UTILISATEUR'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/60 text-xs font-medium tracking-wider mb-1">EXPIRE</p>
                          <p className="text-white font-semibold">{formatExpiry(card.expiry_date)}</p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex">
                            <div className="w-8 h-8 rounded-full bg-[#ff4000] opacity-80" />
                            <div className="w-8 h-8 rounded-full bg-[#ff4000] opacity-80 -ml-3" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Back */}
                  <div className={cn(
                    "absolute inset-0 backface-hidden rotate-y-180",
                    !isFlipped && "invisible"
                  )}>
                    <div className="w-full h-full rounded-2xl bg-slate-700 flex flex-col shadow-2xl overflow-hidden">
                      {/* Magnetic Strip */}
                      <div className="w-full h-12 bg-slate-900 mt-6" />

                      {/* Signature & CVV */}
                      <div className="flex-1 p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-10 bg-white/90 rounded flex items-center px-3">
                            <span className="text-slate-400 italic text-sm">{card.holder_name}</span>
                          </div>
                          <div className="bg-white px-4 py-2 rounded">
                            <p className="text-xs text-slate-500 mb-1">CVV</p>
                            <p className="text-slate-900 font-mono font-bold text-lg tracking-wider">
                              {showDetails ? card.cvv : '•••'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 text-center">
                          <p className="text-white/60 text-xs">
                            Cette carte est la propriété de 224PAY. En cas de perte, veuillez la retourner.
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-6 pb-4 flex items-center justify-between">
                        <div className="text-white/60 text-xs">
                          <Lock className="w-3 h-3 inline mr-1" />
                          Sécurisée par 224PAY
                        </div>
                        <div className="text-white/60 text-xs">224SOLUTIONS</div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-center text-white/40 text-xs mt-2">
                  Cliquez pour retourner la carte
                </p>
              </div>

              {/* Wallet Info */}
              {wallet && (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#ff4000]/20 rounded-lg">
                          <Zap className="w-5 h-5 text-[#ff4000]" />
                        </div>
                        <div>
                          <p className="text-white/60 text-xs">{t('professionalVirtualCard.soldeDisponible')}</p>
                          <p className="text-white font-bold text-xl">
                            <Money amount={wallet.balance} from={wallet.currency || 'GNF'} />
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]/30">
                        Lié
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Limites Info avec Stats temps réel */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-3">
                    <p className="text-white/60 text-xs mb-1">{t('professionalVirtualCard.depenseAujourdHui')}</p>
                    <p className="text-white font-semibold">
                      <Money amount={stats?.daily_spent || card.daily_spent || 0} from="GNF" />
                    </p>
                    <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#04439e]"
                        style={{
                          width: `${Math.min(100, ((stats?.daily_spent || 0) / (card.daily_limit || 1)) * 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-white/40 text-[10px] mt-1">
                      Limite: <Money amount={card.daily_limit || 0} from="GNF" />
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-3">
                    <p className="text-white/60 text-xs mb-1">{t('professionalVirtualCard.depenseCeMois')}</p>
                    <p className="text-white font-semibold">
                      <Money amount={stats?.monthly_spent || card.monthly_spent || 0} from="GNF" />
                    </p>
                    <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#04439e]"
                        style={{
                          width: `${Math.min(100, ((stats?.monthly_spent || 0) / (card.monthly_limit || 1)) * 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-white/40 text-[10px] mt-1">
                      Limite: <Money amount={card.monthly_limit || 0} from="GNF" />
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Boutons d'action */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => setPaymentDialogOpen(true)}
                  className="bg-[#04439e]"
                  disabled={card.status !== 'active'}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Payer
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const newStatus = card.status === 'active' ? 'inactive' : 'active';
                    const success = await toggleCardStatus(card.id, newStatus);
                    if (success) loadData();
                  }}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  {card.status === 'active' ? (
                    <>
                      <Snowflake className="w-4 h-4 mr-2" />
                      Geler
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Activer
                    </>
                  )}
                </Button>
              </div>

              {/* Onglets: Historique / Stats */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="grid w-full grid-cols-2 bg-white/5">
                  <TabsTrigger value="card" className="data-[state=active]:bg-white/10">
                    <Receipt className="w-4 h-4 mr-2" />
                    Historique
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="data-[state=active]:bg-white/10">
                    <Settings className="w-4 h-4 mr-2" />
                    Infos
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="card" className="mt-4">
                  <CardTransactionsHistory cardId={card.id} />
                </TabsContent>

                <TabsContent value="stats" className="mt-4">
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">{t('professionalVirtualCard.totalDepense')}</span>
                        <span className="text-white font-medium">
                          <Money amount={stats?.total_spent || card.total_spent || 0} from="GNF" />
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Transactions</span>
                        <span className="text-white font-medium">
                          {stats?.transaction_count || card.transaction_count || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Statut</span>
                        <Badge className={cn(
                          card.status === 'active' ? 'bg-[#ff4000]' :
                          (card.status === 'frozen' || card.status === 'inactive') ? 'bg-blue-500' : 'bg-[#ff4000]'
                        )}>
                          {card.status === 'active' ? 'Active' :
                           (card.status === 'frozen' || card.status === 'inactive') ? 'Gelée' : 'Bloquée'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview Card */}
              <div className="relative">
                <div className="w-full aspect-[1.586/1] rounded-2xl bg-slate-600/50 p-6 flex flex-col justify-between border border-dashed border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="text-white/40 font-bold text-lg">224PAY</div>
                    <Badge variant="outline" className="text-white/40 border-white/20">PREVIEW</Badge>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                      <Plus className="w-8 h-8 text-white/40" />
                    </div>
                    <p className="text-white/60 text-sm">{t('professionalVirtualCard.creezVotreCarteVirtuelle')}</p>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-white/30 text-sm">•••• •••• •••• ••••</div>
                    <div className="flex">
                      <div className="w-6 h-6 rounded-full bg-white/20" />
                      <div className="w-6 h-6 rounded-full bg-white/10 -ml-2" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle2 className="w-5 h-5 text-[#ff4000]" />
                  <span className="text-sm">{t('professionalVirtualCard.paiementsEnLigneSecurises')}</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle2 className="w-5 h-5 text-[#ff4000]" />
                  <span className="text-sm">{t('professionalVirtualCard.limiteJournaliere1000000')}</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle2 className="w-5 h-5 text-[#ff4000]" />
                  <span className="text-sm">{t('professionalVirtualCard.activationInstantanee')}</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle2 className="w-5 h-5 text-[#ff4000]" />
                  <span className="text-sm">{t('professionalVirtualCard.debitAutomatiqueDuWallet')}</span>
                </div>
              </div>

              {/* Wallet Requirement */}
              {!wallet ? (
                <Card className="bg-[#ff4000]/10 border-[#ff4000]/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
                      <div>
                        <p className="text-[#ff4000] font-medium text-sm">Wallet requis</p>
                        <p className="text-white/60 text-xs">
                          Vous devez avoir un wallet actif pour créer une carte virtuelle.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  onClick={createCard}
                  disabled={creating}
                  className="w-full bg-[#04439e] h-12 text-base"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Créer ma carte virtuelle
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Payment Dialog */}
        {card && wallet && (
          <CardPaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            cardId={card.id}
            walletBalance={wallet.balance}
            dailyRemaining={stats?.daily_remaining || (card.daily_limit || 0) - (card.daily_spent || 0)}
            monthlyRemaining={stats?.monthly_remaining || (card.monthly_limit || 0) - (card.monthly_spent || 0)}
            onSuccess={loadData}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfessionalVirtualCard;
