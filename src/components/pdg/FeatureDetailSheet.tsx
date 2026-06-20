/**
 * Panneau latéral pour afficher les détails de santé d'une fonctionnalité
 * avec actions de correction automatique
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Zap,
  ExternalLink,
  RefreshCw,
  Activity,
  Clock,
  TrendingUp,
  Database,
} from 'lucide-react';
import { FeatureHealthData } from '@/hooks/useFeatureHealth';
import { motion } from 'framer-motion';

interface FeatureDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: {
    name: string;
    icon: React.ElementType;
    color: string;
    domain: string;
  } | null;
  healthData: FeatureHealthData | null;
  onApplyCorrection: (domain: string) => Promise<void>;
  isApplying?: boolean;
}

export default function FeatureDetailSheet({
  open,
  onOpenChange,
  feature,
  healthData,
  onApplyCorrection,
  isApplying = false,
}: FeatureDetailSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [localApplying, setLocalApplying] = useState(false);

  if (!feature || !healthData) return null;

  const Icon = feature.icon;

  const getStatusBadge = () => {
    switch (healthData.status) {
      case 'CRITICAL':
        return (
          <Badge className="bg-[#ff4000] text-white animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" />
            CRITIQUE
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge className="bg-orange-500 text-white">
            <AlertCircle className="w-3 h-3 mr-1" />
            ATTENTION
          </Badge>
        );
      default:
        return (
          <Badge className="bg-[#ff4000] text-white">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            OK
          </Badge>
        );
    }
  };

  const getHealthScore = () => {
    if (healthData.status === 'OK') return 100;
    if (healthData.status === 'WARNING') return 70 - healthData.anomalyCount * 5;
    return Math.max(10, 40 - healthData.anomalyCount * 10);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-[#ff4000]';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-[#ff4000]';
  };

  const handleApplyCorrection = async () => {
    setLocalApplying(true);
    try {
      await onApplyCorrection(feature.domain);
    } finally {
      setLocalApplying(false);
    }
  };

  const handleNavigateToModule = () => {
    onOpenChange(false);
    navigate(healthData.route);
  };

  const score = getHealthScore();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-[450px] sm:w-full max-w-[540px] bg-slate-900 border-slate-700 overflow-y-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: healthData.status === 'CRITICAL' ? [0, 10, -10, 0] : 0 }}
              transition={{ duration: 0.5, repeat: healthData.status === 'CRITICAL' ? Infinity : 0 }}
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${feature.color}30` }}
            >
              <Icon className="w-8 h-8" style={{ color: feature.color }} />
            </motion.div>
            <div>
              <SheetTitle className="text-white text-xl">{feature.name}</SheetTitle>
              <SheetDescription className="text-slate-400">
                Domaine: {feature.domain}
              </SheetDescription>
            </div>
          </div>
          <div className="pt-3">{getStatusBadge()}</div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Score de santé */}
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-300 font-medium">{t('featureDetailSheet.scoreDeSante')}</span>
              <span
                className="text-2xl font-bold"
                style={{ color: score >= 80 ? '#ff4000' : score >= 50 ? '#f97316' : '#ff4000' }}
              >
                {score}%
              </span>
            </div>
            <Progress value={score} className={`h-3 ${getScoreColor(score)}`} />
          </div>

          {/* Source de données */}
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600 mb-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Database className="w-3 h-3" />
              Source de données
            </div>
            <p className="text-xs font-mono text-[#ff4000]">
              {healthData.dataSource || 'Non définie'}
            </p>
          </div>

          {/* Métriques */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                {healthData.metricLabel}
              </div>
              <p className="text-2xl font-bold text-white">
                {healthData.metricValue.toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <AlertTriangle className="w-4 h-4" />
                Anomalies actives
              </div>
              <p
                className="text-2xl font-bold"
                style={{ color: healthData.anomalyCount > 0 ? '#f97316' : '#ff4000' }}
              >
                {healthData.anomalyCount}
              </p>
            </div>

            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <Activity className="w-4 h-4" />
                Activité récente
              </div>
              <p className="text-2xl font-bold text-[#ff4000]">
                {healthData.recentActivity}%
              </p>
            </div>

            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Dernière vérif.
              </div>
              <p className="text-sm font-medium text-slate-300">
                {new Date(healthData.lastCheck).toLocaleTimeString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {healthData.anomalyCount > 0 && (
              <Button
                onClick={handleApplyCorrection}
                disabled={localApplying || isApplying}
                className="w-full bg-gradient-to-r from-[#ff4000] to-[#ff4000] hover:from-[#ff4000] hover:to-[#ff4000] text-white font-semibold"
              >
                {localApplying || isApplying ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {localApplying || isApplying
                  ? 'Correction en cours...'
                  : `Corriger automatiquement (${healthData.anomalyCount})`}
              </Button>
            )}

            <Button
              onClick={handleNavigateToModule}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Accéder au module {feature.domain}
            </Button>
          </div>

          {/* Conseils */}
          {healthData.status !== 'OK' && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <h4 className="text-orange-400 font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Recommandations
              </h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>{t('featureDetailSheet.verifierLesLogsRecentsDu')}</li>
                <li>{t('featureDetailSheet.appliquerLesCorrectionsAutomatiques')}</li>
                <li>{t('featureDetailSheet.consulterLeTableauDeSurveillance')}</li>
                {healthData.status === 'CRITICAL' && (
                  <li className="text-[#ff4000]">{t('featureDetailSheet.actionImmediateRequise')}</li>
                )}
              </ul>
            </div>
          )}

          {healthData.status === 'OK' && (
            <div className="p-4 bg-[#ff4000]/10 border border-[#ff4000]/30 rounded-lg">
              <h4 className="text-[#ff4000] font-medium mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Système sain
              </h4>
              <p className="text-sm text-slate-300">
                Aucune anomalie détectée. Le module {feature.name.toLowerCase()} fonctionne normalement.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
