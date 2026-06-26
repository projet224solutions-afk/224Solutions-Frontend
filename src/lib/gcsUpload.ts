/**
 * Fonction standalone pour upload vers GCS — utilisable dans les classes/services non-React.
 * GCS en premier, fallback Supabase Storage.
 */

import { supabase } from '@/integrations/supabase/client';

export type GCSFolder =
  | 'avatars' | 'products' | 'videos' | 'audio' | 'documents'
  | 'stamps' | 'restaurant' | 'digital-products' | 'travel' | 'misc'
  | 'kyc' | 'sos'
  // Dossiers GCS alignés avec les nouveaux StorageFolder
  | 'service-gallery'
  | 'service-gallery-videos'
  | 'property-images'
  | 'driver-photos';

const SUPABASE_BUCKET_MAP: Record<GCSFolder, string> = {
  avatars: 'avatars',
  products: 'product-images',
  videos: 'communication-files',
  audio: 'communication-files',
  documents: 'communication-files',
  stamps: 'communication-files',
  restaurant: 'restaurant-assets',
  'digital-products': 'digital-products',
  travel: 'communication-files',
  misc: 'communication-files',
  kyc: 'kyc-documents',
  sos: 'sos-recordings',
  'service-gallery': 'service-gallery',
  'service-gallery-videos': 'service-gallery-videos',
  'property-images': 'property-images',
  'driver-photos': 'driver-photos',
};

export interface GCSUploadResult {
  success: boolean;
  publicUrl?: string;
  objectPath?: string;
  error?: string;
  provider?: 'gcs' | 'supabase';
}

export async function uploadToGCSDirect(
  file: File | Blob,
  folder: GCSFolder,
  fileName: string,
  contentType: string,
  subfolder?: string
): Promise<GCSUploadResult> {
  // Normaliser le type MIME — supprimer les paramètres codec (ex: video/webm;codecs=vp9,opus → video/webm)
  const normalizedType = contentType.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
  const folderPath = subfolder ? `${folder}/${subfolder}` : folder;

  try {
    // En DEV (localhost), le PUT vers GCS est bloqué par CORS → on saute GCS et on
    // uploade directement sur Supabase Storage (fallback ci-dessous). GCS reste en prod.
    if (import.meta.env.DEV) throw new Error('dev:prefer-supabase');

    // Étape 1 : URL signée GCS
    const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke(
      'gcs-signed-url',
      {
        body: {
          action: 'upload',
          fileName,
          contentType: normalizedType,
          folder: folderPath,
          expiresInMinutes: 15,
        },
      }
    );

    const hasError = signedUrlError ||
                     signedUrlData?.error ||
                     signedUrlData?.fallback ||
                     !signedUrlData?.signedUrl;

    if (!hasError) {
      // Étape 2 : Upload direct vers GCS
      const uploadResponse = await fetch(signedUrlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': normalizedType },
        body: file,
      });

      if (uploadResponse.ok) {
        // Notification tracking (non bloquant)
        supabase.functions.invoke('gcs-upload-complete', {
          body: {
            objectPath: signedUrlData.objectPath,
            fileType: folder,
            metadata: { originalName: fileName, size: (file as File).size ?? 0, mimeType: normalizedType },
          },
        }).catch(() => {});

        return {
          success: true,
          publicUrl: signedUrlData.publicUrl,
          objectPath: signedUrlData.objectPath,
          provider: 'gcs',
        };
      }
    }
  } catch {
    // Fallback ci-dessous
  }

  // Fallback Supabase Storage
  const bucket = SUPABASE_BUCKET_MAP[folder];
  const filePath = subfolder ? `${subfolder}/${fileName}` : `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { contentType: normalizedType, upsert: true });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    success: true,
    publicUrl: publicUrlData.publicUrl,
    objectPath: filePath,
    provider: 'supabase',
  };
}
