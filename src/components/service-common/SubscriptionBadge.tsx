/**
 * 🎫 SubscriptionBadge (PHASE 2) — plan actif + date d'expiration (compact).
 * Affiché sur chaque interface de service (RÈGLE N°2). Lit l'abonnement actif du service
 * via le service existant. Devient rouge quand l'expiration est proche (≤ 3 jours).
 */

import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ServiceSubscriptionService, type ActiveServiceSubscription } from '@/services/serviceSubscriptionService';

export function SubscriptionBadge({ serviceId, className = '' }: { serviceId: string; className?: string }) {
  const [sub, setSub] = useState<ActiveServiceSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    ServiceSubscriptionService.getServiceSubscription(serviceId)
      .then((s) => { if (alive) { setSub(s); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [serviceId]);

  if (!loaded) return null;

  // Pas d'abonnement payant actif → plan Gratuit.
  if (!sub || !sub.plan_display_name) {
    return <Badge variant="outline" className={`gap-1 ${className}`}><Crown className="h-3 w-3" />Gratuit</Badge>;
  }

  const days = sub.current_period_end ? ServiceSubscriptionService.getDaysRemaining(sub.current_period_end) : null;
  const expiring = days !== null && days <= 3;

  return (
    <Badge variant={expiring ? 'destructive' : 'default'} className={`gap-1 ${className}`} title={sub.current_period_end ? `Expire le ${new Date(sub.current_period_end).toLocaleDateString()}` : undefined}>
      <Crown className="h-3 w-3" />
      {sub.plan_display_name}
      {days !== null && <span className="opacity-80">· {days}j</span>}
    </Badge>
  );
}

export default SubscriptionBadge;
