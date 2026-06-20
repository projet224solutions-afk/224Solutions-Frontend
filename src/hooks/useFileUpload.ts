/**
 * 📤 HOOK: UPLOAD FICHIERS VERS GCS - 224SOLUTIONS
 * Upload avec progress, preview, validation et compression
 * Utilise Google Cloud Storage comme stockage primaire via useStorageUpload
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useStorageUpload, StorageFolder } from './useStorageUpload';
import type { UploadProgress, UploadOptions } from '@/types/communication.types';

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

interface UploadResult {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
  provider?: 'gcs' | 'supabase';
}

/**
 * Détermine le folder GCS basé sur le type MIME du fichier
 */
function getFolderFromMimeType(mimeType: string): StorageFolder {
  if (mimeType.startsWith('image/')) return 'products';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'documents';
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const { uploadFile: uploadToStorage } = useStorageUpload();

  /**
   * Valider un fichier
   */
  const validateFile = useCallback((
    file: File,
    options: UploadOptions = {}
  ): { valid: boolean; error?: string } => {
    const maxSize = options.max_size || DEFAULT_MAX_SIZE;
    const allowedTypes = options.allowed_types || DEFAULT_ALLOWED_TYPES;

    // Vérifier la taille
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `Fichier trop volumineux. Maximum: ${(maxSize / 1024 / 1024).toFixed(1)} MB`,
      };
    }

    // Vérifier le type
    if (options.validate !== false && !allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Type de fichier non autorisé: ${file.type}`,
      };
    }

    return { valid: true };
  }, []);

  /**
   * Générer une preview pour images/vidéos
   */
  const generatePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        reject(new Error('Preview non disponible pour ce type de fichier'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreview(result);
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Compresser une image
   */
  const compressImage = useCallback(async (
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.8
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Calculer les nouvelles dimensions
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erreur compression'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            file.type,
            quality
          );
        };
        img.onerror = () => reject(new Error('Erreur chargement image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Upload un fichier avec progress vers GCS
   */
  const uploadFile = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    setUploading(true);

    try {
      // Valider le fichier
      if (options.validate !== false) {
        const validation = validateFile(file, options);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      // Compresser si image
      let fileToUpload = file;
      if (options.compress && file.type.startsWith('image/')) {
        toast.info('Compression de l\'image...');
        fileToUpload = await compressImage(file);
        toast.success(`Compressé: ${file.size} → ${fileToUpload.size} bytes`);
      }

      // Générer preview
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        try {
          await generatePreview(fileToUpload);
        } catch (err) {
          console.warn('Preview non disponible:', err);
        }
      }

      // Initialiser le progress
      const progressData: UploadProgress = {
        file_name: fileToUpload.name,
        uploaded: 0,
        total: fileToUpload.size,
        percentage: 0,
        status: 'uploading',
      };
      setProgress(progressData);

      // Déterminer le folder GCS basé sur le type de fichier
      const folder = getFolderFromMimeType(fileToUpload.type);

      console.log(`[useFileUpload] Uploading to GCS folder: ${folder}`);

      // Upload vers GCS via useStorageUpload
      const result = await uploadToStorage(fileToUpload, {
        folder,
        onProgress: (pct) => {
          setProgress(prev => prev ? {
            ...prev,
            percentage: pct,
            uploaded: Math.floor((pct / 100) * fileToUpload.size),
          } : null);
        },
      });

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || 'Upload échoué');
      }

      // Progress 100%
      setProgress({
        ...progressData,
        uploaded: fileToUpload.size,
        percentage: 100,
        status: 'completed',
      });

      console.log(`[useFileUpload] ✅ Upload successful via ${result.provider}: ${result.publicUrl}`);

      toast.success('Fichier uploadé!', {
        description: `${fileToUpload.name} (${result.provider?.toUpperCase()})`,
      });

      return {
        url: result.publicUrl,
        path: result.objectPath || '',
        name: fileToUpload.name,
        size: fileToUpload.size,
        type: fileToUpload.type,
        provider: result.provider,
      };
    } catch (error: any) {
      console.error('Erreur upload:', error);

      setProgress((prev) =>
        prev
          ? { ...prev, status: 'failed' }
          : null
      );

      toast.error('Upload échoué', {
        description: error.message,
      });

      throw error;
    } finally {
      setUploading(false);
    }
  }, [validateFile, compressImage, generatePreview, uploadToStorage]);

  /**
   * Upload multiple fichiers
   */
  const uploadFiles = useCallback(async (
    files: File[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        const result = await uploadFile(file, options);
        results.push(result);
      } catch (error) {
        console.error(`Erreur upload ${file.name}:`, error);
      }
    }

    return results;
  }, [uploadFile]);

  /**
   * Nettoyer la preview
   */
  const clearPreview = useCallback(() => {
    setPreview(null);
    setProgress(null);
  }, []);

  return {
    uploadFile,
    uploadFiles,
    validateFile,
    generatePreview,
    compressImage,
    clearPreview,
    uploading,
    progress,
    preview,
  };
}
