/**
 * 🩺 DIAGNOSTIC D'APPEL - 224SOLUTIONS
 * Teste tout ce dont un appel audio/vidéo a besoin et affiche le résultat
 * en clair à l'écran (pas besoin d'ouvrir la console).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stethoscope, CheckCircle2, XCircle, AlertTriangle, Loader2, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { requestNotificationPermission, getCurrentToken } from '@/lib/firebaseMessaging';
import { toast } from 'sonner';

type Status = 'ok' | 'fail' | 'warn' | 'pending';

interface CheckRow {
  label: string;
  status: Status;
  detail?: string;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'ok') return <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />;
  if (status === 'fail') return <XCircle className="w-5 h-5 text-red-600 shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
  return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />;
}

export default function CallDiagnostics({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [running, setRunning] = useState(false);
  const [enablingNotif, setEnablingNotif] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  const runDiagnostics = async () => {
    setRunning(true);
    const results: CheckRow[] = [];

    // 1) Contexte sécurisé
    const secure = typeof window !== 'undefined' && window.isSecureContext;
    results.push({
      label: 'Contexte sécurisé (HTTPS / localhost)',
      status: secure ? 'ok' : 'fail',
      detail: secure
        ? `Origine: ${window.location.origin}`
        : `Origine NON sécurisée: ${window.location.origin} → micro/caméra bloqués`,
    });

    // 2) API mediaDevices disponible
    const hasMediaApi = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    results.push({
      label: 'API micro/caméra disponible',
      status: hasMediaApi ? 'ok' : 'fail',
      detail: hasMediaApi ? 'navigator.mediaDevices.getUserMedia présent' : 'Indisponible (souvent = contexte non sécurisé)',
    });
    setRows([...results]);

    // 3) Appareils détectés
    let hasMic = false;
    let hasCam = false;
    if (hasMediaApi) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        hasMic = devices.some((d) => d.kind === 'audioinput');
        hasCam = devices.some((d) => d.kind === 'videoinput');
        results.push({
          label: 'Microphone détecté',
          status: hasMic ? 'ok' : 'fail',
          detail: hasMic ? '' : 'Aucun microphone trouvé sur cet appareil',
        });
        results.push({
          label: 'Caméra détectée',
          status: hasCam ? 'ok' : 'warn',
          detail: hasCam ? '' : 'Aucune caméra (les appels VIDÉO ne marcheront pas, l’audio oui)',
        });
      } catch (e: any) {
        results.push({ label: 'Énumération des appareils', status: 'fail', detail: e?.message });
      }
    }
    setRows([...results]);

    // 4) Permissions (si l'API existe)
    if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      for (const name of ['microphone', 'camera'] as const) {
        try {
          const p = await (navigator as any).permissions.query({ name });
          results.push({
            label: `Permission ${name === 'microphone' ? 'micro' : 'caméra'}`,
            status: p.state === 'granted' ? 'ok' : p.state === 'denied' ? 'fail' : 'warn',
            detail: p.state === 'denied'
              ? 'REFUSÉE — clique sur l’icône 🔒/caméra dans la barre d’adresse → Autoriser'
              : `état: ${p.state}`,
          });
        } catch {
          /* certains navigateurs ne supportent pas la query caméra */
        }
      }
    }
    setRows([...results]);

    // 5) Test réel getUserMedia AUDIO
    if (hasMediaApi && hasMic) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        s.getTracks().forEach((t) => t.stop());
        results.push({ label: 'Test accès micro (audio)', status: 'ok', detail: 'Micro accessible ✔' });
      } catch (e: any) {
        results.push({
          label: 'Test accès micro (audio)',
          status: 'fail',
          detail: `${e?.name}: ${e?.message}`,
        });
      }
    }

    // 6) Test réel getUserMedia VIDÉO (si caméra)
    if (hasMediaApi && hasCam) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        s.getTracks().forEach((t) => t.stop());
        results.push({ label: 'Test accès caméra (vidéo)', status: 'ok', detail: 'Caméra accessible ✔' });
      } catch (e: any) {
        results.push({
          label: 'Test accès caméra (vidéo)',
          status: 'fail',
          detail: `${e?.name}: ${e?.message} (souvent: caméra déjà utilisée par un autre onglet/app)`,
        });
      }
    }

    // 7) Notifications push (pour recevoir les appels app fermée)
    const notifSupported = typeof Notification !== 'undefined';
    const perm = notifSupported ? Notification.permission : 'denied';
    setNotifGranted(perm === 'granted');
    results.push({
      label: 'Notifications autorisées (appels app fermée)',
      status: perm === 'granted' ? 'ok' : perm === 'denied' ? 'fail' : 'warn',
      detail:
        perm === 'granted'
          ? 'Tu peux recevoir un appel même app fermée.'
          : perm === 'denied'
          ? 'Bloquées — débloque-les dans les réglages du navigateur.'
          : 'Non activées — clique « Activer les notifications » ci-dessous.',
    });
    results.push({
      label: 'Token de notification enregistré (FCM)',
      status: getCurrentToken() ? 'ok' : 'warn',
      detail: getCurrentToken()
        ? 'Appareil enregistré pour recevoir les appels.'
        : 'Aucun token — active les notifications pour t’enregistrer.',
    });

    setRows([...results]);
    setRunning(false);
  };

  const enableNotifications = async () => {
    setEnablingNotif(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        toast.success('🔔 Notifications d’appel activées');
        setNotifGranted(true);
      } else {
        toast.error(
          Notification?.permission === 'denied'
            ? 'Notifications bloquées : autorise-les dans les réglages du navigateur.'
            : 'Activation impossible (configuration push manquante côté serveur ?).'
        );
      }
    } catch {
      toast.error('Erreur lors de l’activation des notifications.');
    } finally {
      setEnablingNotif(false);
      runDiagnostics();
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn('text-muted-foreground', className)}
        title="Diagnostic appel"
        onClick={() => {
          setOpen(true);
          setRows([]);
          runDiagnostics();
        }}
      >
        <Stethoscope className="w-5 h-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5" /> Diagnostic des appels
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {rows.length === 0 && running && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
              </p>
            )}
            {rows.map((r, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-2.5">
                <StatusIcon status={r.status} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.detail && (
                    <p className={cn(
                      'text-xs break-words',
                      r.status === 'fail' ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {r.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!notifGranted && (
            <Button
              onClick={enableNotifications}
              disabled={enablingNotif}
              variant="default"
              className="w-full"
            >
              {enablingNotif ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
              Activer les notifications d'appel
            </Button>
          )}

          <Button onClick={runDiagnostics} disabled={running} variant="outline" className="w-full">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Relancer le diagnostic
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
