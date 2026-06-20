export type UserSearchKind = 'email' | 'uuid' | 'custom_id' | 'public_id' | 'phone' | 'text';

export interface UserSearchInput {
  raw: string;
  trimmed: string;
  upper: string;
  compact: string;
  kind: UserSearchKind;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOM_ID_RE = /^[A-Z]{3}\d{4,}$/;
const PUBLIC_ID_RE = /^224-[A-Z0-9]{3}-[A-Z0-9]{3}$/;

export function normalizePhoneCandidate(value: string): string {
  return value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

export function stripPhoneToDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function sanitizePostgrestSearchTerm(value: string): string {
  return value.replace(/[,%*()]/g, ' ').trim();
}

export function buildPhoneSearchTerms(value: string): string[] {
  const normalized = normalizePhoneCandidate(value);
  const digits = stripPhoneToDigits(normalized);
  const withoutCountryCode = digits.startsWith('224') ? digits.slice(3) : digits;
  const displayValue = sanitizePostgrestSearchTerm(value);
  const terms = [
    displayValue,
    normalized,
    digits,
    withoutCountryCode,
    digits ? `+${digits}` : '',
    withoutCountryCode ? `+224${withoutCountryCode}` : '',
  ];

  return Array.from(new Set(terms.filter((term) => term.length >= 4)));
}

export function parseUserSearchInput(value: string): UserSearchInput {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  const compact = trimmed.replace(/[\s-]/g, '');
  const phoneDigits = stripPhoneToDigits(trimmed);

  let kind: UserSearchKind = 'text';
  if (EMAIL_RE.test(trimmed)) {
    kind = 'email';
  } else if (UUID_RE.test(trimmed)) {
    kind = 'uuid';
  } else if (CUSTOM_ID_RE.test(upper)) {
    kind = 'custom_id';
  } else if (PUBLIC_ID_RE.test(upper)) {
    kind = 'public_id';
  } else if (phoneDigits.length >= 7 && phoneDigits.length <= 15) {
    kind = 'phone';
  }

  return {
    raw: value,
    trimmed,
    upper,
    compact,
    kind,
  };
}

export function isSupportedDirectUserSearch(value: string): boolean {
  const parsed = parseUserSearchInput(value);
  return parsed.trimmed.length >= 2 && parsed.kind !== 'text';
}
