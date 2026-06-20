/**
 * Dialog d'activation du statut Marchand
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Store, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface MerchantActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MerchantActivationDialog({
  open,
  onOpenChange,
  onSuccess
}: MerchantActivationDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Rediriger vers la page d'inscription pour créer un compte marchand séparé
      // On passe l'email actuel pour éviter qu'il soit réutilisé
      const currentEmail = user.email || '';

      toast.info(t('merchantActivationDialog.vousAllezEtreRedirigeVers'));

      // Attendre un peu pour que l'utilisateur lise le message
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Rediriger vers la page d'auth avec les paramètres nécessaires
      window.location.href = `/auth?mode=signup&role=merchant&currentEmail=${encodeURIComponent(currentEmail)}`;

      onSuccess();
    } catch (error) {
      console.error('Erreur redirection marchand:', error);
      toast.error(t('merchantActivationDialog.erreurLorsDeLaRedirection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Devenir Marchand
          </DialogTitle>
          <DialogDescription>
            Pour vendre vos produits numériques sur le marketplace, vous devez créer un <strong>{t('merchantActivationDialog.compteMarchandSepare')}</strong> avec une adresse email différente de votre compte client actuel. Cela permet de bien séparer vos activités d'achat et de vente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-orange-50 dark:bg-[#ff4000] border border-orange-200 dark:border-[#ff4000] rounded-lg p-4">
            <h4 className="font-semibold text-sm text-[#ff4000] dark:text-orange-100 mb-2 flex items-center gap-2">
              <Store className="w-4 h-4" />
              Compte Marchand Séparé Requis
            </h4>
            <p className="text-xs text-[#ff4000] dark:text-orange-200">
              ⚠️ Vous devez créer un nouveau compte avec une <strong>{t('merchantActivationDialog.adresseEmailDifferente')}</strong> de celle de votre compte client actuel ({user?.email}).
              Les deux comptes resteront indépendants.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm text-foreground">
              Avantages du compte Marchand :
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#ff4000] shrink-0" />
                Vendre vos propres produits numériques
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#ff4000] shrink-0" />
                Créer des formations, eBooks, logiciels, etc.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#ff4000] shrink-0" />
                Visibilité sur le marketplace public
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#ff4000] shrink-0" />
                Recevoir des paiements directs sur votre wallet
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#ff4000] shrink-0" />
                Statistiques de vente en temps réel
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#ff4000] shrink-0" />
                Compte 100% gratuit et activation instantanée
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              ℹ️ <strong>Note :</strong> Votre compte client actuel restera actif. Vous pourrez continuer à acheter avec ce compte et vendre avec votre nouveau compte marchand.
            </p>
          </div>

          <Button
            onClick={handleActivate}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redirection en cours...
              </>
            ) : (
              <>
                <Store className="w-4 h-4 mr-2" />
                Créer mon compte marchand
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
