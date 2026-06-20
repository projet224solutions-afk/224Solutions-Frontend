/**
 * Service de conversion audio pour compatibilité iOS
 * Convertit les fichiers WebM/OGG vers MP4/M4A via Edge Function
 */

import { supabase } from '@/integrations/supabase/client';

// Formats supportés nativement par iOS Safari
const IOS_SUPPORTED_FORMATS = ['mp3', 'mp4', 'm4a', 'aac', 'wav', 'caf'];

// Formats nécessitant conversion pour iOS
const FORMATS_NEEDING_CONVERSION = ['webm', 'ogg', 'opus'];

/**
 * Vérifie si un format audio est supporté par iOS
 */
export function isIOSCompatibleFormat(fileName?: string, url?: string): boolean {
  const source = fileName || url || '';
  const ext = source.split('.').pop()?.toLowerCase() || '';
  return IOS_SUPPORTED_FORMATS.includes(ext);
}

/**
 * Vérifie si un format audio nécessite une conversion pour iOS
 */
export function needsConversionForIOS(fileName?: string, url?: string): boolean {
  const source = fileName || url || '';
  const ext = source.split('.').pop()?.toLowerCase() || '';
  return FORMATS_NEEDING_CONVERSION.includes(ext);
}

/**
 * Détecte si l'utilisateur est sur iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Détecte si l'utilisateur est sur Safari
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;
  return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/i.test(navigator.userAgent);
}

/**
 * Convertit un fichier audio vers un format compatible iOS
 * @param audioUrl URL du fichier audio source
 * @param fileName Nom du fichier (pour extraire l'extension)
 * @param messageId ID du message (optionnel, pour mise à jour auto)
 * @returns URL du fichier converti ou null si échec
 */
export async function convertAudioForIOS(
  audioUrl: string,
  fileName?: string,
  messageId?: string
): Promise<{ converted: boolean; url: string; error?: string }> {
  try {
    console.log('[AudioConvert] Starting conversion:', { audioUrl, fileName, messageId });

    const { data, error } = await supabase.functions.invoke('convert-audio', {
      body: {
        audioUrl,
        fileName,
        messageId
      }
    });

    if (error) {
      console.error('[AudioConvert] Edge function error:', error);
      return { converted: false, url: audioUrl, error: error.message };
    }

    if (data.converted) {
      console.log('[AudioConvert] Conversion successful:', data.url);
      return { converted: true, url: data.url };
    }

    // Format déjà compatible ou conversion non disponible
    return {
      converted: false,
      url: audioUrl,
      error: data.message || 'Conversion not needed or not available'
    };

  } catch (error: any) {
    console.error('[AudioConvert] Error:', error);
    return { converted: false, url: audioUrl, error: error.message };
  }
}

/**
 * Obtient l'URL audio appropriée selon la plateforme
 * Retourne file_url_ios si disponible sur iOS, sinon file_url
 */
export function getAudioUrlForPlatform(message: {
  file_url?: string;
  file_url_ios?: string;
  file_name?: string;
  audio_format?: string;
}): string {
  // Sur iOS, préférer l'URL iOS si disponible
  if (isIOS() && message.file_url_ios) {
    console.log('[AudioConvert] Using iOS-compatible URL');
    return message.file_url_ios;
  }

  // Sinon, utiliser l'URL standard
  return message.file_url || '';
}

/**
 * Convertit automatiquement les messages audio non-iOS et met à jour la BDD
 * Utile pour un batch processing ou un webhook
 * Note: Cette fonction utilise 'any' car les colonnes file_url_ios peuvent
 * ne pas exister dans le schema TypeScript généré
 */
export async function batchConvertAudioMessages(): Promise<{
  processed: number;
  converted: number;
  failed: number;
}> {
  const results = { processed: 0, converted: 0, failed: 0 };

  try {
    // Récupérer les messages audio - utilisation de any pour éviter les erreurs de type
    // car le schema peut ne pas inclure les nouvelles colonnes
    const { data, error } = await supabase
      .from('messages')
      .select('id, file_url, file_name')
      .eq('type', 'audio')
      .limit(50) as { data: Array<{ id: string; file_url: string | null; file_name: string | null }> | null; error: any };

    if (error) {
      console.error('[AudioConvert] Batch query error:', error);
      return results;
    }

    // Filtrer côté client pour les formats à convertir
    const needsConversion = (data || []).filter(m => {
      const fileName = m.file_name?.toLowerCase() || '';
      return fileName.endsWith('.webm') ||
             fileName.endsWith('.ogg') ||
             fileName.endsWith('.opus');
    });

    console.log(`[AudioConvert] Found ${needsConversion.length} messages to convert`);

    for (const message of needsConversion) {
      results.processed++;

      if (!message.file_url) continue;

      const result = await convertAudioForIOS(
        message.file_url,
        message.file_name || undefined,
        message.id
      );

      if (result.converted) {
        results.converted++;
      } else if (result.error) {
        results.failed++;
      }

      // Petit délai pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[AudioConvert] Batch complete:', results);
    return results;

  } catch (error) {
    console.error('[AudioConvert] Batch error:', error);
    return results;
  }
}

/**
 * Hook: Convertit automatiquement un fichier audio après upload si nécessaire
 * À appeler après l'envoi d'un message audio
 */
export async function autoConvertIfNeeded(
  messageId: string,
  fileUrl: string,
  fileName?: string
): Promise<void> {
  // Ne convertir que si le format nécessite une conversion
  if (!needsConversionForIOS(fileName, fileUrl)) {
    console.log('[AudioConvert] No conversion needed for:', fileName || fileUrl);
    return;
  }

  console.log('[AudioConvert] Auto-converting audio for iOS compatibility...');

  // Lancer la conversion en arrière-plan (ne pas bloquer)
  convertAudioForIOS(fileUrl, fileName, messageId)
    .then(result => {
      if (result.converted) {
        console.log('[AudioConvert] Auto-conversion successful');
      } else {
        console.log('[AudioConvert] Auto-conversion skipped:', result.error);
      }
    })
    .catch(err => {
      console.error('[AudioConvert] Auto-conversion failed:', err);
    });
}
