/**
 * Shell PARTAGÉ des modules artisans (vitrerie/menuiserie/plomberie/soudure).
 * Factorise : métriques, flux d'intervention type Uber (En route → Arrivé → Terminé),
 * photos avant/après obligatoires. Chaque métier ne fournit que son formulaire de devis.
 */

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Money } from '@/components/Money';
import { Truck, MapPin, CheckCircle2, Camera, FileDown, Clock, AlertTriangle, Inbox, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useArtisanInterventions, useArtisanQuotes, useOpenArtisanRequests, type ArtisanIntervention } from '@/hooks/useArtisan';
import { useShareMyLocation } from '@/hooks/useLiveLocation';
import { useAuth } from '@/hooks/useAuth';
import { Navigation } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { ArtisanService } from '@/lib/artisan/calculator';

const STATUS_FLOW: Record<string, { next: string; labelKey: string; Icon: any }> = {
  scheduled: { next: 'en_route', labelKey: 'artisanShell.enRoute', Icon: Truck },
  en_route: { next: 'on_site', labelKey: 'artisanShell.arrived', Icon: MapPin },
  on_site: { next: 'completed', labelKey: 'artisanShell.completed', Icon: CheckCircle2 },
};

export function Metric({ label, value, Icon }: { label: string; value: number; Icon: any }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export interface ArtisanModuleShellProps {
  serviceType: ArtisanService;
  title: string;
  Icon: React.ComponentType<any>;
  businessName?: string;
  /** Onglet de devis spécifique au métier (reçoit createQuote). */
  renderQuote: (createQuote: (q: any) => Promise<any>) => React.ReactNode;
  /** Onglets additionnels optionnels (ex. portfolio soudure, phases menuiserie). */
  extraTabs?: { value: string; label: string; Icon: any; content: React.ReactNode }[];
}

export function ArtisanModuleShell({ serviceType, title, Icon, businessName, renderQuote, extraTabs = [] }: ArtisanModuleShellProps) {
  const { t } = useTranslation();
  const { interventions, update } = useArtisanInterventions('artisan');
  const { quotes, createQuote } = useArtisanQuotes('artisan');
  const { requests: openRequests, submitQuote } = useOpenArtisanRequests();
  const { uploadFile } = useStorageUpload();
  const { user } = useAuth();
  const { sharing, start: startShare, stop: stopShare, error: shareError } = useShareMyLocation(user?.id, businessName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ id: string; field: 'photos_before' | 'photos_after' } | null>(null);
  const [quotingReqId, setQuotingReqId] = useState<string | null>(null);

  const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();
  const todayCount = interventions.filter((i) => isToday(i.created_at)).length;
  const pendingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').length;
  const doneCount = interventions.filter((i) => i.status === 'completed' || i.status === 'validated').length;
  const ca = quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + (q.total_ttc || 0), 0);

  // Portfolio = photos « après » des chantiers terminés/validés (preuve de travail = +demandes).
  const portfolio = interventions
    .filter((i) => i.status === 'completed' || i.status === 'validated')
    .flatMap((i) => (i.photos_after || []).map((url) => ({ url, date: i.completed_at || i.created_at })));

  const advance = async (i: ArtisanIntervention) => {
    const step = STATUS_FLOW[i.status];
    if (!step) return;
    const extra: any = step.next === 'en_route' ? { started_at: new Date().toISOString() } : step.next === 'completed' ? { completed_at: new Date().toISOString() } : {};
    await update(i.id, { status: step.next as any, ...extra });
  };

  const pickPhoto = (id: string, field: 'photos_before' | 'photos_after') => { setPending({ id, field }); fileRef.current?.click(); };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !pending) return;
    const res = await uploadFile(file, { folder: 'documents' as any, subfolder: `${serviceType}/${pending.id}` });
    if (!res.success || !res.publicUrl) { toast.error(t('artisanShell.uploadFailed')); return; }
    const iv = interventions.find((x) => x.id === pending.id);
    const current = (iv?.[pending.field] as string[]) || [];
    await update(pending.id, { [pending.field]: [...current, res.publicUrl] } as any);
    toast.success(t('artisanShell.photoAdded'));
    setPending(null);
  };

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-[#ff4000]" />{title}{businessName ? ` — ${businessName}` : ''}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('artisanShell.todayInterventions')} value={todayCount} Icon={Clock} />
            <Metric label={t('artisanShell.pendingQuotes')} value={pendingQuotes} Icon={AlertTriangle} />
            <Metric label={t('artisanShell.doneInterventions')} value={doneCount} Icon={CheckCircle2} />
            <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{t('artisanShell.revenue')}</div><div className="text-lg font-bold text-[#ff4000]"><Money amount={ca} /></div></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="interventions">
        <TabsList>
          <TabsTrigger value="demandes" className="gap-1"><Inbox className="h-4 w-4" />{t('artisanShell.tabRequests')}{openRequests.length > 0 ? ` (${openRequests.length})` : ''}</TabsTrigger>
          <TabsTrigger value="interventions" className="gap-1"><Truck className="h-4 w-4" />{t('artisanShell.tabInterventions')}</TabsTrigger>
          <TabsTrigger value="quote" className="gap-1"><FileDown className="h-4 w-4" />{t('artisanShell.tabFreeQuote')}</TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-1"><ImageIcon className="h-4 w-4" />{t('artisanShell.tabPortfolio')}{portfolio.length > 0 ? ` (${portfolio.length})` : ''}</TabsTrigger>
          {extraTabs.map((et) => <TabsTrigger key={et.value} value={et.value} className="gap-1"><et.Icon className="h-4 w-4" />{et.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="demandes" className="space-y-2">
          {openRequests.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">{t('artisanShell.noRequests')}</CardContent></Card>}
          {openRequests.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.urgency === 'immediate' ? 'destructive' : 'outline'} className="capitalize">{r.urgency}</Badge>
                  <span className="font-medium">{r.title}</span>
                  {r.city && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{r.city}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                {r.photos?.length > 0 && <div className="flex gap-2">{r.photos.slice(0, 4).map((p, i) => <img key={i} src={p} alt="" className="h-14 w-14 rounded border object-cover" />)}</div>}
                {quotingReqId === r.id
                  ? <div className="rounded-lg border p-2">
                      {renderQuote(async (payload: any) => {
                        const ok = await submitQuote(r.id, { items: payload.items, total_ht: payload.total_ht, tax_rate: payload.tax_rate, total_ttc: payload.total_ttc });
                        if (ok) setQuotingReqId(null);
                        return ok ? { id: r.id } : null;
                      })}
                      <Button size="sm" variant="ghost" className="mt-1" onClick={() => setQuotingReqId(null)}>{t('artisanShell.cancel')}</Button>
                    </div>
                  : <Button size="sm" onClick={() => setQuotingReqId(r.id)}>{t('artisanShell.makeQuote')}</Button>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="interventions" className="space-y-2">
          {interventions.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">{t('artisanShell.noInterventions')}</CardContent></Card>}
          {interventions.map((i) => {
            const step = STATUS_FLOW[i.status];
            return (
              <Card key={i.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <Badge variant="outline" className="capitalize">{i.status.replace('_', ' ')}</Badge>
                  <span className="text-sm text-muted-foreground">{new Date(i.created_at).toLocaleString()}</span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => pickPhoto(i.id, 'photos_before')}><Camera className="h-4 w-4 mr-1" />{t('artisanShell.before')} ({i.photos_before?.length || 0})</Button>
                    <Button size="sm" variant="outline" onClick={() => pickPhoto(i.id, 'photos_after')}><Camera className="h-4 w-4 mr-1" />{t('artisanShell.after')} ({i.photos_after?.length || 0})</Button>
                    {i.status === 'en_route' && (
                      <Button size="sm" variant={sharing ? 'default' : 'outline'} onClick={() => (sharing ? stopShare() : startShare())} title={shareError || t('artisanShell.shareLocationTitle')}>
                        <Navigation className={`h-4 w-4 mr-1 ${sharing ? 'animate-pulse' : ''}`} />{sharing ? t('artisanShell.locationShared') : t('artisanShell.shareLocation')}
                      </Button>
                    )}
                    {step && <Button size="sm" onClick={() => advance(i)}><step.Icon className="h-4 w-4 mr-1" />{t(step.labelKey)}</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="quote">{renderQuote(createQuote)}</TabsContent>

        <TabsContent value="portfolio">
          {portfolio.length === 0
            ? <Card><CardContent className="py-10 text-center text-muted-foreground">{t('artisanShell.portfolioEmpty')}</CardContent></Card>
            : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {portfolio.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-lg border">
                    <img src={p.url} alt={t('artisanShell.realisationAlt')} className="aspect-square w-full object-cover transition group-hover:scale-105" loading="lazy" />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[10px] text-white">{new Date(p.date).toLocaleDateString()}</span>
                  </a>
                ))}
              </div>}
        </TabsContent>

        {extraTabs.map((et) => <TabsContent key={et.value} value={et.value}>{et.content}</TabsContent>)}
      </Tabs>
    </div>
  );
}
