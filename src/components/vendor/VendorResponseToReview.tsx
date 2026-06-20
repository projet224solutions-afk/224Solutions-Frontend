/**
 * Composant pour permettre au vendeur de répondre aux avis
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface VendorResponseToReviewProps {
  ratingId: string;
  existingResponse?: string;
  onResponseSubmitted: () => void;
}

export default function VendorResponseToReview({
  ratingId,
  existingResponse,
  onResponseSubmitted
}: VendorResponseToReviewProps) {
  const { t } = useTranslation();
  const [response, setResponse] = useState(existingResponse || '');
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(!existingResponse);

  const handleSubmit = async () => {
    if (!response.trim()) {
      toast.error(t('vendorResponseToReview.veuillezEntrerUneReponse'));
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('vendor_ratings')
        .update({
          vendor_response: response,
          vendor_response_at: new Date().toISOString()
        })
        .eq('id', ratingId);

      if (error) throw error;

      toast.success(t('vendorResponseToReview.reponsePublieeAvecSucces'));
      setIsEditing(false);
      onResponseSubmitted();
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error(t('vendorResponseToReview.erreurLorsDeLaPublication'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isEditing && existingResponse) {
    return (
      <div className="mt-3 pl-4 border-l-2 border-primary/30 bg-accent/30 p-3 rounded-r">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">{t('vendorResponseToReview.votreReponse')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Modifier
          </Button>
        </div>
        <p className="text-sm text-foreground">{existingResponse}</p>
      </div>
    );
  }

  return (
    <Card className="mt-3 border-primary/20">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            {existingResponse ? 'Modifier votre réponse' : 'Répondre à cet avis'}
          </span>
        </div>
        <Textarea
          placeholder={t('vendorResponseToReview.ecrivezVotreReponse')}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="mb-2 min-h-[80px]"
        />
        <div className="flex gap-2 justify-end">
          {existingResponse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setResponse(existingResponse);
                setIsEditing(false);
              }}
              disabled={submitting}
            >
              Annuler
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !response.trim()}
          >
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Publication...' : 'Publier'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
