import { describe, expect, it } from 'vitest';
import {
  buildPhoneSearchTerms,
  isSupportedDirectUserSearch,
  parseUserSearchInput,
  stripPhoneToDigits,
} from './userSearch';

describe('userSearch helpers', () => {
  it('detects email, uuid, custom id and public id searches', () => {
    expect(parseUserSearchInput('client@example.com').kind).toBe('email');
    expect(parseUserSearchInput('11111111-2222-3333-4444-555555555555').kind).toBe('uuid');
    expect(parseUserSearchInput('usr000123').kind).toBe('custom_id');
    expect(parseUserSearchInput('224-ABC-123').kind).toBe('public_id');
  });

  it('accepts direct lookup formats used by communication search', () => {
    expect(isSupportedDirectUserSearch('client@example.com')).toBe(true);
    expect(isSupportedDirectUserSearch('USR0001')).toBe(true);
    expect(isSupportedDirectUserSearch('+224 622 11 22 33')).toBe(true);
    expect(isSupportedDirectUserSearch('Jean')).toBe(false);
  });

  it('builds phone variants for formatted and compact numbers', () => {
    expect(stripPhoneToDigits('+224 622-11-22-33')).toBe('224622112233');
    expect(buildPhoneSearchTerms('+224 622-11-22-33')).toEqual(
      expect.arrayContaining(['+224622112233', '224622112233', '622112233'])
    );
  });
});
