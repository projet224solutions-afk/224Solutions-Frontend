import { useTranslation } from "@/hooks/useTranslation";
// ============================================================================
// Onglet PDG: Gestion des Actionnaires
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Users, TrendingUp, DollarSign, PlusCircle, RefreshCw,
  CheckCircle, Send, Edit, Activity, Percent, Globe, MapPin,
  Calculator, FileText, AlertCircle, Download,
  PauseCircle, PlayCircle, ArrowRightLeft, Trash2, AlertTriangle,
  Vote, Lock, XCircle, Eye,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useShareholders } from '@/hooks/useShareholders';
import { useAuth } from '@/hooks/useAuth';
import { shareholderService } from '@/services/shareholderService';
import AddShareholderForm from './AddShareholderForm';
import {
  CATEGORY_LABELS,
  SCOPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  VOTE_TARGET_LABELS,
} from '@/types/shareholder';
import type { Shareholder, ShareholderRevenue, RevenueCalculationResult, ShareholderVote, CreateVoteDto } from '@/types/shareholder';
import { downloadShareholderReceiptPdf } from '@/utils/shareholderReceiptPdf';

// ============================================================================
// Carte statistique
// ============================================================================
function StatCard({
  title, value, icon: Icon, color, sub,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl', color.includes('blue') ? 'bg-blue-50' : color.includes('green') ? 'bg-orange-50' : color.includes('yellow') ? 'bg-orange-50' : 'bg-gray-50')}>
            <Icon className={cn('w-5 h-5', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Formulaire de calcul de revenus
// ============================================================================
function RevenueCalculatorDialog({
  shareholder,
  onClose,
  onConfirmSave,
  loading,
}: {
  shareholder: Shareholder;
  onClose: () => void;
  onConfirmSave: (result: RevenueCalculationResult) => Promise<void>;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const assignment = shareholder.assignment;
  const [start, setStart] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
  );
  const [end, setEnd] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
  );
  const [preview, setPreview] = useState<RevenueCalculationResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    if (!assignment) return;
    setPreviewing(true);
    try {
      const result = await shareholderService.calculateRevenue(assignment.id, start, end);
      if (!result || (result as any).error) {
        toast.error((result as any)?.error || 'Erreur lors du calcul');
        return;
      }
      setPreview(result);
    } finally {
      setPreviewing(false);
    }
  };

  const fmt = (n: number | undefined, cur = 'GNF') =>
    `${(n ?? 0).toLocaleString('fr-FR')} ${cur}`;

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t('pDGShareholderManagement.calculerLesRevenus')}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        {/* Infos actionnaire */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          <p><span className="font-medium">Actionnaire:</span> {shareholder.full_name}</p>
          {assignment && (
            <>
              <p><span className="font-medium">{t('pDGShareholderManagement.categorie')}</span> {CATEGORY_LABELS[assignment.category]}</p>
              <p><span className="font-medium">{t('pDGShareholderManagement.portee')}</span> {SCOPE_LABELS[assignment.action_scope]}</p>
              {assignment.action_scope === 'country' && (
                <p><span className="font-medium">Pays:</span> {assignment.country}</p>
              )}
              <p><span className="font-medium">Pourcentage:</span> {assignment.percentage}%</p>
            </>
          )}
        </div>

        {/* Sélection de période */}
        {!preview && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('pDGShareholderManagement.debutDePeriode')}</label>
              <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('pDGShareholderManagement.finDePeriode')}</label>
              <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {/* Résultat du calcul — décomposition */}
        {preview && (
          <div className="rounded-lg border border-border overflow-hidden text-sm">
            <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              Résultat du calcul
            </div>
            <div className="divide-y divide-border">
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">Abonnements payants</span>
                <span className="font-medium">{preview.paid_subscriptions_count}</span>
              </div>
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">Abonnements offerts</span>
                <span className="font-medium">{preview.free_subscriptions_count}</span>
              </div>
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">Revenus bruts</span>
                <span className="font-medium">{fmt(preview.total_paid_revenue_brut, preview.currency)}</span>
              </div>
              {(() => {
                const hasComm = (preview.total_agent_commission ?? 0) > 0;
                return (
                  <div className={`flex justify-between px-3 py-2 ${hasComm ? 'text-orange-700' : 'text-muted-foreground'}`}>
                    <span className="flex items-center gap-1">
                      {hasComm && <AlertCircle className="w-3.5 h-3.5" />}
                      − Commissions agents déduites
                    </span>
                    <span className="font-medium">
                      {hasComm ? `−${fmt(preview.total_agent_commission, preview.currency)}` : `0 ${preview.currency ?? 'GNF'}`}
                    </span>
                  </div>
                );
              })()}
              <div className="flex justify-between px-3 py-2 bg-orange-50">
                <span className="font-semibold text-[#ff4000]">Part actionnaire ({preview.percentage}%)</span>
                <span className="font-bold text-[#ff4000]">{fmt(preview.shareholder_amount, preview.currency)}</span>
              </div>
              <div className="flex justify-between px-3 py-2 bg-blue-50">
                <span className="font-semibold text-blue-800">Revenus nets plateforme</span>
                <span className="font-bold text-blue-800">
                  {fmt(
                    Math.max(0, Number(preview.total_paid_revenue ?? 0) - Number(preview.shareholder_amount ?? 0)),
                    preview.currency,
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => { setPreview(null); onClose(); }}>
            Annuler
          </Button>
          {!preview ? (
            <Button
              className="flex-1"
              disabled={previewing || !assignment}
              onClick={handlePreview}
            >
              {previewing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
              Calculer
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPreview(null)}
                disabled={loading}
              >
                Modifier période
              </Button>
              <Button
                className="flex-1 bg-[#ff4000] hover:bg-[#ff4000]"
                disabled={loading}
                onClick={() => onConfirmSave(preview)}
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Enregistrer
              </Button>
            </>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

// ============================================================================
// Dialog : Suspendre / Réactiver
// ============================================================================
function SuspendDialog({
  shareholder,
  onConfirm,
  onClose,
  loading,
}: {
  shareholder: Shareholder;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const isSuspended = shareholder.status === 'suspended';
  return (
    <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isSuspended
            ? <PlayCircle className="w-5 h-5 text-[#ff4000]" />
            : <PauseCircle className="w-5 h-5 text-orange-500" />}
          {isSuspended ? 'Réactiver' : 'Suspendre'} l&apos;actionnaire
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          {isSuspended
            ? <>{t('pDGShareholderManagement.leCompteDe')} <strong>{shareholder.full_name}</strong> {t('pDGShareholderManagement.seraReactiveIlPourraDe')}</>
            : <>{t('pDGShareholderManagement.leCompteDe')} <strong>{shareholder.full_name}</strong> {t('pDGShareholderManagement.seraSuspenduIlNePourra')}</>}
        </p>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            className={cn('flex-1', isSuspended ? 'bg-[#ff4000] hover:bg-[#ff4000]' : 'bg-orange-500 hover:bg-orange-600')}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
            {isSuspended ? 'Réactiver' : 'Suspendre'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ============================================================================
// Dialog : Transférer la part d'action
// ============================================================================
function TransferDialog({
  shareholder,
  allShareholders,
  onConfirm,
  onClose,
  loading,
}: {
  shareholder: Shareholder;
  allShareholders: Shareholder[];
  onConfirm: (toId: string, reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [toId, setToId]     = useState('');
  const [reason, setReason] = useState('');
  const candidates = allShareholders.filter(
    s => s.id !== shareholder.id && s.status !== 'archived',
  );

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-blue-600" />
          Transférer la part d&apos;action
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <p><span className="font-medium">{t('pDGShareholderManagement.de')}</span> {shareholder.full_name}</p>
          {shareholder.assignment && (
            <p className="text-muted-foreground">
              {CATEGORY_LABELS[shareholder.assignment.category]} · {shareholder.assignment.percentage}%
              {shareholder.assignment.action_scope === 'country' && shareholder.assignment.country
                ? ` · ${shareholder.assignment.country}` : ''}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t('pDGShareholderManagement.transfererVers')}</label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t('pDGShareholderManagement.selectionnerUnActionnaire')} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}
                  {s.assignment ? ` (${s.assignment.percentage}% existant)` : ' (sans attribution)'}
                </SelectItem>
              ))}
              {candidates.length === 0 && (
                <SelectItem value="__none__" disabled>{t('pDGShareholderManagement.aucunActionnaireDisponible')}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Motif (optionnel)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('pDGShareholderManagement.exDepartVolontaireCession')}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-[#ff4000] flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{t('pDGShareholderManagement.lAposActionnaireSourceSera')}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={loading || !toId || toId === '__none__'}
            onClick={() => onConfirm(toId, reason)}
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
            Confirmer le transfert
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ============================================================================
// Dialog : Supprimer l'actionnaire
// ============================================================================
function DeleteShareholderDialog({
  shareholder,
  onConfirm,
  onClose,
  loading,
}: {
  shareholder: Shareholder;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState('');

  return (
    <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#ff4000]">
          <Trash2 className="w-5 h-5" />
          Supprimer l&apos;actionnaire
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-[#ff4000] space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Action irréversible
          </p>
          <p>{t('pDGShareholderManagement.leCompteDe')} <strong>{shareholder.full_name}</strong> {t('pDGShareholderManagement.seraArchiveEtLApos')}</p>
          <p className="text-xs">{t('pDGShareholderManagement.impossibleSiDesPaiementsSont')}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Tapez <strong>{t('pDGShareholderManagement.supprimer')}</strong> pour confirmer
          </label>
          <Input
            value={confirmed}
            onChange={e => setConfirmed(e.target.value)}
            placeholder={t('pDGShareholderManagement.supprimer')}
            className="text-sm"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={loading || confirmed !== 'SUPPRIMER'}
            onClick={onConfirm}
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
            Supprimer
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ============================================================================
// Tableau des actionnaires
// ============================================================================
function ShareholderTable({
  shareholders,
  onCalculate,
  onEdit,
  onSuspend,
  onTransfer,
  onDelete,
}: {
  shareholders: Shareholder[];
  onCalculate: (sh: Shareholder) => void;
  onEdit: (sh: Shareholder) => void;
  onSuspend: (sh: Shareholder) => void;
  onTransfer: (sh: Shareholder) => void;
  onDelete: (sh: Shareholder) => void;
}) {
  const { t } = useTranslation();
  if (shareholders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>{t('pDGShareholderManagement.aucunActionnaireEnregistre')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Actionnaire</TableHead>
          <TableHead>{t('pDGShareholderManagement.categorie2')}</TableHead>
          <TableHead>{t('pDGShareholderManagement.portee2')}</TableHead>
          <TableHead>Pays</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shareholders.map(sh => {
          const a = sh.assignment;
          return (
            <TableRow key={sh.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{sh.full_name}</p>
                  <p className="text-xs text-muted-foreground">{sh.email}</p>
                </div>
              </TableCell>
              <TableCell>
                {a ? (
                  <Badge variant="outline" className="text-xs">
                    {CATEGORY_LABELS[a.category]}
                  </Badge>
                ) : '—'}
              </TableCell>
              <TableCell>
                {a ? (
                  <div className="flex items-center gap-1">
                    {a.action_scope === 'global'
                      ? <Globe className="w-3.5 h-3.5 text-blue-500" />
                      : <MapPin className="w-3.5 h-3.5 text-[#ff4000]" />
                    }
                    <span className="text-xs">{SCOPE_LABELS[a.action_scope]}</span>
                  </div>
                ) : '—'}
              </TableCell>
              <TableCell className="text-sm">
                {a ? (a.action_scope === 'global' ? 'Tous les pays' : a.country || '—') : '—'}
              </TableCell>
              <TableCell className="text-right font-bold text-sm">
                {a ? `${a.percentage}%` : '—'}
              </TableCell>
              <TableCell>
                <Badge
                  className={cn(
                    'text-xs',
                    sh.status === 'active'    && 'bg-orange-100 text-[#ff4000]',
                    sh.status === 'suspended' && 'bg-orange-100 text-[#ff4000]',
                    sh.status === 'archived'  && 'bg-gray-100 text-gray-600',
                  )}
                  variant="secondary"
                >
                  {sh.status === 'active' ? 'Actif' : sh.status === 'suspended' ? 'Suspendu' : 'Archivé'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs"
                    onClick={() => onCalculate(sh)}
                    disabled={!a}
                    title={t('pDGShareholderManagement.calculerLesRevenus')}
                  >
                    <Calculator className="w-3.5 h-3.5 mr-1" />
                    Calculer
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(sh)}
                    title={t('pDGShareholderManagement.modifier')}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className={cn(
                      'h-7 w-7',
                      sh.status === 'suspended'
                        ? 'text-[#ff4000] hover:text-[#ff4000] hover:bg-orange-50'
                        : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50',
                    )}
                    onClick={() => onSuspend(sh)}
                    title={sh.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                  >
                    {sh.status === 'suspended'
                      ? <PlayCircle className="w-3.5 h-3.5" />
                      : <PauseCircle className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => onTransfer(sh)}
                    disabled={!a}
                    title={t('pDGShareholderManagement.transfererLaPart')}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-[#ff4000] hover:text-[#ff4000] hover:bg-orange-50"
                    onClick={() => onDelete(sh)}
                    title={t('pDGShareholderManagement.supprimer2')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// Tableau des revenus
// ============================================================================
function RevenueTable({ revenues }: { revenues: ShareholderRevenue[] }) {
  const { t } = useTranslation();
  if (revenues.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>{t('pDGShareholderManagement.aucunRevenuCalcule')}</p>
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
        const shName     = (r as any).shareholder_name || r.shareholder_id.slice(0, 8) + '…';

        return (
          <Card key={r.id} className="border shadow-sm">
            <CardContent className="pt-4 pb-4">
              {/* En-tête */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold">{shName}</span>
                    <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[r.category]}</Badge>
                    {r.action_scope === 'country' && r.country && (
                      <Badge variant="secondary" className="text-xs">{r.country}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.period_start), 'dd MMM yyyy', { locale: fr })}
                    {' → '}
                    {format(new Date(r.period_end), 'dd MMM yyyy', { locale: fr })}
                    {' · '}
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

              {/* Décomposition détaillée du calcul */}
              <div className="space-y-1.5">
                {/* Revenus bruts */}
                <div className="flex justify-between items-center px-3 py-2 bg-muted/40 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t('pDGShareholderManagement.revenusBrutsEncaisses')}</span>
                  <span className="text-sm font-semibold">{fmt(brut, r.currency)}</span>
                </div>

                {/* Commission agents — toujours affichée */}
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
                    − Part actionnaire ({Number(r.percentage)}%)
                  </span>
                  <span className="text-sm font-black text-[#ff4000]">−{fmt(share, r.currency)}</span>
                </div>

                {/* Séparateur */}
                <div className="border-t border-dashed border-border mx-3" />

                {/* Revenus nets plateforme */}
                <div className="flex justify-between items-center px-3 py-2 bg-blue-50 rounded-lg">
                  <span className="text-sm font-semibold text-blue-800">= Revenus nets plateforme</span>
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
                  onClick={() => downloadShareholderReceiptPdf(r, shName)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger le reçu
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
// Tableau des paiements
// ============================================================================
function PaymentsTable({
  payments,
  onApprove,
  onSendToWallet,
  loading,
}: {
  payments: any[];
  onApprove: (id: string) => void;
  onSendToWallet: (id: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>{t('pDGShareholderManagement.aucunPaiement')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Actionnaire</TableHead>
          <TableHead className="text-right">{t('pDGShareholderManagement.montant')}</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map(p => (
          <TableRow key={p.id}>
            <TableCell className="text-sm">
              {p.shareholder?.full_name || p.shareholder_id.slice(0, 8) + '…'}
            </TableCell>
            <TableCell className="text-right font-bold">
              {Number(p.amount).toLocaleString('fr-FR')} {p.currency}
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
              {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: fr })}
            </TableCell>
            <TableCell>
              <div className="flex gap-1.5">
                {/* Approuver = crédite le wallet immédiatement */}
                {p.status === 'pending' && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-[#ff4000] hover:bg-[#ff4000] text-white"
                    disabled={loading}
                    onClick={() => onApprove(p.id)}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Approuver &amp; Wallet
                  </Button>
                )}
                {/* Fallback : si approuvé mais wallet non crédité */}
                {p.status === 'approved' && (
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs text-orange-700 border-orange-200 hover:bg-orange-50"
                    disabled={loading}
                    onClick={() => onSendToWallet(p.id)}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Renvoyer Wallet
                  </Button>
                )}
                {p.status === 'sent_to_wallet' && (
                  <span className="text-xs text-[#ff4000] flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Crédité le {p.sent_to_wallet_at
                      ? format(new Date(p.sent_to_wallet_at), 'dd/MM/yy', { locale: fr })
                      : '—'}
                  </span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// Tableau pourcentages
// ============================================================================
function PercentageSummaryTable({ percentages }: { percentages: any[] }) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('pDGShareholderManagement.categorie2')}</TableHead>
          <TableHead>{t('pDGShareholderManagement.portee2')}</TableHead>
          <TableHead>Pays</TableHead>
          <TableHead className="text-right">Actionnaires</TableHead>
          <TableHead className="text-right">{t('pDGShareholderManagement.attribue')}</TableHead>
          <TableHead className="text-right">Restant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {percentages.map((p, i) => (
          <TableRow key={i}>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] || p.category}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">
              {SCOPE_LABELS[p.action_scope as keyof typeof SCOPE_LABELS] || p.action_scope}
            </TableCell>
            <TableCell className="text-sm">
              {p.action_scope === 'global' ? 'Tous les pays' : p.country || '—'}
            </TableCell>
            <TableCell className="text-right text-sm">{p.active_shareholders_count}</TableCell>
            <TableCell className="text-right">
              <span className={cn(
                'font-bold text-sm',
                p.used_percentage >= 80 ? 'text-[#ff4000]' :
                p.used_percentage >= 50 ? 'text-[#ff4000]' : 'text-[#ff4000]',
              )}>
                {p.used_percentage}%
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className={cn(
                'font-bold text-sm',
                p.remaining_percentage <= 20 ? 'text-[#ff4000]' : 'text-[#ff4000]',
              )}>
                {p.remaining_percentage}%
              </span>
            </TableCell>
          </TableRow>
        ))}
        {percentages.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              Aucun actionnaire configuré
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

// ============================================================================
// Badge statut vote
// ============================================================================
function VoteStatusBadge({ status }: { status: ShareholderVote['status'] }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; className: string }> = {
    draft:     { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
    open:      { label: 'Ouvert',    className: 'bg-orange-100 text-[#ff4000]' },
    closed:    { label: t('pDGShareholderManagement.cloture'),   className: 'bg-blue-100 text-blue-800' },
    cancelled: { label: t('pDGShareholderManagement.annule'),    className: 'bg-orange-100 text-[#ff4000]' },
  };
  const cfg = map[status] ?? map.draft;
  return <Badge className={cn('text-xs', cfg.className)} variant="secondary">{cfg.label}</Badge>;
}

// ============================================================================
// Formulaire création / édition d'un vote
// ============================================================================
function VoteFormDialog({
  open,
  onOpenChange,
  initialData,
  shareholders,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialData?: Partial<CreateVoteDto>;
  shareholders: Shareholder[];
  onSubmit: (data: CreateVoteDto) => Promise<void>;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm");

  const [title,          setTitle]         = useState(initialData?.title ?? '');
  const [description,    setDescription]   = useState(initialData?.description ?? '');
  const [startDate,      setStartDate]     = useState(initialData?.start_date ?? now);
  const [endDate,        setEndDate]       = useState(initialData?.end_date ?? tomorrow);
  const [voteType,       setVoteType]      = useState<'simple' | 'weighted'>(initialData?.vote_type ?? 'simple');
  const [targetType,     setTargetType]    = useState<CreateVoteDto['target_type']>(initialData?.target_type ?? 'all');
  const [category,       setCategory]      = useState(initialData?.category ?? '');
  const [country,        setCountry]       = useState(initialData?.country ?? '');
  const [shareholderId,  setShareholderId] = useState(initialData?.shareholder_id ?? '');

  const needsCategory  = ['category', 'category_country'].includes(targetType);
  const needsCountry   = ['country', 'category_country'].includes(targetType);
  const needsShareholder = targetType === 'specific_shareholder';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error(t('pDGShareholderManagement.leTitreEstObligatoire')); return; }
    if (!endDate || endDate <= startDate) { toast.error(t('pDGShareholderManagement.laDateDeClotureDoit')); return; }
    await onSubmit({
      title:          title.trim(),
      description:    description.trim() || undefined,
      start_date:     startDate,
      end_date:       endDate,
      vote_type:      voteType,
      target_type:    targetType,
      category:       needsCategory ? (category as any) || undefined : undefined,
      country:        needsCountry  ? country || undefined : undefined,
      shareholder_id: needsShareholder ? shareholderId || undefined : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="w-4 h-4" />
            {initialData ? 'Modifier le vote' : 'Créer un vote'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Titre */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Titre <span className="text-[#ff4000]">*</span></label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('pDGShareholderManagement.exApprobationDeLExpansion')} />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('pDGShareholderManagement.detailsDeLaResolution')}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('pDGShareholderManagement.debut')}</label>
              <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('pDGShareholderManagement.cloture')} <span className="text-[#ff4000]">*</span></label>
              <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Type de vote */}
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('pDGShareholderManagement.typeDeVote')}</label>
            <Select value={voteType} onValueChange={v => setVoteType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple (1 voix par actionnaire)</SelectItem>
                <SelectItem value="weighted">{t('pDGShareholderManagement.pondereParDeParticipation')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cible */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Destinataires</label>
            <Select value={targetType} onValueChange={v => setTargetType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(VOTE_TARGET_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Catégorie (conditionnel) */}
          {needsCategory && (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('pDGShareholderManagement.categorie2')}</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pays (conditionnel) */}
          {needsCountry && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Pays</label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Ex: GN" />
            </div>
          )}

          {/* Actionnaire spécifique (conditionnel) */}
          {needsShareholder && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Actionnaire</label>
              <Select value={shareholderId} onValueChange={setShareholderId}>
                <SelectTrigger><SelectValue placeholder={t('pDGShareholderManagement.choisirUnActionnaire')} /></SelectTrigger>
                <SelectContent>
                  {shareholders.filter(s => s.status === 'active').map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Enregistrement...' : (initialData ? 'Mettre à jour' : 'Créer le brouillon')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Onglet votes PDG
// ============================================================================
function VotesTabPDG({
  votes,
  shareholders,
  loading,
  onRefresh,
}: {
  votes: ShareholderVote[];
  shareholders: Shareholder[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [showCreate, setShowCreate]   = useState(false);
  const [selectedVote, setSelectedVote] = useState<ShareholderVote | null>(null);
  const [showEdit, setShowEdit]       = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const act = async (fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) => {
    setActionLoading(true);
    const r = await fn();
    setActionLoading(false);
    if (r.success) { toast.success(successMsg); onRefresh(); }
    else toast.error(r.error || 'Erreur');
  };

  const handleCreate = async (data: CreateVoteDto) => {
    setActionLoading(true);
    const r = await shareholderService.createVote(data);
    setActionLoading(false);
    if (r.success) { toast.success(t('pDGShareholderManagement.brouillonCree')); setShowCreate(false); onRefresh(); }
    else toast.error(r.error || 'Erreur');
  };

  const handleEdit = async (data: CreateVoteDto) => {
    if (!selectedVote) return;
    setActionLoading(true);
    const r = await shareholderService.updateVote(selectedVote.id, data);
    setActionLoading(false);
    if (r.success) { toast.success(t('pDGShareholderManagement.voteMisAJour')); setShowEdit(false); setSelectedVote(null); onRefresh(); }
    else toast.error(r.error || 'Erreur');
  };

  const openVotes     = votes.filter(v => v.status === 'open');
  const draftVotes    = votes.filter(v => v.status === 'draft');
  const closedVotes   = votes.filter(v => v.status === 'closed');
  const cancelledVotes = votes.filter(v => v.status === 'cancelled');

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vote className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">{t('pDGShareholderManagement.votesResolutions')}</h3>
            <p className="text-xs text-muted-foreground">
              {openVotes.length} ouvert(s) · {draftVotes.length} brouillon(s) · {closedVotes.length} clôturé(s)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            Nouveau vote
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Ouverts',     count: openVotes.length,      color: 'text-[#ff4000]',  bg: 'bg-orange-50' },
          { label: 'Brouillons',  count: draftVotes.length,     color: 'text-gray-600',   bg: 'bg-gray-50' },
          { label: t('pDGShareholderManagement.clotures'),    count: closedVotes.length,    color: 'text-blue-700',   bg: 'bg-blue-50' },
          { label: t('pDGShareholderManagement.annules'),     count: cancelledVotes.length, color: 'text-[#ff4000]',    bg: 'bg-orange-50' },
        ].map(s => (
          <Card key={s.label} className={cn('border-0 shadow-sm', s.bg)}>
            <CardContent className="pt-3 pb-3 text-center">
              <p className={cn('text-2xl font-bold', s.color)}>{s.count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tableau des votes */}
      {votes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Vote className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('pDGShareholderManagement.aucunVoteCreeCommencezPar')}</p>
        </div>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="pl-4 font-semibold">{t('pDGShareholderManagement.resolution')}</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead className="font-semibold">Destinataires</TableHead>
                  <TableHead className="font-semibold text-center">{t('pDGShareholderManagement.resultats')}</TableHead>
                  <TableHead className="font-semibold">{t('pDGShareholderManagement.cloture')}</TableHead>
                  <TableHead className="text-right pr-4 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {votes.map(vote => {
                  const total = vote.total_votes ?? 0;
                  const pctYes = total > 0 ? Math.round(((vote.total_yes ?? 0) / total) * 100) : 0;
                  const pctNo  = total > 0 ? Math.round(((vote.total_no  ?? 0) / total) * 100) : 0;
                  return (
                    <TableRow key={vote.id} className="hover:bg-gray-50">
                      <TableCell className="pl-4 max-w-[200px]">
                        <p className="font-medium text-sm truncate">{vote.title}</p>
                        {vote.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{vote.description}</p>
                        )}
                      </TableCell>
                      <TableCell><VoteStatusBadge status={vote.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {VOTE_TARGET_LABELS[vote.target_type]}
                      </TableCell>
                      <TableCell className="text-center">
                        {total === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-xs">
                            <span className="text-[#ff4000] font-semibold">{vote.total_yes ?? 0}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-[#ff4000] font-semibold">{vote.total_no ?? 0}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-gray-500">{vote.total_abstain ?? 0}</span>
                            <span className="text-muted-foreground ml-1">({total})</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {vote.end_date ? format(new Date(vote.end_date), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {vote.status === 'draft' && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title={t('pDGShareholderManagement.modifier')}
                                onClick={() => { setSelectedVote(vote); setShowEdit(true); }}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-[#ff4000]" title="Publier"
                                disabled={actionLoading}
                                onClick={() => act(() => shareholderService.publishVote(vote.id), 'Vote publié')}>
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-[#ff4000]" title={t('pDGShareholderManagement.supprimer2')}
                                disabled={actionLoading}
                                onClick={() => act(() => shareholderService.deleteVote(vote.id), 'Brouillon supprimé')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {vote.status === 'open' && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-700" title={t('pDGShareholderManagement.cloturer')}
                                disabled={actionLoading}
                                onClick={() => act(() => shareholderService.closeVote(vote.id), 'Vote clôturé')}>
                                <Lock className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-[#ff4000]" title={t('pDGShareholderManagement.annuler')}
                                disabled={actionLoading}
                                onClick={() => act(() => shareholderService.cancelVote(vote.id), 'Vote annulé')}>
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {(vote.status === 'closed' || vote.status === 'cancelled') && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 opacity-40 cursor-default" title={t('pDGShareholderManagement.termine')}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog créer */}
      <VoteFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        shareholders={shareholders}
        onSubmit={handleCreate}
        loading={actionLoading}
      />

      {/* Dialog modifier */}
      {selectedVote && (
        <VoteFormDialog
          key={selectedVote.id}
          open={showEdit}
          onOpenChange={v => { setShowEdit(v); if (!v) setSelectedVote(null); }}
          initialData={{
            title:          selectedVote.title,
            description:    selectedVote.description,
            start_date:     selectedVote.start_date,
            end_date:       selectedVote.end_date,
            vote_type:      selectedVote.vote_type,
            target_type:    selectedVote.target_type,
            category:       selectedVote.category,
            country:        selectedVote.country,
            shareholder_id: selectedVote.shareholder_id,
          }}
          shareholders={shareholders}
          onSubmit={handleEdit}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

export default function PDGShareholderManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    shareholders, stats, percentages, revenues, payments,
    loading, actionLoading, refetch,
    createShareholder, updateShareholder,
    suspendShareholder, reactivateShareholder,
    transferShare, deleteShareholder,
    calculateRevenue, approvePayment, sendToWallet,
  } = useShareholders();

  const [activeTab, setActiveTab] = useState('overview');

  // Votes PDG
  const [votes, setVotes]             = useState<ShareholderVote[]>([]);
  const [votesLoading, setVotesLoading] = useState(false);

  const loadVotes = useCallback(async () => {
    setVotesLoading(true);
    const data = await shareholderService.listVotesAll();
    setVotes(data);
    setVotesLoading(false);
  }, []);

  useEffect(() => { loadVotes(); }, [loadVotes]);

  const [showAddForm, setShowAddForm]       = useState(false);
  const [selectedSh, setSelectedSh]         = useState<Shareholder | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [searchTerm, setSearchTerm]         = useState('');

  // Dialogs actions
  const [showEditDialog, setShowEditDialog]         = useState(false);
  const [showSuspendDialog, setShowSuspendDialog]   = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog]     = useState(false);

  const handleEditSubmit = useCallback(async (data: any) => {
    if (!selectedSh || !user?.id) return;
    const result = await updateShareholder(selectedSh.id, {
      full_name:       data.full_name,
      email:           data.email,
      phone:           data.phone || undefined,
      category:        data.category,
      action_scope:    data.action_scope,
      country:         data.country || null,
      percentage:      data.percentage,
      internal_notes:  data.internal_notes || undefined,
    }, user.id);
    if (result?.success) {
      setShowEditDialog(false);
      setSelectedSh(null);
    }
  }, [selectedSh, user?.id, updateShareholder]);

  const handleSuspendConfirm = useCallback(async () => {
    if (!selectedSh || !user?.id) return;
    if (selectedSh.status === 'suspended') {
      await reactivateShareholder(selectedSh.id, user.id);
    } else {
      await suspendShareholder(selectedSh.id, user.id);
    }
    setShowSuspendDialog(false);
    setSelectedSh(null);
  }, [selectedSh, user?.id, suspendShareholder, reactivateShareholder]);

  const handleTransferConfirm = useCallback(async (toId: string, reason: string) => {
    if (!selectedSh || !user?.id) return;
    await transferShare(selectedSh.id, toId, reason, user.id);
    setShowTransferDialog(false);
    setSelectedSh(null);
  }, [selectedSh, user?.id, transferShare]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedSh || !user?.id) return;
    await deleteShareholder(selectedSh.id, user.id);
    setShowDeleteDialog(false);
    setSelectedSh(null);
  }, [selectedSh, user?.id, deleteShareholder]);

  const filteredShareholders = shareholders.filter(sh =>
    sh.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sh.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleConfirmSave = useCallback(async (result: RevenueCalculationResult) => {
    if (!user?.id) return;
    const saveResult = await shareholderService.saveRevenue(result, user.id);
    if (saveResult.success) {
      toast.success(t('pDGShareholderManagement.revenusEnregistresAvecSucces'));
      await refetch();
      setShowCalculator(false);
      setSelectedSh(null);
    } else {
      toast.error(saveResult.error || 'Erreur lors de la sauvegarde');
    }
  }, [user?.id, refetch]);

  const formatCurrency = useFormatCurrency();

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('pDGShareholderManagement.gestionDesActionnaires')}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gérer les actionnaires, leurs attributions et leurs revenus
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Ajouter actionnaire
          </Button>
        </div>
      </div>

      {/* Statistiques globales */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total actionnaires"
            value={stats.total_shareholders}
            icon={Users}
            color="text-blue-600"
          />
          <StatCard
            title="Actifs"
            value={stats.active_shareholders}
            icon={Activity}
            color="text-[#ff4000]"
          />
          <StatCard
            title={t('pDGShareholderManagement.paiementsEnAttente')}
            value={formatCurrency(stats.pending_payments)}
            icon={DollarSign}
            color="text-[#ff4000]"
          />
          <StatCard
            title={t('pDGShareholderManagement.totalDistribue')}
            value={formatCurrency(stats.sent_payments)}
            icon={TrendingUp}
            color="text-[#04439e]"
          />
        </div>
      )}

      {/* Onglets principaux */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 overflow-x-auto">
          <TabsTrigger value="overview"    className="text-xs">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="shareholders" className="text-xs">Actionnaires</TabsTrigger>
          <TabsTrigger value="revenues"    className="text-xs">Revenus</TabsTrigger>
          <TabsTrigger value="payments"    className="text-xs">
            Paiements
            {payments.filter(p => p.status === 'pending').length > 0 && (
              <Badge className="ml-1 h-4 text-xs bg-[#ff4000] text-white">
                {payments.filter(p => p.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="percentages" className="text-xs">Pourcentages</TabsTrigger>
          <TabsTrigger value="votes" className="text-xs flex items-center gap-1">
            <Vote className="w-3 h-3" />
            Votes
            {votes.filter(v => v.status === 'open').length > 0 && (
              <Badge className="ml-0.5 h-4 px-1 text-[10px] bg-[#ff4000] text-white">
                {votes.filter(v => v.status === 'open').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Actionnaires récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {shareholders.slice(0, 5).map(sh => {
                    const a = sh.assignment;
                    return (
                      <div key={sh.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{sh.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {a ? `${CATEGORY_LABELS[a.category]} • ${a.percentage}%` : 'Sans attribution'}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            'text-xs',
                            sh.status === 'active' ? 'bg-orange-100 text-[#ff4000]' : 'bg-orange-100 text-[#ff4000]',
                          )}
                          variant="secondary"
                        >
                          {sh.status === 'active' ? 'Actif' : 'Suspendu'}
                        </Badge>
                      </div>
                    );
                  })}
                  {shareholders.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun actionnaire
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Répartition pourcentages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PercentageSummaryTable percentages={percentages.slice(0, 6)} />
              </CardContent>
            </Card>
          </div>

          {/* Paiements en attente */}
          {payments.filter(p => p.status === 'pending').length > 0 && (
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#ff4000] flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Paiements en attente d'approbation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentsTable
                  payments={payments.filter(p => p.status === 'pending')}
                  onApprove={id => approvePayment(id, user?.id || '')}
                  onSendToWallet={id => sendToWallet(id, user?.id || '')}
                  loading={actionLoading}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Actionnaires */}
        <TabsContent value="shareholders" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {filteredShareholders.length} actionnaire(s)
                </CardTitle>
                <Input
                  placeholder={t('pDGShareholderManagement.rechercher')}
                  className="h-8 w-52 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ShareholderTable
                shareholders={filteredShareholders}
                onCalculate={sh => { setSelectedSh(sh); setShowCalculator(true); }}
                onEdit={sh => { setSelectedSh(sh); setShowEditDialog(true); }}
                onSuspend={sh => { setSelectedSh(sh); setShowSuspendDialog(true); }}
                onTransfer={sh => { setSelectedSh(sh); setShowTransferDialog(true); }}
                onDelete={sh => { setSelectedSh(sh); setShowDeleteDialog(true); }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenus */}
        <TabsContent value="revenues" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('pDGShareholderManagement.historiqueDesRevenusCalcules')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueTable revenues={revenues} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paiements */}
        <TabsContent value="payments" className="mt-4">
          <div className="space-y-4">
            {(['pending', 'approved', 'sent_to_wallet', 'cancelled'] as const).map(status => {
              const filtered = payments.filter(p => p.status === status);
              if (filtered.length === 0) return null;
              return (
                <Card key={status}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Badge
                        className={cn('text-xs', PAYMENT_STATUS_COLORS[status])}
                        variant="secondary"
                      >
                        {PAYMENT_STATUS_LABELS[status]}
                      </Badge>
                      <span className="text-muted-foreground font-normal">{filtered.length}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PaymentsTable
                      payments={filtered}
                      onApprove={id => approvePayment(id, user?.id || '')}
                      onSendToWallet={id => sendToWallet(id, user?.id || '')}
                      loading={actionLoading}
                    />
                  </CardContent>
                </Card>
              );
            })}
            {payments.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{t('pDGShareholderManagement.aucunPaiementEnregistre')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Votes */}
        <TabsContent value="votes" className="mt-4">
          <VotesTabPDG
            votes={votes}
            shareholders={shareholders}
            loading={votesLoading}
            onRefresh={loadVotes}
          />
        </TabsContent>

        {/* Pourcentages */}
        <TabsContent value="percentages" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Contrôle des pourcentages par catégorie et portée
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PercentageSummaryTable percentages={percentages} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pDGShareholderManagement.ajouterUnActionnaire')}</DialogTitle>
          </DialogHeader>
          <AddShareholderForm
            percentages={percentages}
            onSubmit={async (data) => {
              if (!user?.id) return;
              const result = await createShareholder(data, user.id);
              if (result?.success) setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
            loading={actionLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showCalculator && !!selectedSh} onOpenChange={v => { if (!v) { setShowCalculator(false); setSelectedSh(null); } }}>
        {selectedSh && (
          <RevenueCalculatorDialog
            shareholder={selectedSh}
            onClose={() => { setShowCalculator(false); setSelectedSh(null); }}
            onConfirmSave={handleConfirmSave}
            loading={actionLoading}
          />
        )}
      </Dialog>

      {/* Dialog Modifier */}
      <Dialog
        open={showEditDialog && !!selectedSh}
        onOpenChange={v => { if (!v) { setShowEditDialog(false); setSelectedSh(null); } }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Modifier — {selectedSh?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedSh && (
            <AddShareholderForm
              percentages={percentages}
              editMode
              initialData={{
                full_name:       selectedSh.full_name,
                email:           selectedSh.email,
                phone:           selectedSh.phone ?? '',
                category:        selectedSh.assignment?.category,
                action_scope:    selectedSh.assignment?.action_scope,
                country:         selectedSh.assignment?.country ?? '',
                percentage:      selectedSh.assignment?.percentage,
                internal_notes:  selectedSh.internal_notes ?? '',
              }}
              onSubmit={handleEditSubmit}
              onCancel={() => { setShowEditDialog(false); setSelectedSh(null); }}
              loading={actionLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Suspendre / Réactiver */}
      <Dialog open={showSuspendDialog && !!selectedSh} onOpenChange={v => { if (!v) { setShowSuspendDialog(false); setSelectedSh(null); } }}>
        {selectedSh && (
          <SuspendDialog
            shareholder={selectedSh}
            onConfirm={handleSuspendConfirm}
            onClose={() => { setShowSuspendDialog(false); setSelectedSh(null); }}
            loading={actionLoading}
          />
        )}
      </Dialog>

      {/* Dialog Transférer */}
      <Dialog open={showTransferDialog && !!selectedSh} onOpenChange={v => { if (!v) { setShowTransferDialog(false); setSelectedSh(null); } }}>
        {selectedSh && (
          <TransferDialog
            shareholder={selectedSh}
            allShareholders={shareholders}
            onConfirm={handleTransferConfirm}
            onClose={() => { setShowTransferDialog(false); setSelectedSh(null); }}
            loading={actionLoading}
          />
        )}
      </Dialog>

      {/* Dialog Supprimer */}
      <Dialog open={showDeleteDialog && !!selectedSh} onOpenChange={v => { if (!v) { setShowDeleteDialog(false); setSelectedSh(null); } }}>
        {selectedSh && (
          <DeleteShareholderDialog
            shareholder={selectedSh}
            onConfirm={handleDeleteConfirm}
            onClose={() => { setShowDeleteDialog(false); setSelectedSh(null); }}
            loading={actionLoading}
          />
        )}
      </Dialog>
    </div>
  );
}
