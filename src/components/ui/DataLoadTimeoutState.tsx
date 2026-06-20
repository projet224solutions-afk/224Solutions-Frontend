import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DataLoadTimeoutStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  onReload?: () => void;
  showPwaReset?: boolean;
}

async function resetPwaCache() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    console.log('[PWA] Cache reset completed');
  } catch (error) {
    console.error('[PWA] Cache reset failed', error);
  } finally {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('resetSw', '1');
    window.location.replace(currentUrl.toString());
  }
}

export function DataLoadTimeoutState({
  title = 'Impossible de charger les données',
  description = 'L’application est ouverte, mais le chargement des données a expiré.',
  onRetry,
  onReload,
  showPwaReset = true,
}: DataLoadTimeoutStateProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            className="w-full"
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>

          <Button
            type="button"
            className="w-full"
            variant="outline"
            onClick={onReload ?? (() => window.location.reload())}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Recharger l’application
          </Button>

          {showPwaReset && (
            <Button
              type="button"
              className="w-full"
              variant="ghost"
              onClick={() => {
                void resetPwaCache();
              }}
            >
              Réinitialiser le cache PWA
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DataLoadTimeoutState;
