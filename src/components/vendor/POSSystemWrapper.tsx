/**
 * WRAPPER POS SYSTEM - Gestion des erreurs et fallback
 * S'assure que le POS s'affiche toujours correctement
 */

import React, { Suspense } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, CreditCard, ShoppingCart, Calculator } from 'lucide-react';
import { toast } from 'sonner';

// Import dynamique du POS (suppression du fallback démo)
const POSSystem = React.lazy(() => import('./POSSystem'));

// Composant de chargement
const POSLoading = () => {
  const { t } = useTranslation();
  return (
  <Card className="border-0 shadow-xl rounded-2xl">
    <CardHeader className="bg-[#04439e]/5 rounded-t-2xl">
      <CardTitle className="text-2xl font-bold bg-[#04439e] bg-clip-text text-transparent flex items-center gap-3">
        <CreditCard className="w-7 h-7 text-blue-600" />
        POS - Point de Vente
      </CardTitle>
    </CardHeader>
    <CardContent className="p-8">
      <div className="flex items-center justify-center space-y-4 flex-col">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 text-lg">{t('pOSSystemWrapper.chargementDuSystemeDeCaisse')}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span>{t('pOSSystemWrapper.produits')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            <span>Calculs</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>{t('pOSSystemWrapper.paiements')}</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
  );
};

// Composant d'erreur
const POSError = ({ error, retry }: { error: Error, retry: () => void }) => {
  const { t } = useTranslation();
  return (
  <Card className="border-0 shadow-xl rounded-2xl border-orange-200">
    <CardHeader className="bg-[#ff4000]/5 rounded-t-2xl">
      <CardTitle className="text-2xl font-bold text-[#ff4000] flex items-center gap-3">
        <AlertTriangle className="w-7 h-7" />
        Erreur POS - Point de Vente
      </CardTitle>
    </CardHeader>
    <CardContent className="p-8 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-[#ff4000]" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Impossible de charger le système de caisse
        </h3>
        <p className="text-gray-600 mb-4">
          Une erreur s'est produite lors du chargement du POS. Cela peut être dû à :
        </p>
        <ul className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-2">
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#ff4000] rounded-full"></div>
            Configuration Supabase manquante ou incorrecte
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#ff4000] rounded-full"></div>
            Problème de connexion réseau
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#ff4000] rounded-full"></div>
            Erreur de chargement des composants
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={retry}
          className="bg-[#04439e] rounded-xl"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>

        <Button
          onClick={() => {
            toast.info(t('pOSSystemWrapper.redirectionVersLeSupport'));
            // Ici on pourrait rediriger vers une page de support
          }}
          variant="outline"
          className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
        >
          Contacter le Support
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-semibold text-blue-800 mb-2">💡 Solution Rapide</h4>
        <p className="text-sm text-blue-700">
          Vérifiez que vos variables d'environnement Supabase sont correctement configurées dans le fichier <code>.env.local</code>
        </p>
      </div>

      {error && (
        <details className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <summary className="font-semibold text-gray-800 cursor-pointer">
            Détails de l'erreur (pour les développeurs)
          </summary>
          <pre className="text-xs text-gray-600 mt-2 overflow-auto">
            {error.message}
          </pre>
        </details>
      )}
    </CardContent>
  </Card>
  );
};

// Composant de fallback simple
const _POSFallback = () => {
  const { t } = useTranslation();
  return (
  <Card className="border-0 shadow-xl rounded-2xl bg-[#04439e]/5">
    <CardHeader>
      <CardTitle className="text-2xl font-bold bg-[#04439e] bg-clip-text text-transparent flex items-center gap-3">
        <CreditCard className="w-7 h-7 text-blue-600" />
        POS - Point de Vente (Mode Simplifié)
      </CardTitle>
    </CardHeader>
    <CardContent className="p-8">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-[#04439e] rounded-full flex items-center justify-center mx-auto">
          <CreditCard className="w-10 h-10 text-white" />
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Système de Caisse 224Solutions
          </h3>
          <p className="text-gray-600">
            Le système POS complet est en cours de chargement. En attendant, vous pouvez utiliser les fonctionnalités de base.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-semibold text-gray-800">{t('pOSSystemWrapper.gestionProduits')}</h4>
            <p className="text-sm text-gray-600">{t('pOSSystemWrapper.catalogueEtInventaire')}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <Calculator className="w-8 h-8 text-[#ff4000] mx-auto mb-2" />
            <h4 className="font-semibold text-gray-800">Calculs Automatiques</h4>
            <p className="text-sm text-gray-600">Prix, taxes, remises</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <CreditCard className="w-8 h-8 text-[#04439e] mx-auto mb-2" />
            <h4 className="font-semibold text-gray-800">{t('pOSSystemWrapper.paiements')}</h4>
            <p className="text-sm text-gray-600">{t('pOSSystemWrapper.especesCarteMobile')}</p>
          </div>
        </div>

        <Button
          onClick={() => window.location.reload()}
          className="bg-[#04439e] rounded-xl"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Recharger le POS Complet
        </Button>
      </div>
    </CardContent>
  </Card>
  );
};

// Composant wrapper principal
class POSErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{ error: Error; retry: () => void }> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: unknown) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Erreur POS System:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// Export du wrapper principal
export default function POSSystemWrapper() {
  const { t } = useTranslation();
  const [forceReload, _setForceReload] = React.useState(0);

  return (
    <POSErrorBoundary fallback={POSError}>
      <Suspense fallback={<POSLoading />}>
        <div key={forceReload} className="h-full">
          <POSSystem />
        </div>
      </Suspense>
    </POSErrorBoundary>
  );
}
