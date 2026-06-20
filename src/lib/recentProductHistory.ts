export type RecentProductType = 'physical' | 'digital';

export interface RecentProductEntry {
  id: string;
  type: RecentProductType;
  title: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  vendorName?: string;
  route: string;
  viewedAt: string;
}

const STORAGE_PREFIX = 'recent-products-v1';
const MAX_ENTRIES = 24;

function getStorageKey(userId?: string | null) {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`;
}

function isRecentProductEntry(value: unknown): value is RecentProductEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as RecentProductEntry;
  return (
    typeof candidate.id === 'string' &&
    (candidate.type === 'physical' || candidate.type === 'digital') &&
    typeof candidate.title === 'string' &&
    typeof candidate.route === 'string' &&
    typeof candidate.viewedAt === 'string'
  );
}

export function getRecentProducts(userId?: string | null): RecentProductEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentProductEntry);
  } catch {
    return [];
  }
}

export function saveRecentProducts(items: RecentProductEntry[], userId?: string | null) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(items.slice(0, MAX_ENTRIES)));
}

export function addRecentProduct(entry: Omit<RecentProductEntry, 'viewedAt'>, userId?: string | null) {
  const current = getRecentProducts(userId);
  const filtered = current.filter((item) => !(item.id === entry.id && item.type === entry.type));
  const next: RecentProductEntry[] = [
    {
      ...entry,
      viewedAt: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, MAX_ENTRIES);

  saveRecentProducts(next, userId);
  window.dispatchEvent(new CustomEvent('recent-products-updated'));
}

export function clearRecentProducts(userId?: string | null) {
  localStorage.removeItem(getStorageKey(userId));
  window.dispatchEvent(new CustomEvent('recent-products-updated'));
}
