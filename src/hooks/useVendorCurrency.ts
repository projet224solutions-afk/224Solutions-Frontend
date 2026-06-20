/**
 * Hook de conversion de devise pour l'interface vendeur physique.
 *
 * Les montants DB sont stockés en GNF. Ce hook expose convert(amount)
 * qui retourne le montant converti vers la devise du wallet du vendeur.
 *
 * Toute la logique (wallet, taux, timeout, isReady) est centralisée dans
 * VendorCurrencyContext pour éviter les appels API dupliqués.
 */
import { useVendorCurrencyContext } from '@/contexts/VendorCurrencyContext';

export function useVendorCurrency() {
  return useVendorCurrencyContext();
}

export default useVendorCurrency;
