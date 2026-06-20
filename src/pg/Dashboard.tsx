import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Dashboard Router - Redirige vers le dashboard approprié selon le rôle
 * IMPORTANT: Utilise TOUJOURS profile.role comme source de vérité
 */
const Dashboard = () => {
  const { t } = useTranslation();
  const { user, profile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Attendre la fin du chargement complet
    if (loading || profileLoading) return;

    if (!user) {
      // Si pas connecté, rediriger vers la page d'authentification
      navigate("/auth");
      return;
    }

    // Attendre que le profil soit chargé avant de rediriger
    if (!profile) {
      console.log('⏳ Attente du chargement du profil...');
      return;
    }

    // Redirection selon le rôle depuis le PROFIL (source de vérité sécurisée)
    // Normaliser le rôle en minuscules pour la comparaison
    const role = profile.role?.toLowerCase() || 'client';

    const roleRedirects: Record<string, string> = {
      'pdg': '/pdg',
      'admin': '/pdg',
      'ceo': '/pdg',
      'vendeur': '/vendeur',
      'prestataire': '/home', // Géré dynamiquement ci-dessous
      'livreur': '/livreur',
      'taxi': '/taxi-moto/driver',
      'driver': '/taxi-moto/driver',
      'syndicat': '/syndicat',
      'bureau': '/bureau',
      'transitaire': '/transitaire',
      'agent': '/agent-dashboard',
      'client': '/client',
      'vendor_agent': '/home',
    };

    // ✓ FIX: Pour les vendor_agents, chercher leur access_token et rediriger vers l'interface agent
    if (role === 'vendor_agent') {
      const fetchVendorAgentToken = async () => {
        const { data: vendorAgent } = await supabase
          .from('vendor_agents')
          .select('access_token')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (vendorAgent?.access_token) {
          console.log('🚀 Dashboard: Redirection agent vendeur vers /vendor-agent/');
          navigate(`/vendor-agent/${vendorAgent.access_token}`, { replace: true });
        } else {
          console.log('⚠️ Dashboard: Agent vendeur sans token, redirection /home');
          navigate('/home', { replace: true });
        }
      };
      fetchVendorAgentToken();
      return;
    }

    // ✓ Pour les prestataires, chercher leur professional_service et rediriger
    if (role === 'prestataire') {
      const fetchPrestaService = async () => {
        const { data: proService } = await supabase
          .from('professional_services')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (proService?.id) {
          console.log('🚀 Dashboard: Redirection prestataire vers /dashboard/service/', proService.id);
          navigate(`/dashboard/service/${proService.id}`, { replace: true });
        } else {
          console.log('⚠️ Dashboard: Prestataire sans service, redirection /service-selection');
          navigate('/service-selection', { replace: true });
        }
      };
      fetchPrestaService();
      return;
    }

    const redirectPath = roleRedirects[role] || '/home';

    console.log(`🔄 Dashboard: Redirection vers ${redirectPath} (rôle: ${role})`);
    navigate(redirectPath, { replace: true });
  }, [user, profile, loading, profileLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">{t('dashboard.redirectionVersVotreDashboard')}</p>
      </div>
    </div>
  );
};

export default Dashboard;
