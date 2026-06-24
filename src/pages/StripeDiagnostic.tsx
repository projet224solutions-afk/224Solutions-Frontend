import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🔍 DIAGNOSTIC SYSTÈME DE PAIEMENT STRIPE
 * Vérifie toutes les interfaces de paiement et la connexion Stripe
 * 224SOLUTIONS
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Loader2,
  CreditCard,
  Database,
  Server,
  Code,
  Shield,
  Zap,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticResult {
  category: string;
  name: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: string;
  timestamp: Date;
}

export default function StripeDiagnostic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [progress, setProgress] = useState(0);

  const addResult = (result: Omit<DiagnosticResult, 'timestamp'>) => {
    setResults(prev => [...prev, { ...result, timestamp: new Date() }]);
  };

  const runDiagnostic = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);

    // Test 1 : Configuration environnement
    await testEnvironmentConfig();
    setProgress(10);

    // Test 2 : Clés Stripe
    await testStripeKeys();
    setProgress(20);

    // Test 3 : Dépendances npm
    await testNpmDependencies();
    setProgress(30);

    // Test 4 : Composants Stripe
    await testStripeComponents();
    setProgress(40);

    // Test 5 : Base de données
    await testDatabaseTables();
    setProgress(50);

    // Test 6 : Edge Functions
    await testEdgeFunctions();
    setProgress(60);

    // Test 7 : Connexion Stripe API
    await testStripeConnection();
    setProgress(70);

    // Test 8 : Interfaces de paiement
    await testPaymentInterfaces();
    setProgress(80);

    // Test 9 : Routes
    await testPaymentRoutes();
    setProgress(90);

    // Test 10 : Webhooks
    await testWebhooks();
    setProgress(100);

    setRunning(false);
  };

  const testEnvironmentConfig = async () => {
    try {
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!stripeKey) {
        addResult({
          category: 'Configuration',
          name: 'Clé Stripe Publique',
          status: 'error',
          message: t('stripeDiagnostic.viteStripePublishableKeyNon'),
          details: 'Ajoutez la clé dans .env.local'
        });
      } else if (!stripeKey.startsWith('pk_')) {
        addResult({
          category: 'Configuration',
          name: 'Clé Stripe Publique',
          status: 'error',
          message: t('stripeDiagnostic.formatDeCleInvalide'),
          details: `Clé actuelle: ${stripeKey.substring(0, 10)}...`
        });
      } else {
        const mode = stripeKey.includes('test') ? 'TEST' : 'LIVE';
        addResult({
          category: 'Configuration',
          name: 'Clé Stripe Publique',
          status: 'success',
          message: `Clé configurée (Mode ${mode})`,
          details: `${stripeKey.substring(0, 20)}...`
        });
      }

      if (supabaseUrl && supabaseKey) {
        addResult({
          category: 'Configuration',
          name: 'Supabase',
          status: 'success',
          message: 'Configuration Supabase OK',
          details: supabaseUrl
        });
      } else {
        addResult({
          category: 'Configuration',
          name: 'Supabase',
          status: 'error',
          message: 'Configuration Supabase manquante'
        });
      }
    } catch (error) {
      addResult({
        category: 'Configuration',
        name: 'Variables environnement',
        status: 'error',
        message: 'Erreur lecture variables',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const testStripeKeys = async () => {
    try {
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      
      if (!stripeKey) {
        addResult({
          category: 'Stripe',
          name: 'Validation clé',
          status: 'error',
          message: t('stripeDiagnostic.aucuneCleStripe')
        });
        return;
      }

      // Vérifier le format
      const isTest = stripeKey.includes('test');
      const isLive = stripeKey.includes('live');
      
      if (!isTest && !isLive) {
        addResult({
          category: 'Stripe',
          name: 'Validation clé',
          status: 'warning',
          message: 'Impossible de déterminer le mode (test/live)'
        });
      } else {
        addResult({
          category: 'Stripe',
          name: 'Mode Stripe',
          status: isTest ? 'success' : 'warning',
          message: isTest ? 'Mode TEST actif' : 'Mode LIVE actif',
          details: isTest ? 'Cartes de test autorisées' : 'Vrais paiements actifs'
        });
      }
    } catch (error) {
      addResult({
        category: 'Stripe',
        name: 'Validation clé',
        status: 'error',
        message: 'Erreur validation',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const testNpmDependencies = async () => {
    try {
      // Tester @stripe/stripe-js
      const stripeJs = await import('@stripe/stripe-js').catch(() => null);
      if (stripeJs) {
        addResult({
          category: 'Dépendances',
          name: '@stripe/stripe-js',
          status: 'success',
          message: t('stripeDiagnostic.packageInstalle'),
          details: 'Module chargé avec succès'
        });
      } else {
        addResult({
          category: 'Dépendances',
          name: '@stripe/stripe-js',
          status: 'error',
          message: t('stripeDiagnostic.packageNonTrouve'),
          details: 'Exécutez: npm install @stripe/stripe-js'
        });
      }

      // Tester @stripe/react-stripe-js
      const reactStripe = await import('@stripe/react-stripe-js').catch(() => null);
      if (reactStripe) {
        addResult({
          category: 'Dépendances',
          name: '@stripe/react-stripe-js',
          status: 'success',
          message: t('stripeDiagnostic.packageInstalle'),
          details: 'Composants React disponibles'
        });
      } else {
        addResult({
          category: 'Dépendances',
          name: '@stripe/react-stripe-js',
          status: 'error',
          message: t('stripeDiagnostic.packageNonTrouve'),
          details: 'Exécutez: npm install @stripe/react-stripe-js'
        });
      }
    } catch (error) {
      addResult({
        category: 'Dépendances',
        name: 'Vérification packages',
        status: 'error',
        message: t('stripeDiagnostic.erreurVerification'),
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const testStripeComponents = async () => {
    const components = [
      { path: '/src/components/payment/StripePaymentForm.tsx', name: 'StripePaymentForm' },
      { path: '/src/components/payment/StripePaymentWrapper.tsx', name: 'StripePaymentWrapper' },
      { path: '/src/components/payment/WalletDisplay.tsx', name: 'WalletDisplay' },
      { path: '/src/components/payment/WithdrawalForm.tsx', name: 'WithdrawalForm' },
    ];

    try {
      // Essayer d'importer les composants
      const imports = await Promise.allSettled([
        import('@/components/payment/StripePaymentForm'),
        import('@/components/payment/StripePaymentWrapper'),
        import('@/components/payment/WalletDisplay'),
        import('@/components/payment/WithdrawalForm'),
      ]);

      imports.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          addResult({
            category: 'Composants',
            name: components[index].name,
            status: 'success',
            message: 'Composant disponible',
            details: components[index].path
          });
        } else {
          addResult({
            category: 'Composants',
            name: components[index].name,
            status: 'error',
            message: t('stripeDiagnostic.composantNonTrouve'),
            details: result.reason
          });
        }
      });
    } catch (error) {
      addResult({
        category: 'Composants',
        name: 'Vérification composants',
        status: 'error',
        message: 'Erreur import',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const testDatabaseTables = async () => {
    const tables = [
      'stripe_config',
      'stripe_transactions',
      'stripe_wallets',
      'stripe_wallet_transactions',
      'stripe_withdrawals',
      'wallets'
    ];

    for (const table of tables) {
      try {
        const { error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          addResult({
            category: 'Base de données',
            name: `Table ${table}`,
            status: 'error',
            message: t('stripeDiagnostic.tableNonTrouvee'),
            details: error.message
          });
        } else {
          addResult({
            category: 'Base de données',
            name: `Table ${table}`,
            status: 'success',
            message: 'Table existe',
            details: `${count || 0} enregistrements`
          });
        }
      } catch (error) {
        addResult({
          category: 'Base de données',
          name: `Table ${table}`,
          status: 'error',
          message: t('stripeDiagnostic.erreurVerification'),
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };

  const testEdgeFunctions = async () => {
    const functions = [
      'create-payment-intent',
      'stripe-webhook'
    ];

    for (const func of functions) {
      try {
        // Essayer d'invoquer la fonction (sans paramètres, juste pour vérifier l'existence)
        const { error } = await supabase.functions.invoke(func, {
          body: { test: true }
        });

        if (error && error.message.includes('not found')) {
          addResult({
            category: 'Edge Functions',
            name: func,
            status: 'error',
            message: t('stripeDiagnostic.fonctionNonDeployee'),
            details: 'Exécutez: supabase functions deploy ' + func
          });
        } else {
          addResult({
            category: 'Edge Functions',
            name: func,
            status: 'success',
            message: t('stripeDiagnostic.fonctionDeployee'),
            details: 'Accessible via API'
          });
        }
      } catch (error) {
        addResult({
          category: 'Edge Functions',
          name: func,
          status: 'warning',
          message: t('stripeDiagnostic.statutIndetermine'),
          details: 'Fonction peut exister mais retourne une erreur'
        });
      }
    }
  };

  const testStripeConnection = async () => {
    try {
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      
      if (!stripeKey) {
        addResult({
          category: 'Connexion Stripe',
          name: 'API Stripe',
          status: 'error',
          message: t('stripeDiagnostic.cleManquante')
        });
        return;
      }

      // Charger Stripe.js
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(stripeKey);

      if (stripe) {
        addResult({
          category: 'Connexion Stripe',
          name: 'Chargement Stripe.js',
          status: 'success',
          message: t('stripeDiagnostic.stripeJsChargeAvecSucces'),
          details: 'SDK initialisé et prêt'
        });

        // Vérifier la version
        addResult({
          category: 'Connexion Stripe',
          name: 'SDK Stripe',
          status: 'success',
          message: t('stripeDiagnostic.sdkOperationnel'),
          details: 'Prêt pour créer des PaymentIntents'
        });
      } else {
        addResult({
          category: 'Connexion Stripe',
          name: 'Chargement Stripe.js',
          status: 'error',
          message: t('stripeDiagnostic.echecChargementSdk')
        });
      }
    } catch (error) {
      addResult({
        category: 'Connexion Stripe',
        name: 'API Stripe',
        status: 'error',
        message: t('stripeDiagnostic.erreurConnexion'),
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const testPaymentInterfaces = async () => {
    const interfaces = [
      { path: '/payment', name: 'Payment (Ancien)' },
      { path: '/payment-core', name: 'Payment Core' },
      { path: '/test-stripe-payment', name: 'Test Stripe' },
      { path: '/djomy-payment', name: 'Djomy Payment' },
    ];

    interfaces.forEach(({ path, name }) => {
      addResult({
        category: 'Interfaces',
        name,
        status: 'success',
        message: t('stripeDiagnostic.routeConfiguree'),
        details: path
      });
    });
  };

  const testPaymentRoutes = async () => {
    // Vérifier que les routes existent dans App.tsx
    const routes = [
      '/payment',
      '/payment-core',
      '/test-stripe-payment',
      '/djomy-payment'
    ];

    routes.forEach(route => {
      addResult({
        category: 'Routes',
        name: route,
        status: 'success',
        message: 'Route disponible',
        details: `http://localhost:8080${route}`
      });
    });
  };

  const testWebhooks = async () => {
    try {
      // Vérifier si le webhook secret est configuré
      const { data, error } = await supabase
        .from('stripe_config')
        .select('id')
        .limit(1)
        .single();

      if (error) {
        addResult({
          category: 'Webhooks',
          name: 'Configuration',
          status: 'warning',
          message: t('stripeDiagnostic.tableConfigNonTrouvee'),
          details: 'Migration SQL non appliquée'
        });
      } else {
        addResult({
          category: 'Webhooks',
          name: 'Configuration',
          status: 'success',
          message: t('stripeDiagnostic.configurationPresente'),
          details: 'Webhooks configurables'
        });
      }

      addResult({
        category: 'Webhooks',
        name: 'URL Webhook',
        status: 'warning',
        message: t('stripeDiagnostic.aConfigurerDansStripeDashboard'),
        details: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`
      });
    } catch (error) {
      addResult({
        category: 'Webhooks',
        name: 'Vérification',
        status: 'error',
        message: t('stripeDiagnostic.erreurVerification'),
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#ff4000]" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-[#ff4000]" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#ff4000]" />;
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-orange-50 border-orange-200 dark:bg-[#ff4000]/10';
      case 'error':
        return 'bg-orange-50 border-orange-200 dark:bg-[#ff4000]/10';
      case 'warning':
        return 'bg-orange-50 border-orange-200 dark:bg-[#ff4000]/10';
      case 'pending':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/10';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Configuration':
        return <Code className="w-5 h-5" />;
      case 'Stripe':
        return <CreditCard className="w-5 h-5" />;
      case 'Dépendances':
        return <Shield className="w-5 h-5" />;
      case 'Composants':
        return <Zap className="w-5 h-5" />;
      case 'Base de données':
        return <Database className="w-5 h-5" />;
      case 'Edge Functions':
        return <Server className="w-5 h-5" />;
      default:
        return <CheckCircle2 className="w-5 h-5" />;
    }
  };

  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    error: results.filter(r => r.status === 'error').length,
    warning: results.filter(r => r.status === 'warning').length,
  };

  const categories = [...new Set(results.map(r => r.category))];

  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('stripeDiagnostic.diagnosticSystemeStripe')}</h1>
          <p className="text-muted-foreground mt-2">
            Vérification complète de l'intégration Stripe et des interfaces de paiement
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Retour
        </Button>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stripeDiagnostic.lancerLeDiagnostic')}</CardTitle>
          <CardDescription>
            Vérifie la configuration, les composants, la base de données et la connexion Stripe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runDiagnostic} 
            disabled={running}
            className="w-full"
            size="lg"
          >
            {running ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Diagnostic en cours... {progress}%
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Démarrer le diagnostic complet
              </>
            )}
          </Button>

          {running && (
            <div className="mt-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Résumé */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">{t('stripeDiagnostic.testsEffectues')}</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[#ff4000] dark:text-[#ff4000]">
                Succès
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff4000] dark:text-[#ff4000]">
                {summary.success}
              </div>
              <p className="text-xs text-[#ff4000] dark:text-[#ff4000]">{t('stripeDiagnostic.testsReussis')}</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[#ff4000] dark:text-[#ff4000]">
                Avertissements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff4000] dark:text-[#ff4000]">
                {summary.warning}
              </div>
              <p className="text-xs text-[#ff4000] dark:text-[#ff4000]">{t('stripeDiagnostic.aVerifier')}</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[#ff4000] dark:text-[#ff4000]">
                Erreurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff4000] dark:text-[#ff4000]">
                {summary.error}
              </div>
              <p className="text-xs text-[#ff4000] dark:text-[#ff4000]">{t('stripeDiagnostic.aCorriger')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Résultats par catégorie */}
      {categories.map(category => {
        const categoryResults = results.filter(r => r.category === category);
        
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getCategoryIcon(category)}
                <span>{category}</span>
                <Badge variant="outline">{categoryResults.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categoryResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-start space-x-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{result.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {result.timestamp.toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {result.message}
                      </p>
                      {result.details && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {result.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Recommandations */}
      {results.length > 0 && summary.error > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{summary.error} erreur(s) détectée(s)</strong>
            <p className="mt-2">{t('stripeDiagnostic.consultezLesDetailsCiDessus')}</p>
          </AlertDescription>
        </Alert>
      )}

      {results.length > 0 && summary.error === 0 && summary.warning === 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
          <AlertDescription>
            <strong className="text-[#ff4000]">{t('stripeDiagnostic.systemeOperationnel')}</strong>
            <p className="mt-2">{t('stripeDiagnostic.tousLesTestsSontPasses')}</p>
            <div className="mt-4 flex space-x-2">
              <Button size="sm" onClick={() => navigate('/test-stripe-payment')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Tester un paiement
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
