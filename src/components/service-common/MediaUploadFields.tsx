import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🖼️ Champs d'upload IMAGE + VIDÉO réutilisables. La vidéo est RÉSERVÉE au plan le
 * plus cher (Premium) : sinon le champ est verrouillé avec une invite à upgrader.
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Image as ImageIcon, Video, Lock, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';

interface Props {
  subfolder: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  onImage: (url: string) => void;
  onVideo: (url: string) => void;
  isPremium: boolean;
}

export function MediaUploadFields({ subfolder, imageUrl, videoUrl, onImage, onVideo, isPremium }: Props) {
  const { t } = useTranslation();
  const { uploadFile } = useStorageUpload();
  const [busy, setBusy] = useState<'image' | 'video' | null>(null);

  const handle = async (kind: 'image' | 'video', file?: File) => {
    if (!file) return;
    setBusy(kind);
    // Bucket 'restaurant-assets' = upload permissif (tout authentifié, sans condition de
    // chemin) + lecture publique ; 'product-images' impose un chemin = vendors.id (refusé
    // pour un prestataire non-vendor). Vidéos → 'videos' (communication-files).
    const folder = kind === 'video' ? 'videos' : 'restaurant';
    const res = await uploadFile(file, { folder: folder as any, subfolder });
    setBusy(null);
    if (res.success && res.publicUrl) { kind === 'image' ? onImage(res.publicUrl) : onVideo(res.publicUrl); }
    else toast.error(res.error || 'Upload échoué');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />Image</Label>
        <div className="flex items-center gap-2">
          <Input type="file" accept="image/*" disabled={busy === 'image'} onChange={(e) => handle('image', e.target.files?.[0])} />
          {busy === 'image' && <Loader2 className="h-4 w-4 animate-spin" />}
          {imageUrl && <img src={imageUrl} alt="" className="h-9 w-9 rounded object-cover" />}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="flex items-center gap-1">
          <Video className="h-3.5 w-3.5" />Vidéo
          {isPremium
            ? <Badge variant="outline" className="ml-1 gap-1 text-[10px] text-[#ff4000]"><Check className="h-3 w-3" />Premium</Badge>
            : <Badge variant="outline" className="ml-1 gap-1 text-[10px]"><Lock className="h-3 w-3" />Premium requis</Badge>}
        </Label>
        {isPremium ? (
          <div className="flex items-center gap-2">
            <Input type="file" accept="video/*" disabled={busy === 'video'} onChange={(e) => handle('video', e.target.files?.[0])} />
            {busy === 'video' && <Loader2 className="h-4 w-4 animate-spin" />}
            {videoUrl && <Check className="h-4 w-4 text-green-600" />}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">{t('mediaUploadFields.lAjoutDeVideoEst')} <b>Premium</b>{t('mediaUploadFields.passezAuPlanSuperieurPour')}</p>
        )}
      </div>
    </div>
  );
}

export default MediaUploadFields;
