/**
 * Upload d'images pour les biens immobiliers
 */
import { useState, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PropertyImageUploadProps {
  propertyId: string;
  existingImages?: { id: string; image_url: string; is_cover: boolean; display_order: number }[];
  onImagesChange?: () => void;
}

export function PropertyImageUpload({ propertyId, existingImages = [], onImagesChange }: PropertyImageUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState(existingImages);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    const ext = file.name.split('.').pop();
    const path = `${propertyId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('property-images')
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('property-images')
      .getPublicUrl(path);

    return publicUrl;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} est trop lourd (max 5MB)`);
          continue;
        }

        const url = await uploadImage(file);
        const isCover = images.length === 0;

        const { data, error } = await supabase
          .from('property_images')
          .insert({
            property_id: propertyId,
            image_url: url,
            is_cover: isCover,
            display_order: images.length,
          })
          .select()
          .single();

        if (error) throw error;
        setImages(prev => [...prev, data as any]);
      }
      toast.success(t('propertyImageUpload.photosAjoutees'));
      onImagesChange?.();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(t('propertyImageUpload.erreurLorsDeLUpload'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = async (imageId: string) => {
    const { error } = await supabase
      .from('property_images')
      .delete()
      .eq('id', imageId);

    if (!error) {
      setImages(prev => prev.filter(i => i.id !== imageId));
      onImagesChange?.();
    }
  };

  const setCover = async (imageId: string) => {
    // Unset all covers
    await supabase
      .from('property_images')
      .update({ is_cover: false })
      .eq('property_id', propertyId);

    // Set new cover
    await supabase
      .from('property_images')
      .update({ is_cover: true })
      .eq('id', imageId);

    setImages(prev => prev.map(i => ({ ...i, is_cover: i.id === imageId })));
    onImagesChange?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map(img => (
          <div key={img.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border">
            <img src={img.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={() => setCover(img.id)}
                className={`p-1 rounded-full ${img.is_cover ? 'bg-primary text-primary-foreground' : 'bg-card/80 text-foreground'}`}
              >
                <Star className="h-3 w-3" />
              </button>
              <button
                onClick={() => removeImage(img.id)}
                className="p-1 rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {img.is_cover && (
              <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] text-center py-0.5">
                Couverture
              </span>
            )}
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">{t('propertyImageUpload.ajouter')}</span>
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
