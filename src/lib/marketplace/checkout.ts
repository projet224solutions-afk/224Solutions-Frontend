export interface CheckoutCartItemWithVendor {
  vendorId?: string | null;
  vendor_id?: string | null;
}

export function getCartItemVendorId(item: CheckoutCartItemWithVendor): string | null {
  const vendorId = item.vendorId || item.vendor_id;
  return typeof vendorId === 'string' && vendorId.trim().length > 0 ? vendorId.trim() : null;
}

export function groupCartItemsByVendor<T extends CheckoutCartItemWithVendor>(items: T[]): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const vendorId = getCartItemVendorId(item);
    if (!vendorId) return acc;

    if (!acc[vendorId]) acc[vendorId] = [];
    acc[vendorId].push(item);
    return acc;
  }, {});
}

export function getCartVendorEntries<T extends CheckoutCartItemWithVendor>(items: T[]): Array<[string, T[]]> {
  return Object.entries(groupCartItemsByVendor(items));
}
