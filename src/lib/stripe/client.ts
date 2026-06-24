import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';

let publishableKeyPromise: Promise<string> | null = null;
let stripeInstancePromise: Promise<Stripe | null> | null = null;

export const STRIPE_OFFLINE_ERROR = 'OFFLINE_MODE';

const isOffline = (): boolean => {
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

/** Validate that a key looks like a real Stripe publishable key */
const isValidStripeKey = (key: string | undefined): key is string => {
  if (!key) return false;
  const trimmed = key.trim();
  // Must start with pk_test_ or pk_live_ and have at least 20 chars after prefix
  return /^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(trimmed);
};

export const getStripePublishableKey = async (): Promise<string> => {
  if (isOffline()) {
    throw new Error(STRIPE_OFFLINE_ERROR);
  }

  const envKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
  if (isValidStripeKey(envKey)) {
    return envKey;
  }

  if (envKey) {
    console.warn('⚠️ [Stripe] VITE_STRIPE_PUBLISHABLE_KEY invalide, tentative via stripe_config DB');
  }

  if (!publishableKeyPromise) {
    publishableKeyPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('stripe_config')
          .select('stripe_publishable_key')
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const dbKey = data?.stripe_publishable_key?.trim();
        if (isValidStripeKey(dbKey)) {
          return dbKey;
        }
        if (dbKey) {
          console.warn('⚠️ [Stripe] Clé stripe_config invalide');
        }
      } catch (error) {
        console.warn('⚠️ [Stripe] Impossible de récupérer la clé publique depuis stripe_config:', error);
      }

      throw new Error('Clé Stripe non configurée. Ajoutez `VITE_STRIPE_PUBLISHABLE_KEY` ou renseignez `stripe_config`.');
    })().catch((error) => {
      publishableKeyPromise = null;
      throw error;
    });
  }

  return publishableKeyPromise;
};

export const getStripeInstance = async (): Promise<Stripe | null> => {
  if (isOffline()) {
    throw new Error(STRIPE_OFFLINE_ERROR);
  }

  if (!stripeInstancePromise) {
    stripeInstancePromise = getStripePublishableKey()
      .then((key) => loadStripe(key))
      .catch((error) => {
        stripeInstancePromise = null;
        throw error;
      });
  }

  return stripeInstancePromise;
};

export const resetStripeInstance = (): void => {
  publishableKeyPromise = null;
  stripeInstancePromise = null;
};
