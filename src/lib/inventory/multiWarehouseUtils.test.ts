import { describe, expect, it } from 'vitest';
import {
  calculateRemainingStock,
  computeTotalUnits,
  getTransferMode,
  normalizeStockUnits,
  splitTotalUnits,
  validateTransferRequest,
} from './multiWarehouseUtils';

describe('multiWarehouseUtils', () => {
  it('calcule correctement le total unités à partir des cartons + unités', () => {
    expect(
      computeTotalUnits({
        unitsPerCarton: 20,
        quantityCartons: 5,
        quantityUnits: 0,
      }),
    ).toBe(100);

    expect(
      computeTotalUnits({
        unitsPerCarton: 20,
        quantityCartons: 2,
        quantityUnits: 3,
      }),
    ).toBe(43);
  });

  it('normalise un stock legacy en unités et en cartons', () => {
    expect(normalizeStockUnits({ quantity: 37, units_per_carton: 12 })).toEqual({
      unitsPerCarton: 12,
      qtyCartonsClosed: 3,
      qtyUnitsLoose: 1,
      qtyTotalUnits: 37,
      availableUnits: 37,
      reservedUnits: 0,
    });
  });

  it('recalcule le stock restant après un transfert mixte', () => {
    expect(
      calculateRemainingStock(
        {
          quantity_cartons_closed: 4,
          quantity_units_loose: 6,
          units_per_carton: 10,
          total_units: 46,
          available_quantity: 46,
        },
        {
          unitsPerCarton: 10,
          quantityCartons: 1,
          quantityUnits: 8,
        },
      ),
    ).toEqual({
      requestedUnits: 18,
      remainingUnits: 28,
      qtyCartonsClosed: 2,
      qtyUnitsLoose: 8,
    });
  });

  it('valide les transferts boutique uniquement si le mapping produit existe', () => {
    expect(
      validateTransferRequest({
        stock: { total_units: 50, available_quantity: 50, units_per_carton: 10 },
        transfer: { unitsPerCarton: 10, quantityCartons: 1, quantityUnits: 5 },
        destinationType: 'shop',
        shopProductId: null,
      }),
    ).toMatchObject({
      valid: false,
      error: 'Le produit boutique lié est obligatoire pour un transfert vers boutique.',
    });

    expect(
      validateTransferRequest({
        stock: { total_units: 50, available_quantity: 50, units_per_carton: 10 },
        transfer: { unitsPerCarton: 10, quantityCartons: 1, quantityUnits: 5 },
        destinationType: 'shop',
        shopProductId: 'shop-prod-1',
      }),
    ).toMatchObject({
      valid: true,
      requestedUnits: 15,
    });
  });

  it('rejette les transferts dépassant le stock disponible', () => {
    expect(
      validateTransferRequest({
        stock: { total_units: 24, available_quantity: 24, units_per_carton: 12 },
        transfer: { unitsPerCarton: 12, quantityCartons: 3, quantityUnits: 0 },
        destinationType: 'warehouse',
      }),
    ).toMatchObject({
      valid: false,
      availableUnits: 24,
      requestedUnits: 36,
    });
  });

  it('détermine le bon mode de transfert', () => {
    expect(getTransferMode({ quantityCartons: 0, quantityUnits: 4 })).toBe('units');
    expect(getTransferMode({ quantityCartons: 2, quantityUnits: 0 })).toBe('cartons');
    expect(getTransferMode({ quantityCartons: 2, quantityUnits: 4 })).toBe('mixed');
  });

  it('reconvertit les unités restantes en cartons + unités loose', () => {
    expect(splitTotalUnits(67, 20)).toEqual({
      qtyCartonsClosed: 3,
      qtyUnitsLoose: 7,
    });
  });
});
