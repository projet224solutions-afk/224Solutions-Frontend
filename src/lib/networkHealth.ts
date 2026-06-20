import { resolveBackendUrl } from '@/config/backend';

export type ConnectivityStatus = 'online' | 'degraded' | 'offline';

export interface NetworkHealthResult {
  ok: boolean;
  connectivity: ConnectivityStatus;
  reason: string;
  statusCode?: number;
  latencyMs: number;
  sources: string[];
}

interface NetworkHealthOptions {
  timeoutMs?: number;
  retries?: number;
  force?: boolean;
}

interface HealthProbeResult {
  ok: boolean;
  reason: string;
  statusCode?: number;
  source: 'healthz' | 'supabase' | 'business';
}

const HEALTH_CHECK_PATH = resolveBackendUrl('/healthz.json');
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 1;
const RESULT_CACHE_WINDOW_MS = 15_000;

let inFlightHealthCheck: Promise<NetworkHealthResult> | null = null;
let lastHealthCheckAt = 0;
let lastHealthResult: NetworkHealthResult | null = null;
let lastReportedState: ConnectivityStatus | null = null;
let lastReportedReason = '';

const nowPerf = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function _withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  // 🚀 Use AbortController for real cancellation (saves bandwidth on slow networks)
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function probeHealthz(timeoutMs: number, attempt: number): Promise<HealthProbeResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${HEALTH_CHECK_PATH}?t=${Date.now()}&a=${attempt}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      keepalive: true,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { ok: false, reason: `app_http_${response.status}`, statusCode: response.status, source: 'healthz' };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, reason: 'healthz_not_json', statusCode: response.status, source: 'healthz' };
    }

    const payload = await response.json().catch(() => null);
    if (payload?.status === 'ok') {
      return { ok: true, reason: 'ok:app_health', statusCode: response.status, source: 'healthz' };
    }

    return { ok: false, reason: 'healthz_invalid_payload', statusCode: response.status, source: 'healthz' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return { ok: false, reason: isAbort ? 'healthz_timeout' : `healthz_${message}`, source: 'healthz' };
  }
}

async function probeSupabaseReachability(timeoutMs: number): Promise<HealthProbeResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { ok: false, reason: 'supabase_config_missing', source: 'supabase' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD', // 🚀 HEAD instead of GET — no body to parse
      cache: 'no-store',
      signal: controller.signal,
      keepalive: true,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    clearTimeout(timer);

    if (response.ok || response.status === 200) {
      return { ok: true, reason: 'ok:supabase_reachable', statusCode: response.status, source: 'supabase' };
    }

    return { ok: false, reason: `supabase_http_${response.status}`, statusCode: response.status, source: 'supabase' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return { ok: false, reason: isAbort ? 'supabase_timeout' : `supabase_${message}`, source: 'supabase' };
  }
}

async function probeBusinessData(timeoutMs: number): Promise<HealthProbeResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { ok: false, reason: 'business_test_config_missing', source: 'business' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/service_types?select=id&is_active=eq.true&limit=1`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      keepalive: true,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { ok: false, reason: `business_http_${response.status}`, statusCode: response.status, source: 'business' };
    }

    const payload = await response.json().catch(() => null);
    if (Array.isArray(payload)) {
      return { ok: true, reason: 'ok:business_data', statusCode: response.status, source: 'business' };
    }

    return { ok: false, reason: 'business_invalid_payload', statusCode: response.status, source: 'business' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return { ok: false, reason: isAbort ? 'business_timeout' : `business_${message}`, source: 'business' };
  }
}

function pickStatusCode(...probes: HealthProbeResult[]): number | undefined {
  return probes.find((probe) => typeof probe.statusCode === 'number')?.statusCode;
}

async function executeHealthCheck(timeoutMs: number, retries: number): Promise<NetworkHealthResult> {
  const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  const maxAttempts = Math.max(1, retries + 1);
  let lastResult: NetworkHealthResult = {
    ok: false,
    connectivity: 'offline',
    reason: 'health_check_failed',
    latencyMs: 0,
    sources: [],
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = nowPerf();

    const [healthzProbe, supabaseProbe] = await Promise.all([
      probeHealthz(timeoutMs, attempt),
      probeSupabaseReachability(timeoutMs),
    ]);

    const businessProbe = supabaseProbe.ok
      ? await probeBusinessData(timeoutMs)
      : ({ ok: false, reason: 'business_skipped_supabase_down', source: 'business' } as HealthProbeResult);

    const latencyMs = Math.round(nowPerf() - startedAt);

    const sources = [healthzProbe, supabaseProbe, businessProbe]
      .filter((probe) => probe.ok)
      .map((probe) => probe.source);

    // All three passed = fully online
    if (healthzProbe.ok && supabaseProbe.ok && businessProbe.ok) {
      return {
        ok: true,
        connectivity: 'online',
        reason: 'ok:all_checks',
        statusCode: pickStatusCode(businessProbe, supabaseProbe, healthzProbe),
        latencyMs,
        sources,
      };
    }

    // Supabase + business OK = online even if healthz fails (Lovable preview / some hosts)
    if (supabaseProbe.ok && businessProbe.ok) {
      return {
        ok: true,
        connectivity: 'online',
        reason: 'ok:supabase_business',
        statusCode: pickStatusCode(businessProbe, supabaseProbe),
        latencyMs,
        sources,
      };
    }

    if (healthzProbe.ok || supabaseProbe.ok) {
      lastResult = {
        ok: true,
        connectivity: 'degraded',
        reason: [healthzProbe.reason, supabaseProbe.reason, businessProbe.reason].find((reason) => !reason.startsWith('ok:')) || 'degraded',
        statusCode: pickStatusCode(healthzProbe, supabaseProbe, businessProbe),
        latencyMs,
        sources,
      };
    } else {
      lastResult = {
        ok: false,
        connectivity: 'offline',
        reason:
          (!browserOnline && 'navigator_offline') ||
          [healthzProbe.reason, supabaseProbe.reason, businessProbe.reason].find(Boolean) ||
          'offline',
        statusCode: pickStatusCode(healthzProbe, supabaseProbe),
        latencyMs,
        sources,
      };
    }

    if (lastResult.connectivity !== 'offline' || attempt === maxAttempts) {
      return lastResult;
    }

    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }

  return lastResult;
}

function logHealthTransition(result: NetworkHealthResult) {
  if (lastReportedState === result.connectivity && lastReportedReason === result.reason) return;

  lastReportedState = result.connectivity;
  lastReportedReason = result.reason;

  if (result.connectivity === 'online') {
    console.info('[HEALTH CHECK OK]', {
      connectivity: result.connectivity,
      reason: result.reason,
      sources: result.sources,
      latencyMs: result.latencyMs,
      statusCode: result.statusCode,
    });
    return;
  }

  if (result.connectivity === 'degraded') {
    console.warn('[HEALTH CHECK DEGRADED]', {
      connectivity: result.connectivity,
      reason: result.reason,
      sources: result.sources,
      latencyMs: result.latencyMs,
      statusCode: result.statusCode,
      navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    });
    return;
  }

  console.warn('[HEALTH CHECK FAIL]', {
    connectivity: result.connectivity,
    reason: result.reason,
    sources: result.sources,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode,
    navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
  });
}

export async function checkNetworkHealth(options: NetworkHealthOptions = {}): Promise<NetworkHealthResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, force = false } = options;

  const now = Date.now();

  if (lastHealthResult && now - lastHealthCheckAt < (force ? 5000 : RESULT_CACHE_WINDOW_MS)) {
    return lastHealthResult;
  }

  if (inFlightHealthCheck) {
    return inFlightHealthCheck;
  }

  inFlightHealthCheck = executeHealthCheck(timeoutMs, retries)
    .then((result) => {
      lastHealthCheckAt = Date.now();
      lastHealthResult = result;
      logHealthTransition(result);
      return result;
    })
    .finally(() => {
      inFlightHealthCheck = null;
    });

  return inFlightHealthCheck;
}

export function getCachedNetworkHealth(): NetworkHealthResult | null {
  return lastHealthResult;
}

export function shouldAssumeOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (navigator.onLine) return false;

  const cacheIsFresh = Date.now() - lastHealthCheckAt < RESULT_CACHE_WINDOW_MS * 2;
  if (!cacheIsFresh || !lastHealthResult) {
    return false;
  }

  return lastHealthResult.connectivity === 'offline';
}

export { HEALTH_CHECK_PATH, DEFAULT_TIMEOUT_MS };
