/**
 * 🎯 PAGE "POUR VOUS" - Style Alibaba Feed
 * Page dediee de recommandations personnalisees par IA
 */

import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, TrendingUp, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useAIPersonalized, useAITrending, useAIContextual } from "@/hooks/useAIRecommendations";
import { AIRecommendationSection } from "@/components/marketplace/AIRecommendationSection";
import { useBehaviorTracking } from "@/hooks/useBehaviorTracking";
import { useRecommendationRealtimeInvalidation } from "@/hooks/useRecommendationRealtimeInvalidation";
import QuickFooter from "@/components/QuickFooter";

export default function ForYouPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Track behavior on this page
  useBehaviorTracking({ sessionType: 'browse' });
  useRecommendationRealtimeInvalidation();

  // AI-powered recommendations
  const { data: personalized, isLoading: loadingPersonalized } = useAIPersonalized(20);
  const { data: trending, isLoading: loadingTrending } = useAITrending(16);
  const { data: contextual, isLoading: loadingContextual } = useAIContextual({}, 12);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#04439e] p-1.5">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">
                {t('marketplace.forYou') || 'Pour vous'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t('marketplace.aiPowered') || 'Propulsé par IA'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6 mt-4">
        {/* Selection personnalisee */}
        <AIRecommendationSection
          title={t('marketplace.selectedForYou') || 'Sélection pour vous'}
          subtitle={t('marketplace.basedOnBehavior') || 'Basé sur votre activité récente'}
          products={personalized}
          isLoading={loadingPersonalized}
          icon="sparkles"
          showReason={true}
          maxItems={20}
        />

        {/* Tendances */}
        <AIRecommendationSection
          title={t('marketplace.trendingNow') || 'Tendances du moment'}
          subtitle={t('marketplace.trendingSubtitle') || 'Les plus populaires cette semaine'}
          products={trending}
          isLoading={loadingTrending}
          icon="trending"
          showReason={false}
          maxItems={16}
        />

        {/* Contextuel */}
        <AIRecommendationSection
          title={t('marketplace.contextualPicks') || 'Recommandés maintenant'}
          subtitle={t('marketplace.contextualSubtitle') || 'Adapté à votre moment'}
          products={contextual}
          isLoading={loadingContextual}
          icon="clock"
          showReason={true}
          maxItems={12}
        />
      </div>

      <QuickFooter />
    </div>
  );
}
