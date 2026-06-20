import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 ÉCRANS 5+7 — PARAMÈTRES : walk-in, politique d'annulation (pénalité no-show),
 * programme de fidélité, heure du rappel J-1.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBeautySettings } from '@/hooks/useBeauty';
import { DoorOpen, ShieldAlert, Gift, Bell, Loader2 } from 'lucide-react';

export function BeautySettings({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { settings, loading, save } = useBeautySettings(serviceId);
  const [f, setF] = useState<any>({});
  useEffect(() => { if (settings) setF(settings); }, [settings]);

  if (loading) return <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><DoorOpen className="h-4 w-4" />Passages directs (walk-in)</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label className="text-sm">{t('beautySettings.accepterLesClientsSansReservation')}</Label>
          <Switch checked={!!f.accepts_walkin} onCheckedChange={(v) => setF((x: any) => ({ ...x, accepts_walkin: v }))} />
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Annulation & no-show</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div><Label>{t('beautySettings.annulationGratuiteJusquAHeures')}</Label><Input type="number" value={f.cancel_window_hours ?? 24} onChange={(e) => setF((x: any) => ({ ...x, cancel_window_hours: +e.target.value }))} /></div>
          <div><Label>{t('beautySettings.penaliteNoShowDuPrix')}</Label><Input type="number" value={f.noshow_penalty_pct ?? 50} onChange={(e) => setF((x: any) => ({ ...x, noshow_penalty_pct: +e.target.value }))} /></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" />{t('beautySettings.programmeDeFidelite')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div><Label>{t('beautySettings.visitesPourUneRecompense')}</Label><Input type="number" value={f.loyalty_threshold ?? 10} onChange={(e) => setF((x: any) => ({ ...x, loyalty_threshold: +e.target.value }))} /></div>
          <div className="col-span-2"><Label>{t('beautySettings.recompense')}</Label><Input value={f.loyalty_reward ?? ''} onChange={(e) => setF((x: any) => ({ ...x, loyalty_reward: e.target.value }))} placeholder="Ex : Soin offert" /></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Rappels automatiques</CardTitle></CardHeader>
        <CardContent>
          <Label>{t('beautySettings.heureDEnvoiDuRappel')}</Label>
          <Input type="number" min={0} max={23} value={f.reminder_day_before_hour ?? 18} onChange={(e) => setF((x: any) => ({ ...x, reminder_day_before_hour: +e.target.value }))} />
          <p className="mt-1 text-xs text-muted-foreground">{t('beautySettings.leRappelH22h')}</p>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={() => save(f)}>{t('beautySettings.enregistrerLesParametres')}</Button>
    </div>
  );
}

export default BeautySettings;
