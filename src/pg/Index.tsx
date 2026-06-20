/**
 * Index.tsx - Page d'accueil principale
 * Composant léger qui charge rapidement et redirige vers Home
 */
import { Suspense, lazy } from "react";

// Lazy load Home pour un premier affichage rapide
const Home = lazy(() => import("./Home"));

// Loader minimal inline
const QuickLoader = () => (
  <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-primary mb-4">224Solutions</h1>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
    </div>
  </div>
);

export default function Index() {
  return (
    <Suspense fallback={<QuickLoader />}>
      <Home />
    </Suspense>
  );
}
