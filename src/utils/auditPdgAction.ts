import { supabase } from '@/lib/supabaseClient';

/**
 * Journalise une action PDG sensible de façon uniforme.
 * À appeler APRÈS une modification réussie (changement de frais, suspension,
 * validation KYC, changement de rôle, etc.).
 *
 * Best-effort : n'interrompt jamais le flux principal si le log échoue.
 *
 * @example
 *   await logPdgAction('transfer_fee_changed', {
 *     targetType: 'pdg_settings', targetId: null,
 *     before: { value: 2 }, after: { value: 3 },
 *   });
 */
export async function logPdgAction(
  action: string,
  opts: {
    targetType?: string;
    targetId?: string | null;
    before?: unknown;
    after?: unknown;
  } = {}
): Promise<void> {
  try {
    await supabase.rpc('log_pdg_action', {
      p_action:      action,
      p_target_type: opts.targetType ?? null,
      p_target_id:   opts.targetId ?? null,
      p_before:      opts.before ?? null,
      p_after:       opts.after ?? null,
    });
  } catch (e) {
    // Best-effort : on ne bloque jamais l'action principale
    console.warn('[audit] log_pdg_action échoué:', e);
  }
}
