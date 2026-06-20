import { Component, ErrorInfo, ReactNode } from 'react';
import { errorMonitor } from '@/services/errorMonitor';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  allowOfflineFallback?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Vérifie si l'erreur est liée au mode offline
 */
const isOfflineError = (error: Error | null): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    !navigator.onLine ||
    message.includes('failed to fetch') ||
    message.includes('failed to load') ||
    message.includes('network') ||
    message.includes('dynamically imported module') ||
    message.includes('offline')
  );
};

/**
 * Vérifie si l'erreur est liée à Stripe
 */
const isStripeError = (error: Error | null): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return message.includes('stripe');
};

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    console.error('❌ [ErrorBoundary] Erreur capturée:', error);
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ [ErrorBoundary] Uncaught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Ne pas logger les erreurs offline (c'est normal)
    if (isOfflineError(error)) {
      console.warn('[ErrorBoundary] Erreur offline ignorée pour le monitoring');
      return;
    }

    // Log l'erreur dans le système de monitoring
    try {
      errorMonitor.logError({
        module: 'react_error_boundary',
        error_type: error.name,
        error_message: error.message,
        stack_trace: error.stack,
        severity: 'critique',
        metadata: {
          componentStack: errorInfo.componentStack,
        },
      });
    } catch (monitorError) {
      console.error('❌ Erreur lors du logging:', monitorError);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const offline = this.props.allowOfflineFallback && isOfflineError(this.state.error);
      const stripeErr = isStripeError(this.state.error);

      // UI spéciale pour mode hors ligne
      if (offline) {
        return (
          <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="max-w-lg w-full">
              <CardHeader>
              <div className="flex items-center gap-2" style={{ color: '#04439e' }}>
                  <WifiOff className="h-6 w-6" />
                  <CardTitle style={{ color: '#04439e' }}>Mode hors ligne</CardTitle>
                </div>
                <CardDescription>
                  Cette page n'est pas disponible hors connexion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {stripeErr
                    ? "Les paiements nécessitent une connexion internet active."
                    : "Cette fonctionnalité nécessite une connexion internet. Veuillez vous reconnecter et réessayer."
                  }
                </p>

                <div className="flex gap-2">
                  <Button onClick={this.handleGoHome} variant="outline" style={{ borderColor: '#04439e', color: '#04439e' }}>
                    Accueil
                  </Button>
                  <Button onClick={this.handleReload} className="gap-2" style={{ backgroundColor: '#04439e', color: '#fff' }}>
                    <RefreshCw className="h-4 w-4" />
                    Réessayer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2" style={{ color: '#04439e' }}>
                <AlertTriangle className="h-6 w-6" />
                <CardTitle style={{ color: '#04439e' }}>Une erreur s'est produite</CardTitle>
              </div>
              <CardDescription>
                L'application a rencontré un problème inattendu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono text-destructive">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline" style={{ borderColor: '#04439e', color: '#04439e' }}>
                  Réessayer
                </Button>
                <Button onClick={this.handleReload} className="gap-2" style={{ backgroundColor: '#04439e', color: '#fff' }}>
                  <RefreshCw className="h-4 w-4" />
                  Recharger la page
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    Détails techniques
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
