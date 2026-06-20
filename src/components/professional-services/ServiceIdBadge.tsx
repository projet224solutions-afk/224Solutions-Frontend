/**
 * 🆔 BADGE ID PRESTATAIRE DE SERVICE
 * Affiche le public_id du prestataire dans l'interface de service
 * Source de vérité: profiles.public_id
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StandardIdBadge } from '@/components/StandardIdBadge';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Shield } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface ServiceIdBadgeProps {
  serviceId?: string;
  compact?: boolean;
  className?: string;
}

export function ServiceIdBadge({ serviceId, compact = false, className }: ServiceIdBadgeProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [publicId, setPublicId] = useState<string | null>(null);
  const [_serviceName, setServiceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, serviceId]);

  const loadData = async () => {
    try {
      // Charger le public_id depuis profiles (source de vérité)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('public_id')
        .eq('id', user!.id)
        .maybeSingle();

      if (profileData?.public_id) {
        setPublicId(profileData.public_id);
      }

      // Charger le nom du service si serviceId fourni
      if (serviceId) {
        const { data: serviceData } = await supabase
          .from('professional_services')
          .select('business_name, service_type:service_types(name, code)')
          .eq('id', serviceId)
          .maybeSingle() as any;

        if (serviceData?.business_name) {
          setServiceName(serviceData.business_name);
        }
      }
    } catch (error) {
      console.error('Erreur chargement ID service:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="h-6 w-24 animate-pulse bg-muted rounded-md" />;
  }

  if (!publicId) return null;

  if (compact) {
    return (
      <StandardIdBadge
        standardId={publicId}
        variant="secondary"
        size="sm"
        copyable={true}
        showIcon={true}
        className={className}
      />
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
        <Briefcase className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs text-muted-foreground font-medium">{t('serviceIdBadge.idPro')}</span>
        <StandardIdBadge
          standardId={publicId}
          variant="outline"
          size="sm"
          copyable={true}
          showIcon={false}
        />
      </div>
      <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
        <Shield className="w-2.5 h-2.5" />
        {t('serviceIdBadge.servicePro')}
      </Badge>
    </div>
  );
}

export default ServiceIdBadge;
