import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncOfflineRestaurantSales } from '@/lib/offlineRestaurantSync';
import offlineDB from '@/lib/offlineDB';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/lib/offlineDB', () => ({
  default: {
    getPendingEvents: vi.fn(),
    getFailedEvents: vi.fn(),
    markEventAsSynced: vi.fn(),
    markEventAsFailed: vi.fn(),
    markEventForRetry: vi.fn(),
    abandonEvent: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

const db = vi.mocked(offlineDB as any);
const rpc = vi.mocked(supabase.rpc as any);

/** Fabrique un événement de vente caisse restaurant hors ligne. */
function saleEvent(overrides: Partial<any> = {}) {
  return {
    client_event_id: 'evt_1',
    type: 'restaurant_pos_sale',
    vendor_id: 'svc-1', // = professional_service_id
    created_at: '2026-06-16T10:00:00.000Z',
    retry_count: 0,
    data: {
      order_number: 'RESTO-OFF-ABC',
      order_type: 'dine_in',
      payment_method: 'cash',
      total: 5000,
      subtotal: 5000,
      items: [{ menu_item_id: 'mi-1', name: 'Café', price: 5000, quantity: 1, subtotal: 5000 }],
    },
    ...overrides,
  };
}

describe('syncOfflineRestaurantSales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getPendingEvents.mockResolvedValue([]);
    db.getFailedEvents.mockResolvedValue([]);
    rpc.mockResolvedValue({ data: { status: 'created', order_id: 'o-1' }, error: null });
  });

  it('ne fait rien quand il n’y a aucun événement', async () => {
    const res = await syncOfflineRestaurantSales();
    expect(res).toEqual({ total: 0, synced: 0, failed: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('synchronise une vente valide via la RPC atomique et la marque synchronisée', async () => {
    db.getPendingEvents.mockResolvedValue([saleEvent()]);

    const res = await syncOfflineRestaurantSales();

    expect(rpc).toHaveBeenCalledWith('create_restaurant_pos_offline_order', expect.objectContaining({
      p_service_id: 'svc-1',
      p_order_number: 'RESTO-OFF-ABC',
      p_order: expect.objectContaining({ payment_method: 'cash', total: 5000 }),
    }));
    expect(db.markEventAsSynced).toHaveBeenCalledWith('evt_1');
    expect(res).toEqual({ total: 1, synced: 1, failed: 0 });
  });

  it('traite un doublon (rejeu) comme un SUCCÈS idempotent', async () => {
    db.getPendingEvents.mockResolvedValue([saleEvent()]);
    rpc.mockResolvedValue({ data: { status: 'duplicate', order_id: 'o-1' }, error: null });

    const res = await syncOfflineRestaurantSales();

    expect(db.markEventAsSynced).toHaveBeenCalledWith('evt_1');
    expect(db.markEventAsFailed).not.toHaveBeenCalled();
    expect(res.synced).toBe(1);
  });

  it('abandonne immédiatement une vente sans article (irrécupérable, pas de RPC)', async () => {
    db.getPendingEvents.mockResolvedValue([saleEvent({ data: { order_number: 'X', items: [] } })]);

    const res = await syncOfflineRestaurantSales();

    expect(db.abandonEvent).toHaveBeenCalledWith('evt_1', expect.any(String));
    expect(rpc).not.toHaveBeenCalled();
    expect(res.synced).toBe(0);
  });

  it('compte un rejet métier DÉTERMINISTE (NON_AUTORISE) vers le cap (markEventAsFailed)', async () => {
    db.getPendingEvents.mockResolvedValue([saleEvent()]);
    rpc.mockResolvedValue({ data: null, error: { message: 'NON_AUTORISE' } });

    const res = await syncOfflineRestaurantSales();

    expect(db.markEventAsFailed).toHaveBeenCalledWith('evt_1', 'NON_AUTORISE');
    expect(db.markEventForRetry).not.toHaveBeenCalled();
    expect(res.failed).toBe(1);
  });

  it('réessaie SANS pénalité un échec TRANSITOIRE (réseau) via markEventForRetry', async () => {
    db.getPendingEvents.mockResolvedValue([saleEvent()]);
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch (network)' } });

    const res = await syncOfflineRestaurantSales();

    expect(db.markEventForRetry).toHaveBeenCalledWith('evt_1', expect.any(String));
    expect(db.markEventAsFailed).not.toHaveBeenCalled();
    expect(res.failed).toBe(1);
  });

  it('traite une EXCEPTION (abort réseau) comme transitoire (markEventForRetry)', async () => {
    db.getPendingEvents.mockResolvedValue([saleEvent()]);
    rpc.mockRejectedValue(new Error('boom'));

    await syncOfflineRestaurantSales();

    expect(db.markEventForRetry).toHaveBeenCalledWith('evt_1', expect.any(String));
  });

  it('ignore une vente non récupérable (retry_count >= 5)', async () => {
    db.getFailedEvents.mockResolvedValue([saleEvent({ client_event_id: 'evt_dead', retry_count: 5 })]);

    const res = await syncOfflineRestaurantSales();

    expect(rpc).not.toHaveBeenCalled();
    expect(res).toEqual({ total: 0, synced: 0, failed: 0 });
  });

  it('filtre par serviceId (ne synchronise que les ventes du service ciblé)', async () => {
    db.getPendingEvents.mockResolvedValue([
      saleEvent({ client_event_id: 'a', vendor_id: 'svc-1' }),
      saleEvent({ client_event_id: 'b', vendor_id: 'svc-2' }),
    ]);

    const res = await syncOfflineRestaurantSales({ serviceId: 'svc-1' });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(res.total).toBe(1);
    expect(db.markEventAsSynced).toHaveBeenCalledWith('a');
  });
});
