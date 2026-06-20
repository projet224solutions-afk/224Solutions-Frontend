/**
 * HOOK DE FORMATAGE DE DEVISE DYNAMIQUE
 * Convertit ET formate les montants dans la devise de l'utilisateur.
 *
 * IMPORTANT : les montants en base sont stockés en GNF (devise plateforme).
 * Ce hook les CONVERTIT au taux BCRG (table currency_exchange_rates, via
 * usePriceConverter) vers la devise réelle de l'utilisateur, puis les formate.
 * → même chemin de conversion que la brique <Money>, pour une interface cohérente
 *   quand le PDG change la devise d'un utilisateur.
 */

import { useCallback } from 'react';
import { usePriceConverter } from '@/hooks/usePriceConverter';

/**
 * Hook React pour convertir + formater les montants dans la devise de l'utilisateur.
 *
 * @example
 * const fc = useFormatCurrency();
 * fc(15000);           // "15 000 GNF" (user GNF) ou "1 373 XOF" (user XOF, converti au taux BCRG)
 * fc(100, 'USD');      // 100 USD convertis dans la devise de l'utilisateur
 *
 * @param amount        montant à afficher
 * @param fromCurrency  devise d'origine du montant (défaut 'GNF' = devise de stockage)
 */
export function useFormatCurrency() {
  const { convert } = usePriceConverter();

  return useCallback(
    (amount: number, fromCurrency: string = 'GNF') => convert(amount, fromCurrency).formatted,
    [convert]
  );
}

/**
 * Formatage simple (non-hook) pour les fichiers utilitaires non-React.
 * Nécessite de passer la devise explicitement. NE CONVERTIT PAS.
 */
export { formatCurrency } from '@/lib/formatters';
