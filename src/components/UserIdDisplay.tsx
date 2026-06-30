import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StandardIdBadge } from '@/components/StandardIdBadge';
import { Badge } from '@/components/ui/badge';

interface UserIdDisplayProps {
  className?: string;
  showBadge?: boolean;
  layout?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

export const UserIdDisplay = ({
  className = '',
  showBadge = true,
  layout = 'horizontal',
  size = 'sm'
}: UserIdDisplayProps) => {
  const { user, profile } = useAuth();
  const [standardId, setStandardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lecture seule : l'ID est créé côté serveur (trigger d'inscription) ou
    // réparé par l'outil PDG d'audit des IDs. Aucune génération/écriture client.
    const fetchStandardId = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // 1. Priorité à user_ids.custom_id
        const { data: userIdData } = await supabase
          .from('user_ids')
          .select('custom_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userIdData?.custom_id) {
          setStandardId(userIdData.custom_id);
          return;
        }

        // 2. Sinon, public_id du profil (sans le modifier)
        const existingId = (profile as any)?.public_id;
        if (existingId) setStandardId(existingId);
      } catch (error) {
        console.error('Erreur lecture ID:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStandardId();
   
  }, [user, profile]);

  if (loading) {
    return <span className={`text-muted-foreground ${className}`}>Chargement...</span>;
  }

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email?.split('@')[0] || 'Utilisateur';

  if (!standardId) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="text-xs">
          ID en cours...
        </Badge>
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <span className="font-semibold text-foreground">{displayName}</span>
        <StandardIdBadge
          standardId={standardId}
          variant="default"
          size={size}
          copyable={true}
          showIcon={true}
        />
      </div>
    );
  }

  if (showBadge) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StandardIdBadge
          standardId={standardId}
          variant="secondary"
          size={size}
          copyable={true}
          showIcon={true}
        />
        <span className="text-foreground font-medium">{displayName}</span>
      </div>
    );
  }

  return (
    <span className={className}>
      {standardId} - {displayName}
    </span>
  );
};

export default UserIdDisplay;
