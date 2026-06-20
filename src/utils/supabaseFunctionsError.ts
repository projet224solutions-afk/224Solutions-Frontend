// Utilitaires pour extraire proprement les erreurs des Supabase Edge Functions
// (supabase.functions.invoke renvoie souvent un message générique sur non-2xx)

export type EdgeFunctionErrorPayload =
  | string
  | {
      error?: string
      message?: string
      details?: any
    }
  | null;

async function readResponseBodySafe(res: Response): Promise<EdgeFunctionErrorPayload> {
  try {
    const cloned = res.clone();
    const contentType = cloned.headers.get('Content-Type') || '';

    if (contentType.includes('application/json')) {
      return (await cloned.json()) as any;
    }

    const text = await cloned.text();
    return text || null;
  } catch {
    return null;
  }
}

export async function getEdgeFunctionErrorPayload(error: any): Promise<EdgeFunctionErrorPayload> {
  if (!error) return null;

  // Supabase FunctionsHttpError/RelayError mettent une Response dans error.context
  const ctx = error?.context;
  if (ctx && typeof ctx === 'object') {
    // context peut être une Response (dans functions-js)
    if (typeof ctx.clone === 'function' && typeof ctx.text === 'function') {
      return await readResponseBodySafe(ctx as Response);
    }
  }

  return null;
}

export async function getEdgeFunctionErrorMessage(error: any): Promise<string | null> {
  const payload = await getEdgeFunctionErrorPayload(error);

  if (typeof payload === 'string') {
    return payload.trim() || null;
  }

  if (payload && typeof payload === 'object') {
    const topError = typeof payload.error === 'string' ? payload.error : null;
    const topMessage = typeof payload.message === 'string' ? payload.message : null;

    const detailsMessage =
      payload.details && typeof payload.details === 'object' && typeof payload.details.message === 'string'
        ? payload.details.message
        : null;

    // Format le plus utile pour l'utilisateur
    if (detailsMessage && topError) return `${topError}: ${detailsMessage}`;
    if (detailsMessage) return detailsMessage;
    if (topError) return topError;
    if (topMessage) return topMessage;
  }

  return null;
}
