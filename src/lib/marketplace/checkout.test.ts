import { describe, expect, it } from 'vitest';
import { getCartItemVendorId, getCartVendorEntries, groupCartItemsByVendor } from './checkout';

describe('marketplace checkout helpers', () => {
  it('accepts cart items using the persisted vendor_id field', () => {
    const item = { id: 'p1', vendor_id: ' vendor-a ' };

    expect(getCartItemVendorId(item)).toBe('vendor-a');
  });

  it('keeps compatibility with legacy vendorId items', () => {
    const item = { id: 'p1', vendorId: 'vendor-b' };

    expect(getCartItemVendorId(item)).toBe('vendor-b');
  });

  it('groups only items that have a vendor identifier', () => {
    const grouped = groupCartItemsByVendor([
      { id: 'p1', vendor_id: 'vendor-a' },
      { id: 'p2', vendorId: 'vendor-a' },
      { id: 'p3', vendor_id: 'vendor-b' },
      { id: 'p4' },
    ]);

    expect(Object.keys(grouped)).toEqual(['vendor-a', 'vendor-b']);
    expect(grouped['vendor-a'].map(item => item.id)).toEqual(['p1', 'p2']);
    expect(getCartVendorEntries(Object.values(grouped).flat())).toHaveLength(2);
  });
});
