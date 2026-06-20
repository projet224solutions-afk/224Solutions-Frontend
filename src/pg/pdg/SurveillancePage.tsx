import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from '@/hooks/useAuth';
import SurveillanceLogiqueDashboard from '@/components/pdg/SurveillanceLogiqueDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle } from 'lucide-react';

export default function SurveillancePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Vérifier que l'utilisateur est PDG
  useEffect(() => {
    if (user && user.role !== 'pdg') {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || user.role !== 'pdg') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-md bg-[#ff4000]/20 border-[#ff4000]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#ff4000]">
              <AlertCircle className="w-5 h-5" />
              Accès Refusé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">
              Seuls les utilisateurs avec le rôle PDG peuvent accéder à la surveillance logique.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔍 Surveillance Logique Globale</h1>
          <p className="text-slate-400">
            Système de monitoring en temps réel de toutes les fonctionnalités Vista-Flows
          </p>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto mb-6 bg-slate-800 border border-slate-700">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-600">
              📈 Dashboard
            </TabsTrigger>
            <TabsTrigger value="documentation" className="data-[state=active]:bg-blue-600">
              📚 Documentation
            </TabsTrigger>
            <TabsTrigger value="integration" className="data-[state=active]:bg-blue-600">
              🔌 Intégration
            </TabsTrigger>
            <TabsTrigger value="support" className="data-[state=active]:bg-blue-600">
              💬 Support
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <SurveillanceLogiqueDashboard />
          </TabsContent>

          {/* Tab: Documentation */}
          <TabsContent value="documentation" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-blue-400">📚 Guide d'Utilisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-slate-300">
                <div>
                  <h3 className="font-semibold text-white mb-2">{t('surveillancePage.quEstCeQueLe')}</h3>
                  <p>
                    Le système de surveillance logique est un outil de monitoring avancé qui détecte et corrige automatiquement
                    les anomalies logiques dans 100% des fonctionnalités de Vista-Flows.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">{t('surveillancePage.t120ReglesMetierSurveillees')}</h3>
                  <p>
                    Réparties sur 8 domaines:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                    <li><strong>POS_SALES</strong> {t('surveillancePage.ventesEtPointsDeVente')}</li>
                    <li><strong>INVENTORY</strong> {t('surveillancePage.gestionDesStocks4Regles')}</li>
                    <li><strong>PAYMENTS</strong> {t('surveillancePage.paiementsEtTransactions5Regles')}</li>
                    <li><strong>ORDERS</strong> {t('surveillancePage.commandesEtConfirmations4Regles')}</li>
                    <li><strong>DELIVERIES</strong> {t('surveillancePage.livraisonsEtTracking4Regles')}</li>
                    <li><strong>COMMISSIONS</strong> {t('surveillancePage.calculsDeCommissions3Regles')}</li>
                    <li><strong>SECURITY</strong> {t('surveillancePage.securiteEtPermissions3Regles')}</li>
                    <li><strong>WALLETS</strong> {t('surveillancePage.portefeuillesEtSoldes3Regles')}</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">{t('surveillancePage.severitesDesAnomalies')}</h3>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-3 bg-[#ff4000]/30 border border-[#ff4000] rounded">
                      <span className="font-semibold text-[#ff4000]">🔴 CRITICAL</span>
                      <p className="text-sm mt-1">{t('surveillancePage.impactImmediatSurLesDonnees')}</p>
                    </div>
                    <div className="p-3 bg-orange-900/30 border border-orange-500 rounded">
                      <span className="font-semibold text-orange-400">🟠 HIGH</span>
                      <p className="text-sm mt-1">{t('surveillancePage.impactImportantACourtTerme')}</p>
                    </div>
                    <div className="p-3 bg-[#ff4000]/30 border border-[#ff4000] rounded">
                      <span className="font-semibold text-[#ff4000]">🟡 MEDIUM</span>
                      <p className="text-sm mt-1">{t('surveillancePage.impactModereNotification')}</p>
                    </div>
                    <div className="p-3 bg-[#ff4000]/30 border border-[#ff4000] rounded">
                      <span className="font-semibold text-[#ff4000]">🟢 LOW</span>
                      <p className="text-sm mt-1">Impact minimal, information</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">Actions Disponibles</h3>
                  <ul className="space-y-2">
                    <li className="flex gap-2">
                      <span className="text-blue-400">🔍</span>
                      <span><strong>{t('surveillancePage.detecter')}</strong> {t('surveillancePage.lancerUneDetectionCompleteDes')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#ff4000]">✓</span>
                      <span><strong>Correction Auto</strong> {t('surveillancePage.appliquerAutomatiquementLaCorrection')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#04439e]">🔧</span>
                      <span><strong>Correction Manuelle</strong> {t('surveillancePage.approuverEtCorrigerManuellement')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#ff4000]">📈</span>
                      <span><strong>Exporter</strong> {t('surveillancePage.telechargerLAnalyseEnJson')}</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Integration */}
          <TabsContent value="integration" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-blue-400">{t('surveillancePage.detailsDeLIntegration')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-slate-300">
                <div>
                  <h3 className="font-semibold text-white mb-2">Architecture</h3>
                  <p className="mb-3">{t('surveillancePage.leSystemeUtiliseUneArchitecture')}</p>
                  <div className="bg-slate-900 p-4 rounded border border-slate-700 text-sm space-y-2 font-mono">
                    <div><span className="text-blue-400">Layer 1:</span> PostgreSQL + RLS</div>
                    <div><span className="text-[#ff4000]">Layer 2:</span> RPC Functions (SECURITY DEFINER)</div>
                    <div><span className="text-[#04439e]">Layer 3:</span> Edge Functions + Cron</div>
                    <div><span className="text-[#ff4000]">Layer 4:</span> React + Real-time Subscriptions</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">{t('surveillancePage.detectionAutomatique')}</h3>
                  <p className="mb-3">
                    La détection des anomalies s'exécute automatiquement toutes les <strong>5 minutes</strong> via un Cron Job Supabase.
                  </p>
                  <div className="bg-slate-900 p-4 rounded border border-slate-700 text-sm">
                    <p><strong>{t('surveillancePage.prochaineExecution')}</strong> {t('surveillancePage.dans5Minutes')}</p>
                    <p><strong>{t('surveillancePage.nombreDeReglesExecutees')}</strong> 120</p>
                    <p><strong>{t('surveillancePage.tempsDExecutionCible')}</strong> &lt; 500ms</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">Permissions</h3>
                  <p className="mb-3">{t('surveillancePage.seulsLesUtilisateursAvecLe')} <strong>PDG</strong> peuvent:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('surveillancePage.voirLesAnomaliesDetectees')}</li>
                    <li>{t('surveillancePage.approuverLesCorrections')}</li>
                    <li>{t('surveillancePage.accederAuxAuditTrails')}</li>
                    <li>{t('surveillancePage.exporterLesAnalyses')}</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">Audit Trail</h3>
                  <p>
                    Tous les événements (détection, correction, approbation) sont enregistrés de façon <strong>immuable</strong> dans
                    la table <code className="bg-slate-900 px-2 py-1 rounded">logic_audit</code>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Support */}
          <TabsContent value="support" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-blue-400">{t('surveillancePage.supportEtFaq')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-slate-300">
                <div>
                  <h3 className="font-semibold text-white mb-2 text-lg">{t('surveillancePage.questionsFrequentes')}</h3>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-slate-700 pb-4">
                    <h4 className="font-semibold text-white mb-2">{t('surveillancePage.qQuEstCeQu')}</h4>
                    <p>
                      Une anomalie est une violation d'une règle métier. Par exemple, si une vente est complétée mais le stock
                      n'a pas diminué, c'est une anomalie (règle POS_001).
                    </p>
                  </div>

                  <div className="border-b border-slate-700 pb-4">
                    <h4 className="font-semibold text-white mb-2">{t('surveillancePage.qQuEstCeQu2')}</h4>
                    <p>
                      Certaines anomalies peuvent être corrigées automatiquement sans intervention manuelle. Par exemple,
                      corriger un stock négatif à zéro. Les autres anomalies nécessitent l'approbation du PDG.
                    </p>
                  </div>

                  <div className="border-b border-slate-700 pb-4">
                    <h4 className="font-semibold text-white mb-2">{t('surveillancePage.qCommentExporterLesDonnees')}</h4>
                    <p>
                      Cliquez sur le bouton "Exporter analyse" pour télécharger un fichier JSON contenant toutes les anomalies
                      détectées, les corrections appliquées et l'audit trail.
                    </p>
                  </div>

                  <div className="border-b border-slate-700 pb-4">
                    <h4 className="font-semibold text-white mb-2">{t('surveillancePage.qQuelleEstLaFrequence')}</h4>
                    <p>
                      La détection automatique s'exécute toutes les 5 minutes. Vous pouvez aussi déclencher une détection
                      manuelle à tout moment en cliquant sur "Détecter anomalies".
                    </p>
                  </div>

                  <div className="border-b border-slate-700 pb-4">
                    <h4 className="font-semibold text-white mb-2">{t('surveillancePage.qLesDonneesSontElles')}</h4>
                    <p>
                      Oui. Le système utilise:
                    </p>
                    <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                      <li>{t('surveillancePage.rlsRowLevelSecurityPour')}</li>
                      <li>{t('surveillancePage.securityDefinerPourLesRpc')}</li>
                      <li>{t('surveillancePage.auditTrailImmuablePourLa')}</li>
                      <li>{t('surveillancePage.accesPdgOnlyViaLes')}</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h3 className="font-semibold text-white mb-3">{t('surveillancePage.contacterLeSupport')}</h3>
                  <p className="mb-3">{t('surveillancePage.enCasDeProbleme')}</p>
                  <ul className="space-y-2">
                    <li><strong>Email:</strong> support@vista-flows.com</li>
                    <li><strong>Documentation:</strong> docs.vista-flows.com/surveillance</li>
                    <li><strong>GitHub Issues:</strong> github.com/vista-flows/issues</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
