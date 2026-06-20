import { useTranslation } from "@/hooks/useTranslation";
/**
 * Badge de sécurité médicale — OBLIGATOIRE sur chaque page du service Pharmacie (client + pharmacien).
 * « Urgence ? Appelez le 15. Ce service ne remplace pas un avis médical professionnel. »
 */
import { AlertTriangle, Phone } from 'lucide-react';

export function PharmacySafetyBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300 ${className}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {t('pharmacySafetyBadge.urgenceMedicaleAppelezLe15')}</strong>{' '}
        Ce service ne remplace pas un avis médical professionnel.
      </span>
    </div>
  );
}

export default PharmacySafetyBadge;
