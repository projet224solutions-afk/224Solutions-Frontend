import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelOrder,
  confirmCashOnDeliveryOrder,
  createDigitalOrder,
  createOrder,
  listMyOrders,
  updateOrderStatus,
} from '@/services/orderBackendService';
import { backendFetch, generateIdempotencyKey } from '@/services/backendApi';

vi.mock('@/services/backendApi', () => ({
  backendFetch: vi.fn(),
  generateIdempotencyKey: vi.fn(() => 'idem-test-key'),
}));

const mockedBackendFetch = vi.mocked(backendFetch);
const mockedGenerateIdempotencyKey = vi.mocked(generateIdempotencyKey);

describe('orderBackendService', () => {
  beforeEach(() => {
    mockedBackendFetch.mockResolvedValue({ success: true, data: {} });
    mockedGenerateIdempotencyKey.mockReturnValue('idem-test-key');
  });

  it('creates physical orders with an idempotency key', async () => {
    const payload = {
      vendor_id: 'vendor-1',
      items: [{ product_id: 'product-1', quantity: 2 }],
      payment_method: 'wallet' as const,
      shipping_address: {
        full_name: 'Client Test',
        phone: '+224000000000',
        address_line: 'Rue 1',
        city: 'Conakry',
        country: 'GN',
      },
    };

    await createOrder(payload);

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      body: payload,
      idempotencyKey: 'idem-test-key',
      signal: undefined,
    });
  });

  it('creates digital orders on the digital endpoint', async () => {
    const payload = {
      vendor_id: 'vendor-1',
      product_id: 'digital-1',
      product_name: 'Guide PDF',
      quantity: 1,
      unit_price: 10000,
      total_amount: 10000,
      currency: 'GNF',
      payment_method: 'card' as const,
      pricing_type: 'one_time' as const,
    };

    await createDigitalOrder(payload);

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/orders/digital', {
      method: 'POST',
      body: payload,
      idempotencyKey: 'idem-test-key',
      signal: undefined,
    });
  });

  it('serializes order list filters in the query string', async () => {
    await listMyOrders({ limit: 25, offset: 50, status: 'delivered' });

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/orders/mine?limit=25&offset=50&status=delivered', {
      method: 'GET',
      signal: undefined,
    });
  });

  it('sends cancellation reasons to the cancel endpoint', async () => {
    await cancelOrder('order-1', 'Client request');

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/orders/order-1/cancel', {
      method: 'POST',
      body: { reason: 'Client request' },
      idempotencyKey: 'idem-test-key',
      signal: undefined,
    });
  });

  it('confirms cash on delivery orders through the buyer endpoint', async () => {
    await confirmCashOnDeliveryOrder('order-1');

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/orders/order-1/confirm-cod-delivery', {
      method: 'POST',
      idempotencyKey: 'idem-test-key',
      signal: undefined,
    });
  });

  it('updates vendor order status with tracking options', async () => {
    await updateOrderStatus('order-1', 'shipped', { tracking_number: 'TRK-1' });

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/orders/order-1/status', {
      method: 'PATCH',
      body: { status: 'shipped', tracking_number: 'TRK-1' },
      signal: undefined,
    });
  });
});
