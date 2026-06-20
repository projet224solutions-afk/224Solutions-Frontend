import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Layers,
  TrendingUp,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { RoleType, getIdConfig } from "@/lib/autoIdGenerator";
import {
  getIdStats,
  reorganizeIds,
  reorganizeAllIds,
} from "@/lib/idReorganizer";

interface RoleStats {
  roleType: RoleType;
  label: string;
  total: number;
  maxNumber: number;
  gaps: number[];
  gapCount: number;
  legacyCount: number;
  invalidCount: number;
  loading: boolean;
}

const ROLE_LABELS: Record<RoleType, string> = {
  vendor: 'Vendeurs (VND)',
  client: 'Clients (CLT)',
  agent: 'Agents (AGT)',
  driver: 'Chauffeurs (DRV)',
  taxi: 'Taxi-Motos (TAX)',
  livreur: 'Livreurs (LIV)',
  bureau: 'Bureaux (BST)',
  pdg: 'PDG',
  transitaire: 'Transitaires (TRS)',
  worker: 'Travailleurs (WRK)'
};

export function IdReorganizationPanel() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<RoleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorganizing, setReorganizing] = useState<RoleType | 'all' | null>(null);
  const [lastResults, setLastResults] = useState<{ oldId: string; newId: string }[]>([]);

  const roleTypes: RoleType[] = ['vendor', 'client', 'agent', 'driver', 'taxi', 'livreur', 'bureau', 'pdg', 'transitaire', 'worker'];

  useEffect(() => {
    loadAllStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllStats = async () => {
    setLoading(true);

    const newStats = await Promise.all(
      roleTypes.map(async (roleType) => {
        const stat = await getIdStats(roleType);
        return {
          roleType,
          label: ROLE_LABELS[roleType],
          ...stat,
          loading: false,
        };
      })
    );

    setStats(newStats);
    setLoading(false);
    return newStats;
  };

  const handleReorganize = async (roleType: RoleType) => {
    setReorganizing(roleType);
    toast.info(`Réorganisation des IDs ${ROLE_LABELS[roleType]}...`);

    try {
      const result = await reorganizeIds(roleType);

      if (result.success) {
        toast.success(`${result.reorganized.length} ID(s) réorganisé(s) avec succès`);
        setLastResults(result.reorganized);
      } else {
        toast.error(`Erreurs: ${result.errors.join(', ')}`);
      }

      await loadAllStats();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setReorganizing(null);
    }
  };

  const handleReorganizeAll = async () => {
    setReorganizing('all');
    toast.info(t('idReorganizationPanel.reorganisationDeTousLesIds'));

    try {
      const results = await reorganizeAllIds();
      let totalReorganized = 0;
      let totalErrors = 0;
      const aggregatedResults: { oldId: string; newId: string }[] = [];
      const detailedErrors = Array.from(
        new Set(
          Object.values(results).flatMap((result) => result.errors)
        )
      );

      for (const roleType of Object.keys(results) as RoleType[]) {
        const result = results[roleType];
        totalReorganized += result.reorganized.length;
        totalErrors += result.errors.length;
        aggregatedResults.push(...result.reorganized.map(({ oldId, newId }) => ({ oldId, newId })));
      }

      setLastResults(aggregatedResults);

      if (totalErrors === 0 && totalReorganized > 0) {
        toast.success(`${totalReorganized} ID(s) réorganisé(s) au total`);
      } else if (totalErrors === 0) {
        toast.info(t('idReorganizationPanel.aucunIdSupplementaireAReorganiser'));
      } else {
        toast.warning(detailedErrors[0] ?? `${totalReorganized} réorganisé(s), ${totalErrors} erreur(s)`);
      }

      const refreshedStats = await loadAllStats();
      const remainingIssues = refreshedStats.reduce(
        (sum, stat) => sum + stat.gapCount + stat.legacyCount + stat.invalidCount,
        0
      );

      if (totalErrors === 0 && totalReorganized === 0 && remainingIssues > 0) {
        toast.warning('La réorganisation a bien été lancée, mais la base doit encore être alignée sur les préfixes CLT/BST. Appliquez la migration SQL puis relancez l’action.');
      }
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setReorganizing(null);
    }
  };

  const totalGaps = stats.reduce((sum, s) => sum + s.gapCount, 0);
  const totalLegacyIds = stats.reduce((sum, s) => sum + s.legacyCount + s.invalidCount, 0);
  const hasIssues = totalGaps > 0 || totalLegacyIds > 0;
  const hasLegacyPrefixDrift = stats.some(
    (stat) => (stat.roleType === 'client' || stat.roleType === 'bureau') && stat.legacyCount > 0
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Réorganisation des IDs
            </CardTitle>
            <CardDescription>
              Vérifier les numéros libres et les anciens formats avant réorganisation
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllStats}
              disabled={loading || !!reorganizing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            {hasIssues && (
              <Button
                size="sm"
                onClick={handleReorganizeAll}
                disabled={loading || !!reorganizing}
              >
                {reorganizing === 'all' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Tout réorganiser
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasIssues && !loading ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
            <AlertDescription>
              Tous les IDs actifs sont cohérents. Aucun numéro libre ou ancien format détecté.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4 text-[#ff4000]" />
              <AlertDescription>
                Les écarts affichés représentent des numéros libres dans la séquence active, pas des utilisateurs perdus.
              </AlertDescription>
            </Alert>

            {hasLegacyPrefixDrift && (
              <Alert className="mb-4 border-[#ff4000]/40 bg-[#ff4000]/5">
                <AlertTriangle className="h-4 w-4 text-[#ff4000]" />
                <AlertDescription>
                  Des IDs utilisent encore un ancien préfixe (`CLI` / `SYN`). Le correctif d’alignement `CLT` / `BST` doit être appliqué côté base pour que <strong>{t('idReorganizationPanel.toutReorganiser')}</strong> les corrige définitivement.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="details">{t('idReorganizationPanel.detailsParRole')}</TabsTrigger>
                {lastResults.length > 0 && (
                  <TabsTrigger value="history">{t('idReorganizationPanel.dernieresModifications')}</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.map((stat) => {
                    const hasRoleIssues = stat.gapCount > 0 || stat.legacyCount > 0 || stat.invalidCount > 0;

                    return (
                      <Card key={stat.roleType} className={hasRoleIssues ? 'border-[#ff4000]/50' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{stat.label}</span>
                            {hasRoleIssues ? (
                              <Badge variant="destructive" className="bg-[#ff4000]">
                                {stat.gapCount > 0 ? `${stat.gapCount} n° libres` : 'À revoir'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>Total: {stat.total} IDs actifs</p>
                            <p>Max: {getIdConfig(stat.roleType).prefix}{stat.maxNumber.toString().padStart(4, '0')}</p>
                            {stat.legacyCount > 0 && (
                              <p className="text-[#ff4000]">Anciens formats: {stat.legacyCount}</p>
                            )}
                            {stat.invalidCount > 0 && (
                              <p className="text-destructive">Formats à normaliser: {stat.invalidCount}</p>
                            )}
                            {stat.gapCount > 0 && (
                              <p className="text-[#ff4000]">
                                Numéros libres: {stat.gaps.slice(0, 5).join(', ')}
                                {stat.gaps.length > 5 && '...'}
                              </p>
                            )}
                          </div>
                          {hasRoleIssues && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-3"
                              onClick={() => handleReorganize(stat.roleType)}
                              disabled={!!reorganizing}
                            >
                              {reorganizing === stat.roleType ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              Réorganiser
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="details">
                <ScrollArea className="h-[400px]">
                  {stats.filter((s) => s.gapCount > 0 || s.legacyCount > 0 || s.invalidCount > 0).map((stat) => (
                    <div key={stat.roleType} className="mb-6">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#ff4000]" />
                        {stat.label}
                      </h3>
                      <div className="pl-6 space-y-1">
                        {stat.gapCount > 0 && (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Numéros libres dans la séquence active:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {stat.gaps.slice(0, 24).map((gap) => (
                                <Badge key={gap} variant="outline" className="text-[#ff4000]">
                                  {getIdConfig(stat.roleType).prefix}{gap.toString().padStart(4, '0')}
                                </Badge>
                              ))}
                              {stat.gaps.length > 24 && (
                                <Badge variant="secondary">+{stat.gaps.length - 24} autres</Badge>
                              )}
                            </div>
                          </>
                        )}
                        {stat.legacyCount > 0 && (
                          <p className="text-xs text-[#ff4000] mt-2">
                            {stat.legacyCount} ID(s) utilisent encore un ancien préfixe pour ce rôle.
                          </p>
                        )}
                        {stat.invalidCount > 0 && (
                          <p className="text-xs text-destructive mt-2">
                            {stat.invalidCount} ID(s) ne respectent pas encore le format attendu.
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          La réorganisation resserre uniquement les numéros actifs et garde la séquence plus lisible.
                        </p>
                      </div>
                    </div>
                  ))}
                  {stats.filter((s) => s.gapCount > 0 || s.legacyCount > 0 || s.invalidCount > 0).length === 0 && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                      <AlertDescription>
                        Aucun écart à afficher. Tous les IDs sont déjà propres.
                      </AlertDescription>
                    </Alert>
                  )}
                </ScrollArea>
              </TabsContent>

              {lastResults.length > 0 && (
                <TabsContent value="history">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {lastResults.map((result, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          <Badge variant="outline" className="font-mono">
                            {result.oldId}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge className="font-mono bg-[#ff4000]">
                            {result.newId}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
