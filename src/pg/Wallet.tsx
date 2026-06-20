import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import UniversalWalletTransactions from '@/components/wallet/UniversalWalletTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet as WalletIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Wallet() {
  const { user, profileLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Rediriger vers auth si pas connecté
    if (!user && !profileLoading) {
      navigate('/auth');
    }
  }, [user, profileLoading, navigate]);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      {/* Header - optimise mobile */}
      <div className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="px-3 py-3 sm:container sm:mx-auto sm:px-4 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0 h-9 w-9 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <WalletIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Mon Wallet</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Gérez vos transactions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - optimise mobile */}
      <div className="px-2 py-3 sm:container sm:mx-auto sm:px-4 sm:py-6">
        <UniversalWalletTransactions />
      </div>
    </div>
  );
}
