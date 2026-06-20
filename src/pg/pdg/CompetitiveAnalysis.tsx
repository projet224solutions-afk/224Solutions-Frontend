import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { Shield, TrendingUp, Zap, Award, ArrowLeft, Loader2, BarChart3, Lock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer, ResponsiveGrid } from '@/components/responsive/ResponsiveContainer';

interface PlatformScore {
  name: string;
  scores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  innovations?: string[];
  overall_score?: number;
  recommendations?: string[];
}

interface AnalysisResult {
  platforms: PlatformScore[];
  summary: string;
  recommendations: string[];
  ranking?: string[];
  solutions_224_priorities?: Array<{
    priority: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
  }>;
}

export default function CompetitiveAnalysis() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const [loadingCompetitive, setLoadingCompetitive] = useState<boolean>(false);
  const [loadingSecurity, setLoadingSecurity] = useState<boolean>(false);
  const [competitiveAnalysis, setCompetitiveAnalysis] = useState<AnalysisResult | null>(null);
  const [securityAnalysis, setSecurityAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const competitors = ['Amazon', 'Alibaba', 'Odoo', 'AliExpress', 'Africa Coin'];
  const criteria = ['Sécurité', 'Fiabilité', 'Fonctionnalité', 'Innovation'];

  const runCompetitiveAnalysis = async () => {
    setLoadingCompetitive(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('competitive-analysis', {
        body: { competitors, criteria }
      });

      if (error) {
        throw new Error(`Erreur API: ${error.message}`);
      }

      if (data?.success && data?.analysis) {
        // Validation des données reçues
        if (!data.analysis.platforms || !Array.isArray(data.analysis.platforms)) {
          throw new Error('Format de données invalide: platforms manquant');
        }

        setCompetitiveAnalysis(data.analysis);
        setError(null);
        toast.success(t('competitiveAnalysis.analyseComparativeTermineeAvecSucces'));
      } else {
        throw new Error(data?.error || 'Aucune analyse reçue du serveur');
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur inconnue lors de l\'analyse';
      console.error('✕ Error running competitive analysis:', {
        error,
        message: errorMessage,
        timestamp: new Date().toISOString()
      });

      setError(errorMessage);
      setCompetitiveAnalysis(null);
      toast.error(`Échec de l'analyse: ${errorMessage}`);
    } finally {
      setLoadingCompetitive(false);
    }
  };

  const runSecurityAnalysis = async () => {
    setLoadingSecurity(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('security-analysis');

      if (error) {
        throw new Error(`Erreur API: ${error.message}`);
      }

      if (data?.analysis) {
        // Validation des données
        if (!data.analysis.platforms || !Array.isArray(data.analysis.platforms)) {
          throw new Error('Format de données invalide: platforms manquant');
        }

        setSecurityAnalysis(data.analysis);
        setError(null);
        toast.success(t('competitiveAnalysis.analyseDeSecuriteTermineeAvec'));
      } else {
        throw new Error('Aucune analyse reçue du serveur');
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur inconnue';
      console.error('✕ Security analysis error:', {
        error,
        message: errorMessage,
        timestamp: new Date().toISOString()
      });

      setError(errorMessage);
      setSecurityAnalysis(null);
      toast.error(`Échec de l'analyse de sécurité: ${errorMessage}`);
    } finally {
      setLoadingSecurity(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80 || score >= 8) return 'text-[#ff4000] dark:text-[#ff4000]';
    if (score >= 60 || score >= 6) return 'text-[#ff4000] dark:text-[#ff4000]';
    return 'text-[#ff4000] dark:text-[#ff4000]';
  };

  const getImpactColor = (impact: string) => {
    if (impact === 'high') return 'destructive';
    if (impact === 'medium') return 'default';
    return 'secondary';
  };

  const getEffortColor = (effort: string) => {
    if (effort === 'high') return 'destructive';
    if (effort === 'medium') return 'default';
    return 'secondary';
  };

  return (
    <div className="min-h-screen bg-background">
      <ResponsiveContainer>
        <div className="space-y-6 py-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/pdg')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Analyse Concurrentielle</h1>
              <p className="text-muted-foreground">
                Comparaison avec les leaders du marché
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="competitive" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="competitive" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Analyse Compétitive
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="w-4 h-4" />
                Sécurité vs Concurrents
              </TabsTrigger>
            </TabsList>

          <TabsContent value="competitive" className="space-y-6">
            {error && (
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-destructive mb-1">{t('competitiveAnalysis.erreurDetectee')}</h4>
                      <p className="text-sm text-muted-foreground">{error}</p>
                      <Button
                        onClick={() => setError(null)}
                        variant="outline"
                        size="sm"
                        className="mt-3"
                      >
                        Fermer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!competitiveAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Lancer l'Analyse Comparative</CardTitle>
                  <CardDescription>
                    Analyse IA comparative de 224Solutions vs les géants du marché
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">{t('competitiveAnalysis.concurrentsAnalyses')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {competitors.map((comp) => (
                          <Badge key={comp} variant="outline">{comp}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">{t('competitiveAnalysis.criteresDEvaluation')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {criteria.map((crit) => (
                          <Badge key={crit} variant="secondary">{crit}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={runCompetitiveAnalysis}
                      disabled={loadingCompetitive}
                      className="w-full gap-2"
                      size="lg"
                    >
                      {loadingCompetitive ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyse en cours...
                        </>
                      ) : (
                        <>
                          <BarChart3 className="w-5 h-5" />
                          Lancer l'Analyse IA
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {competitiveAnalysis && competitiveAnalysis.platforms && (
              <>
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-6 h-6 text-primary" />
                      Résumé de l'Analyse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">
                      {competitiveAnalysis.summary || 'Analyse comparative complétée.'}
                    </p>
                  </CardContent>
                </Card>

                <ResponsiveGrid
                  mobileCols={1}
                  tabletCols={2}
                  desktopCols={3}
                  gap={isMobile ? "sm" : "md"}
                >
                  {competitiveAnalysis.platforms?.map((platform) => (
                    <Card key={platform.name} className={platform.name === '224Solutions' ? 'border-primary/50 shadow-lg' : ''}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{platform.name}</span>
                          {platform.name === '224Solutions' && (
                            <Badge variant="default" className="gap-1">
                              <Award className="w-3 h-3" />
                              Notre solution
                            </Badge>
                          )}
                        </CardTitle>
                        {platform.overall_score !== undefined && (
                          <div className="flex items-center gap-2">
                            <Progress value={platform.overall_score} className="flex-1" />
                            <span className={`text-sm font-semibold ${getScoreColor(platform.overall_score)}`}>
                              {platform.overall_score.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {platform.scores && Object.keys(platform.scores).length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">{t('competitiveAnalysis.scoresParCritere')}</h4>
                            {Object.entries(platform.scores).map(([criterion, score]) => (
                              <div key={criterion} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{criterion}</span>
                                <span className={`font-semibold ${getScoreColor(score as number)}`}>
                                  {typeof score === 'number' ? score.toFixed(1) : score}/10
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {platform.strengths && platform.strengths.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-[#ff4000] dark:text-[#ff4000]">
                              ✓ Points forts
                            </h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {platform.strengths.map((strength, i) => (
                                <li key={i}>• {strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {platform.weaknesses && platform.weaknesses.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-[#ff4000] dark:text-[#ff4000]">
                              ✗ Faiblesses
                            </h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {platform.weaknesses.map((weakness, i) => (
                                <li key={i}>• {weakness}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {platform.innovations && platform.innovations.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              <Zap className="w-3 h-3 inline mr-1" />
                              Innovations
                            </h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {platform.innovations.map((innovation, i) => (
                                <li key={i}>• {innovation}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </ResponsiveGrid>

                {competitiveAnalysis?.ranking && competitiveAnalysis.ranking.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('competitiveAnalysis.classementGeneral')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {competitiveAnalysis.ranking.map((platform, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                              index === 0 ? 'bg-[#ff4000] text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-600 text-white' :
                              'bg-muted'
                            }`}>
                              <span className="font-bold">{index + 1}</span>
                            </div>
                            <span className={`font-semibold ${platform === '224Solutions' ? 'text-primary' : ''}`}>
                              {platform}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {competitiveAnalysis?.recommendations && competitiveAnalysis.recommendations.length > 0 && (
                  <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <TrendingUp className="w-5 h-5" />
                        Recommandations Stratégiques
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {competitiveAnalysis.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-600 font-bold mt-0.5">{i + 1}.</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      setCompetitiveAnalysis(null);
                      runCompetitiveAnalysis();
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Relancer l'Analyse
                  </Button>
                </div>
              </>
            )}
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
            {!securityAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('competitiveAnalysis.analyseDeSecuriteComparative')}</CardTitle>
                  <CardDescription>
                    Évaluation de la sécurité de 224Solutions face aux standards des leaders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <Lock className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-semibold mb-1">Analyse approfondie</h4>
                        <p className="text-sm text-muted-foreground">
                          Cette analyse compare nos mesures de sécurité avec celles des géants du marché
                          et identifie les axes d'amélioration prioritaires.
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={runSecurityAnalysis}
                      disabled={loadingSecurity}
                      className="w-full gap-2"
                      size="lg"
                    >
                      {loadingSecurity ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyse en cours...
                        </>
                      ) : (
                        <>
                          <Shield className="w-5 h-5" />
                          Lancer l'Analyse de Sécurité
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {securityAnalysis && (
              <div className="space-y-6">
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-6 h-6 text-primary" />
                      Résumé de l'Analyse de Sécurité
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{securityAnalysis.summary}</p>
                  </CardContent>
                </Card>

                <ResponsiveGrid
                  mobileCols={1}
                  tabletCols={2}
                  desktopCols={3}
                  gap={isMobile ? "sm" : "md"}
                >
                  {securityAnalysis.platforms && securityAnalysis.platforms.map((platform) => (
                    <Card key={platform.name} className={platform.name === '224Solutions' ? 'border-primary/50 shadow-lg' : ''}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{platform.name}</span>
                          {platform.name === '224Solutions' && (
                            <Badge variant="default" className="gap-1">
                              <Shield className="w-3 h-3" />
                              Notre solution
                            </Badge>
                          )}
                        </CardTitle>
                        {platform.overall_score !== undefined && (
                          <div className="flex items-center gap-2">
                            <Progress value={platform.overall_score} className="flex-1" />
                            <span className={`text-sm font-semibold ${getScoreColor(platform.overall_score)}`}>
                              {platform.overall_score.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {platform.scores && Object.keys(platform.scores).length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">{t('competitiveAnalysis.scoresDeSecurite')}</h4>
                            {Object.entries(platform.scores).map(([criterion, score]) => (
                              <div key={criterion} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{criterion}</span>
                                <span className={`font-semibold ${getScoreColor(score as number)}`}>
                                  {typeof score === 'number' ? score.toFixed(1) : score}/10
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {platform.strengths && platform.strengths.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-[#ff4000] dark:text-[#ff4000]">
                              ✓ Points forts sécurité
                            </h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {platform.strengths.map((strength, i) => (
                                <li key={i}>• {strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {platform.weaknesses && platform.weaknesses.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-[#ff4000] dark:text-[#ff4000]">
                              ✗ Vulnérabilités
                            </h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {platform.weaknesses.map((weakness, i) => (
                                <li key={i}>• {weakness}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </ResponsiveGrid>

                {securityAnalysis.solutions_224_priorities && securityAnalysis.solutions_224_priorities.length > 0 && (
                  <Card className="border-blue-200 dark:border-blue-900">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-6 h-6 text-primary" />
                        Priorités pour 224Solutions
                      </CardTitle>
                      <CardDescription>
                        Plan d'action pour atteindre le niveau des leaders du marché
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {securityAnalysis.solutions_224_priorities.map((priority, idx) => (
                          <div key={idx} className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <h4 className="font-semibold">{priority.priority}</h4>
                              <div className="flex gap-2">
                                <Badge variant={getImpactColor(priority.impact)}>
                                  Impact: {priority.impact}
                                </Badge>
                                <Badge variant={getEffortColor(priority.effort)}>
                                  Effort: {priority.effort}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{priority.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            </TabsContent>
          </Tabs>
        </div>
      </ResponsiveContainer>
    </div>
  );
}
