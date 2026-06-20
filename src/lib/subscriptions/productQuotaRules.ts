export interface ProductLimitCheckLike {
  current_count: number;
  max_products: number | null;
  can_add: boolean;
  is_unlimited: boolean;
}

export interface ProductActivationLike {
  id: string;
  is_active: boolean;
}

export interface ProductActivationPlan {
  totalProducts: number;
  activeProducts: number;
  maxAllowed: number;
  excessCount: number;
  deactivateIds: string[];
}

export function canCreateProductWithLimit(limit: ProductLimitCheckLike, requestedActive: boolean): boolean {
  if (!requestedActive) {
    return true;
  }

  if (limit.is_unlimited || limit.max_products === null) {
    return true;
  }

  if (limit.can_add) {
    return true;
  }

  return limit.current_count < limit.max_products;
}

export function canReactivateProductWithLimit(
  limit: ProductLimitCheckLike,
  existingIsActive: boolean,
  requestedActive: boolean,
): boolean {
  if (existingIsActive || !requestedActive) {
    return true;
  }

  return canCreateProductWithLimit(limit, true);
}

export function canDuplicateProductWithLimit(
  limit: ProductLimitCheckLike,
  originalIsActive: boolean,
): boolean {
  if (!originalIsActive) {
    return true;
  }

  return canCreateProductWithLimit(limit, true);
}

export function buildProductActivationPlan(
  products: ProductActivationLike[],
  maxAllowed: number,
  isUnlimited: boolean,
): ProductActivationPlan {
  const totalProducts = products.length;
  const activeProducts = products.filter((product) => product.is_active);
  const activeCount = activeProducts.length;

  if (isUnlimited) {
    return {
      totalProducts,
      activeProducts: activeCount,
      maxAllowed: Infinity,
      excessCount: 0,
      deactivateIds: [],
    };
  }

  const safeMaxAllowed = Math.max(0, maxAllowed);
  const deactivateIds = activeProducts.slice(safeMaxAllowed).map((product) => product.id);

  return {
    totalProducts,
    activeProducts: activeCount,
    maxAllowed: safeMaxAllowed,
    excessCount: Math.max(0, activeCount - safeMaxAllowed),
    deactivateIds,
  };
}