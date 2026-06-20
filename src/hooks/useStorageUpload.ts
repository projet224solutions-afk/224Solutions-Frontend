/**
 * Hook unifié pour gérer tous les uploads vers Google Cloud Storage
 * Avec fallback vers Supabase Storage si GCS échoue
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type StorageFolder =
  | 'avatars'
  | 'products'
  | 'videos'
  | 'audio'
  | 'documents'
  | 'stamps'
  | 'restaurant'
  | 'digital-products'
  | 'travel'
  | 'misc';

// Mapping des folders vers les buckets Supabase pour le fallback
const SUPABASE_BUCKET_MAP: Record<StorageFolder, string> = {
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
};

interface UploadOptions {
  folder: StorageFolder;
  subfolder?: string; // Ex: userId, productId, etc.
  onProgress?: (progress: number) => void;
  metadata?: Record<string, string>;
  preferSupabase?: boolean; // Force Supabase Storage instead of GCS
}

interface UploadResult {
  success: boolean;
  publicUrl?: string;
  objectPath?: string;
  error?: string;
  provider?: 'gcs' | 'supabase';
}

interface UseStorageUploadReturn {
  uploadFile: (file: File, options: UploadOptions) => Promise<UploadResult>;
  uploadMultipleFiles: (files: File[], options: UploadOptions) => Promise<UploadResult[]>;
  getDownloadUrl: (objectPath: string, expiresInMinutes?: number) => Promise<string | null>;
  isUploading: boolean;
  progress: number;
}

// Types MIME autorisés par catégorie
const ALLOWED_TYPES: Record<StorageFolder, string[]> = {
  avatars: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  products: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  videos: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/aac', 'audio/m4a', 'audio/x-m4a'],
  documents: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  stamps: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  restaurant: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  'digital-products': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip'],
  travel: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  misc: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
};

// Taille max par catégorie (en bytes)
const MAX_SIZES: Record<StorageFolder, number> = {
  avatars: 10 * 1024 * 1024, // 10 MB
  products: 10 * 1024 * 1024, // 10 MB
  videos: 100 * 1024 * 1024, // 100 MB
  audio: 50 * 1024 * 1024, // 50 MB
  documents: 20 * 1024 * 1024, // 20 MB
  stamps: 2 * 1024 * 1024, // 2 MB
  restaurant: 5 * 1024 * 1024, // 5 MB
  'digital-products': 5 * 1024 * 1024 * 1024, // 5 GB
  travel: 10 * 1024 * 1024, // 10 MB
  misc: 10 * 1024 * 1024, // 10 MB
};

function formatMaxSizeLabel(sizeInBytes: number): string {
  if (sizeInBytes >= 1024 * 1024 * 1024) {
    return `${Math.round((sizeInBytes / (1024 * 1024 * 1024)) * 10) / 10} Go`;
  }

  return `${Math.round(sizeInBytes / (1024 * 1024))} Mo`;
}

function resolveContentType(file: File, folder: StorageFolder): string {
  const normalizedType = file.type?.split(';')[0].trim().toLowerCase();

  if (normalizedType) {
    return normalizedType;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  if (folder === 'digital-products') {
    const digitalProductMimeMap: Record<string, string> = {
      apk: 'application/vnd.android.package-archive',
      appx: 'application/vnd.ms-appx',
      appxbundle: 'application/vnd.ms-appxbundle',
      bat: 'application/x-msdos-program',
      bin: 'application/octet-stream',
      dmg: 'application/x-apple-diskimage',
      exe: 'application/vnd.microsoft.portable-executable',
      ipa: 'application/octet-stream',
      iso: 'application/x-iso9660-image',
      jar: 'application/java-archive',
      msi: 'application/x-msi',
      pkg: 'application/octet-stream',
      rar: 'application/vnd.rar',
      tar: 'application/x-tar',
      zip: 'application/zip',
      '7z': 'application/x-7z-compressed',
      deb: 'application/vnd.debian.binary-package',
      rpm: 'application/x-rpm',
      sh: 'application/x-sh',
    };

    if (extension && digitalProductMimeMap[extension]) {
      return digitalProductMimeMap[extension];
    }

    return 'application/octet-stream';
  }

  return 'application/octet-stream';
}

/**
 * Vérifie si un type MIME de fichier correspond à un type autorisé
 * Gère les types MIME avec paramètres comme "audio/webm;codecs=opus"
 */
function isTypeAllowed(fileType: string, allowedTypes: string[]): boolean {
  // Extraire le type de base (sans les paramètres comme codecs)
  const baseType = fileType.split(';')[0].trim().toLowerCase();

  // Vérification directe
  if (allowedTypes.includes(baseType)) {
    return true;
  }

  // Pour l'audio, être plus flexible - accepter si le type commence par audio/
  if (baseType.startsWith('audio/')) {
    // Vérifier si le type de base (audio/mp4, audio/webm, etc.) est dans la liste
    return allowedTypes.some(allowed =>
      baseType === allowed ||
      baseType.startsWith(allowed.split('/')[0] + '/')
    );
  }

  return false;
}

export function useStorageUpload(): UseStorageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Valide le fichier avant upload
   */
  const validateFile = useCallback((file: File, folder: StorageFolder): { valid: boolean; error?: string } => {
    const allowedTypes = ALLOWED_TYPES[folder];
    const maxSize = MAX_SIZES[folder];

    if (folder === 'digital-products') {
      if (file.size > maxSize) {
        return {
          valid: false,
          error: `Le fichier dépasse la taille maximale de ${formatMaxSizeLabel(maxSize)}`,
        };
      }

      return { valid: true };
    }

    // Pour l'audio, utiliser une validation plus flexible
    if (folder === 'audio') {
      const baseType = file.type.split(';')[0].trim().toLowerCase();
      const isAudioValid = baseType.startsWith('audio/') ||
        file.name.match(/\.(mp3|wav|ogg|m4a|mp4|webm|aac|opus)$/i);

      if (!isAudioValid) {
        return {
          valid: false,
          error: `Type de fichier audio non autorisé. Formats acceptés: MP3, WAV, OGG, M4A, AAC, WebM`
        };
      }
    } else if (!isTypeAllowed(file.type, allowedTypes)) {
      return {
        valid: false,
        error: `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(', ')}`
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `Le fichier dépasse la taille maximale de ${formatMaxSizeLabel(maxSize)}`
      };
    }

    return { valid: true };
  }, []);

  /**
   * Upload via Supabase Storage (fallback)
   */
  const uploadToSupabase = useCallback(async (
    file: File,
    folder: StorageFolder,
    subfolder?: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> => {
    const bucket = SUPABASE_BUCKET_MAP[folder];
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || '';
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `${baseName}-${timestamp}-${random}.${extension}`;
    const filePath = subfolder ? `${subfolder}/${fileName}` : `${folder}/${fileName}`;
    const contentType = resolveContentType(file, folder);

    console.log(`[useStorageUpload] Uploading to Supabase bucket: ${bucket}, path: ${filePath}`);

    // Upload avec 1 nouvelle tentative en cas d'erreur réseau transitoire ("Failed to fetch")
    let uploadErr: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await supabase.storage
          .from(bucket)
          .upload(filePath, file, { contentType, upsert: true });
        uploadErr = res.error;
        if (!uploadErr) { uploadErr = null; break; }
      } catch (netErr: any) {
        // supabase-js peut throw une TypeError "Failed to fetch" sur coupure réseau
        uploadErr = netErr;
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
    }

    if (uploadErr) {
      console.error('[useStorageUpload] Supabase upload error:', uploadErr);
      const msg = String(uploadErr?.message || uploadErr);
      throw new Error(
        /failed to fetch|network|load failed/i.test(msg)
          ? "Réseau indisponible pour l'upload. Vérifie ta connexion, ou désactive un éventuel bloqueur de pubs / l'extension qui coupe les requêtes de stockage."
          : msg
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    onProgress?.(100);

    return {
      success: true,
      publicUrl: publicUrlData.publicUrl,
      objectPath: filePath,
      provider: 'supabase' as const,
    };
  }, []);

  /**
   * Upload un fichier (GCS avec fallback Supabase)
   */
  const uploadFile = useCallback(async (
    file: File,
    options: UploadOptions
  ): Promise<UploadResult> => {
    const { folder, subfolder, onProgress, preferSupabase } = options;
    const contentType = resolveContentType(file, folder);

    // Validation
    const validation = validateFile(file, folder);
    if (!validation.valid) {
      toast.error(validation.error);
      return { success: false, error: validation.error };
    }

    setIsUploading(true);
    setProgress(0);

    try {
      // ⚠️ On uploade TOUJOURS sur Supabase Storage (buckets publics, fiable). Le chemin
      // GCS (Edge Function gcs-signed-url) était un point de panne : en prod, l'upload
      // « réussissait » mais l'URL GCS ne s'affichait pas (bucket non public / non configuré),
      // et en dev il était bloqué par CORS. Supabase = lecture publique garantie partout.
      if (preferSupabase || import.meta.env.DEV || true) {
        console.log('[useStorageUpload] Using Supabase Storage (forced — public buckets)');
        const result = await uploadToSupabase(file, folder, subfolder, onProgress);
        setProgress(100);
        return result;
      }

      // Construire le chemin du dossier
      const folderPath = subfolder ? `${folder}/${subfolder}` : folder;

      // Vérifier si l'utilisateur est authentifié
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[useStorageUpload] Erreur session:', sessionError);
        // Fallback vers Supabase sans authentification
        console.log('[useStorageUpload] Falling back to Supabase Storage (session error)');
        const result = await uploadToSupabase(file, folder, subfolder, onProgress);
        setProgress(100);
        return result;
      }

      if (!session) {
        console.error('[useStorageUpload] Pas de session active');
        // Fallback vers Supabase
        console.log('[useStorageUpload] Falling back to Supabase Storage (no session)');
        const result = await uploadToSupabase(file, folder, subfolder, onProgress);
        setProgress(100);
        return result;
      }

      console.log(`[useStorageUpload] Session valide, user: ${session.user.id}`);

      // Essayer GCS en premier
      try {
        // Étape 1: Obtenir une URL signée pour l'upload
        console.log(`[useStorageUpload] Requesting signed URL for ${folderPath}/${file.name}`);

        const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke(
          'gcs-signed-url',
          {
            body: {
              action: 'upload',
              fileName: file.name,
              contentType,
              folder: folderPath,
              expiresInMinutes: 15,
            },
          }
        );

        // Check for errors - both invoke errors AND error responses from the function
        const hasError = signedUrlError ||
          signedUrlData?.error ||
          signedUrlData?.fallback ||
          !signedUrlData?.signedUrl;

        if (hasError) {
          console.warn('[useStorageUpload] GCS signed URL failed, falling back to Supabase:',
            signedUrlError?.message || signedUrlData?.error || 'No signed URL received');
          const result = await uploadToSupabase(file, folder, subfolder, onProgress);
          setProgress(100);
          return result;
        }

        setProgress(10);
        onProgress?.(10);

        console.log(`[useStorageUpload] Got signed URL, uploading to GCS...`);

        // Étape 2: Upload direct vers GCS via l'URL signée
        const uploadResponse = await fetch(signedUrlData.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          console.warn('[useStorageUpload] GCS upload failed, falling back to Supabase');
          const result = await uploadToSupabase(file, folder, subfolder, onProgress);
          setProgress(100);
          return result;
        }

        setProgress(80);
        onProgress?.(80);

        console.log(`[useStorageUpload] Upload successful: ${signedUrlData.publicUrl}`);

        // Étape 3: Notifier le backend (optionnel, pour tracking)
        try {
          await supabase.functions.invoke('gcs-upload-complete', {
            body: {
              objectPath: signedUrlData.objectPath,
              fileType: folder,
              metadata: {
                originalName: file.name,
                size: file.size,
                mimeType: contentType,
                ...options.metadata,
              },
            },
          });
        } catch (notifyError) {
          console.warn('[useStorageUpload] Upload notification failed (non-critical):', notifyError);
        }

        setProgress(100);
        onProgress?.(100);

        return {
          success: true,
          publicUrl: signedUrlData.publicUrl,
          objectPath: signedUrlData.objectPath,
          provider: 'gcs' as const,
        };

      } catch (gcsError: any) {
        console.warn('[useStorageUpload] GCS error, falling back to Supabase:', gcsError);
        const result = await uploadToSupabase(file, folder, subfolder, onProgress);
        setProgress(100);
        return result;
      }

    } catch (error: any) {
      console.error('[useStorageUpload] Error:', error);
      toast.error(`Erreur d'upload: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsUploading(false);
    }
  }, [validateFile, uploadToSupabase]);

  /**
   * Upload multiple fichiers
   */
  const uploadMultipleFiles = useCallback(async (
    files: File[],
    options: UploadOptions
  ): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await uploadFile(file, {
        ...options,
        onProgress: (fileProgress) => {
          const overallProgress = ((i + fileProgress / 100) / files.length) * 100;
          setProgress(overallProgress);
          options.onProgress?.(overallProgress);
        },
      });
      results.push(result);
    }

    return results;
  }, [uploadFile]);

  /**
   * Obtenir une URL signée pour télécharger un fichier
   */
  const getDownloadUrl = useCallback(async (
    objectPath: string,
    expiresInMinutes: number = 60
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('gcs-signed-url', {
        body: {
          action: 'download',
          fileName: objectPath,
          expiresInMinutes,
        },
      });

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Échec de l\'obtention de l\'URL de téléchargement');
      }

      return data.signedUrl;
    } catch (error: any) {
      console.error('[useStorageUpload] Get download URL error:', error);
      toast.error(`Erreur: ${error.message}`);
      return null;
    }
  }, []);

  return {
    uploadFile,
    uploadMultipleFiles,
    getDownloadUrl,
    isUploading,
    progress,
  };
}

/**
 * Fonction utilitaire pour migrer une URL Supabase vers GCS
 * (utile pour la migration des données existantes)
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co/storage') || url.includes('.supabase.co/storage');
}

/**
 * Fonction pour obtenir l'URL publique GCS
 */
export function getGCSPublicUrl(objectPath: string, bucketName: string = '224solutions'): string {
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}
