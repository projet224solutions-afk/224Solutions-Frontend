export type PostPaymentProductType = 'digital' | 'physical';
export type PostPaymentPricingType = 'one_time' | 'subscription' | 'pay_what_you_want' | undefined;

interface ResolvePostPaymentRouteParams {
  productType?: PostPaymentProductType;
  pricingType?: PostPaymentPricingType;
}

export function resolvePostPaymentRoute(params: ResolvePostPaymentRouteParams = {}): string {
  if (params.productType === 'digital') {
    return params.pricingType === 'subscription'
      ? '/my-digital-subscriptions'
      : '/my-digital-purchases';
  }

  return '/my-purchases';
}