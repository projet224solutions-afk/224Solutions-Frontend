import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Loader2, WifiOff } from 'lucide-react';

/**
 * Garde de route (UI). La frontière de sécurité RÉELLE est la RLS + `verifyJWT` backend ;
 * ce composant ne contrôle que l'affichage.
 *
 * 🔒 DURCISSEMENT (audit auth 2026-06-17) : l'ancienne « session custom » agent/bureau lue dans
 * localStorage (« chiffrée » avec une clé non secrète = userAgent+hostname → FORGEABLE) a été
 * SUPPRIMÉE. Elle était de toute façon du code mort : aucun login n'écrivait agent_session/
 * agent_user/bureau_user. Les vrais accès agent/bureau passent par un TOKEN dans l'URL
 * (/agent/:token, /bureau/:token) validé côté backend (access_token / JWT signé), hors de ce garde.
 * Ici on ne fait confiance qu'à la session Supabase réelle (+ cache profil offline, purgé au logout).
 */
interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { t } = useTranslation();
  const { user, profile, loading, profileLoading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const navigate = useNavigate();

  // Cache profil pour le mode hors ligne (ne sert que si réellement offline ET pas de session live).
  const [offlineProfile, setOfflineProfile] = useState<{ role: string } | null>(null);

  useEffect(() => {
    if (!isOnline && !user) {
      try {
        const keys = Object.keys(localStorage);
        const profileKey = keys.find(k => k.startsWith('profile_cache_'));
        if (profileKey) {
          const cached = JSON.parse(localStorage.getItem(profileKey) || '{}');
          if (cached?.role) {
            console.log('📡 [ProtectedRoute] Mode offline - profil cache trouvé:', cached.role);
            setOfflineProfile(cached);
          }
        }
      } catch {
        console.warn('⚠️ Erreur lecture profil offline');
      }
    }
  }, [isOnline, user]);

  // Redirection si non authentifié — JAMAIS en mode réellement offline (pour ne pas couper l'app).
  useEffect(() => {
    if (!loading && !user) {
      const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!browserOnline) {
        console.log("📡 [ProtectedRoute] Mode offline - pas de redirection");
        return;
      }
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      if (currentPath && currentPath !== '/' && currentPath !== '/auth') {
        sessionStorage.setItem('post_auth_redirect', currentPath);
        console.log("🔒 [ProtectedRoute] Destination sauvegardée:", currentPath);
      }
      console.log("🔒 Utilisateur non authentifié, redirection vers /auth");
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const isAuthenticated = !!user || (!browserOnline && !!offlineProfile);
  const rawRole = profile?.role || offlineProfile?.role || 'client';

  // pdg/ceo/admin sont équivalents côté PDG ; ceo → pdg.
  const normalizeRole = (role: string): string => {
    const r = role.toLowerCase();
    return r === 'ceo' ? 'pdg' : r;
  };
  const effectiveRole = normalizeRole(rawRole);
  const trulyOffline = !isOnline && (typeof navigator === 'undefined' || !navigator.onLine);

  if (!isAuthenticated) {
    if (trulyOffline) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <WifiOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Mode hors ligne</h2>
            <p className="text-muted-foreground mb-4">
              Connectez-vous une première fois avec Internet pour activer le mode hors ligne.
            </p>
            <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground px-4 py-2 rounded">
              🔄 Réessayer
            </button>
          </div>
        </div>
      );
    }
    // Redirection en cours (gérée par le useEffect) : loader, pas de page d'erreur (évite le flash).
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Redirection…</span>
        </div>
      </div>
    );
  }

  if (effectiveRole && !allowedRoles.includes(effectiveRole)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">{t('protectedRoute.accesNonAutorise')}</h2>
          <p className="mb-4">{t('protectedRoute.vousNAvezPasLes')}</p>
          <button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground px-4 py-2 rounded">
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen pb-24">{children}</div>;
}
