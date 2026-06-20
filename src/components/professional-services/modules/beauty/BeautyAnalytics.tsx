import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 ÉCRAN 8 — ANALYTICS & REVENUS. CA mois / RDV / panier moyen / no-shows +
 * revenus hebdo (Recharts) + remplissage par jour + top services.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { useBeautyAnalytics, useBeautyServices } from '@/hooks/useBeauty';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, CalendarCheck, ShoppingBag, AlertTriangle } from 'lucide-react';

const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function BeautyAnalytics({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const a = useBeautyAnalytics(serviceId);
  const { services } = useBeautyServices(serviceId);
  const nameOf = (id: string) => services.find((s) => s.id === id)?.name || '—';
  const dowData = a.byDow.map((v, i) => ({ jour: DOW[i], rdv: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-[#04439e] text-white"><CardContent className="p-4"><TrendingUp className="h-4 w-4 opacity-80" /><p className="text-lg font-bold mt-1"><Money amount={a.revenueMonth} from="GNF" /></p><p className="text-xs opacity-80">{t('beautyAnalytics.caDuMois')}</p></CardContent></Card>
        <Card className="bg-[#ff4000] text-white"><CardContent className="p-4"><CalendarCheck className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{a.countMonth}</p><p className="text-xs opacity-80">RDV ce mois</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-[#ff4000] to-[#04439e] text-white"><CardContent className="p-4"><ShoppingBag className="h-4 w-4 opacity-80" /><p className="text-lg font-bold mt-1"><Money amount={a.avgBasket} from="GNF" /></p><p className="text-xs opacity-80">Panier moyen</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-gray-700 to-gray-900 text-white"><CardContent className="p-4"><AlertTriangle className="h-4 w-4 opacity-80" /><p className="text-2xl font-bold mt-1">{a.noShowCount}</p><p className="text-xs opacity-80">No-shows · <Money amount={a.noShowPenalties} from="GNF" /></p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-base">Revenus par semaine</CardTitle></CardHeader><CardContent>
        {a.weekly.length === 0 ? <p className="text-sm text-muted-foreground">{t('beautyAnalytics.pasEncoreDeDonnees')}</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={a.weekly}><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="revenue" fill="#ff4000" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        )}
      </CardContent></Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Remplissage par jour</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData}><XAxis dataKey="jour" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="rdv" fill="#04439e" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">{t('beautyAnalytics.servicesLesPlusDemandes')}</CardTitle></CardHeader><CardContent className="space-y-1">
          {a.topServices.length === 0 && <p className="text-sm text-muted-foreground">{t('beautyAnalytics.pasEncoreDeDonnees')}</p>}
          {a.topServices.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0">
              <span className="truncate">{nameOf(s.id)}</span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground"><span>{s.count}×</span><b className="text-[#ff4000]"><Money amount={s.revenue} from="GNF" /></b></span>
            </div>
          ))}
        </CardContent></Card>
      </div>
    </div>
  );
}

export default BeautyAnalytics;
