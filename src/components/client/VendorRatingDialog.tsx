import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface VendorRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  vendorId: string;
  vendorName: string;
  onRatingSubmitted?: () => void;
}

export default function VendorRatingDialog({
  open,
  onOpenChange,
  orderId,
  vendorId,
  vendorName,
  onRatingSubmitted
}: VendorRatingDialogProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error(t('vendorRatingDialog.veuillezSelectionnerUneNote'));
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Enregistrer la note (upsert) : contrainte UNIQUE (order_id, customer_id) → si le client a
      // déjà noté cette commande, on MET À JOUR sa note au lieu d'échouer en duplicate key.
      const { error } = await supabase
        .from('vendor_ratings')
        .upsert({
          vendor_id: vendorId,
          customer_id: user.id,
          order_id: orderId,
          rating: rating,
          comment: comment.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'order_id,customer_id' });

      if (error) throw error;

      toast.success(t('vendorRatingDialog.merciPourVotreAvis'), {
        description: `Vous avez noté ${vendorName} avec ${rating}/5 étoiles`
      });

      onRatingSubmitted?.();
      onOpenChange(false);

      // Réinitialiser le formulaire
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error(t('vendorRatingDialog.erreurLorsDeLEnvoi'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('vendorRatingDialog.notezVotreExperience')}</DialogTitle>
          <DialogDescription>
            Comment évaluez-vous votre expérience avec <strong>{vendorName}</strong> ?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Système de notation par étoiles */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-[#ff4000] text-[#ff4000]'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>

            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && 'Très insatisfait'}
                {rating === 2 && 'Insatisfait'}
                {rating === 3 && 'Correct'}
                {rating === 4 && 'Satisfait'}
                {rating === 5 && 'Très satisfait'}
              </p>
            )}
          </div>

          {/* Commentaire optionnel */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Commentaire (optionnel)
            </label>
            <Textarea
              placeholder={t('vendorRatingDialog.partagezVotreExperienceAvecCe')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Plus tard
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              'Envoyer la note'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
