import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🛠️ Auto-Réparation supervisée (dual-IA) — tableau PDG.
 * Affiche la chaîne : incident (surveillance) → OpenAI diagnostique/propose → Claude vérifie/corrige
 * → remédiation classée (auto_safe / needs_human). FONDATION : propositions seulement, pas d'exécution auto.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Brain, ShieldCheck, ShieldAlert, Bot, Cpu, CheckCircle2, ArrowUpCircle, Play } from 'lucide-react';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

interface Incident {
  id: string;
  module: string | null;
  alert_key: string | null;
  severity: string | null;
  title: string | null;
  detail: string | null;
  openai_diagnosis: string | null;
  openai_action: string | null;
  openai_rationale: string | null;
  claude_verdict: string | null;
  claude_analysis: string | null;
  claude_action: string | null;
  final_action: string | null;
  remediation_label: string | null;
  remediation_kind: string | null;
  status: string;
  created_at: string;
}

const sevColor = (s?: string | null): 'destructive' | 'secondary' | 'outline' =>
  s === 'critical' || s === 'high' ? 'destructive' : s === 'medium' ? 'secondary' : 'outline';

const statusLabel: Record<string, string> = {
  detected: 'Détecté', diagnosed: 'Diagnostiqué', proposed: 'Correction proposée',
  escalated: 'Escaladé (humain)', applied: 'Appliqué', resolved: 'Résolu', failed: 'Échec',
};

export default function AutoHealingDashboard() {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [providers, setProviders] = useState<{ openai: boolean; anthropic: boolean }>({ openai: false, anthropic: false });
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backendFetch<{ incidents: Incident[]; providers: { openai: boolean; anthropic: boolean } }>('/api/admin/auto-healing/incidents', { method: 'GET' });
      const data = (res as any)?.data;
      if (res.success && data) { setIncidents(data.incidents || []); setProviders(data.providers || { openai: false, anthropic: false }); }
    } catch { /* silencieux */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await backendFetch<{ ingested: number; diagnosed: number }>('/api/admin/auto-healing/scan', { method: 'POST' });
      const d = (res as any)?.data;
      if (res.success) { toast.success(`Scan terminé : ${d?.ingested ?? 0} nouveaux incidents, ${d?.diagnosed ?? 0} diagnostiqués.`); await load(); }
      else toast.error(res.error || 'Scan impossible');
    } catch { toast.error(t('autoHealingDashboard.erreurReseau')); } finally { setScanning(false); }
  };

  const rediagnose = async (id: string) => {
    setBusyId(id);
    try {
      const res = await backendFetch(`/api/admin/auto-healing/${id}/diagnose`, { method: 'POST' });
      if (res.success) { toast.success(t('autoHealingDashboard.reDiagnosticEffectue')); await load(); } else toast.error(res.error || 'Échec');
    } catch { toast.error(t('autoHealingDashboard.erreurReseau')); } finally { setBusyId(null); }
  };

  const apply = async (id: string) => {
    setBusyId(id);
    try {
      const res = await backendFetch(`/api/admin/auto-healing/${id}/apply`, { method: 'POST' });
      if (res.success) { toast.success(t('autoHealingDashboard.remediationAppliquee')); await load(); }
      else toast.error(res.error || 'Application impossible');
    } catch { toast.error(t('autoHealingDashboard.erreurReseau')); } finally { setBusyId(null); }
  };

  const setStatus = async (id: string, status: 'resolved' | 'escalated') => {
    setBusyId(id);
    try {
      const res = await backendFetch(`/api/admin/auto-healing/${id}/status`, { method: 'POST', body: { status } });
      if (res.success) { toast.success(status === 'resolved' ? 'Marqué comme résolu' : 'Escaladé'); await load(); } else toast.error(res.error || 'Échec');
    } catch { toast.error(t('autoHealingDashboard.erreurReseau')); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> {t('autoHealingDashboard.autoReparationSuperviseeDualIa')}</CardTitle>
              <CardDescription>{t('autoHealingDashboard.openaiDiagnostiqueEtProposeClaude')} <strong>{t('autoHealingDashboard.proposees')}</strong>{t('autoHealingDashboard.jamaisExecuteesAutomatiquement')}</CardDescription>
            </div>
            <Button onClick={scan} disabled={scanning} className="gap-2">
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Scanner maintenant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={providers.openai ? 'default' : 'outline'} className="gap-1"><Cpu className="h-3 w-3" /> OpenAI {providers.openai ? 'connecté' : 'absent'}</Badge>
            <Badge variant={providers.anthropic ? 'default' : 'outline'} className="gap-1"><Bot className="h-3 w-3" /> Claude {providers.anthropic ? 'connecté' : 'absent'}</Badge>
            <span className="text-muted-foreground">{incidents.length} incident(s)</span>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[520px] pr-2">
        <div className="space-y-3">
          {!loading && incidents.length === 0 && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t('autoHealingDashboard.aucunIncidentCliquezSurScanner')}</CardContent></Card>
          )}

          {incidents.map((inc) => {
            const safe = inc.remediation_kind === 'auto_safe';
            const closed = ['resolved', 'applied', 'failed'].includes(inc.status);
            return (
              <Card key={inc.id} className={closed ? 'opacity-70' : ''}>
                <CardContent className="pt-6 space-y-3">
                  {/* Entête incident */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={sevColor(inc.severity)}>{inc.severity}</Badge>
                        <span className="font-semibold">{inc.module}</span>
                        {inc.alert_key && <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{inc.alert_key}</code>}
                        <Badge variant="outline">{statusLabel[inc.status] || inc.status}</Badge>
                      </div>
                      <p className="text-sm font-medium">{inc.title}</p>
                      {inc.detail && <p className="text-xs text-muted-foreground">{inc.detail}</p>}
                    </div>
                  </div>

                  {/* Chaîne dual-IA */}
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                      <p className="flex items-center gap-1 text-xs font-semibold text-primary"><Cpu className="h-3 w-3" /> OpenAI — diagnostic</p>
                      <p className="text-xs">{inc.openai_diagnosis || <span className="text-muted-foreground">{t('autoHealingDashboard.pasEncoreDiagnostique')}</span>}</p>
                      {inc.openai_action && <p className="text-[11px] text-muted-foreground">{t('autoHealingDashboard.actionProposee')} <code>{inc.openai_action}</code></p>}
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                      <p className="flex items-center gap-1 text-xs font-semibold text-primary"><Bot className="h-3 w-3" /> {t('autoHealingDashboard.claudeVerification')}</p>
                      {inc.claude_verdict ? (
                        <>
                          <Badge variant={inc.claude_verdict === 'approved' ? 'default' : inc.claude_verdict === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">{inc.claude_verdict}</Badge>
                          <p className="text-xs">{inc.claude_analysis}</p>
                          {inc.claude_action && <p className="text-[11px] text-muted-foreground">Action retenue : <code>{inc.claude_action}</code></p>}
                        </>
                      ) : <p className="text-xs text-muted-foreground">{t('autoHealingDashboard.enAttenteDeVerification')}</p>}
                    </div>
                  </div>

                  {/* Remédiation finale */}
                  {inc.remediation_label && (
                    <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${safe ? 'border-green-500/40 bg-green-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
                      {safe ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
                      <span className="flex-1">{inc.remediation_label}</span>
                      <Badge variant={safe ? 'default' : 'secondary'} className="text-[10px]">{safe ? 'Action sûre (auto-éligible)' : 'Validation humaine requise'}</Badge>
                    </div>
                  )}

                  {/* Actions PDG */}
                  {!closed && (
                    <div className="flex flex-wrap gap-2">
                      {safe && (
                        <Button size="sm" className="h-7 gap-1 bg-green-600 text-xs hover:bg-green-700" disabled={busyId === inc.id} onClick={() => apply(inc.id)}>
                          <Play className="h-3 w-3" /> Appliquer (action sûre)
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busyId === inc.id} onClick={() => rediagnose(inc.id)}>
                        <RefreshCw className={`h-3 w-3 ${busyId === inc.id ? 'animate-spin' : ''}`} /> Re-diagnostiquer
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busyId === inc.id} onClick={() => setStatus(inc.id, 'resolved')}>
                        <CheckCircle2 className="h-3 w-3" /> Marquer résolu
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busyId === inc.id} onClick={() => setStatus(inc.id, 'escalated')}>
                        <ArrowUpCircle className="h-3 w-3" /> Escalader
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
