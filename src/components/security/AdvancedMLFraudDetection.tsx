/**
 * DÉTECTION DE FRAUDE ML AVANCÉE
 * Intelligence artificielle et Machine Learning pour détecter les fraudes
 * Comparable aux systèmes d'Amazon et Alibaba
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Activity, AlertTriangle, TrendingDown, RefreshCw,
  Zap, Target, BarChart3, Shield, CheckCircle
} from "lucide-react";
import { ResponsiveGrid } from "@/components/responsive/ResponsiveContainer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MLModel {
  id: string;
  model_name: string;
  model_version: string;
  model_type: string;
  status: string;
  accuracy: number;
  precision_score: number;
  recall_score: number;
  f1_score: number;
  total_predictions: number;
  features_used: string[];
}

interface FraudPattern {
  id: string;
  pattern_name: string;
  pattern_type: string;
  risk_score: number;
  confidence: number;
  occurrences: number;
  description: string;
  detection_rules: any;
  is_active: boolean;
}

export function AdvancedMLFraudDetection() {
  const { t } = useTranslation();
  const [models, setModels] = useState<MLModel[]>([]);
  const [patterns, setPatterns] = useState<FraudPattern[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMLData = async () => {
    setLoading(true);
    try {
      const [modelsRes, patternsRes] = await Promise.all([
        supabase.from('ml_fraud_models').select('*').order('accuracy', { ascending: false }),
        supabase.from('ml_fraud_patterns').select('*').eq('is_active', true).order('risk_score', { ascending: false })
      ]);

      if (modelsRes.data) setModels(modelsRes.data);
      if (patternsRes.data) setPatterns(patternsRes.data);
    } catch (error) {
      console.error('Error loading ML data:', error);
      toast.error(t('advancedMLFraudDetection.erreurChargementDonneesMl'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMLData();
  }, []);

  const handleRefresh = () => {
    loadMLData();
    toast.success(t('advancedMLFraudDetection.donneesMlActualisees'));
  };

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'neural_network': return <Brain className="w-5 h-5 text-[#04439e]" />;
      case 'anomaly_detection': return <Target className="w-5 h-5 text-blue-500" />;
      case 'classification': return <BarChart3 className="w-5 h-5 text-[#ff4000]" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPatternTypeColor = (type: string) => {
    switch (type) {
      case 'velocity': return 'bg-[#ff4000]';
      case 'geographic': return 'bg-blue-500';
      case 'amount': return 'bg-[#ff4000]';
      case 'behavior': return 'bg-[#04439e]';
      case 'temporal': return 'bg-[#ff4000]';
      default: return 'bg-gray-500';
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-[#ff4000]';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-[#ff4000]';
    return 'text-[#ff4000]';
  };

  const totalPredictions = models.reduce((sum, m) => sum + Number(m.total_predictions), 0);
  const avgAccuracy = models.length > 0
    ? models.reduce((sum, m) => sum + Number(m.accuracy), 0) / models.length
    : 0;
  const activePatterns = patterns.filter(p => p.is_active).length;
  const highRiskPatterns = patterns.filter(p => p.risk_score >= 75).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                Détection de Fraude ML Avancée
              </CardTitle>
              <CardDescription>
                Intelligence artificielle prédictive comparable à Amazon/Alibaba
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-[#04439e] border-blue-200 dark:border-[#04439e]">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-[#04439e]" />
              <span className="font-semibold">{t('advancedMLFraudDetection.systemeMlActifAnalyseEn')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {models.filter(m => m.status === 'active').length} modèles actifs •
              {totalPredictions.toLocaleString()} prédictions •
              Précision moyenne: {avgAccuracy.toFixed(1)}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Métriques ML */}
      <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="md">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{totalPredictions.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{t('advancedMLFraudDetection.transactionsAnalysees')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="w-8 h-8 text-[#ff4000]" />
              <div>
                <div className="text-2xl font-bold">{avgAccuracy.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">{t('advancedMLFraudDetection.precisionMoyenne')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-8 h-8 text-[#ff4000]" />
              <div>
                <div className="text-2xl font-bold">{highRiskPatterns}</div>
                <div className="text-xs text-muted-foreground">{t('advancedMLFraudDetection.patternsAHautRisque')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-[#04439e]" />
              <div>
                <div className="text-2xl font-bold">{activePatterns}</div>
                <div className="text-xs text-muted-foreground">Patterns actifs</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </ResponsiveGrid>

      {/* Modèles ML */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Modèles de Machine Learning
          </CardTitle>
          <CardDescription>
            Algorithmes avancés pour la détection de fraude en temps réel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {models.map((model) => (
              <div key={model.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getModelTypeIcon(model.model_type)}
                    <div>
                      <h4 className="font-semibold">{model.model_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Version {model.model_version} • {model.model_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <Badge className={model.status === 'active' ? 'bg-[#ff4000]' : 'bg-gray-500'}>
                    {model.status === 'active' ? 'Actif' : model.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold text-[#ff4000]">{model.accuracy}%</div>
                    <div className="text-xs text-muted-foreground">{t('advancedMLFraudDetection.precision')}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold text-blue-600">{model.precision_score}%</div>
                    <div className="text-xs text-muted-foreground">Precision</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold text-[#04439e]">{model.recall_score}%</div>
                    <div className="text-xs text-muted-foreground">Recall</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold text-orange-600">{model.f1_score}%</div>
                    <div className="text-xs text-muted-foreground">F1 Score</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-2">{t('advancedMLFraudDetection.featuresUtilisees')}</div>
                  <div className="flex flex-wrap gap-1">
                    {model.features_used?.slice(0, 5).map((feature, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {feature.replace('_', ' ')}
                      </Badge>
                    ))}
                    {model.features_used?.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{model.features_used.length - 5}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {Number(model.total_predictions).toLocaleString()} prédictions effectuées
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patterns de fraude détectés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Patterns de Fraude Détectés
          </CardTitle>
          <CardDescription>
            Comportements suspects identifiés par les modèles ML
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getPatternTypeColor(pattern.pattern_type)}>
                        {pattern.pattern_type}
                      </Badge>
                      <h4 className="font-medium">{pattern.pattern_name}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{pattern.description}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getRiskColor(pattern.risk_score)}`}>
                      {pattern.risk_score}%
                    </div>
                    <div className="text-xs text-muted-foreground">Risque</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('advancedMLFraudDetection.confianceDuModele')}</span>
                      <span className="font-medium">{pattern.confidence}%</span>
                    </div>
                    <Progress value={pattern.confidence} className="h-2" />
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Occurrences: </span>
                    <span className="font-medium">{pattern.occurrences.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdvancedMLFraudDetection;
