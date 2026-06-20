import { describe, expect, it } from 'vitest';

import { buildEscrowDisputePayload } from '@/lib/escrow/disputePayload';

describe('buildEscrowDisputePayload', () => {
  it('builds the buyer dispute payload without an initiator override', () => {
    expect(buildEscrowDisputePayload('escrow-1', 'Produit non recu', 'Le suivi est bloque.')).toEqual({
      escrowId: 'escrow-1',
      reason: 'Produit non recu',
      description: 'Le suivi est bloque.',
    });
  });

  it('marks vendor disputes explicitly', () => {
    expect(buildEscrowDisputePayload('escrow-2', 'Preuve livraison', 'Client deja livre.', 'vendor')).toEqual({
      escrowId: 'escrow-2',
      reason: 'Preuve livraison',
      description: 'Client deja livre.',
      initiator: 'vendor',
    });
  });
});
