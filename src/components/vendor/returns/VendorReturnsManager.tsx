import { useEffect, useState, useCallback } from 'react';
import { backendFetch } from '@/services/backendApi';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Undo2, RefreshCw, CheckCircle, XCircle, PackageCheck } from 'lucide-react';

interface ReturnRow {
  id: string;
  order_id: string;
  reason: string;
  comment?: string | null;
  items: { name?: string; quantity?: number }[];
  refund_amount: number;
  status: string;
  vendor_response?: string | null;
  created_at: string;
  orders?: { order_number?: string } | null;
}

// Clés i18n (traduites au rendu — cf. useTranslation).
const REASON_KEYS: Record<string, string> = {
  defective: 'vendorReturns.reasonDefective', not_as_described: 'vendorReturns.reasonNotAsDescribed',
  wrong_item: 'vendorReturns.reasonWrongItem', no_longer_needed: 'vendorReturns.reasonNoLongerNeeded',
  other: 'vendorReturns.reasonOther',
};
const STATUS: Record<string, { key: string; variant: any }> = {
  requested: { key: 'vendorReturns.statusRequested', variant: 'default' },
  approved: { key: 'vendorReturns.statusApproved', variant: 'secondary' },
  received: { key: 'vendorReturns.statusReceived', variant: 'secondary' },
  refunded: { key: 'vendorReturns.statusRefunded', variant: 'outline' },
  rejected: { key: 'vendorReturns.statusRejected', variant: 'destructive' },
  cancelled: { key: 'vendorReturns.statusCancelled', variant: 'outline' },
};

export default function VendorReturnsManager() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // ✅ Remplacent les pop-ups natifs (bloqués sur Android/WebView)
  const [rejectDialog, setRejectDialog] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [receivedDialog, setReceivedDialog] = useState<{ id: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backendFetch<{ success: boolean; data: ReturnRow[] }>('/api/returns/vendor');
      if (res.success) setRows(res.data || []);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'received', vendor_response?: string) => {
    setBusy(id);
    try {
      const res = await backendFetch<{ success: boolean; status?: string; error?: string }>(`/api/returns/${id}`, {
        method: 'PATCH',
        body: { action, vendor_response },
      });
      if (res.success) {
        toast.success(action === 'received' ? t('vendorReturns.toastRefunded') : action === 'approve' ? t('vendorReturns.toastApproved') : t('vendorReturns.toastRejected'));
        await load();
      } else {
        toast.error(res.error || t('vendorReturns.fail'));
      }
    } catch { toast.error(t('vendorReturns.networkError')); }
    finally { setBusy(null); }
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Undo2 className="w-5 h-5" /> {t('vendorReturns.title')}</CardTitle>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> {t('vendorReturns.refresh')}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">{t('vendorReturns.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t('vendorReturns.empty')}</p>
        ) : rows.map(r => {
          const st = STATUS[r.status] || STATUS.requested;
          return (
            <div key={r.id} className="border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{t('vendorReturns.order')} {r.orders?.order_number || r.order_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('vendorReturns.reason')} {REASON_KEYS[r.reason] ? t(REASON_KEYS[r.reason]) : r.reason}
                    {r.comment ? ` — « ${r.comment} »` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(r.items || []).map(i => `${i.quantity}× ${i.name || t('vendorReturns.item')}`).join(', ')}
                  </p>
                  <p className="text-sm font-semibold mt-1">{t('vendorReturns.refund')} {fc(r.refund_amount)}</p>
                </div>
                <Badge variant={st.variant} className="shrink-0">{t(st.key)}</Badge>
              </div>
              {r.status === 'requested' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => act(r.id, 'approve')} disabled={busy === r.id} className="gap-1">
                    <CheckCircle className="w-4 h-4" /> {t('vendorReturns.approve')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectDialog({ id: r.id })} disabled={busy === r.id} className="gap-1">
                    <XCircle className="w-4 h-4" /> {t('vendorReturns.reject')}
                  </Button>
                </div>
              )}
              {r.status === 'approved' && (
                <Button size="sm" onClick={() => setReceivedDialog({ id: r.id })} disabled={busy === r.id} className="gap-1 mt-3">
                  <PackageCheck className="w-4 h-4" /> {t('vendorReturns.receivePackage')}
                </Button>
              )}
              {r.status === 'rejected' && r.vendor_response && (
                <p className="text-xs text-muted-foreground mt-2">{t('vendorReturns.rejectReason')} {r.vendor_response}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>

    {/* Dialog : Rejeter un retour (remplace le prompt natif) */}
    <AlertDialog open={!!rejectDialog} onOpenChange={(o) => { if (!o) { setRejectDialog(null); setRejectReason(''); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('vendorReturns.reject')}</AlertDialogTitle>
          <AlertDialogDescription>{t('vendorReturns.rejectPrompt')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-2">
          <Label className="text-sm">{t('vendorReturns.rejectReason')}</Label>
          <Textarea
            className="mt-1"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('vendorReturns.rejectPrompt')}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('vendorReturns.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={() => {
              if (!rejectReason.trim()) { toast.error(t('vendorReturns.rejectPrompt')); return; }
              const id = rejectDialog!.id;
              setRejectDialog(null);
              const reason = rejectReason;
              setRejectReason('');
              act(id, 'reject', reason);
            }}
          >
            {t('vendorReturns.reject')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Dialog : Confirmer réception (remplace la confirmation native) */}
    <AlertDialog open={!!receivedDialog} onOpenChange={(o) => { if (!o) setReceivedDialog(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('vendorReturns.receivePackage')}</AlertDialogTitle>
          <AlertDialogDescription>{t('vendorReturns.receivedConfirm')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('vendorReturns.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-[#16a34a] hover:bg-[#16a34a]/90"
            onClick={() => { const id = receivedDialog!.id; setReceivedDialog(null); act(id, 'received'); }}
          >
            {t('vendorReturns.receivePackage')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
