import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  depositToWallet,
  getWalletTransactions,
  previewWalletTransfer,
  resetWalletPin,
  transferToWallet,
  withdrawFromWallet,
} from '@/services/walletBackendService';
import { backendFetch, generateIdempotencyKey } from '@/services/backendApi';

vi.mock('@/services/backendApi', () => ({
  backendFetch: vi.fn(),
  generateIdempotencyKey: vi.fn(() => 'wallet-idem-key'),
}));

const mockedBackendFetch = vi.mocked(backendFetch);
const mockedGenerateIdempotencyKey = vi.mocked(generateIdempotencyKey);

describe('walletBackendService', () => {
  beforeEach(() => {
    mockedBackendFetch.mockResolvedValue({ success: true, new_balance: 1000 });
    mockedGenerateIdempotencyKey.mockReturnValue('wallet-idem-key');
  });

  it('requests wallet transactions with default pagination', async () => {
    await getWalletTransactions();

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/v2/wallet/transactions?limit=20&offset=0', {
      method: 'GET',
      signal: undefined,
    });
  });

  it('wraps deposits with idempotency metadata', async () => {
    await depositToWallet(5000, 'Depot test', 'REF-1');

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/v2/wallet/deposit', {
      method: 'POST',
      body: {
        amount: 5000,
        description: 'Depot test',
        reference: 'REF-1',
        idempotency_key: 'wallet-idem-key',
      },
      idempotencyKey: 'wallet-idem-key',
    });
  });

  it('sends withdrawal PINs only to the withdrawal endpoint', async () => {
    await withdrawFromWallet(2000, 'Retrait test', '1234');

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/v2/wallet/withdraw', {
      method: 'POST',
      body: {
        amount: 2000,
        description: 'Retrait test',
        pin: '1234',
        idempotency_key: 'wallet-idem-key',
      },
      idempotencyKey: 'wallet-idem-key',
    });
  });

  it('transfers to recipients through the P2P endpoint', async () => {
    await transferToWallet('recipient-1', 1500, 'Paiement', '9999');

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/v2/wallet/transfer', {
      method: 'POST',
      body: {
        amount: 1500,
        recipient_id: 'recipient-1',
        description: 'Paiement',
        pin: '9999',
        idempotency_key: 'wallet-idem-key',
      },
      idempotencyKey: 'wallet-idem-key',
    });
  });

  it('normalizes nested transfer preview payloads', async () => {
    mockedBackendFetch.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        is_international: false,
        amount_sent: 1000,
        currency_sent: 'GNF',
        fee_percentage: 0,
        fee_amount: 0,
        amount_after_fee: 1000,
        total_debit: 1000,
        amount_received: 1000,
        currency_received: 'GNF',
        rate_displayed: 1,
        sender_balance: 5000,
        balance_after: 4000,
      },
    });

    const result = await previewWalletTransfer('recipient-1', 1000);

    expect(result.data?.amount_received).toBe(1000);
    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/v2/wallet/transfer/preview', {
      method: 'POST',
      body: { recipient_id: 'recipient-1', amount: 1000 },
    });
  });

  it('uses explicit field names when resetting wallet PINs', async () => {
    await resetWalletPin('account-password', '1234', '1234');

    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/v2/wallet/pin/reset', {
      method: 'POST',
      body: {
        account_password: 'account-password',
        new_pin: '1234',
        confirm_pin: '1234',
      },
    });
  });
});
