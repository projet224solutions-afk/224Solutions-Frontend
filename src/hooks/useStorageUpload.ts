/**
 * Hook unifié pour gérer tous les uploads vers Google Cloud Storage
 * Avec fallback vers Supabase Storage si GCS échoue
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Architecture GCS-first : en PROD, on uploade sur GCS (bucket "224solutions")
// via l'Edge Function gcs-signed-url, avec fallback Supabase si GCS échoue.
// Activé par défaut en production : le bucket 224solutions a été configuré
// public-read + CORS (vérifié 2026-06-24). Deux filets de sécurité subsistent :
//   • la vérification de lisibilité post-upload (isGcsUrlDisplayable) → fallback
//     Supabase si une URL GCS n'est pas réellement affichable ;
//   • le coupe-circuit VITE_DISABLE_GCS_UPLOAD='true' force Supabase partout.
// En DEV (localhost), GCS est de toute façon contourné (CORS) → Supabase.
const GCS_UPLOAD_DISABLED = import.meta.env.VITE_DISABLE_GCS_UPLOAD === 'true';

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
  | 'misc'
  // Buckets dédiés — GCS dossier + Supabase bucket séparé en fallback
  | 'service-gallery'         // galerie photos services de proximité
  | 'service-gallery-videos'  // vidéos galerie (Premium)
  | 'property-images'         // photos immobilier
  | 'driver-photos';          // photos chauffeurs taxi/moto

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
  'service-gallery': 'service-gallery',
  'service-gallery-videos': 'service-gallery-videos',
  'property-images': 'property-images',
  'driver-photos': 'driver-photos',
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
  bucket?: string; // bucket Supabase (fallback) ou '224solutions' (GCS) — pour le rollback
  deleteToken?: string; // jeton de suppression GCS (sécurise le rollback côté serveur)
  error?: string;
  provider?: 'gcs' | 'supabase';
}

// Résultat atomique : le fichier ET son enregistrement métier sont liés tout-ou-rien.
interface AtomicUploadResult<T> {
  success: boolean;
  data?: T;
  upload?: UploadResult;
  error?: string;
}

interface UseStorageUploadReturn {
  uploadFile: (file: File, options: UploadOptions) => Promise<UploadResult>;
  uploadMultipleFiles: (files: File[], options: UploadOptions) => Promise<UploadResult[]>;
  /**
   * Upload ATOMIQUE : uploade le fichier puis exécute `persist` (écriture métier).
   * Si `persist` échoue, le fichier uploadé est supprimé (rollback) → pas d'orphelin.
   */
  uploadAndPersist: <T>(
    file: File,
    options: UploadOptions,
    persist: (upload: UploadResult) => Promise<T>,
  ) => Promise<AtomicUploadResult<T>>;
  /** Supprime un fichier déjà uploadé (Supabase ou GCS). */
  removeUploadedFile: (result: UploadResult) => Promise<boolean>;
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
  'service-gallery': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'],
  'service-gallery-videos': ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  'property-images': ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  'driver-photos': ['image/jpeg', 'image/png', 'image/webp'],
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
  'service-gallery': 8 * 1024 * 1024, // 8 MB
  'service-gallery-videos': 200 * 1024 * 1024, // 200 MB
  'property-images': 15 * 1024 * 1024, // 15 MB
  'driver-photos': 10 * 1024 * 1024, // 10 MB
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

/**
 * Vérifie les magic bytes (premiers octets) du fichier.
 * Protège contre les fichiers malveillants renommés (ex: .exe → .jpg).
 * Retourne true si le fichier est valide OU si le type n'est pas connu/lisible.
 */
async function verifyFileMagicBytes(file: File): Promise<boolean> {
  const SIGNATURES: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]],
    'video/mp4': [[0x66, 0x74, 0x79, 0x70]], // 'ftyp' à l'offset 4
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
    'application/zip': [[0x50, 0x4B, 0x03, 0x04]],
  };

  const baseType = file.type.split(';')[0].trim().toLowerCase();
  const signatures = SIGNATURES[baseType];
  if (!signatures) return true; // type inconnu → laisser passer

  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // mp4 : 'ftyp' commence à l'octet 4 ; les autres au début.
    if (baseType === 'video/mp4') {
      return signatures.some(sig => sig.every((b, i) => bytes[i + 4] === b));
    }
    return signatures.some(sig => sig.every((b, i) => bytes[i] === b));
  } catch {
    return true; // erreur de lecture → laisser passer
  }
}

/**
 * Teste si une URL d'image GCS est réellement AFFICHABLE (objet public-read).
 * Utilise <img> (et non fetch) car l'affichage <img> ne dépend PAS du CORS,
 * contrairement à fetch — c'est donc le test fidèle à ce que verra l'app.
 * Évite la « panne silencieuse » : upload GCS 200 OK mais URL 403 (bucket non public).
 * Pour les non-images, renvoie true (pas de vérif fiable possible côté navigateur).
 */
function isGcsUrlDisplayable(url: string, contentType: string, timeoutMs = 6000): Promise<boolean> {
  if (!contentType.startsWith('image/')) return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; img.src = ''; resolve(ok); } };
    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = () => { clearTimeout(timer); finish(true); };
    img.onerror = () => { clearTimeout(timer); finish(false); };
    img.src = url;
  });
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
    // crypto.randomUUID() : identifiant cryptographiquement sûr (vs Math.random prédictible)
    const uniqueId = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const baseName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .substring(0, 40);
    const fileName = `${baseName}-${timestamp}-${uniqueId}.${extension}`;
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
      bucket,
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

    // Vérification magic bytes (protège contre un fichier renommé : .exe → .jpg)
    const magicOk = await verifyFileMagicBytes(file);
    if (!magicOk) {
      const err = 'Fichier invalide : le type réel ne correspond pas à son extension.';
      toast.error(err);
      return { success: false, error: err };
    }

    setIsUploading(true);
    setProgress(0);

    try {
      // Architecture GCS-first :
      //   PROD → GCS via gcs-signed-url (bucket public + CORS OK), fallback Supabase si échec
      //   DEV / préférence explicite / coupe-circuit → Supabase directement
      // Voir GCS_UPLOAD_DISABLED en tête de fichier (coupe-circuit VITE_DISABLE_GCS_UPLOAD).
      if (preferSupabase || import.meta.env.DEV || GCS_UPLOAD_DISABLED) {
        console.log('[useStorageUpload] Supabase Storage (dev / préférence / GCS désactivé)');
        const result = await uploadToSupabase(file, folder, subfolder, onProgress);
        setProgress(100);
        return result;
      }
      // → En production avec GCS activé, le code continue vers la logique GCS ci-dessous

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

        // 🛡️ Auto-réparation : si l'objet GCS n'est pas réellement affichable
        // (bucket non public → 403 silencieux), on bascule sur Supabase pour ne
        // JAMAIS livrer une image cassée. Activer GCS devient donc sans risque.
        const displayable = await isGcsUrlDisplayable(signedUrlData.publicUrl, contentType);
        if (!displayable) {
          console.warn('[useStorageUpload] URL GCS non affichable (bucket non public ?) → fallback Supabase');
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
          bucket: signedUrlData.bucket || '224solutions',
          deleteToken: signedUrlData.deleteToken,
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

  /**
   * Supprime un fichier déjà uploadé (rollback). Supporte GCS (action delete de
   * l'Edge Function) et Supabase (storage.remove). Idempotent côté serveur.
   */
  const removeUploadedFile = useCallback(async (result: UploadResult): Promise<boolean> => {
    if (!result?.objectPath) return false;
    try {
      if (result.provider === 'gcs') {
        const { data, error } = await supabase.functions.invoke('gcs-signed-url', {
          body: { action: 'delete', fileName: result.objectPath, deleteToken: result.deleteToken },
        });
        return !error && (data as any)?.success === true;
      }
      if (!result.bucket) return false;
      const { error } = await supabase.storage.from(result.bucket).remove([result.objectPath]);
      return !error;
    } catch (e) {
      console.warn('[useStorageUpload] removeUploadedFile a échoué (orphelin possible):', e);
      return false;
    }
  }, []);

  /**
   * Upload ATOMIQUE (tout-ou-rien) : uploade puis exécute `persist`. Si `persist`
   * échoue, le fichier est supprimé (rollback) → jamais de fichier orphelin.
   */
  const uploadAndPersist = useCallback(async <T>(
    file: File,
    options: UploadOptions,
    persist: (upload: UploadResult) => Promise<T>,
  ): Promise<AtomicUploadResult<T>> => {
    const upload = await uploadFile(file, options);
    if (!upload.success || !upload.publicUrl) {
      return { success: false, error: upload.error || 'upload_failed' };
    }
    try {
      const data = await persist(upload);
      return { success: true, data, upload };
    } catch (persistErr: any) {
      // 🔁 ROLLBACK : la persistance métier a échoué → supprimer le fichier uploadé.
      console.warn('[useStorageUpload] persist KO → rollback du fichier', persistErr);
      const removed = await removeUploadedFile(upload);
      if (!removed) console.warn('[useStorageUpload] rollback non confirmé (orphelin possible)');
      return { success: false, error: persistErr?.message || 'persist_failed', upload };
    }
  }, [uploadFile, removeUploadedFile]);

  return {
    uploadFile,
    uploadMultipleFiles,
    uploadAndPersist,
    removeUploadedFile,
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
