import { describe, expect, it } from 'vitest';

import { resolvePostPaymentRoute } from '@/lib/payment/postPaymentRoute';

describe('resolvePostPaymentRoute', () => {
  it('redirects physical marketplace purchases to my purchases', () => {
    expect(resolvePostPaymentRoute({ productType: 'physical' })).toBe('/my-purchases');
  });

  it('redirects cart and generic marketplace success to my purchases', () => {
    expect(resolvePostPaymentRoute()).toBe('/my-purchases');
  });

  it('redirects digital one-time purchases to my digital purchases', () => {
    expect(resolvePostPaymentRoute({ productType: 'digital', pricingType: 'one_time' })).toBe('/my-digital-purchases');
  });

  it('redirects digital subscriptions to my digital subscriptions', () => {
    expect(resolvePostPaymentRoute({ productType: 'digital', pricingType: 'subscription' })).toBe('/my-digital-subscriptions');
  });
});