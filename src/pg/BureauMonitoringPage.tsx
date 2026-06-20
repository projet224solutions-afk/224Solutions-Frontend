/**
 * Page de monitoring temps réel pour les bureaux/syndicats
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import { BureauRealtimeDashboard } from '@/components/bureau/BureauRealtimeDashboard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function BureauMonitoringPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bureauId, setBureauId] = useState<string | null>(null);
  const [bureauName, setBureauName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBureau = async () => {
      try {
        // Check localStorage first
        const storedBureauId = localStorage.getItem('bureau_id');

        if (storedBureauId) {
          setBureauId(storedBureauId);

          // Get bureau name
          const { data: bureau } = await supabase
            .from('bureaus')
            .select('commune, prefecture')
            .eq('id', storedBureauId)
            .single();

          if (bureau) {
            setBureauName(`${bureau.commune}, ${bureau.prefecture}`);
          }
        } else {
          // Try to get from user profile
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            const { data: bureau } = await supabase
              .from('bureaus')
              .select('id, commune, prefecture')
              .eq('user_id', user.id)
              .single();

            if (bureau) {
              setBureauId(bureau.id);
              setBureauName(`${bureau.commune}, ${bureau.prefecture}`);
              localStorage.setItem('bureau_id', bureau.id);
            }
          }
        }
      } catch (error) {
        console.error('Error loading bureau:', error);
        toast.error(t('bureauMonitoringPage.erreurLorsDuChargementDu'));
      } finally {
        setLoading(false);
      }
    };

    loadBureau();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!bureauId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">{t('bureauMonitoringPage.accesNonAutorise')}</h1>
        <p className="text-muted-foreground mb-6">
          Vous devez être connecté en tant que bureau/syndicat pour accéder à cette page.
        </p>
        <Button onClick={() => navigate('/auth')}>
          Se Connecter
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">Monitoring Syndicat</h1>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <BureauRealtimeDashboard
          bureauId={bureauId}
          bureauName={bureauName}
        />
      </main>
    </div>
  );
}
