/**
 * 🔍 ID AUDIT MANAGER - Système d'audit et correction des IDs
 * Détecte et corrige les désynchronisations entre tables
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { backendFetch } from '@/services/backendApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Shield,
  Database,
  ArrowRight,
  Wrench,
  Eye,
  XCircle
} from 'lucide-react';

interface IdDiscrepancy {
  userId: string;
  email: string;
  fullName: string;
  profilesPublicId: string;
  userIdsCustomId: string | null;
  vendorCode: string | null;
  status: 'desync_user_ids' | 'desync_vendor' | 'desync_profile_custom_id' | 'desync_both' | 'missing_user_id' | 'conflict' | 'ok';
  canAutoFix: boolean;
  conflictWith?: string; // userId du conflit potentiel
}

interface DuplicateInfo {
  id: string;
  users: string[];
  count: number;
}

export function IdAuditManager() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<IdDiscrepancy[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastAudit, setLastAudit] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    desyncUserIds: 0,
    desyncVendor: 0,
    desyncBoth: 0,
    conflicts: 0,
    missing: 0
  });

  const runAudit = async () => {
    setLoading(true);
    try {
      // Audit server-side (PDG only) — plus aucune lecture/écriture directe depuis le navigateur
      const res = await backendFetch<{
        discrepancies: IdDiscrepancy[];
        duplicates: DuplicateInfo[];
        stats: { total: number; desyncUserIds: number; desyncVendor: number; desyncBoth: number; conflicts: number; missing: number };
      }>('/api/admin/ids/audit');

      if (!res.success || !res.data) {
        toast.error(res.error || 'Erreur lors de l\'audit');
        return;
      }

      setDuplicates(res.data.duplicates || []);
      setDiscrepancies(res.data.discrepancies || []);
      setStats({ synced: 0, ...res.data.stats });
    } catch (err) {
      console.error('Erreur audit:', err);
      toast.error(t('idAuditManager.erreurLorsDeLAudit'));
    } finally {
      setLoading(false);
      setLastAudit(new Date().toLocaleString('fr-FR'));
    }
  };

  const applyFix = async (body: { userIds?: string[]; all?: boolean }) => {
    setFixing(true);
    try {
      const res = await backendFetch<{ fixed: number; errors: number; skipped: number; conflicts: number }>(
        '/api/admin/ids/fix',
        { method: 'POST', body }
      );
      if (!res.success || !res.data) {
        toast.error(res.error || 'Erreur lors de la correction');
        return;
      }
      const { fixed, errors, skipped } = res.data;
      if (fixed > 0) toast.success(`✅ ${fixed} utilisateur(s) corrigé(s)`);
      if (skipped > 0) toast.warning(`⚠️ ${skipped} conflit(s) ignoré(s) - correction manuelle requise`);
      if (errors > 0) toast.error(`❌ ${errors} erreur(s) lors de la correction`);

      setSelectedIds(new Set());
      await runAudit();
    } catch (err) {
      console.error('Erreur correction:', err);
      toast.error(t('idAuditManager.erreurLorsDeLaCorrection'));
    } finally {
      setFixing(false);
    }
  };

  const fixSelectedIds = async () => {
    if (selectedIds.size === 0) {
      toast.warning(t('idAuditManager.selectionnezAuMoinsUnUtilisateur'));
      return;
    }
    await applyFix({ userIds: Array.from(selectedIds) });
  };

  const fixAllDiscrepancies = async () => {
    if (discrepancies.length === 0) return;
    await applyFix({ all: true });
  };

  const toggleSelection = (userId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    if (selectedIds.size === discrepancies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(discrepancies.map(d => d.userId)));
    }
  };

  const getStatusBadge = (status: IdDiscrepancy['status']) => {
    switch (status) {
      case 'desync_user_ids':
        return <Badge variant="destructive" className="text-xs">{t('idAuditManager.userIdsDesync')}</Badge>;
      case 'desync_vendor':
        return <Badge className="bg-[#ff4000] text-white text-xs">{t('idAuditManager.vendorDesync')}</Badge>;
      case 'desync_profile_custom_id':
        return <Badge className="bg-orange-500 text-white text-xs">{t('idAuditManager.profilCustomIdDesync')}</Badge>;
      case 'desync_both':
        return <Badge variant="destructive" className="text-xs animate-pulse">CRITIQUE</Badge>;
      case 'missing_user_id':
        return <Badge className="bg-blue-500 text-white text-xs">Manquant</Badge>;
      case 'conflict':
        return <Badge className="bg-[#04439e] text-white text-xs animate-pulse">⚠️ CONFLIT</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">OK</Badge>;
    }
  };

  useEffect(() => {
    runAudit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('idAuditManager.auditDesIdsSysteme')}</CardTitle>
              <CardDescription>
                Vérification et correction des désynchronisations d'identifiants
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={runAudit}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <div className="text-xl font-bold text-destructive">{stats.desyncUserIds}</div>
            <div className="text-xs text-muted-foreground">user_ids</div>
          </div>
          <div className="p-3 rounded-lg bg-[#ff4000]/10 text-center">
            <div className="text-xl font-bold text-[#ff4000]">{stats.desyncVendor}</div>
            <div className="text-xs text-muted-foreground">vendors</div>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <div className="text-xl font-bold text-destructive">{stats.desyncBoth}</div>
            <div className="text-xs text-muted-foreground">Critiques</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-center">
            <div className="text-xl font-bold text-blue-600">{stats.missing}</div>
            <div className="text-xs text-muted-foreground">Manquants</div>
          </div>
          <div className="p-3 rounded-lg bg-[#04439e]/10 text-center">
            <div className="text-xl font-bold text-[#04439e]">{stats.conflicts}</div>
            <div className="text-xs text-muted-foreground">Conflits</div>
          </div>
        </div>

        {/* Alerte doublons */}
        {duplicates.length > 0 && (
          <Alert variant="destructive" className="animate-pulse">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{t('idAuditManager.doublonsDetectesDansProfilesPublic')}</AlertTitle>
            <AlertDescription>
              {duplicates.map(d => (
                <div key={d.id} className="mt-1">
                  <code className="bg-muted px-1 rounded">{d.id}</code> utilisé par {d.count} utilisateurs
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {lastAudit && (
          <p className="text-xs text-muted-foreground">
            Dernier audit: {lastAudit}
          </p>
        )}

        {/* Alerte si problèmes */}
        {discrepancies.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('idAuditManager.desynchronisationsDetectees')}</AlertTitle>
            <AlertDescription>
              {discrepancies.length} utilisateur(s) avec des IDs incohérents.
              La source de vérité est <code className="bg-muted px-1 rounded">profiles.public_id</code>.
            </AlertDescription>
          </Alert>
        )}

        {discrepancies.length === 0 && !loading && (
          <Alert className="border-[#ff4000]/50 bg-[#ff4000]/10">
            <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
            <AlertTitle className="text-[#ff4000]">{t('idAuditManager.systemeSynchronise')}</AlertTitle>
            <AlertDescription className="text-[#ff4000]/80">
              Tous les IDs sont correctement synchronisés entre les tables.
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        {discrepancies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={fixAllDiscrepancies}
              disabled={fixing || discrepancies.length === 0}
              className="bg-[#ff4000] hover:bg-[#ff4000]"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Corriger tout ({discrepancies.length})
            </Button>
            <Button
              onClick={fixSelectedIds}
              disabled={fixing || selectedIds.size === 0}
              variant="outline"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Corriger sélection ({selectedIds.size})
            </Button>
          </div>
        )}

        {/* Table des problèmes */}
        {discrepancies.length > 0 && (
          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === discrepancies.length && discrepancies.length > 0}
                      onCheckedChange={selectAll}
                    />
                  </TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="text-[#ff4000]">profiles.public_id</span>
                    <span className="text-xs ml-1">(source)</span>
                  </TableHead>
                  <TableHead>
                    <span className="text-[#ff4000]">user_ids.custom_id</span>
                  </TableHead>
                  <TableHead>
                    <span className="text-orange-500">vendors.vendor_code</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies.map((d) => (
                  <TableRow
                    key={d.userId}
                    className={`hover:bg-muted/50 ${d.status === 'conflict' ? 'bg-[#04439e]/5' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(d.userId)}
                        onCheckedChange={() => toggleSelection(d.userId)}
                        disabled={!d.canAutoFix}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{d.fullName}</p>
                        <p className="text-xs text-muted-foreground">{d.email}</p>
                        {d.conflictWith && (
                          <p className="text-xs text-[#04439e] mt-1">
                            ⚠️ ID déjà utilisé par un autre user
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(d.status)}</TableCell>
                    <TableCell>
                      <code className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">
                        {d.profilesPublicId}
                      </code>
                    </TableCell>
                    <TableCell>
                      {d.userIdsCustomId ? (
                        <div className="flex items-center gap-1">
                          <code className={`px-2 py-1 rounded text-xs font-mono ${
                            d.userIdsCustomId === d.profilesPublicId
                              ? 'bg-primary/10 text-primary'
                              : 'bg-destructive/10 text-destructive'
                          }`}>
                            {d.userIdsCustomId}
                          </code>
                          {d.userIdsCustomId !== d.profilesPublicId && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">{t('idAuditManager.aucun')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.vendorCode ? (
                        <code className={`px-2 py-1 rounded text-xs font-mono ${
                          d.vendorCode === d.profilesPublicId
                            ? 'bg-primary/10 text-primary'
                            : 'bg-[#ff4000]/10 text-[#ff4000]'
                        }`}>
                          {d.vendorCode}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Légende */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span>{t('idAuditManager.sourceDeVerite')} <code className="bg-muted px-1 rounded">profiles.public_id</code></span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#ff4000]" />
            <span>{t('idAuditManager.synchronise')}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-[#ff4000]" />
            <span>{t('idAuditManager.desynchronise')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default IdAuditManager;
