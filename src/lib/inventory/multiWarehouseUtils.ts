export type TransferDestinationType = 'warehouse' | 'shop' | 'client';
export type TransferMode = 'units' | 'cartons' | 'mixed';

export interface CartonTransferInput {
  unitsPerCarton?: number | null;
  quantityCartons?: number | null;
  quantityUnits?: number | null;
}

export interface LocationStockLike {
  units_per_carton?: number | null;
  quantity_cartons_closed?: number | null;
  quantity_units_loose?: number | null;
  total_units?: number | null;
  quantity?: number | null;
  available_quantity?: number | null;
  reserved_quantity?: number | null;
}

export interface NormalizedStockUnits {
  unitsPerCarton: number;
  qtyCartonsClosed: number;
  qtyUnitsLoose: number;
  qtyTotalUnits: number;
  availableUnits: number;
  reservedUnits: number;
}

const toSafeInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

export const ensureUnitsPerCarton = (value?: number | null) => {
  const parsed = toSafeInt(value, 1);
  return parsed > 0 ? parsed : 1;
};

export const computeTotalUnits = ({
  unitsPerCarton,
  quantityCartons,
  quantityUnits,
}: CartonTransferInput) => {
  const safeUnitsPerCarton = ensureUnitsPerCarton(unitsPerCarton);
  const cartons = toSafeInt(quantityCartons, 0);
  const looseUnits = toSafeInt(quantityUnits, 0);

  return cartons * safeUnitsPerCarton + looseUnits;
};

export const splitTotalUnits = (totalUnits: number, unitsPerCarton?: number | null) => {
  const safeTotalUnits = toSafeInt(totalUnits, 0);
  const safeUnitsPerCarton = ensureUnitsPerCarton(unitsPerCarton);

  return {
    qtyCartonsClosed: Math.floor(safeTotalUnits / safeUnitsPerCarton),
    qtyUnitsLoose: safeTotalUnits % safeUnitsPerCarton,
  };
};

export const normalizeStockUnits = (stock?: LocationStockLike | null): NormalizedStockUnits => {
  const unitsPerCarton = ensureUnitsPerCarton(stock?.units_per_carton);
  const explicitTotal = toSafeInt(stock?.total_units, -1);
  const cartons = toSafeInt(stock?.quantity_cartons_closed, 0);
  const looseUnits = toSafeInt(stock?.quantity_units_loose, 0);
  const legacyQuantity = toSafeInt(stock?.quantity, 0);

  const computedFromBreakdown = computeTotalUnits({
    unitsPerCarton,
    quantityCartons: cartons,
    quantityUnits: looseUnits,
  });

  const qtyTotalUnits = explicitTotal >= 0
    ? explicitTotal
    : computedFromBreakdown > 0
      ? computedFromBreakdown
      : legacyQuantity;

  const normalizedBreakdown = computedFromBreakdown > 0 || qtyTotalUnits === 0
    ? { qtyCartonsClosed: cartons, qtyUnitsLoose: looseUnits }
    : splitTotalUnits(qtyTotalUnits, unitsPerCarton);

  const reservedUnits = toSafeInt(stock?.reserved_quantity, 0);
  const availableUnits = stock?.available_quantity != null
    ? Math.max(0, toSafeInt(stock.available_quantity, 0))
    : Math.max(0, qtyTotalUnits - reservedUnits);

  return {
    unitsPerCarton,
    qtyCartonsClosed: normalizedBreakdown.qtyCartonsClosed,
    qtyUnitsLoose: normalizedBreakdown.qtyUnitsLoose,
    qtyTotalUnits,
    availableUnits,
    reservedUnits,
  };
};

export const calculateRemainingStock = (
  stock: LocationStockLike | null | undefined,
  transfer: CartonTransferInput,
) => {
  const normalizedStock = normalizeStockUnits(stock);
  const requestedUnits = computeTotalUnits({
    unitsPerCarton: transfer.unitsPerCarton ?? normalizedStock.unitsPerCarton,
    quantityCartons: transfer.quantityCartons,
    quantityUnits: transfer.quantityUnits,
  });

  const remainingUnits = Math.max(0, normalizedStock.qtyTotalUnits - requestedUnits);
  const breakdown = splitTotalUnits(remainingUnits, normalizedStock.unitsPerCarton);

  return {
    requestedUnits,
    remainingUnits,
    ...breakdown,
  };
};

export const getTransferMode = ({ quantityCartons, quantityUnits }: CartonTransferInput): TransferMode => {
  const cartons = toSafeInt(quantityCartons, 0);
  const units = toSafeInt(quantityUnits, 0);

  if (cartons > 0 && units > 0) return 'mixed';
  if (cartons > 0) return 'cartons';
  return 'units';
};

export const validateTransferRequest = ({
  stock,
  transfer,
  destinationType,
  shopProductId,
}: {
  stock?: LocationStockLike | null;
  transfer: CartonTransferInput;
  destinationType: TransferDestinationType;
  shopProductId?: string | null;
}) => {
  const normalizedStock = normalizeStockUnits(stock);
  const requestedUnits = computeTotalUnits({
    unitsPerCarton: transfer.unitsPerCarton ?? normalizedStock.unitsPerCarton,
    quantityCartons: transfer.quantityCartons,
    quantityUnits: transfer.quantityUnits,
  });

  if (requestedUnits <= 0) {
    return {
      valid: false,
      error: 'La quantité à transférer doit être supérieure à zéro.',
      requestedUnits,
    };
  }

  if (requestedUnits > normalizedStock.availableUnits) {
    return {
      valid: false,
      error: 'Le stock disponible est insuffisant pour ce transfert.',
      requestedUnits,
      availableUnits: normalizedStock.availableUnits,
    };
  }

  if (destinationType === 'shop' && !shopProductId) {
    return {
      valid: false,
      error: 'Le produit boutique lié est obligatoire pour un transfert vers boutique.',
      requestedUnits,
    };
  }

  return {
    valid: true,
    requestedUnits,
    availableUnits: normalizedStock.availableUnits,
  };
};

export const buildDestinationSummary = (
  destinationType: TransferDestinationType,
  options?: {
    locationName?: string | null;
    clientName?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
  },
) => {
  if (destinationType === 'client') {
    const parts = [options?.clientName, options?.clientPhone, options?.clientAddress].filter(Boolean);
    return parts.join(' • ') || 'Client final';
  }

  if (destinationType === 'shop') {
    return options?.locationName || 'Boutique liée';
  }

  return options?.locationName || 'Entrepôt destination';
};

export const generateTransferIdempotencyKey = (prefix = 'inv') => {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomPart}`;
};
