/**
 * PAGE MES ACHATS - Accessible depuis toutes les interfaces
 * 224Solutions - My Purchases Page
 */

import { lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/home/BottomNavigation';

const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));

export default function MyPurchases() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Mes Achats</h1>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <MyPurchasesOrdersList
            title="Mes Achats Personnels"
            emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace"
          />
        </Suspense>
      </div>

      <BottomNavigation />
    </div>
  );
}
