import { useTranslation } from "@/hooks/useTranslation";
/**
 * Interface AGENT de restaurant : l'agent connecté (compte auth) accède au(x) restaurant(s) où il est
 * rattaché (restaurant_agents.user_id = lui, actif) et ne voit QUE les onglets autorisés par ses
 * permissions. Réutilise RestaurantModule en mode agent (prop agentPermissions).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RestaurantModule } from '@/components/professional-services/modules/RestaurantModule';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, Loader2, ShieldX, LogOut, ChefHat } from 'lucide-react';

interface AgentService {
  serviceId: string;
  businessName: string;
  permissions: Record<string, boolean>;
}

export default function RestaurantAgentDashboard() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<AgentService[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) { setLoading(false); return; }
      // Restaurants où l'utilisateur est agent ACTIF + leurs permissions.
      const { data: rows } = await supabase
        .from('restaurant_agents')
        .select('professional_service_id, permissions, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);
      const list = rows || [];
      if (list.length === 0) { if (alive) { setServices([]); setLoading(false); } return; }

      const ids = list.map((r: any) => r.professional_service_id);
      const { data: svcs } = await supabase
        .from('professional_services')
        .select('id, business_name')
        .in('id', ids);
      const byId = new Map((svcs || []).map((s: any) => [s.id, s.business_name]));

      const mapped: AgentService[] = list.map((r: any) => ({
        serviceId: r.professional_service_id,
        businessName: byId.get(r.professional_service_id) || 'Restaurant',
        permissions: (r.permissions || {}) as Record<string, boolean>,
      }));
      if (alive) { setServices(mapped); setSelected(mapped[0]?.serviceId ?? null); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (services.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-4">
            <ShieldX className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div>
              <h2 className="font-bold text-lg">{t('restaurantAgentDashboard.aucunAccesAgent')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Votre compte n'est rattaché à aucun restaurant, ou votre accès a été désactivé. Contactez le restaurateur.
              </p>
            </div>
            <Button variant="outline" onClick={() => { signOut?.(); navigate('/auth'); }} className="gap-2">
              <LogOut className="w-4 h-4" /> Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = services.find((s) => s.serviceId === selected) || services[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <ChefHat className="w-6 h-6 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{current.businessName}</h1>
              <p className="text-xs text-muted-foreground">{t('restaurantAgentDashboard.espaceAgentAccesLimitePar')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { signOut?.(); navigate('/auth'); }} className="gap-1.5">
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">{t('restaurantAgentDashboard.deconnexion')}</span>
          </Button>
        </div>

        {/* Sélecteur si l'agent est rattaché à plusieurs restaurants */}
        {services.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {services.map((s) => (
              <Button key={s.serviceId} size="sm" variant={s.serviceId === current.serviceId ? 'default' : 'outline'}
                className="gap-1.5" onClick={() => setSelected(s.serviceId)}>
                <Store className="w-3.5 h-3.5" /> {s.businessName}
              </Button>
            ))}
          </div>
        )}

        <RestaurantModule
          key={current.serviceId}
          serviceId={current.serviceId}
          businessName={current.businessName}
          agentPermissions={current.permissions}
        />
      </div>
    </div>
  );
}
