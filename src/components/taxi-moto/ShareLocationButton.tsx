/**
 * MON ID DE LOCALISATION — 224Solutions Taxi-Moto
 *
 * Affiche l'identifiant (custom_id) et le lien que le client communique au
 * chauffeur. Le chauffeur saisit cet ID dans son interface "Suivre un client" :
 * le client reçoit alors une demande de partage (gérée globalement par
 * LocationShareListener) qu'il confirme pour partager sa position en direct.
 *
 * NB : le partage GPS lui-même n'est PAS géré ici (pour éviter un second canal
 * Realtime en conflit avec l'écouteur global) — il est déclenché à la demande.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MapPin, Share2, Copy, Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildShareLink } from '@/lib/liveLocation';

interface ShareLocationButtonProps {
  userId: string | undefined;
  userName?: string;
  /** Variante d'affichage du bouton déclencheur. */
  variant?: 'default' | 'compact';
  className?: string;
}

/** Jeton de secours persistant si l'utilisateur n'est pas connecté. */
function guestToken(): string {
  try {
    let token = localStorage.getItem('taxi_share_token');
    if (!token) {
      token =
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      localStorage.setItem('taxi_share_token', token);
    }
    return token;
  } catch {
    return `guest-${Date.now()}`;
  }
}

export function ShareLocationButton({
  userId,
  variant = 'default',
  className,
}: ShareLocationButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'id' | 'link' | null>(null);

  // ID communiqué au chauffeur = custom_id (ex: CLT0005), lu sur sa propre ligne
  // user_ids (RLS-safe). Replis : UUID auth, puis jeton invité.
  const [shareId, setShareId] = useState<string>(() => (userId ? '' : guestToken()));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) setShareId(guestToken());
        return;
      }
      try {
        const { data } = await supabase
          .from('user_ids')
          .select('custom_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (!cancelled) setShareId(data?.custom_id || userId);
      } catch {
        if (!cancelled) setShareId(userId);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const shareLink = shareId ? buildShareLink(shareId) : '';

  const copy = async (value: string, kind: 'id' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === 'id' ? 'ID copié' : 'Lien copié');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(t('shareLocationButton.impossibleDeCopier'));
    }
  };

  const nativeShare = async () => {
    if (navigator.share && shareLink) {
      try {
        await navigator.share({
          title: 'Ma localisation — 224Solutions',
          text: `Mon ID de localisation : ${shareId}`,
          url: shareLink,
        });
      } catch {
        /* annulé par l'utilisateur */
      }
    } else {
      copy(shareLink, 'link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={variant === 'compact' ? 'sm' : 'default'}
          className={className}
        >
          <MapPin className="w-4 h-4 mr-2" />
          Mon ID de localisation
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Mon ID de localisation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Communiquez cet <strong>ID</strong> {t('shareLocationButton.ouCe')} <strong>lien</strong>) au chauffeur.
            Il le saisira dans son application et vous recevrez une <strong>demande de
            partage</strong> à confirmer pour qu'il vous localise en temps réel.
          </p>

          {/* ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('shareLocationButton.votreId')}</label>
            <div className="flex gap-2">
              <code className="flex-1 text-sm font-mono bg-muted rounded px-3 py-2 truncate">
                {shareId || '—'}
              </code>
              <Button
                variant="outline"
                size="icon"
                disabled={!shareId}
                onClick={() => shareId && copy(shareId, 'id')}
                title="Copier l'ID"
              >
                {copied === 'id' ? <Check className="w-4 h-4 text-[#ff4000]" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Lien */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Lien de suivi
            </label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs font-mono bg-muted rounded px-3 py-2 truncate">
                {shareLink || '—'}
              </code>
              <Button
                variant="outline"
                size="icon"
                disabled={!shareLink}
                onClick={() => shareLink && copy(shareLink, 'link')}
                title={t('shareLocationButton.copierLeLien')}
              >
                {copied === 'link' ? <Check className="w-4 h-4 text-[#ff4000]" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Button onClick={nativeShare} variant="outline" disabled={!shareLink} className="w-full">
            <Share2 className="w-4 h-4 mr-2" />
            Envoyer mon ID / lien
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareLocationButton;
