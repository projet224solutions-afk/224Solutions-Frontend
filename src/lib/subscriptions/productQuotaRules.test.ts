import { describe, expect, it } from 'vitest';
import {
  buildProductActivationPlan,
  canCreateProductWithLimit,
  canDuplicateProductWithLimit,
  canReactivateProductWithLimit,
} from './productQuotaRules';

describe('productQuotaRules', () => {
  const fullLimit = {
    current_count: 3,
    max_products: 3,
    can_add: false,
    is_unlimited: false,
  };

  it('bloque la creation d un produit actif quand le quota du plan est plein', () => {
    expect(canCreateProductWithLimit(fullLimit, true)).toBe(false);
  });

  it('autorise la creation d un produit inactif meme quand le quota actif est plein', () => {
    expect(canCreateProductWithLimit(fullLimit, false)).toBe(true);
  });

  it('bloque la reactivation d un produit inactif quand le quota actif est plein', () => {
    expect(canReactivateProductWithLimit(fullLimit, false, true)).toBe(false);
  });

  it('bloque la duplication d un produit actif quand le quota actif est plein', () => {
    expect(canDuplicateProductWithLimit(fullLimit, true)).toBe(false);
  });

  it('ne desactive que les produits actifs excedentaires sans toucher aux produits deja inactifs', () => {
    const plan = buildProductActivationPlan(
      [
        { id: 'p1', is_active: true },
        { id: 'p2', is_active: true },
        { id: 'p3', is_active: false },
        { id: 'p4', is_active: true },
      ],
      2,
      false,
    );

    expect(plan).toEqual({
      totalProducts: 4,
      activeProducts: 3,
      maxAllowed: 2,
      excessCount: 1,
      deactivateIds: ['p4'],
    });
  });
});