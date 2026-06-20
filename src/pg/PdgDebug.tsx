import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import SurveillanceLogiqueDashboard from '@/components/pdg/SurveillanceLogiqueDashboard';
import { toast } from 'sonner';

export default function PdgDebug() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const hasPdgAccess = !!profile && ['admin', 'pdg', 'ceo'].includes((profile.role || '').toString().toLowerCase());

  useEffect(() => {
    // Vérifier que l'utilisateur est PDG
    if (profile && !hasPdgAccess) {
      toast.error(t('pdgDebug.accesRefuseReserveAuPdg'));
      navigate('/home');
    }
  }, [profile, navigate, hasPdgAccess]);

  if (!hasPdgAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/pdg')}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Surveillance Logique</h1>
            <p className="text-muted-foreground">{t('pdgDebug.monitez120ReglesMetierEn')}</p>
          </div>
        </div>

        {/* Dashboard de Surveillance */}
        <SurveillanceLogiqueDashboard />
      </div>
    </div>
  );
}
