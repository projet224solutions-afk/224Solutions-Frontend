import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/Money";
import { backendFetch } from "@/services/backendApi";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Loader2,
  Users,
  Package,
  Clock,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Info,
} from "lucide-react";

interface AffiliateCommission {
  id: string;
  order_id: string;
  product_id: string;
  affiliate_user_id: string;
  product_name: string;
  affiliate_ref: string;
  sale_amount: number;
  commission_amount: number;
  commission_rate: number;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
  confirmed_at: string | null;
}

interface VendorAffiliateData {
  commissions: AffiliateCommission[];
  pending: number;
  confirmed: number;
  cancelled: number;
  affiliates: number;
  products_enabled: number;
}

const STATUS_META: Record<string, { labelKey: string; className: string }> = {
  pending: { labelKey: "affiliateMgmt.statusPending", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  confirmed: { labelKey: "affiliateMgmt.statusConfirmed", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  cancelled: { labelKey: "affiliateMgmt.statusCancelled", className: "bg-muted text-muted-foreground border-border" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="truncate text-lg font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AffiliateManagement(_props: { shopId?: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<VendorAffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await backendFetch<VendorAffiliateData>("/api/affiliate-program/vendor");
    if (res.success) {
      setData(res as unknown as VendorAffiliateData);
    } else {
      setError(res.error || t("affiliateMgmt.loadError"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const commissions = data?.commissions ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#ff4000]" />
              {t("affiliateMgmt.title")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("affiliateMgmt.intro")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-2 hidden sm:inline">{t("affiliateMgmt.refresh")}</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              {/* KPI */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  icon={Package}
                  label={t("affiliateMgmt.kpiProducts")}
                  value={data?.products_enabled ?? 0}
                  accent="bg-[#ff4000]/10 text-[#ff4000]"
                />
                <StatCard
                  icon={Users}
                  label={t("affiliateMgmt.kpiAffiliates")}
                  value={data?.affiliates ?? 0}
                  accent="bg-blue-500/10 text-blue-600"
                />
                <StatCard
                  icon={Clock}
                  label={t("affiliateMgmt.kpiPending")}
                  value={<Money amount={data?.pending ?? 0} from="GNF" />}
                  accent="bg-amber-500/10 text-amber-600"
                />
                <StatCard
                  icon={CheckCircle2}
                  label={t("affiliateMgmt.kpiPaid")}
                  value={<Money amount={data?.confirmed ?? 0} from="GNF" />}
                  accent="bg-emerald-500/10 text-emerald-600"
                />
              </div>

              {/* Comment ça marche */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Info className="h-4 w-4 text-[#ff4000]" />
                  {t("affiliateMgmt.howTitle")}
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>{t("affiliateMgmt.how1")}</li>
                  <li>{t("affiliateMgmt.how2")}</li>
                  <li>{t("affiliateMgmt.how3")}</li>
                  <li>{t("affiliateMgmt.how4")}</li>
                  <li>{t("affiliateMgmt.how5")}</li>
                </ul>
              </div>

              {/* Table des commissions */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("affiliateMgmt.recentTitle")}</h3>
                {commissions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("affiliateMgmt.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t("affiliateMgmt.colProduct")}</th>
                          <th className="px-3 py-2 font-medium">{t("affiliateMgmt.colAffiliate")}</th>
                          <th className="px-3 py-2 text-right font-medium">{t("affiliateMgmt.colSale")}</th>
                          <th className="px-3 py-2 text-right font-medium">{t("affiliateMgmt.colRate")}</th>
                          <th className="px-3 py-2 text-right font-medium">{t("affiliateMgmt.colCommission")}</th>
                          <th className="px-3 py-2 font-medium">{t("affiliateMgmt.colStatus")}</th>
                          <th className="px-3 py-2 font-medium">{t("affiliateMgmt.colDate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map((c) => {
                          const meta = STATUS_META[c.status] || STATUS_META.pending;
                          return (
                            <tr key={c.id} className="border-t border-border/60">
                              <td className="max-w-[200px] truncate px-3 py-2" title={c.product_name}>
                                {c.product_name}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{c.affiliate_ref}</td>
                              <td className="px-3 py-2 text-right">
                                <Money amount={c.sale_amount} from="GNF" />
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {Number(c.commission_rate)}%
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                <Money amount={c.commission_amount} from="GNF" />
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={meta.className}>
                                  {t(meta.labelKey)}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleDateString("fr-FR")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
