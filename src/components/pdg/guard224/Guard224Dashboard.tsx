/**
 * 224Guard — Dashboard PDG (Lot D).
 * Intégré au Centre Sécurité. Santé système, jauge de risque, compteurs, liste
 * d'alertes virtualisée (action ≤3 clics), timeline, threat map, console, export PDF.
 * Accessibilité : sévérité = couleur + ICÔNE + LABEL (lisible daltonien).
 * i18n : tout le chrome passe par t() ; les libellés d'alerte sont traduits par patternKey
 * (cf. guardLabels.ts) — la couche de détection reste pure.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldCheck, ShieldAlert, AlertTriangle, AlertOctagon, Info, Activity, RefreshCw, FileDown, Check, Ban, Eye, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/useTranslation';
import { useGuard224, type GuardAlertRow, type GuardSeverity } from './useGuard224';
import { translateGuardLabel } from './guardLabels';
import { reportFalsePositive, isGuard224Running, setGuard224Enabled } from '@/224guard';

/** Style (couleur + icône) par sévérité — STABLE. Le libellé est traduit via t(). */
const SEV_STYLE: Record<GuardSeverity, { color: string; bg: string; Icon: React.ComponentType<any> }> = {
  CRITICAL: { color: 'text-red-600', bg: 'bg-red-100 text-red-700 border-red-200', Icon: AlertOctagon },
  HIGH: { color: 'text-[#ff4000]', bg: 'bg-[#ff4000]/15 text-[#ff4000] border-[#ff4000]/30', Icon: AlertTriangle },
  MEDIUM: { color: 'text-amber-600', bg: 'bg-amber-100 text-amber-700 border-amber-200', Icon: ShieldAlert },
  LOW: { color: 'text-slate-600', bg: 'bg-slate-100 text-slate-700 border-slate-200', Icon: Info },
};

const SEV_LABEL_KEY: Record<GuardSeverity, string> = {
  CRITICAL: 'guard224Dashboard.severityCritical',
  HIGH: 'guard224Dashboard.severityHigh',
  MEDIUM: 'guard224Dashboard.severityMedium',
  LOW: 'guard224Dashboard.severityLow',
};

/**
 * Score de risque PONDÉRÉ PAR GRAVITÉ (0-100). Les critiques/élevées pilotent ;
 * les « moyennes » (souvent de l'entropie de faible confiance) PLAFONNENT pour ne pas
 * saturer le score à 100 par simple volume (anti « 100/100 Critique » sans vraie critique).
 */
function riskOf(counts: Record<GuardSeverity, number>): number {
  const r =
    counts.CRITICAL * 45 +
    counts.HIGH * 15 +
    Math.min(counts.MEDIUM, 15) * 1 +
    Math.min(counts.LOW, 10) * 0.2;
  return Math.max(0, Math.min(100, Math.round(r)));
}

/** Liste virtualisée légère (fenêtrage par scroll) — évite le freeze à 50+ alertes. */
function VirtualAlertList({ alerts, onAck, onFalsePositive, onDetails }: {
  alerts: GuardAlertRow[];
  onAck: (a: GuardAlertRow) => void;
  onFalsePositive: (a: GuardAlertRow) => void;
  onDetails: (a: GuardAlertRow) => void;
}) {
  const { t } = useTranslation();
  const ROW = 68, HEIGHT = 480, OVERSCAN = 4;
  const [scrollTop, setScrollTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const total = alerts.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + HEIGHT) / ROW) + OVERSCAN);
  const slice = alerts.slice(start, end);

  if (total === 0) {
    return <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><ShieldCheck className="h-10 w-10 mb-2 text-emerald-500" />{t('guard224Dashboard.aucuneExpositionDetectee')}</div>;
  }

  return (
    <div ref={ref} onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)} style={{ height: HEIGHT, overflowY: 'auto', position: 'relative' }} className="rounded-xl border">
      <div style={{ height: total * ROW, position: 'relative' }}>
        {slice.map((a, i) => {
          const s = SEV_STYLE[a.severity] ?? SEV_STYLE.LOW;
          const sevLabel = t(SEV_LABEL_KEY[a.severity] ?? SEV_LABEL_KEY.LOW);
          return (
            <div key={a.id} style={{ position: 'absolute', top: (start + i) * ROW, height: ROW, left: 0, right: 0 }}
              className="flex items-center gap-3 border-b px-3">
              <s.Icon className={`h-5 w-5 shrink-0 ${s.color}`} aria-label={sevLabel} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${s.bg}`}>{sevLabel}</Badge>
                  <span className="truncate text-sm font-medium">{translateGuardLabel(t, a.pattern_key, a.label) || a.type}</span>
                  {a.status !== 'OPEN' && <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {a.masked} · {(a.sources || []).join(', ')} · {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" title={t('guard224Dashboard.details')} onClick={() => onDetails(a)}><Eye className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title={t('guard224Dashboard.acquitter')} onClick={() => onAck(a)}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title={t('guard224Dashboard.fauxPositif')} onClick={() => onFalsePositive(a)}><Ban className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ alerts }: { alerts: GuardAlertRow[] }) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 3_600_000);
      buckets.set(`${d.getHours()}h`, 0);
    }
    for (const a of alerts) {
      const d = new Date(a.created_at);
      if (Date.now() - d.getTime() <= 24 * 3_600_000) {
        const k = `${d.getHours()}h`;
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + 1);
      }
    }
    return [...buckets.entries()].map(([t2, n]) => ({ t: t2, n }));
  }, [alerts]);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs><linearGradient id="g224" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff4000" stopOpacity={0.4} /><stop offset="100%" stopColor="#ff4000" stopOpacity={0} /></linearGradient></defs>
        <XAxis dataKey="t" tick={{ fontSize: 10 }} interval={2} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
        <Tooltip />
        <Area type="monotone" dataKey="n" stroke="#ff4000" fill="url(#g224)" name={t('guard224Dashboard.tabAlertes')} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ThreatMap({ alerts }: { alerts: GuardAlertRow[] }) {
  const { t } = useTranslation();
  const sources = ['network_request', 'websocket', 'local_storage', 'session_storage', 'dom', 'bundle', 'tamper'];
  const grid = useMemo(() => {
    const m: Record<string, Record<GuardSeverity, number>> = {};
    for (const src of sources) m[src] = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const a of alerts) for (const src of a.sources || []) if (m[src]) m[src][a.severity]++;
    return m;
  }, [alerts]);
  const cell = (n: number) => n === 0 ? 'bg-slate-50 text-slate-300' : n < 3 ? 'bg-amber-100 text-amber-700' : n < 8 ? 'bg-[#ff4000]/20 text-[#ff4000]' : 'bg-red-200 text-red-800';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-xs">
        <thead><tr><th className="p-2 text-left">{t('guard224Dashboard.source')}</th>{(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as GuardSeverity[]).map((s) => <th key={s} className="p-2">{t(SEV_LABEL_KEY[s])}</th>)}</tr></thead>
        <tbody>
          {sources.map((src) => (
            <tr key={src}><td className="p-2 text-left font-medium">{src}</td>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as GuardSeverity[]).map((s) => <td key={s} className="p-1"><div className={`rounded-md py-2 font-semibold ${cell(grid[src][s])}`}>{grid[src][s]}</div></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Console({ onScan, onExport }: { onScan: () => void; onExport: () => void }) {
  const { t } = useTranslation();
  const [log, setLog] = useState<string[]>([t('guard224Dashboard.consoleAccueil')]);
  const [cmd, setCmd] = useState('');
  const run = () => {
    const c = cmd.trim();
    if (!c) return;
    const out = [`> ${c}`];
    const [verb, ...args] = c.split(/\s+/);
    switch (verb) {
      case 'help': out.push(t('guard224Dashboard.consoleAide')); break;
      case 'scan': onScan(); out.push(t('guard224Dashboard.consoleRescan')); break;
      case 'export': onExport(); out.push(t('guard224Dashboard.consoleExport')); break;
      case 'whitelist': if (args[0]) { reportFalsePositive(args[0]); out.push(`${t('guard224Dashboard.consoleWhitelistOk')} ${args[0]}`); } else out.push(t('guard224Dashboard.consoleWhitelistUsage')); break;
      case 'status': out.push(t('guard224Dashboard.consoleStatus')); break;
      case 'clear': setLog([]); setCmd(''); return;
      default: out.push(`${t('guard224Dashboard.consoleInconnue')} ${verb}`);
    }
    setLog((l) => [...l, ...out].slice(-100));
    setCmd('');
  };
  return (
    <div className="rounded-xl border bg-slate-950 p-3 font-mono text-xs text-emerald-300">
      <div className="mb-2 h-48 overflow-y-auto">{log.map((l, i) => <div key={i} className={l.startsWith('>') ? 'text-sky-300' : ''}>{l}</div>)}</div>
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-emerald-400" />
        <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
          className="flex-1 bg-transparent outline-none placeholder:text-emerald-700" placeholder="help" />
      </div>
    </div>
  );
}

export default function Guard224Dashboard() {
  const { t } = useTranslation();
  const { summary, alerts, loading, reload, setStatus, purge } = useGuard224();
  const [detail, setDetail] = useState<GuardAlertRow | null>(null);
  const [purging, setPurging] = useState(false);
  const [monitoringOn, setMonitoringOn] = useState(isGuard224Running());

  // Interrupteur ON/OFF du monitoring 224Guard (état persistant, respecté au prochain chargement).
  const toggleMonitoring = (on: boolean) => {
    setGuard224Enabled(on);
    setMonitoringOn(on);
    toast.success(on ? t('guard224Dashboard.monitoringActiveToast') : t('guard224Dashboard.monitoringDesactiveToast'));
  };

  const purgeEntropy = async () => {
    setPurging(true);
    const n = await purge(); // défaut : faux positifs d'entropie
    setPurging(false);
    toast.success(`${n} ${t('guard224Dashboard.fauxPositifsEntropieClotures')}`);
  };

  const counts = useMemo(() => {
    const c: Record<GuardSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const a of alerts) if (a.status === 'OPEN') c[a.severity]++;
    return c;
  }, [alerts]);

  const risk = riskOf(counts);
  const riskColor = risk >= 70 ? 'text-red-600' : risk >= 40 ? 'text-[#ff4000]' : 'text-emerald-600';

  const ack = (a: GuardAlertRow) => { void setStatus(a.id, 'ACK'); toast.success(t('guard224Dashboard.alerteAcquittee')); };
  const fp = (a: GuardAlertRow) => { void setStatus(a.id, 'FALSE_POSITIVE'); reportFalsePositive(a.pattern_key); toast.success(t('guard224Dashboard.marqueeFauxPositif')); };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(t('guard224Dashboard.pdfTitre'), 14, 18);
    doc.setFontSize(10); doc.text(`${t('guard224Dashboard.pdfGenereLe')} ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`${t('guard224Dashboard.scoreDeRisque')}: ${risk}/100 · ${t('guard224Dashboard.pdfCritiquesOuvertes')}: ${counts.CRITICAL} · ${t('guard224Dashboard.pdfAlertesOuvertes')}: ${summary?.open_alerts ?? '—'}`, 14, 34);
    let y = 46; doc.setFontSize(11); doc.text(t('guard224Dashboard.pdfExpositionsRecentes'), 14, y); y += 8; doc.setFontSize(9);
    for (const a of alerts.slice(0, 30)) {
      doc.text(`[${a.severity}] ${(translateGuardLabel(t, a.pattern_key, a.label) || a.type).slice(0, 70)} — ${a.masked || ''} (${(a.sources || []).join(',')})`, 14, y);
      y += 6; if (y > 280) { doc.addPage(); y = 16; }
    }
    doc.save('224guard-rapport.pdf');
  };

  return (
    <div className="space-y-4">
      {/* En-tête : santé + jauge + compteurs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-[#ff4000]" /> {t('guard224Dashboard.titre')}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${monitoringOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <span className="text-sm font-medium">{monitoringOn ? t('guard224Dashboard.monitoringActif') : t('guard224Dashboard.monitoringDesactive')}</span>
                <Switch checked={monitoringOn} onCheckedChange={toggleMonitoring} aria-label={t('guard224Dashboard.monitoringToggleAria')} />
              </div>
              <Button size="sm" variant="outline" onClick={() => reload()} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('guard224Dashboard.rescan')}</Button>
              <Button size="sm" variant="outline" onClick={purgeEntropy} disabled={purging}><RefreshCw className={`h-4 w-4 mr-1 ${purging ? 'animate-spin' : ''}`} />{t('guard224Dashboard.purgerFauxPositifs')}</Button>
              <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />{t('guard224Dashboard.exportPdf')}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="col-span-2 rounded-xl border p-3 md:col-span-2">
              <div className="text-xs text-muted-foreground">{t('guard224Dashboard.scoreDeRisque')}</div>
              <div className={`text-4xl font-bold ${riskColor}`}>{risk}<span className="text-base text-muted-foreground">/100</span></div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100"><div className={`h-2 rounded-full ${risk >= 70 ? 'bg-red-500' : risk >= 40 ? 'bg-[#ff4000]' : 'bg-emerald-500'}`} style={{ width: `${risk}%` }} /></div>
            </div>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as GuardSeverity[]).map((s) => {
              const cfg = SEV_STYLE[s];
              return (
                <div key={s} className="rounded-xl border p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><cfg.Icon className={`h-4 w-4 ${cfg.color}`} />{t(SEV_LABEL_KEY[s])}</div>
                  <div className={`text-2xl font-bold ${cfg.color}`}>{counts[s]}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            {summary?.last_alert_at ? `${t('guard224Dashboard.derniereMenace')} ${new Date(summary.last_alert_at).toLocaleString()}` : t('guard224Dashboard.aucuneMenaceRecente')}
            {' · '}{summary?.alerts_last_hour ?? 0} {t('guard224Dashboard.alertesMot')} / 1h · {summary?.alerts_last_day ?? 0} / 24h
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts" className="gap-1"><ShieldAlert className="h-4 w-4" />{t('guard224Dashboard.tabAlertes')}</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1"><Activity className="h-4 w-4" />{t('guard224Dashboard.tabTimeline')}</TabsTrigger>
          <TabsTrigger value="threatmap" className="gap-1"><AlertOctagon className="h-4 w-4" />{t('guard224Dashboard.tabThreatMap')}</TabsTrigger>
          <TabsTrigger value="console" className="gap-1"><Terminal className="h-4 w-4" />{t('guard224Dashboard.tabConsole')}</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts">
          <VirtualAlertList alerts={alerts} onAck={ack} onFalsePositive={fp} onDetails={setDetail} />
        </TabsContent>
        <TabsContent value="timeline"><Card><CardContent className="pt-4"><Timeline alerts={alerts} /></CardContent></Card></TabsContent>
        <TabsContent value="threatmap"><Card><CardContent className="pt-4"><ThreatMap alerts={alerts} /></CardContent></Card></TabsContent>
        <TabsContent value="console"><Console onScan={reload} onExport={exportPdf} /></TabsContent>
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2">{detail && React.createElement(SEV_STYLE[detail.severity].Icon, { className: `h-5 w-5 ${SEV_STYLE[detail.severity].color}` })}{t('guard224Dashboard.detailExposition')}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <div><b>{t('guard224Dashboard.type')}</b> {detail.type} <span className="text-muted-foreground">({detail.pattern_key})</span></div>
              <div><b>{t('guard224Dashboard.severite')}</b> {t(SEV_LABEL_KEY[detail.severity])}</div>
              <div><b>{t('guard224Dashboard.valeurMasquee')}</b> <code className="rounded bg-muted px-1">{detail.masked}</code></div>
              <div><b>{t('guard224Dashboard.empreinte')}</b> <code className="break-all text-xs">{detail.key_hash}</code></div>
              <div><b>{t('guard224Dashboard.sources')}</b> {(detail.sources || []).join(', ')}</div>
              <div><b>{t('guard224Dashboard.emplacements')}</b> {(detail.locations || []).join(', ') || '—'}</div>
              <div><b>{t('guard224Dashboard.detectee')}</b> {new Date(detail.created_at).toLocaleString()}</div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => { ack(detail); setDetail(null); }}><Check className="h-4 w-4 mr-1" />{t('guard224Dashboard.acquitter')}</Button>
                <Button size="sm" variant="outline" onClick={() => { fp(detail); setDetail(null); }}><Ban className="h-4 w-4 mr-1" />{t('guard224Dashboard.fauxPositif')}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
