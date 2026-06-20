import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ArrowLeft, AlertTriangle, ShoppingBag, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Déterminer la page d'accueil selon le rôle
  const getHomePath = () => {
    if (!user || !profile?.role) return "/";

    switch (profile.role) {
      case "vendeur":
        return "/vendeur/dashboard";
      case "admin":
        return "/pdg-224solutions";
      case "client":
        return "/client";
      case "syndicat":
        return "/bureau/dashboard";
      case "livreur":
        return "/livreur/dashboard";
      case "transitaire":
        return "/transitaire/dashboard";
      case "taxi":
        return "/taxi-moto/driver";
      default:
        return "/";
    }
  };

  // Boutons de navigation rapide
  const navigationItems = [
    {
      id: 'home',
      label: 'Accueil',
      icon: Home,
      path: '/home',
      description: 'Accueil 224Solutions'
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: ShoppingBag,
      path: '/marketplace',
      description: 'Achats en ligne'
    },
    {
      id: 'tracking',
      label: 'Tracking',
      icon: MapPin,
      path: '/tracking',
      description: 'Suivi de commandes'
    },
    {
      id: 'profil',
      label: 'Profil',
      icon: User,
      path: profile ? '/profil' : '/auth',
      description: profile ? 'Mon profil' : 'Connexion'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30 flex items-center justify-center p-4 pb-24">
      <Card className="max-w-2xl w-full shadow-2xl border-border/50">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              404
            </CardTitle>
            <CardDescription className="text-xl font-medium">
              Page introuvable
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">
              La page que vous recherchez n'existe pas ou a été déplacée.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-mono text-muted-foreground break-all">
                Chemin: <span className="text-foreground font-semibold">{location.pathname}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => navigate(getHomePath())}
              className="flex-1 h-12 text-base shadow-lg"
              size="lg"
            >
              <Home className="w-5 h-5 mr-2" />
              Retour à l'accueil
            </Button>

            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="flex-1 h-12 text-base"
              size="lg"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Page précédente
            </Button>
          </div>

          {user && (
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground text-center">
                Connecté en tant que{" "}
                <span className="font-semibold text-foreground">
                  {profile?.first_name} {profile?.last_name}
                </span>
                {profile?.role && (
                  <span className="ml-2 text-primary">
                    ({profile.role})
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation rapide en bas de page */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 shadow-elegant">
        <div className="flex items-center justify-around px-2 py-2 max-w-screen-xl mx-auto">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 min-w-[70px] group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20 scale-105"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5 hover:scale-105"
                )}
                title={item.description}
              >
                <div className={cn(
                  "p-2 rounded-full transition-all duration-300",
                  isActive
                    ? "bg-white/15 text-primary-foreground"
                    : "bg-muted group-hover:bg-accent group-hover:text-primary"
                )}>
                  <Icon size={20} />
                </div>
                <span className={cn(
                  "text-xs font-medium mt-1 leading-tight",
                  isActive ? "text-primary-foreground font-semibold" : "text-muted-foreground group-hover:text-primary"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
