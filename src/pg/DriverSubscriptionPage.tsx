import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DriverSubscriptionCard } from '@/components/driver/DriverSubscriptionCard';
import { useAuth } from '@/hooks/useAuth';

export default function DriverSubscriptionPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleBack = () => {
    if (profile?.role === 'taxi') {
      navigate('/taxi-moto/driver');
    } else if (profile?.role === 'livreur') {
      navigate('/livreur');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Abonnement 224Solutions</h1>
            <p className="text-muted-foreground">
              Gérez votre abonnement mensuel
            </p>
          </div>
        </div>

        <DriverSubscriptionCard />
      </div>
    </div>
  );
}
