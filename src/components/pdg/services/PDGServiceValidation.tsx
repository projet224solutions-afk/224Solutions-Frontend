/**
 * PDGServiceValidation - Validation des services en attente
 * Permet d'approuver ou rejeter les services professionnels pending
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { ServiceSubscriptionService } from '@/services/serviceSubscriptionService';
import {
  CheckCircle, XCircle, Clock, MapPin, Phone, Mail, Eye,
  Shield, AlertTriangle, RefreshCw, Store
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PDGServiceValidationProps {
  activeServiceTab: string;
  serviceTypes: { id: string; code: string; name: string }[];
  onRefresh?: () => void;
}

interface PendingService {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  verification_status: string;
  created_at: string;
  service_type_id: string;
  service_type?: { name: string; code: string } | null;
}

export function PDGServiceValidation({ activeServiceTab, serviceTypes, onRefresh }: PDGServiceValidationProps) {
  const { t } = useTranslation();
  const [services, setServices] = useState<PendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionService, setActionService] = useState<PendingService | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchPendingServices(); }, []);

  const fetchPendingServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('professional_services')
        .select('*, service_type:service_types(name, code)')
        .in('status', ['pending'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      const EXCLUDED_CODES = ['ecommerce', 'dropshipping', 'digital_livre', 'digital_logiciel'];
      const proximityOnly = (data || []).filter(
        (s: any) => !s.service_type || !EXCLUDED_CODES.includes(s.service_type.code)
      );
      setServices(proximityOnly as PendingService[]);
    } catch (err) {
      console.error('Error fetching pending services:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (activeServiceTab === 'all') return services;
    return services.filter(s => s.service_type_id === activeServiceTab);
  }, [services, activeServiceTab]);

  const handleAction = async () => {
    if (!actionService) return;
    setSubmitting(true);
    try {
      const newStatus = actionType === 'approve' ? 'active' : 'rejected';
      const newVerification = actionType === 'approve' ? 'verified' : 'rejected';

      const { error } = await supabase
        .from('professional_services')
        .update({
          status: newStatus,
          verification_status: newVerification
        })
        .eq('id', actionService.id);

      if (error) throw error;

      // Approbation : créer un abonnement gratuit 365 jours pour que le service
      // apparaisse dans le marketplace (ServicesProximite utilise service_subscriptions!inner)
      if (actionType === 'approve') {
        let freePlanId: string | null = null;

        // Chercher le plan gratuit spécifique au type de service
        const { data: typePlan } = await supabase
          .from('service_plans')
          .select('id')
          .eq('name', 'free')
          .eq('is_active', true)
          .eq('service_type_id', actionService.service_type_id)
          .limit(1)
          .maybeSingle();

        if (typePlan?.id) {
          freePlanId = typePlan.id;
        } else {
          // Fallback : plan global (service_type_id IS NULL)
          const { data: globalPlan } = await supabase
            .from('service_plans')
            .select('id')
            .eq('name', 'free')
            .eq('is_active', true)
            .is('service_type_id', null)
            .limit(1)
            .maybeSingle();
          freePlanId = globalPlan?.id ?? null;
        }

        if (freePlanId) {
          await ServiceSubscriptionService.offerFreeSubscription(
            actionService.id,
            actionService.user_id,
            freePlanId,
            365
          );
        }
      }

      toast({
        title: actionType === 'approve' ? '✅ Service approuvé' : '❌ Service rejeté',
        description: actionType === 'approve'
          ? `${actionService.business_name} est maintenant actif et visible dans le marketplace`
          : `${actionService.business_name} a été rejeté`,
      });

      setActionService(null);
      setReason('');
      fetchPendingServices();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-[#ff4000]/30">
            <Shield className="w-5 h-5 text-[#ff4000]" />
          </div>
          <div>
            <h3 className="font-semibold">{t('pDGServiceValidation.servicesEnAttenteDeValidation')}</h3>
            <p className="text-sm text-muted-foreground">{filtered.length} service(s) à valider</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPendingServices}>
          <RefreshCw className="w-4 h-4 mr-2" />Actualiser
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-[#ff4000] mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">{t('pDGServiceValidation.toutEstAJour')}</h3>
            <p className="text-muted-foreground">{t('pDGServiceValidation.aucunServiceEnAttenteDe')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(service => (
            <Card key={service.id} className="border-orange-200 dark:border-[#ff4000]/50">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-lg">{service.business_name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {service.service_type?.name || 'Non défini'}
                      </Badge>
                      <Badge className="bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000] gap-1">
                        <Clock className="w-3 h-3" />En attente
                      </Badge>
                    </div>

                    {service.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{service.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {service.address && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{service.address}</span>
                      )}
                      {service.phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{service.phone}</span>
                      )}
                      {service.email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{service.email}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Inscrit le {format(new Date(service.created_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-[#ff4000] hover:bg-[#ff4000] text-white gap-1"
                      onClick={() => { setActionService(service); setActionType('approve'); }}
                    >
                      <CheckCircle className="w-4 h-4" />Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => { setActionService(service); setActionType('reject'); }}
                    >
                      <XCircle className="w-4 h-4" />Rejeter
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!actionService} onOpenChange={() => setActionService(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? '✅ Approuver le service' : '❌ Rejeter le service'}
            </DialogTitle>
            <DialogDescription>
              {actionService?.business_name} — {actionService?.service_type?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder={actionType === 'approve' ? 'Note (optionnel)' : 'Raison du rejet...'}
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionService(null)}>{t('pDGServiceValidation.annuler')}</Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
            >
              {submitting ? 'En cours...' : actionType === 'approve' ? 'Confirmer l\'approbation' : 'Confirmer le rejet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
