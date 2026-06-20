export type EscrowDisputeInitiator = 'buyer' | 'vendor';

export interface EscrowDisputePayload {
  escrowId: string;
  reason: string;
  description: string;
  initiator?: EscrowDisputeInitiator;
}

export function buildEscrowDisputePayload(
  escrowId: string,
  reason: string,
  description: string,
  initiator?: EscrowDisputeInitiator
): EscrowDisputePayload {
  return {
    escrowId,
    reason,
    description,
    ...(initiator ? { initiator } : {}),
  };
}
