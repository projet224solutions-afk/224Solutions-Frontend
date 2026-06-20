// ============================================================================
// Dashboard Actionnaire — 224Solutions
// ============================================================================

import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';

const UniversalWalletDashboard = lazy(() => import('@/components/wallet/UniversalWalletDashboard'));
// Copilot 224 unifié (mode intégré) — remplace l'ancien CopiloteChat.
const Copilot224 = lazy(() => import('@/components/service-common/Copilot224'));
const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp, DollarSign, Bell, Vote, FileText, Wallet,
  Users, Globe, MapPin, LogOut, RefreshCw, CheckCircle,
  XCircle, Minus, ChevronRight, Package, Truck, Gift,
  Clock, Building2, CreditCard, Download, PauseCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useRoleRedirect } from '@/hooks/useRoleRedirect';
import { useShareholderDashboard } from '@/hooks/useShareholderDashboard';
import {
  CATEGORY_LABELS,
  SCOPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from '@/types/shareholder';
import type { ShareholderVote } from '@/types/shareholder';
import { downloadShareholderReceiptPdf } from '@/utils/shareholderReceiptPdf';

// ============================================================================
// Carte statistique
// ============================================================================
function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  color = 'text-foreground',
  bg = 'bg-muted/40',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl', bg)}>
            <Icon className={cn('w-5 h-5', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Badge de vote
// ============================================================================
function VoteChoiceBadge({ choice }: { choice: 'yes' | 'no' | 'abstain' | null | undefined }) {
  if (!choice) return <Badge variant="outline" className="text-xs">Non voté</Badge>;
  const map = {
    yes:     { label: 'Pour',      cls: 'bg-orange-100 text-[#ff4000]' },
    no:      { label: 'Contre',    cls: 'bg-orange-100 text-[#ff4000]' },
    abstain: { label: 'Abstention', cls: 'bg-gray-100 text-gray-600' },
  };
  const { label, cls } = map[choice];
  return <Badge className={cn('text-xs', cls)} variant="secondary">{label}</Badge>;
}

// ============================================================================
// Onglet Vue d'ensemble
// ============================================================================
function OverviewTab({
  dashboardData,
  walletBalance,
  revenues,
  payments,
  subscriptions,
  openVotes,
  unreadCount,
  onGoToWallet,
}: ReturnType<typeof useShareholderDashboard> & { onGoToWallet: () => void }) {
  const fc = useFormatCurrency();
  const sh = dashboardData?.shareholder;
  const assignment = dashboardData?.assignment;
  if (!sh || !assignment) return null;

  const recentRevenues = revenues.slice(0, 3);
  const recentPayments = payments.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Profil actionnaire */}
      <Card className="border-0 shadow-sm bg-[#04439e] text-white">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Mon compte actionnaire</p>
              <p className="text-2xl font-bold mt-1">{sh.full_name}</p>
              <div className="flex items-center gap-3 mt-2">
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  {CATEGORY_LABELS[assignment.category]}
                </Badge>
                <div className="flex items-center gap-1 text-blue-100 text-xs">
                  {assignment.action_scope === 'global'
                    ? <Globe className="w-3.5 h-3.5" />
                    : <MapPin className="w-3.5 h-3.5" />
                  }
                  {SCOPE_LABELS[assignment.action_scope]}
                  {assignment.country && ` — ${assignment.country}`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm">Ma participation</p>
              <p className="text-4xl font-black">{assignment.percentage}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="cursor-pointer" onClick={onGoToWallet}>
          <StatCard
            title="Solde wallet"
            value={walletBalance > 0 ? walletBalance.toLocaleString('fr-FR') : '— Voir →'}
            sub="Cliquer pour ouvrir"
            icon={Wallet}
            color="text-[#ff4000]"
            bg="bg-orange-50"
          />
        </div>
        <StatCard
          title="Revenus totaux"
          value={fc(dashboardData?.total_earnings ?? 0)}
          icon={TrendingUp}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          title="Abonnements actifs"
          value={new Set(
            subscriptions
              .filter((s: any) => s.status === 'active' || s.status === 'completed')
              .map((s: any) => s.user_id),
          ).size}
          sub={`${new Set(
            subscriptions
              .filter((s: any) => (s.status === 'active' || s.status === 'completed') && s.is_paid)
              .map((s: any) => s.user_id),
          ).size} payants`}
          icon={assignment.category === 'delivery_driver' ? Truck : Package}
          color="text-[#04439e]"
          bg="bg-blue-50"
        />
        <StatCard
          title="Votes ouverts"
          value={openVotes.length}
          sub={unreadCount > 0 ? `${unreadCount} notifications` : undefined}
          icon={Vote}
          color="text-orange-600"
          bg="bg-orange-50"
        />
      </div>

      {/* Derniers revenus */}
      {recentRevenues.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Derniers revenus calculés
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {recentRevenues.map(r => {
                const brut       = Number(r.total_paid_revenue_brut  ?? r.total_paid_revenue ?? 0);
                const commission = Number(r.total_agent_commission   ?? 0);
                const net        = Number(r.total_paid_revenue       ?? 0);
                const share      = Number(r.shareholder_amount       ?? 0);
                return (
                  <div key={r.id} className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                      <p className="text-xs font-medium">
                        {format(new Date(r.period_start), 'dd MMM yyyy', { locale: fr })}
                        {' → '}
                        {format(new Date(r.period_end), 'dd MMM yyyy', { locale: fr })}
                      </p>
                      <Badge className={cn('text-xs', PAYMENT_STATUS_COLORS[r.payment_status])} variant="secondary">
                        {PAYMENT_STATUS_LABELS[r.payment_status]}
                      </Badge>
                    </div>
                    <div className="px-3 py-2 space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Revenus bruts</span>
                        <span className="font-medium">{Number(brut).toLocaleString('fr-FR')} {r.currency}</span>
                      </div>
                      <div className={cn('flex justify-between', commission > 0 ? 'text-orange-600' : 'text-muted-foreground')}>
                        <span>− Commissions agents</span>
                        <span className="font-medium">{commission > 0 ? `−${Number(commission).toLocaleString('fr-FR')}` : '0'} {r.currency}</span>
                      </div>
                      <div className="flex justify-between text-[#ff4000] font-bold">
                        <span>− Ma part ({Number(r.percentage)}%)</span>
                        <span>+{Number(share).toLocaleString('fr-FR')} {r.currency}</span>
                      </div>
                      <div className="flex justify-between text-blue-700 font-semibold border-t border-dashed border-border pt-1">
                        <span>= Revenus nets plateforme</span>
                        <span>{Math.max(0, net - share).toLocaleString('fr-FR')} {r.currency}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Derniers paiements */}
      {recentPayments.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#ff4000]" />
              Derniers paiements
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(p.created_at), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-xs text-muted-foreground">Paiement</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{p.amount.toLocaleString('fr-FR')} {p.currency}</p>
                    <Badge
                      className={cn('text-xs', PAYMENT_STATUS_COLORS[p.status])}
                      variant="secondary"
                    >
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Onglet Revenus
// ============================================================================
function RevenuesTab({ revenues }: { revenues: ReturnType<typeof useShareholderDashboard>['revenues'] }) {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name ?? user?.email ?? 'Actionnaire';

  if (revenues.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Aucun revenu calculé pour le moment</p>
        <p className="text-xs mt-1">Les revenus sont calculés par le PDG chaque mois</p>
      </div>
    );
  }

  const fmt = (n: number | string | undefined, cur: string) =>
    `${Number(n || 0).toLocaleString('fr-FR')} ${cur}`;

  return (
    <div className="space-y-4">
      {revenues.map(r => {
        const brut       = Number(r.total_paid_revenue_brut  ?? r.total_paid_revenue ?? 0);
        const commission = Number(r.total_agent_commission   ?? 0);
        const net        = Number(r.total_paid_revenue       ?? 0);
        const share      = Number(r.shareholder_amount       ?? 0);
        const hasCommission = commission > 0;

        return (
          <Card key={r.id} className="border shadow-sm">
            <CardContent className="pt-4 pb-4">
              {/* En-tête : période + statut */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Période</p>
                  <p className="text-sm font-semibold">
                    {format(new Date(r.period_start), 'dd MMM yyyy', { locale: fr })}
                    {' → '}
                    {format(new Date(r.period_end), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.paid_subscriptions_count} abonnements payants
                    {r.free_subscriptions_count > 0 && ` · ${r.free_subscriptions_count} offerts`}
                  </p>
                </div>
                <Badge
                  className={cn('text-xs', PAYMENT_STATUS_COLORS[r.payment_status])}
                  variant="secondary"
                >
                  {PAYMENT_STATUS_LABELS[r.payment_status]}
                </Badge>
              </div>

              {/* Décomposition du calcul */}
              <div className="space-y-1.5">
                {/* Revenus bruts */}
                <div className="flex justify-between items-center px-3 py-2 bg-muted/40 rounded-lg">
                  <span className="text-sm text-muted-foreground">Revenus bruts encaissés</span>
                  <span className="text-sm font-semibold">{fmt(brut, r.currency)}</span>
                </div>

                {/* Commission agents — toujours visible */}
                <div className={cn(
                  'flex justify-between items-center px-3 py-2 rounded-lg',
                  hasCommission ? 'bg-orange-50' : 'bg-muted/20',
                )}>
                  <span className={cn('text-sm', hasCommission ? 'text-orange-700' : 'text-muted-foreground')}>
                    − Commissions agents déduites
                  </span>
                  <span className={cn('text-sm font-semibold', hasCommission ? 'text-orange-700' : 'text-muted-foreground')}>
                    {hasCommission ? `−${fmt(commission, r.currency)}` : `0 ${r.currency}`}
                  </span>
                </div>

                {/* Part actionnaire */}
                <div className="flex justify-between items-center px-3 py-2 bg-orange-50 rounded-lg">
                  <span className="text-sm font-bold text-[#ff4000]">
                    − Ma part ({Number(r.percentage)}%)
                  </span>
                  <span className="text-sm font-black text-[#ff4000]">+{fmt(share, r.currency)}</span>
                </div>

                {/* Séparateur */}
                <div className="border-t border-dashed border-border mx-3" />

                {/* Revenus nets plateforme */}
                <div className="flex justify-between items-center px-3 py-2 bg-blue-50 rounded-lg">
                  <span className="text-sm font-semibold text-blue-800">
                    = Revenus nets plateforme
                  </span>
                  <span className="text-sm font-bold text-blue-800">
                    {fmt(Math.max(0, net - share), r.currency)}
                  </span>
                </div>
              </div>

              {/* Bouton reçu */}
              <div className="flex justify-end mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => downloadShareholderReceiptPdf(r, userName)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger mon reçu
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================================
// Onglet Paiements
// ============================================================================
function PaymentsTab({ payments }: { payments: ReturnType<typeof useShareholderDashboard>['payments'] }) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Aucun paiement reçu pour le moment</p>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Envoyé au wallet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">
                  {format(new Date(p.created_at), 'dd MMMM yyyy', { locale: fr })}
                </TableCell>
                <TableCell className="text-right font-bold text-sm">
                  {p.amount.toLocaleString('fr-FR')} {p.currency}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn('text-xs', PAYMENT_STATUS_COLORS[p.status])}
                    variant="secondary"
                  >
                    {PAYMENT_STATUS_LABELS[p.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.sent_to_wallet_at
                    ? format(new Date(p.sent_to_wallet_at), 'dd/MM/yy HH:mm', { locale: fr })
                    : '—'
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Onglet Abonnements
// ============================================================================
// ============================================================================
// Helpers locaux pour la table abonnements
// ============================================================================
const SUB_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:    { label: 'Actif',           className: 'bg-orange-100 text-[#ff4000]' },
  expired:   { label: 'Expiré',          className: 'bg-orange-100 text-orange-800' },
  cancelled: { label: 'Annulé',          className: 'bg-orange-100 text-[#ff4000]' },
  pending:   { label: 'En attente',      className: 'bg-orange-100 text-[#ff4000]' },
  none:      { label: 'Sans abonnement', className: 'bg-gray-100 text-gray-500' },
};

const COUNTRY_NAMES: Record<string, string> = {
  GN: 'Guinée', SN: 'Sénégal', ML: 'Mali', CI: "Côte d'Ivoire",
  BF: 'Burkina', NE: 'Niger',  TG: 'Togo', BJ: 'Bénin',
  CM: 'Cameroun', CD: 'RDC',  CG: 'Congo', GA: 'Gabon',
  FR: 'France',  BE: 'Belgique',
};

// ============================================================================
// Table d'abonnements réutilisable
// ============================================================================
function SubscriptionTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Boutique / Abonné</TableHead>
          <TableHead>Pays</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Montant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 100).map((s: any) => {
          const statusCfg = SUB_STATUS_CONFIG[s.status] ?? { label: s.status ?? '—', className: 'bg-gray-100 text-gray-600' };
          const countryLabel = COUNTRY_NAMES[s.subscriber_country] ?? s.subscriber_country ?? '—';
          return (
            <TableRow key={s.id}>
              <TableCell className="text-sm font-medium">
                {s.subscriber_name ?? `${s.user_id?.slice(0, 8)}…`}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{countryLabel}
                </span>
              </TableCell>
              <TableCell>
                <Badge className={cn('text-xs', statusCfg.className)} variant="secondary">
                  {statusCfg.label}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {(s.start_date ?? s.created_at)
                  ? format(new Date(s.start_date ?? s.created_at), 'dd/MM/yy', { locale: fr })
                  : '—'
                }
              </TableCell>
              <TableCell className="text-right text-sm font-semibold">
                {(s.amount ?? 0) > 0
                  ? `${Number(s.amount).toLocaleString('fr-FR')} ${s.currency ?? 'GNF'}`
                  : <span className="text-[#04439e] font-medium text-xs">Gratuit</span>
                }
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// Section filtrée réutilisable
// ============================================================================
function SubSection({
  icon: Icon,
  title,
  count,
  rows,
  accentColor,
  emptyMsg,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  rows: any[];
  accentColor: string;
  emptyMsg: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Icon className={cn('w-4 h-4 shrink-0', accentColor)} />
        <h3 className={cn('font-semibold text-sm', accentColor)}>
          {title}
          <span className={cn(
            'ml-2 text-xs font-normal px-2 py-0.5 rounded-full',
            accentColor.includes('green')  && 'bg-orange-100 text-[#ff4000]',
            accentColor.includes('purple') && 'bg-blue-100 text-[#04439e]',
            accentColor.includes('orange') && 'bg-orange-100 text-orange-700',
            accentColor.includes('blue')   && 'bg-blue-100 text-blue-700',
          )}>
            {count}
          </span>
        </h3>
      </div>
      {rows.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-6 text-center text-muted-foreground text-sm">{emptyMsg}</CardContent>
        </Card>
      ) : (
        <Card className={cn('border-0 shadow-sm border-l-4',
          accentColor.includes('green')  && 'border-l-green-400',
          accentColor.includes('purple') && 'border-l-purple-400',
          accentColor.includes('orange') && 'border-l-orange-400',
          accentColor.includes('blue')   && 'border-l-blue-400',
        )}>
          <CardContent className="pt-3 pb-2 px-3">
            <SubscriptionTable rows={rows} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Section liste complète des vendeurs du pays
// ============================================================================
// Retourne true si l'abonnement a été offert manuellement par le PDG.
// Offert PDG : payment_method='free_gift' (créé via SubscriptionManagement)
//              OU billing_cycle='custom' (durée personnalisée donnée par PDG)
// NE PAS confondre avec billing_cycle='lifetime' qui est l'abonnement gratuit
// créé automatiquement par trigger à l'inscription d'un nouveau vendeur (payment_method='free').
function isOfferedByCeo(s: any): boolean {
  if (s.payment_method === 'free_gift') return true;
  if (s.billing_cycle === 'custom') return true;
  return false;
}

function VendorListSection({ subscriptions }: { subscriptions: any[] }) {
  type VendorRow = {
    name: string; country: string; isActive: boolean;
    payant: number;    // actif + prix > 0
    offert: number;    // actif + offert par PDG (free_gift / custom)
    gratuit: number;   // actif + plan gratuit normal (inscrit soi-même)
    expire: number;    // status = expired (payant ou gratuit)
    annule: number;    // status = cancelled
    noSub: boolean;    // aucun abonnement du tout
    totalAmount: number; currency: string;
  };

  const vendorMap = new Map<string, VendorRow>();

  subscriptions.forEach((s: any) => {
    const key = s.user_id || s.subscriber_name || 'unknown';
    if (!vendorMap.has(key)) {
      vendorMap.set(key, {
        name:        s.subscriber_name ?? 'Boutique',
        country:     COUNTRY_NAMES[s.subscriber_country] ?? s.subscriber_country ?? '—',
        isActive:    s.is_active_vendor !== false,
        payant:      0,
        offert:      0,
        gratuit:     0,
        expire:      0,
        annule:      0,
        noSub:       false,
        totalAmount: 0,
        currency:    s.currency ?? 'GNF',
      });
    }
    const v = vendorMap.get(key)!;
    const offered = isOfferedByCeo(s);

    if (s.status === 'none')                               { v.noSub = true; }
    if (s.status === 'active' && s.is_paid)                { v.payant++;  v.totalAmount += s.amount ?? 0; }
    if (s.status === 'active' && !s.is_paid && offered)    { v.offert++; }
    if (s.status === 'active' && !s.is_paid && !offered)   { v.gratuit++; }
    if (s.status === 'expired')                            { v.expire++; }
    if (s.status === 'cancelled')                          { v.annule++; }
  });

  const vendors = [...vendorMap.values()];
  if (vendors.length === 0) return null;

  return (
    <div className="space-y-3 pt-4 border-t-2 border-dashed border-gray-200">
      {/* En-tête section */}
      <div className="flex items-center gap-2 px-1">
        <Building2 className="w-5 h-5 text-gray-700 shrink-0" />
        <div>
          <h3 className="font-bold text-sm text-gray-800">
            Liste des Vendeurs du pays
          </h3>
          <p className="text-xs text-muted-foreground">
            {vendors.length} boutique{vendors.length > 1 ? 's' : ''} — Abonnements : Payant · Offert · Gratuit · Expiré
          </p>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="pl-4 font-semibold">Boutique</TableHead>
                <TableHead className="font-semibold">Pays</TableHead>
                <TableHead className="text-center font-semibold text-[#ff4000]">
                  <span className="flex items-center justify-center gap-1">
                    <CreditCard className="w-3 h-3" />Payant
                  </span>
                </TableHead>
                <TableHead className="text-center font-semibold text-[#04439e]">
                  <span className="flex items-center justify-center gap-1">
                    <Gift className="w-3 h-3" />Offert
                  </span>
                </TableHead>
                <TableHead className="text-center font-semibold text-blue-700">
                  <span className="flex items-center justify-center gap-1">
                    <Users className="w-3 h-3" />Gratuit
                  </span>
                </TableHead>
                <TableHead className="text-center font-semibold text-orange-700">
                  <span className="flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />Expiré
                  </span>
                </TableHead>
                <TableHead className="text-center font-semibold text-[#ff4000]">
                  <span className="flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" />Annulé
                  </span>
                </TableHead>
                <TableHead className="text-right font-semibold pr-4">Montant payé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v, idx) => (
                <TableRow
                  key={idx}
                  className={cn(
                    'hover:bg-gray-50/50 transition-colors',
                    v.noSub && v.payant === 0 && v.offert === 0 && v.gratuit === 0 && v.expire === 0
                      && 'opacity-50 italic',
                  )}
                >
                  {/* Nom boutique + badge actif/inactif */}
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{v.name}</span>
                      {!v.isActive && (
                        <Badge className="bg-gray-100 text-gray-500 text-xs" variant="secondary">Inactif</Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Pays */}
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{v.country}
                    </span>
                  </TableCell>

                  {/* Payant */}
                  <TableCell className="text-center">
                    {v.payant > 0
                      ? <Badge className="bg-orange-100 text-[#ff4000] font-bold text-xs min-w-[1.5rem]" variant="secondary">{v.payant}</Badge>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </TableCell>

                  {/* Offert PDG */}
                  <TableCell className="text-center">
                    {v.offert > 0
                      ? <Badge className="bg-blue-100 text-[#04439e] font-bold text-xs min-w-[1.5rem]" variant="secondary">{v.offert}</Badge>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </TableCell>

                  {/* Gratuit — plan free normal (pas cadeau PDG) */}
                  <TableCell className="text-center">
                    {v.gratuit > 0
                      ? <Badge className="bg-blue-100 text-blue-800 font-bold text-xs min-w-[1.5rem]" variant="secondary">{v.gratuit}</Badge>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </TableCell>

                  {/* Expiré */}
                  <TableCell className="text-center">
                    {v.expire > 0
                      ? <Badge className="bg-orange-100 text-orange-800 font-bold text-xs min-w-[1.5rem]" variant="secondary">{v.expire}</Badge>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </TableCell>

                  {/* Annulé */}
                  <TableCell className="text-center">
                    {v.annule > 0
                      ? <Badge className="bg-orange-100 text-[#ff4000] font-bold text-xs min-w-[1.5rem]" variant="secondary">{v.annule}</Badge>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </TableCell>

                  {/* Montant total payé */}
                  <TableCell className="text-right pr-4 text-sm font-semibold">
                    {v.totalAmount > 0
                      ? `${v.totalAmount.toLocaleString('fr-FR')} ${v.currency}`
                      : <span className="text-gray-400 text-xs font-normal">
                          {v.noSub && v.offert === 0 ? 'Aucun abonnement' : '—'}
                        </span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type FilterKey = 'payant' | 'offert' | 'gratuit' | 'expire' | 'annule' | 'total';

const FILTER_CONFIG: Record<FilterKey, {
  label: string;
  description: string;
  selectedBg: string;
  ring: string;
  textColor: string;
}> = {
  payant:  { label: 'Abonnements payants actifs',   description: 'Vendeurs avec abonnement payant actif',       selectedBg: 'bg-orange-100',  ring: 'ring-[#ff4000]',  textColor: 'text-[#ff4000]'  },
  offert:  { label: 'Offerts par le PDG',           description: 'Tous les abonnements offerts par le PDG (actifs + expirés)',  selectedBg: 'bg-blue-100', ring: 'ring-[#04439e]', textColor: 'text-[#04439e]' },
  gratuit: { label: 'Comptes sur plan gratuit',     description: 'Vendeurs inscrits sur le plan gratuit',       selectedBg: 'bg-blue-100',   ring: 'ring-blue-500',   textColor: 'text-blue-700'   },
  expire:  { label: 'Abonnements expirés',          description: 'Vendeurs avec au moins un abonnement expiré', selectedBg: 'bg-orange-100', ring: 'ring-orange-500', textColor: 'text-orange-700' },
  annule:  { label: 'Abonnements annulés',          description: 'Vendeurs avec au moins un abonnement annulé', selectedBg: 'bg-orange-100',    ring: 'ring-[#ff4000]',    textColor: 'text-[#ff4000]'    },
  total:   { label: 'Tous les vendeurs',            description: 'Vue complète de tous les vendeurs du pays',   selectedBg: 'bg-orange-100',   ring: 'ring-[#ff4000]',   textColor: 'text-[#ff4000]'   },
};

// ============================================================================
// Onglet Abonnements — 6 compteurs cliquables + liste vendeurs filtrée
// ============================================================================
function SubscriptionsTab({
  subscriptions,
}: Pick<ReturnType<typeof useShareholderDashboard>, 'subscriptions' | 'paidSubs' | 'freeSubs'>) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('total');

  // ── Groupes calculés ─────────────────────────────────────────────────────
  const activePaid      = subscriptions.filter((s: any) => s.status === 'active' && s.is_paid);
  // Offerts PDG = TOUS statuts (actifs + expirés) : billing_cycle=custom OU payment_method=free_gift
  const allOfferedByPDG = subscriptions.filter((s: any) => isOfferedByCeo(s));
  // Gratuits = actifs, non-payants, non-offerts PDG
  const activeGratuit   = subscriptions.filter((s: any) => s.status === 'active' && !s.is_paid && !isOfferedByCeo(s));
  // Expirés = expirés hors offerts PDG (les offerts PDG expirés sont déjà dans allOfferedByPDG)
  const expiredSubs     = subscriptions.filter((s: any) => s.status === 'expired' && !isOfferedByCeo(s));
  const cancelledSubs   = subscriptions.filter((s: any) => s.status === 'cancelled');
  const totalSubs       = activePaid.length + allOfferedByPDG.length + activeGratuit.length + expiredSubs.length + cancelledSubs.length;

  // ── Filtrage des vendors selon la carte sélectionnée ────────────────────
  const filteredSubscriptions = (() => {
    if (activeFilter === 'total') return subscriptions;
    const source =
      activeFilter === 'payant'  ? activePaid      :
      activeFilter === 'offert'  ? allOfferedByPDG :
      activeFilter === 'gratuit' ? activeGratuit   :
      activeFilter === 'expire'  ? expiredSubs     :
      activeFilter === 'annule'  ? cancelledSubs   :
      subscriptions;
    const ids = new Set(source.map((s: any) => s.user_id));
    // On garde TOUTES les lignes du vendeur pour afficher son profil complet
    return subscriptions.filter((s: any) => ids.has(s.user_id));
  })();

  const handleFilter = (key: FilterKey) => {
    setActiveFilter(prev => prev === key ? 'total' : key);
  };

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Aucun abonnement dans votre périmètre</p>
      </div>
    );
  }

  const cfg = FILTER_CONFIG[activeFilter];

  return (
    <div className="space-y-5">

      {/* ── 6 cartes cliquables ── */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">

        {/* Payant */}
        <button
          type="button"
          onClick={() => handleFilter('payant')}
          className={cn(
            'text-left rounded-xl p-3 shadow-sm border transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus:outline-none',
            activeFilter === 'payant'
              ? 'bg-orange-100 ring-2 ring-[#ff4000] ring-offset-1 border-orange-300'
              : 'bg-orange-50 border-transparent',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <CreditCard className="w-3.5 h-3.5 text-[#ff4000]" />
            <p className="text-xs text-[#ff4000] font-medium">Abonnements</p>
          </div>
          <p className="text-2xl font-bold text-[#ff4000]">{activePaid.length}</p>
          <p className="text-xs text-[#ff4000] mt-0.5">Vendeurs payants actifs</p>
        </button>

        {/* Offert */}
        <button
          type="button"
          onClick={() => handleFilter('offert')}
          className={cn(
            'text-left rounded-xl p-3 shadow-sm border transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus:outline-none',
            activeFilter === 'offert'
              ? 'bg-blue-100 ring-2 ring-[#04439e] ring-offset-1 border-blue-300'
              : 'bg-blue-50 border-transparent',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Gift className="w-3.5 h-3.5 text-[#04439e]" />
            <p className="text-xs text-[#04439e] font-medium">Offerts</p>
          </div>
          <p className="text-2xl font-bold text-[#04439e]">{allOfferedByPDG.length}</p>
          <p className="text-xs text-[#04439e] mt-0.5">Offerts par le PDG</p>
        </button>

        {/* Gratuit */}
        <button
          type="button"
          onClick={() => handleFilter('gratuit')}
          className={cn(
            'text-left rounded-xl p-3 shadow-sm border transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus:outline-none',
            activeFilter === 'gratuit'
              ? 'bg-blue-100 ring-2 ring-blue-500 ring-offset-1 border-blue-300'
              : 'bg-blue-50 border-transparent',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs text-blue-700 font-medium">Gratuits</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{activeGratuit.length}</p>
          <p className="text-xs text-blue-600 mt-0.5">Plan gratuit inscrit</p>
        </button>

        {/* Expiré */}
        <button
          type="button"
          onClick={() => handleFilter('expire')}
          className={cn(
            'text-left rounded-xl p-3 shadow-sm border transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus:outline-none',
            activeFilter === 'expire'
              ? 'bg-orange-100 ring-2 ring-orange-500 ring-offset-1 border-orange-300'
              : 'bg-orange-50 border-transparent',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <p className="text-xs text-orange-700 font-medium">Expirés</p>
          </div>
          <p className="text-2xl font-bold text-orange-700">{expiredSubs.length}</p>
          <p className="text-xs text-orange-600 mt-0.5">Abonnements expirés</p>
        </button>

        {/* Annulé */}
        <button
          type="button"
          onClick={() => handleFilter('annule')}
          className={cn(
            'text-left rounded-xl p-3 shadow-sm border transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus:outline-none',
            activeFilter === 'annule'
              ? 'bg-orange-100 ring-2 ring-[#ff4000] ring-offset-1 border-orange-300'
              : 'bg-orange-50 border-transparent',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle className="w-3.5 h-3.5 text-[#ff4000]" />
            <p className="text-xs text-[#ff4000] font-medium">Annulés</p>
          </div>
          <p className="text-2xl font-bold text-[#ff4000]">{cancelledSubs.length}</p>
          <p className="text-xs text-[#ff4000] mt-0.5">Abonnements annulés</p>
        </button>

        {/* Total */}
        <button
          type="button"
          onClick={() => handleFilter('total')}
          className={cn(
            'text-left rounded-xl p-3 shadow-sm border transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus:outline-none',
            activeFilter === 'total'
              ? 'bg-orange-100 ring-2 ring-[#ff4000] ring-offset-1 border-orange-300'
              : 'bg-orange-50 border-transparent',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Building2 className="w-3.5 h-3.5 text-[#ff4000]" />
            <p className="text-xs text-[#ff4000] font-medium">Total</p>
          </div>
          <p className="text-2xl font-bold text-[#ff4000]">{totalSubs}</p>
          <p className="text-xs text-[#ff4000] mt-0.5">Total abonnements</p>
        </button>

      </div>

      {/* ── Bandeau contextuel du filtre actif ── */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
        cfg.selectedBg, cfg.textColor,
      )}>
        <ChevronRight className="w-4 h-4 shrink-0" />
        <span>{cfg.label}</span>
        <span className="ml-auto text-xs font-normal opacity-70">{cfg.description}</span>
      </div>

      {/* ── Liste des vendeurs (filtrée selon carte active) ── */}
      <VendorListSection subscriptions={filteredSubscriptions} />

    </div>
  );
}

// ============================================================================
// Onglet Votes
// ============================================================================
function VotesTab({
  votes,
  openVotes,
  onVote,
}: {
  votes: ReturnType<typeof useShareholderDashboard>['votes'];
  openVotes: ReturnType<typeof useShareholderDashboard>['openVotes'];
  onVote: (voteId: string, choice: 'yes' | 'no' | 'abstain') => Promise<void>;
}) {
  const [voting, setVoting] = useState<string | null>(null);

  const handleVote = async (vote: ShareholderVote, choice: 'yes' | 'no' | 'abstain') => {
    setVoting(vote.id);
    await onVote(vote.id, choice);
    setVoting(null);
  };

  if (votes.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Vote className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Aucune résolution en cours</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Votes ouverts */}
      {openVotes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#ff4000]">
            <Vote className="w-4 h-4" />
            Votes en cours ({openVotes.length})
          </h3>
          {openVotes.map(vote => (
            <Card key={vote.id} className="border-orange-200 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{vote.title}</p>
                    {vote.description && (
                      <p className="text-xs text-muted-foreground mt-1">{vote.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Clôture: {format(new Date(vote.end_date), 'dd MMMM yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <VoteChoiceBadge choice={vote.my_response} />
                </div>
                {!vote.my_response && (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-[#ff4000] text-[#ff4000] hover:bg-orange-50 h-8 text-xs"
                      disabled={voting === vote.id}
                      onClick={() => handleVote(vote, 'yes')}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Pour
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-[#ff4000] text-[#ff4000] hover:bg-orange-50 h-8 text-xs"
                      disabled={voting === vote.id}
                      onClick={() => handleVote(vote, 'no')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Contre
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      disabled={voting === vote.id}
                      onClick={() => handleVote(vote, 'abstain')}
                    >
                      <Minus className="w-3.5 h-3.5 mr-1" />
                      Abstention
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Votes passés (fermés, annulés, ou ouverts dont la date est dépassée) */}
      {votes.filter(v => v.status !== 'open' || (v.end_date && new Date(v.end_date) <= new Date())).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Votes passés</h3>
          {votes.filter(v => v.status !== 'open' || (v.end_date && new Date(v.end_date) <= new Date())).map(vote => {
            const total = vote.total_votes ?? 0;
            return (
              <Card key={vote.id} className="border-0 shadow-sm bg-muted/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{vote.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {vote.end_date ? format(new Date(vote.end_date), 'dd/MM/yy', { locale: fr }) : '—'}
                      </p>
                      {total > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#ff4000] font-medium">{vote.total_yes ?? 0} pour</span>
                          <span className="text-xs text-[#ff4000] font-medium">{vote.total_no ?? 0} contre</span>
                          <span className="text-xs text-muted-foreground">{vote.total_abstain ?? 0} abstention</span>
                          <span className="text-xs text-muted-foreground">({total} votant{total > 1 ? 's' : ''})</span>
                        </div>
                      )}
                    </div>
                    <VoteChoiceBadge choice={vote.my_response} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Onglet Documents
// ============================================================================
function DocumentsTab({ documents }: { documents: ReturnType<typeof useShareholderDashboard>['documents'] }) {
  const DOC_TYPE_LABELS: Record<string, string> = {
    shareholder_contract:    'Contrat actionnaire',
    payment_receipt:         'Reçu de paiement',
    monthly_report:          'Rapport mensuel',
    financial_report:        'Rapport financier',
    meeting_minutes:         'PV de réunion',
    participation_certificate: 'Certificat de participation',
    tax_document:            'Document fiscal',
    other:                   'Autre',
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Aucun document disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map(doc => (
        <Card key={doc.id} className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: fr })}
                    </span>
                  </div>
                </div>
              </div>
              {doc.file_url && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs shrink-0"
                  onClick={() => window.open(doc.file_url!, '_blank')}
                >
                  Télécharger
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Onglet Notifications
// ============================================================================
function NotificationsTab({
  notifications,
  onMarkRead,
}: {
  notifications: ReturnType<typeof useShareholderDashboard>['notifications'];
  onMarkRead: (id: string) => Promise<void>;
}) {
  if (notifications.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Aucune notification</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((n: any) => (
        <Card
          key={n.id}
          className={cn(
            'border-0 shadow-sm cursor-pointer transition-colors',
            !n.read && 'bg-blue-50 border-blue-100',
          )}
          onClick={() => !n.read && onMarkRead(n.id)}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className={cn(
                  'w-2 h-2 rounded-full mt-1.5 shrink-0',
                  !n.read ? 'bg-blue-500' : 'bg-gray-300',
                )} />
                <div>
                  <p className={cn('text-sm', !n.read && 'font-medium')}>{n.message ?? n.title ?? 'Notification'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {n.created_at
                      ? format(new Date(n.created_at), 'dd MMM yyyy HH:mm', { locale: fr })
                      : ''
                    }
                  </p>
                </div>
              </div>
              {!n.read && (
                <Badge className="bg-blue-100 text-blue-700 text-xs shrink-0" variant="secondary">
                  Nouveau
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Page principale
// ============================================================================
export default function ActionnaireDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  useRoleRedirect();

  const [activeTab, setActiveTab] = useState('overview');

  const {
    dashboardData,
    revenues,
    payments,
    documents,
    votes,
    openVotes,
    notifications,
    subscriptions,
    paidSubs,
    freeSubs,
    walletBalance,
    userCode,
    unreadCount,
    loading,
    loadError,
    isSuspended,
    refetch,
    markNotificationRead,
    submitVote,
  } = useShareholderDashboard();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleVote = async (voteId: string, choice: 'yes' | 'no' | 'abstain') => {
    await submitVote(voteId, choice);
    await refetch();
  };

  // ---- État de chargement ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-muted-foreground text-sm">Chargement de votre espace…</p>
        </div>
      </div>
    );
  }

  // ---- Erreur API ----
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <XCircle className="w-12 h-12 mx-auto text-[#ff4000]" />
            <div>
              <p className="font-semibold text-lg">Erreur de connexion</p>
              <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Réessayer
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')}>
                Retour à l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Compte suspendu ----
  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <PauseCircle className="w-14 h-14 mx-auto text-orange-400" />
            <div>
              <p className="font-semibold text-xl">Compte suspendu</p>
              <p className="text-sm text-muted-foreground mt-2">
                Votre compte actionnaire a été suspendu par l'administration 224 Solutions.
                Contactez l'équipe pour plus d'informations.
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Pas de compte actionnaire ----
  if (!dashboardData?.shareholder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Users className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
            <div>
              <p className="font-semibold text-lg">Accès non autorisé</p>
              <p className="text-sm text-muted-foreground mt-1">
                Votre compte n'est pas encore configuré comme actionnaire.
                Contactez l'administration.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Espace Actionnaire</p>
              <p className="text-xs text-muted-foreground leading-tight">224Solutions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge
                className="bg-[#ff4000] text-white text-xs cursor-pointer"
                onClick={() => setActiveTab('notifications')}
              >
                {unreadCount}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-8 text-xs text-muted-foreground"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-4xl mx-auto px-4 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full mb-5 h-9 overflow-x-auto">
            <TabsTrigger value="overview"       className="text-xs flex-1 min-w-fit">Accueil</TabsTrigger>
            <TabsTrigger value="wallet"         className="text-xs flex-1 min-w-fit">Wallet</TabsTrigger>
            <TabsTrigger value="revenues"       className="text-xs flex-1 min-w-fit">Revenus</TabsTrigger>
            <TabsTrigger value="payments"       className="text-xs flex-1 min-w-fit">Paiements</TabsTrigger>
            <TabsTrigger value="subscriptions"  className="text-xs flex-1 min-w-fit">Abonnements</TabsTrigger>
            <TabsTrigger value="purchases"      className="text-xs flex-1 min-w-fit">Mes achats</TabsTrigger>
            <TabsTrigger value="votes"          className="relative text-xs flex-1 min-w-fit">
              Votes
              {openVotes.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 text-white rounded-full text-[9px] flex items-center justify-center">
                  {openVotes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="notifications"  className="relative text-xs flex-1 min-w-fit">
              Notifs
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#ff4000] text-white rounded-full text-[9px] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="copilote"       className="text-xs flex-1 min-w-fit">Copilote IA</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              dashboardData={dashboardData}
              walletBalance={walletBalance}
              revenues={revenues}
              payments={payments}
              documents={documents}
              subscriptions={subscriptions}
              paidSubs={paidSubs}
              freeSubs={freeSubs}
              votes={votes}
              openVotes={openVotes}
              notifications={notifications}
              unreadCount={unreadCount}
              userCode={userCode}
              loading={loading}
              loadError={loadError}
              isSuspended={isSuspended}
              refetch={refetch}
              markNotificationRead={markNotificationRead}
              submitVote={submitVote}
              onGoToWallet={() => setActiveTab('wallet')}
            />
          </TabsContent>

          {/* Onglet Wallet — composant complet avec dépôt/retrait/historique */}
          <TabsContent value="wallet">
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            }>
              <UniversalWalletDashboard
                userId={user?.id || ''}
                userCode={userCode}
                showTransactions={true}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="revenues">
            <RevenuesTab revenues={revenues} />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab payments={payments} />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionsTab
              subscriptions={subscriptions}
              paidSubs={paidSubs}
              freeSubs={freeSubs}
            />
          </TabsContent>

          <TabsContent value="purchases">
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            }>
              <MyPurchasesOrdersList />
            </Suspense>
          </TabsContent>

          <TabsContent value="votes">
            <VotesTab votes={votes} openVotes={openVotes} onVote={handleVote} />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab notifications={notifications} onMarkRead={markNotificationRead} />
          </TabsContent>

          {/* Onglet Copilote IA */}
          <TabsContent value="copilote">
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            }>
              <Copilot224
                variant="embedded"
                service=""
                title="Copilot 224"
                height="calc(100vh - 200px)"
              />
            </Suspense>
          </TabsContent>
        </Tabs>

        {/* Documents — onglet supplémentaire au-dessous si documents */}
        {documents.length > 0 && activeTab === 'overview' && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Documents récents
            </h3>
            <DocumentsTab documents={documents.slice(0, 3)} />
          </div>
        )}
      </main>
    </div>
  );
}
