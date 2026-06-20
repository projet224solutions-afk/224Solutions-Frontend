export interface NativeSharePayload {
  title?: string;
  text?: string;
  url?: string;
}

function hasShareContent(payload: NativeSharePayload): boolean {
  return Boolean(payload.title || payload.text || payload.url);
}

export function canUseNativeShare(payload?: NativeSharePayload): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (!window.isSecureContext || typeof navigator.share !== 'function') {
    return false;
  }

  if (!payload || !hasShareContent(payload) || typeof navigator.canShare !== 'function') {
    return true;
  }

  try {
    return navigator.canShare(payload);
  } catch {
    return false;
  }
}

export async function tryNativeShare(payload: NativeSharePayload): Promise<'shared' | 'fallback' | 'aborted'> {
  if (!canUseNativeShare(payload)) {
    return 'fallback';
  }

  try {
    await navigator.share(payload);
    return 'shared';
  } catch (error) {
    const shareError = error as Error & { name?: string; message?: string };
    const message = (shareError.message || '').toLowerCase();

    if (shareError.name === 'AbortError') {
      return 'aborted';
    }

    if (
      shareError.name === 'NotAllowedError' ||
      message.includes('permission denied') ||
      message.includes('permissions policy') ||
      message.includes('user activation')
    ) {
      return 'fallback';
    }

    throw error;
  }
}