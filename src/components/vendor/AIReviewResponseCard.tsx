/**
 * Composant pour afficher et gérer les réponses IA proposées aux avis
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Bot, Check, X, Edit2, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface AIReviewResponseCardProps {
  ratingId: string;
  aiSuggestedResponse: string;
  aiResponseStatus: string;
  aiSentiment?: string;
  aiAnalyzedAt?: string;
  onStatusChange: () => void;
}

export default function AIReviewResponseCard({
  ratingId,
  aiSuggestedResponse,
  aiResponseStatus,
  aiSentiment,
  aiAnalyzedAt,
  onStatusChange
}: AIReviewResponseCardProps) {
  const { t } = useTranslation();
  const [response, setResponse] = useState(aiSuggestedResponse);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async (publish: boolean = false) => {
    setIsSubmitting(true);
    try {
      const updateData: any = {
        ai_response_status: publish ? 'published' : 'approved',
        ai_suggested_response: response
      };

      // Si on publie directement, copier vers vendor_response
      if (publish) {
        updateData.vendor_response = response;
        updateData.vendor_response_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('vendor_ratings')
        .update(updateData)
        .eq('id', ratingId);

      if (error) throw error;

      toast.success(publish ? 'Réponse publiée avec succès' : 'Réponse approuvée');
      onStatusChange();
    } catch (error) {
      console.error('Error approving response:', error);
      toast.error(t('aIReviewResponseCard.erreurLorsDeL'));
    } finally {
      setIsSubmitting(false);
      setIsEditing(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('vendor_ratings')
        .update({
          ai_response_status: 'rejected'
        })
        .eq('id', ratingId);

      if (error) throw error;

      toast.success(t('aIReviewResponseCard.reponseRejetee'));
      onStatusChange();
    } catch (error) {
      console.error('Error rejecting response:', error);
      toast.error(t('aIReviewResponseCard.erreurLorsDuRejet'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSentimentBadge = () => {
    if (!aiSentiment) return null;

    const sentimentConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      positive: { label: '😊 Positif', variant: 'default' },
      neutral: { label: '😐 Neutre', variant: 'secondary' },
      negative: { label: t('aIReviewResponseCard.negatif'), variant: 'outline' },
      critical: { label: '😠 Critique', variant: 'destructive' }
    };

    const config = sentimentConfig[aiSentiment] || sentimentConfig.neutral;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Si rejeté ou déjà publié, ne pas afficher
  if (aiResponseStatus === 'rejected' || aiResponseStatus === 'published') {
    return null;
  }

  return (
    <div className="mt-3 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary">
            💡 Réponse IA proposée
          </span>
          <Badge variant="outline" className="text-xs bg-orange-50 text-[#ff4000] border-orange-200">
            <Clock className="w-3 h-3 mr-1" />
            Validation requise
          </Badge>
        </div>
        {getSentimentBadge()}
      </div>

      {/* Response Content */}
      {isEditing ? (
        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="min-h-[100px] mb-3"
          placeholder={t('aIReviewResponseCard.modifierLaReponse')}
        />
      ) : (
        <div className="p-3 bg-background rounded-md mb-3 text-sm text-foreground">
          "{response}"
        </div>
      )}

      {/* Analysis Info */}
      {aiAnalyzedAt && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <Zap className="w-3 h-3" />
          Analysé le {new Date(aiAnalyzedAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isEditing ? (
          <>
            <Button
              size="sm"
              onClick={() => handleApprove(true)}
              disabled={isSubmitting}
              className="bg-[#ff4000] hover:bg-[#ff4000]"
            >
              <Check className="w-4 h-4 mr-1" />
              Valider & Publier
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              disabled={isSubmitting}
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Modifier
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReject}
              disabled={isSubmitting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4 mr-1" />
              Rejeter
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => handleApprove(true)}
              disabled={isSubmitting || !response.trim()}
            >
              <Check className="w-4 h-4 mr-1" />
              Enregistrer & Publier
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setResponse(aiSuggestedResponse);
                setIsEditing(false);
              }}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
          </>
        )}
      </div>
    </div>
  );
}