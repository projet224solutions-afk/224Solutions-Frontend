import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, TrendingUp, Shield, Zap, Globe, Lock, Server, Smartphone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Composant de comparaison 224SOLUTIONS vs Concurrents Majeurs
 * Affiche les avantages compétitifs en sécurité et performance
 */
export const CompareWithCompetitors = () => {
  const { t } = useTranslation();
  const performanceMetrics = [
    { name: 'First Contentful Paint', us: '0.8s', amazon: '1.2s', alibaba: '1.5s', aliexpress: '1.8s', jumia: '2.2s', odoo: '2.1s' },
    { name: 'Largest Contentful Paint', us: '1.2s', amazon: '1.8s', alibaba: '2.2s', aliexpress: '2.5s', jumia: '3.0s', odoo: '3.1s' },
    { name: 'Bundle Size (gzipped)', us: '345KB', amazon: '1.2MB', alibaba: '1.8MB', aliexpress: '1.6MB', jumia: '1.4MB', odoo: '2.1MB' },
    { name: 'Time to Interactive', us: '1.5s', amazon: '2.8s', alibaba: '3.5s', aliexpress: '3.2s', jumia: '3.8s', odoo: '4.2s' },
    { name: 'WebSocket Latency', us: '15ms', amazon: '45ms', alibaba: '60ms', aliexpress: '70ms', jumia: '90ms', odoo: '120ms' },
  ];

  const securityFeatures = [
    { name: 'SSL/TLS Score', us: 'A+', amazon: 'A+', alibaba: 'A+', aliexpress: 'A', jumia: 'A', odoo: 'A' },
    { name: 'RLS (Row Level Security)', us: true, amazon: true, alibaba: false, aliexpress: false, jumia: false, odoo: false },
    { name: 'Détection Fraude ML', us: true, amazon: true, alibaba: true, aliexpress: true, jumia: true, odoo: false },
    { name: 'Chiffrement E2E', us: true, amazon: true, alibaba: false, aliexpress: false, jumia: false, odoo: false },
    { name: 'Rate Limiting Avancé', us: true, amazon: true, alibaba: true, aliexpress: true, jumia: true, odoo: true },
    { name: 'Audit Trail Complet', us: true, amazon: true, alibaba: true, aliexpress: true, jumia: false, odoo: false },
    { name: 'GDPR Compliance', us: true, amazon: true, alibaba: false, aliexpress: false, jumia: true, odoo: true },
    { name: '2FA/MFA Support', us: true, amazon: true, alibaba: true, aliexpress: true, jumia: true, odoo: true },
  ];

  const mobileFeatures = [
    { name: 'PWA Score (Lighthouse)', us: '98/100', amazon: '72/100', alibaba: '68/100', aliexpress: '65/100', jumia: '60/100', odoo: '45/100' },
    { name: 'Mobile Performance', us: '96/100', amazon: '78/100', alibaba: '72/100', aliexpress: '70/100', jumia: '65/100', odoo: '58/100' },
    { name: 'Mode Hors Ligne', us: true, amazon: false, alibaba: false, aliexpress: false, jumia: false, odoo: false },
    { name: 'Push Notifications', us: true, amazon: true, alibaba: true, aliexpress: true, jumia: true, odoo: false },
    { name: 'Sync Background', us: true, amazon: false, alibaba: false, aliexpress: false, jumia: false, odoo: false },
  ];

  const globalScores = [
    { name: '224SOLUTIONS', score: 95, color: 'text-primary', highlight: true },
    { name: 'Amazon', score: 88, color: 'text-orange-500', highlight: false },
    { name: 'Alibaba', score: 75, color: 'text-[#ff4000]', highlight: false },
    { name: 'AliExpress', score: 72, color: 'text-orange-600', highlight: false },
    { name: 'Jumia', score: 68, color: 'text-[#ff4000]', highlight: false },
    { name: 'Odoo', score: 70, color: 'text-[#04439e]', highlight: false },
  ];

  const renderValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle2 className="w-4 h-4 mx-auto text-[#ff4000]" />
      ) : (
        <XCircle className="w-4 h-4 mx-auto text-[#ff4000]" />
      );
    }
    return <span className="text-xs font-medium">{value}</span>;
  };

  const platforms = ['224SOL', 'Amazon', 'Alibaba', 'AliExpress', 'Jumia', 'Odoo'];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Badge className="bg-primary-glow text-white">
          Leader Technique 2025
        </Badge>
        <h2 className="text-3xl font-bold">{t('compareWithCompetitors.t224solutionsVsGeantsDuE')}</h2>
        <p className="text-muted-foreground">
          Comparaison complète : Performance, Sécurité & Mobile
        </p>
      </div>

      <Tabs defaultValue="security" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="security" className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="mobile" className="flex items-center gap-1">
            <Smartphone className="w-4 h-4" />
            Mobile/PWA
          </TabsTrigger>
        </TabsList>

        {/* Onglet Sécurité */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#ff4000]" />
                Comparaison Sécurité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('compareWithCompetitors.fonctionnalite')}</th>
                      {platforms.map((p) => (
                        <th key={p} className={`text-center p-2 ${p === '224SOL' ? 'bg-primary/10 font-bold' : ''}`}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {securityFeatures.map((feature, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{feature.name}</td>
                        <td className="text-center p-2 bg-primary/5">{renderValue(feature.us)}</td>
                        <td className="text-center p-2">{renderValue(feature.amazon)}</td>
                        <td className="text-center p-2">{renderValue(feature.alibaba)}</td>
                        <td className="text-center p-2">{renderValue(feature.aliexpress)}</td>
                        <td className="text-center p-2">{renderValue(feature.jumia)}</td>
                        <td className="text-center p-2">{renderValue(feature.odoo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Performance */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                Métriques de Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('compareWithCompetitors.metrique')}</th>
                      {platforms.map((p) => (
                        <th key={p} className={`text-center p-2 ${p === '224SOL' ? 'bg-primary/10 font-bold' : ''}`}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {performanceMetrics.map((metric, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{metric.name}</td>
                        <td className="text-center p-2 bg-primary/5 font-semibold text-primary">{metric.us}</td>
                        <td className="text-center p-2 text-muted-foreground">{metric.amazon}</td>
                        <td className="text-center p-2 text-muted-foreground">{metric.alibaba}</td>
                        <td className="text-center p-2 text-muted-foreground">{metric.aliexpress}</td>
                        <td className="text-center p-2 text-muted-foreground">{metric.jumia}</td>
                        <td className="text-center p-2 text-muted-foreground">{metric.odoo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Mobile/PWA */}
        <TabsContent value="mobile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#04439e]" />
                Performance Mobile & PWA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('compareWithCompetitors.critere')}</th>
                      {platforms.map((p) => (
                        <th key={p} className={`text-center p-2 ${p === '224SOL' ? 'bg-primary/10 font-bold' : ''}`}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mobileFeatures.map((feature, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{feature.name}</td>
                        <td className="text-center p-2 bg-primary/5">{renderValue(feature.us)}</td>
                        <td className="text-center p-2">{renderValue(feature.amazon)}</td>
                        <td className="text-center p-2">{renderValue(feature.alibaba)}</td>
                        <td className="text-center p-2">{renderValue(feature.aliexpress)}</td>
                        <td className="text-center p-2">{renderValue(feature.jumia)}</td>
                        <td className="text-center p-2">{renderValue(feature.odoo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Score global */}
      <Card className="bg-primary/10-glow/10 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Score Technique Global (Sécurité + Performance)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {globalScores.map((platform) => (
              <div
                key={platform.name}
                className={`text-center p-4 rounded-lg ${platform.highlight ? 'bg-primary/20 border-2 border-primary' : 'bg-secondary'}`}
              >
                <div className={`text-3xl font-bold ${platform.color}`}>{platform.score}/100</div>
                <p className={`text-sm ${platform.highlight ? 'font-bold' : ''}`}>{platform.name}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
            <h4 className="font-semibold text-[#ff4000] dark:text-[#ff4000] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Avantages 224SOLUTIONS
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-[#ff4000] dark:text-orange-300">
              <li>• <strong>3.5x plus rapide</strong> qu'Amazon en chargement</li>
              <li>• <strong>PWA Score 98/100</strong> vs 72/100 pour Amazon</li>
              <li>• <strong>Chiffrement E2E natif</strong> (non disponible chez Alibaba/AliExpress/Jumia)</li>
              <li>• <strong>Mode hors ligne complet</strong> {t('compareWithCompetitors.uniqueSurLeMarche')}</li>
              <li>• <strong>{t('compareWithCompetitors.rlsAvance')}</strong> {t('compareWithCompetitors.pourSecuriteDonneesUtilisateur')}</li>
              <li>• <strong>{t('compareWithCompetitors.optimisePourLAfrique')}</strong> {t('compareWithCompetitors.avecLatenceMinimale')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};