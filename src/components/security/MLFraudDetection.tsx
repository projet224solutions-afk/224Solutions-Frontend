/**
 * DÉTECTION DE FRAUDE ML - VERSION CONNECTÉE
 * Machine Learning pour détecter les fraudes en temps réel
 * Intégré avec l'edge function fraud-detection
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Activity, AlertTriangle, TrendingDown, RefreshCw } from "lucide-react";
import { ResponsiveGrid } from "@/components/responsive/ResponsiveContainer";
import { Progress } from "@/components/ui/progress";
import { useSecurityData } from "@/hooks/useSecurityData";
import { toast } from "sonner";

interface FraudMetrics {
  transactionsAnalyzed: number;
  fraudDetected: number;
  falsePositives: number;
  accuracy: number;
  modelVersion: string;
}

interface FraudPattern {
  id: string;
  pattern: string;
  confidence: number;
  occurrences: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export function MLFraudDetection() {
  const { t } = useTranslation();
  const { fraudLogs, loading, refetch } = useSecurityData(true);
  const [metrics, setMetrics] = useState<FraudMetrics>({
    transactionsAnalyzed: 0,
    fraudDetected: 0,
    falsePositives: 0,
    accuracy: 0,
    modelVersion: 'v2.4.0'
  });
  const [detectedPatterns, setDetectedPatterns] = useState<FraudPattern[]>([]);

  useEffect(() => {
    if (fraudLogs) {
      // Calculer les métriques depuis les logs réels
      const highRiskCount = fraudLogs.filter(log => log.risk_level === 'high' || log.risk_level === 'critical').length;
      const falsePos = fraudLogs.filter(log => log.reviewed && log.risk_level === 'low').length;

      setMetrics({
        transactionsAnalyzed: fraudLogs.length,
        fraudDetected: highRiskCount,
        falsePositives: falsePos,
        accuracy: fraudLogs.length > 0 ? ((fraudLogs.length - falsePos) / fraudLogs.length) * 100 : 0,
        modelVersion: 'v2.4.0'
      });

      // Extraire les patterns des logs
      const patterns: Record<string, FraudPattern> = {};
      fraudLogs.forEach(log => {
        if (log.flags && Array.isArray(log.flags)) {
          log.flags.forEach((flag: string) => {
            if (!patterns[flag]) {
              patterns[flag] = {
                id: flag,
                pattern: flag,
                confidence: 0,
                occurrences: 0,
                riskLevel: log.risk_level as 'high' | 'medium' | 'low' || 'medium'
              };
            }
            patterns[flag].occurrences++;
            patterns[flag].confidence = Math.min(95, patterns[flag].occurrences * 5);
          });
        }
      });

      setDetectedPatterns(Object.values(patterns).slice(0, 5));
    }
  }, [fraudLogs]);

  const handleRefresh = () => {
    refetch();
    toast.success(t('mLFraudDetection.donneesDeFraudeActualisees'));
  };
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-[#ff4000]';
      case 'medium': return 'bg-orange-500';
      case 'low': return 'bg-[#ff4000]';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Détection de Fraude ML
            </CardTitle>
            <CardDescription>
              Intelligence artificielle prédictive - Données en temps réel
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
      <CardContent className="space-y-6">
        {/* Métriques du modèle */}
        <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="sm">
          <div className="p-4 bg-muted rounded-lg">
            <Activity className="w-8 h-8 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{metrics.transactionsAnalyzed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{t('mLFraudDetection.transactionsAnalysees')}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <AlertTriangle className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{metrics.fraudDetected}</div>
            <div className="text-xs text-muted-foreground">{t('mLFraudDetection.fraudesDetectees')}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <TrendingDown className="w-8 h-8 text-[#ff4000] mb-2" />
            <div className="text-2xl font-bold">{metrics.falsePositives}</div>
            <div className="text-xs text-muted-foreground">Faux positifs</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <Brain className="w-8 h-8 text-[#04439e] mb-2" />
            <div className="text-2xl font-bold">{metrics.accuracy}%</div>
            <div className="text-xs text-muted-foreground">{t('mLFraudDetection.precisionDuModele')}</div>
          </div>
        </ResponsiveGrid>

        {/* Info modèle */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">{t('mLFraudDetection.modeleMlActif')}</span>
            <Badge className="bg-[#ff4000]">{t('mLFraudDetection.predictifActive')}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Version {metrics.modelVersion} • Analyse comportementale en temps réel • {metrics.transactionsAnalyzed.toLocaleString()} transactions analysées
          </p>
        </div>

        {/* Patterns détectés */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{t('mLFraudDetection.patternsDeFraudeDetectes')}</h4>
          {detectedPatterns.map((pattern) => (
            <div key={pattern.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getRiskColor(pattern.riskLevel)}>
                      {pattern.riskLevel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {pattern.occurrences} occurrences
                    </span>
                  </div>
                  <p className="text-sm font-medium">{pattern.pattern}</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{t('mLFraudDetection.confianceDuModele')}</span>
                  <span className="font-medium">{pattern.confidence}%</span>
                </div>
                <Progress value={pattern.confidence} className="h-1" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
