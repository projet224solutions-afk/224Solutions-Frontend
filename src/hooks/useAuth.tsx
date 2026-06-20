import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, startSessionMonitor, stopSessionMonitor, getLocalSession, isOffline } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'ceo' | 'pdg' | 'vendeur' | 'livreur' | 'taxi' | 'syndicat' | 'transitaire' | 'client' | 'agent' | 'vendor_agent' | 'actionnaire';
  avatar_url?: string;
  phone?: string;
  city?: string;
  country?: string;
  detected_country?: string;
  detected_currency?: string;
  profile_completed?: boolean;
  is_active: boolean;
  kyc_status?: string;
  has_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  ensureUserSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Refs anti-boucles / anti-requêtes répétées
  const profileRef = useRef<Profile | null>(null);
  const ensuredSetupForUserRef = useRef<string | null>(null);
  const isRefreshingProfileRef = useRef(false);
  const firstSupabaseErrorLoggedRef = useRef(false);

  const logFirstSupabaseError = useCallback((scope: string, error: unknown) => {
    if (firstSupabaseErrorLoggedRef.current) return;
    firstSupabaseErrorLoggedRef.current = true;
    console.error('FIRST SUPABASE ERROR', { scope, error });
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Fonction pour s'assurer que l'utilisateur a son setup complet
  const ensureUserSetup = useCallback(async () => {
    if (!user) return;

    const setupStartedAt = performance.now();
    console.log('⚙️ [useAuth] ensureUserSetup:start', { userId: user.id });

    try {
      const p = profileRef.current;
      console.log('🔍 Vérification setup utilisateur:', user.id);

      const [walletCheck, userIdCheck, virtualCardCheck] = await Promise.all([
        supabase.from('wallets').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_ids').select('custom_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('virtual_cards').select('id').eq('user_id', user.id).maybeSingle(),
      ]);

      // Si l'une des requêtes échoue (RLS, réseau, etc.) → on remonte l'erreur
      const unexpectedError = walletCheck.error || userIdCheck.error || virtualCardCheck.error;
      if (unexpectedError) throw unexpectedError;

      const needsWallet = !walletCheck.data;
      const needsUserId = !userIdCheck.data;
      const needsVirtualCard = !virtualCardCheck.data;

      if (!needsWallet && !needsUserId && !needsVirtualCard) {
        console.log('✅ Setup utilisateur complet');
        return;
      }

      const missing: string[] = [];
      if (needsWallet) missing.push('Wallet');
      if (needsUserId) missing.push('ID utilisateur');
      if (needsVirtualCard) missing.push('Carte virtuelle');
      console.log('⚠️ Éléments manquants:', missing);

      let customId = '';

      // Créer ID utilisateur si manquant — généré et écrit côté serveur
      // (les colonnes d'identité ne sont jamais écrites depuis le navigateur)
      if (needsUserId) {
        try {
          const { backendFetch } = await import('@/services/backendApi');
          const res = await backendFetch<{ custom_id: string }>('/api/identity/ensure', { method: 'POST' });
          if (res.success && res.data?.custom_id) {
            customId = res.data.custom_id;
            console.log('✅ ID utilisateur assuré (backend):', customId);
          } else {
            console.error('❌ Erreur génération ID (backend):', res.error);
          }
        } catch (e) {
          console.error('❌ Erreur appel /api/identity/ensure:', e);
        }
      } else {
        customId = userIdCheck.data?.custom_id || 'ABC0000';
      }

      // Créer wallet si manquant via RPC
      if (needsWallet) {
        console.log('⚠️ Wallet manquant pour:', user.id);
        console.log('📝 Initialisation via RPC...');

        try {
          const { data: initResult, error: rpcError } = await supabase
            .rpc('initialize_user_wallet', { p_user_id: user.id });

          if (rpcError) {
            console.error('❌ Erreur RPC:', rpcError);
          } else if (initResult) {
            const result = initResult as any;
            if (result.success) {
              console.log('✅ Wallet initialisé:', result);
            }
          }
        } catch (initError) {
          console.error('❌ Erreur appel fonction initialisation:', initError);
        }
      }

      // Créer carte virtuelle si manquante
      if (needsVirtualCard) {
        const last4Digits = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        const cardNumber = `4*** **** **** ${last4Digits}`;

        const holderName = `${p?.first_name || ''} ${p?.last_name || customId}`.trim();

        const futureDate = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000);
        const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
        const year = futureDate.getFullYear().toString().slice(-2);
        const expiryDate = `${month}/${year}`;

        const { error: cardError } = await supabase
          .from('virtual_cards')
          .upsert({
            user_id: user.id,
            card_number: cardNumber,
            holder_name: holderName,
            expiry_date: expiryDate,
            cvv: Math.floor(Math.random() * 900 + 100).toString(),
            daily_limit: 500000,
            monthly_limit: 2000000,
          });

        if (cardError) {
          console.error('❌ Erreur création carte virtuelle:', cardError);
        } else {
          console.log('✅ Carte virtuelle créée:', cardNumber);
        }
      }

      console.log('✅ Configuration utilisateur complétée !');
    } catch (error) {
      console.warn('⚠️ [useAuth] ensureUserSetup:error (non bloquant)', error);
    } finally {
      const durationMs = Math.round(performance.now() - setupStartedAt);
      console.log('⚙️ [useAuth] ensureUserSetup:end', { userId: user.id, durationMs });
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    if (isRefreshingProfileRef.current) {
      console.log('⏭️ [useAuth] refreshProfile ignoré (déjà en cours)');
      return;
    }

    isRefreshingProfileRef.current = true;
    const refreshStartedAt = performance.now();
    console.log('🧭 [useAuth] refreshProfile:start', { userId: user.id, email: user.email });

    const mapAccountTypeToRole = (value: string): string | null => {
      const v = value.toLowerCase().trim();
      if (v === 'marchand' || v === 'merchant' || v === 'vendeur') return 'vendeur';
      if (v === 'prestataire' || v === 'service') return 'prestataire';
      if (v === 'livreur' || v === 'driver') return 'livreur';
      if (v === 'taxi_moto' || v === 'taxi-moto' || v === 'taxi') return 'taxi';
      if (v === 'transitaire') return 'transitaire';
      if (v === 'syndicat' || v === 'bureau') return 'syndicat';
      if (v === 'agent') return 'agent';
      if (v === 'admin') return 'admin';
      if (v === 'ceo' || v === 'pdg') return 'pdg';
      if (v === 'client') return 'client';
      if (v === 'vendor_agent') return 'vendor_agent';
      return null;
    };

    // Clé de cache pour le profil
    const profileCacheKey = `profile_cache_${user.id}`;

    const applyMinimalProfileFallback = (reason: string) => {
      const fallbackProfile: Profile = {
        id: user.id,
        email: user.email || '',
        role: 'client',
        is_active: true,
      };
      console.warn('⚠️ [useAuth] fallback profil minimal', { reason, userId: user.id });
      setProfile((prev) => prev ?? fallbackProfile);
      localStorage.setItem(profileCacheKey, JSON.stringify(fallbackProfile));
    };

    // ✅ Fonction réutilisable pour créer vendor lors de l'OAuth (vendeurs uniquement)
    const createVendorForOAuth = async (authUser: User) => {
      try {
        const oauthShopType = localStorage.getItem('oauth_vendor_shop_type') || 'physical';
        const meta: any = (authUser as any).user_metadata || {};
        const fullName = (meta.full_name || meta.name || '').toString().trim();
        const businessName = fullName || authUser.email?.split('@')[0] || 'Ma Boutique';

        // Vérifier si un vendor existe déjà
        const { data: existingVendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (existingVendor) {
          console.log('ℹ️ Vendor existe déjà, skip création');
          return;
        }

        const { error: vendorError } = await supabase
          .from('vendors')
          .insert({
            user_id: authUser.id,
            business_name: businessName,
            email: authUser.email || '',
            is_verified: false,
            is_active: true,
            service_type: 'general',
            business_type: oauthShopType === 'digital' ? 'digital' : 'physical',
          });

        if (vendorError) {
          console.error('❌ Erreur création vendor OAuth:', vendorError);
          return;
        }
        console.log('✅ Vendor créé via OAuth:', { businessName, shopType: oauthShopType });
      } catch (vendorErr) {
        console.error('❌ Exception création vendor OAuth:', vendorErr);
      }
    };

    // ✅ Fonction pour créer taxi_driver pour les chauffeurs OAuth
    const createTaxiDriverForOAuth = async (authUser: User) => {
      try {
        const pendingCategory = localStorage.getItem('oauth_taxi_category');
        const pendingCountry = localStorage.getItem('oauth_taxi_country');
        const categoryToSave: 'car' | 'motorcycle' =
          pendingCategory === 'car' ? 'car' : 'motorcycle';

        // Vérifier si un taxi_driver existe déjà
        const { data: existingDriver } = await supabase
          .from('taxi_drivers')
          .select('id')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (existingDriver) {
          console.log('ℹ️ Taxi driver existe déjà, skip création');
          localStorage.removeItem('oauth_taxi_category');
          localStorage.removeItem('oauth_taxi_country');
          return;
        }

        const { error: dErr } = await supabase
          .from('taxi_drivers')
          .insert({
            user_id: authUser.id,
            is_online: false,
            status: 'pending_verification',
            taxi_category: categoryToSave,
            ...(pendingCountry ? { vehicle: { country: pendingCountry } } : {}),
          });

        if (dErr) {
          console.error('❌ Erreur création taxi_driver OAuth:', dErr);
        } else {
          console.log('✅ Taxi driver créé via OAuth, catégorie:', categoryToSave);
        }

        localStorage.removeItem('oauth_taxi_category');
        localStorage.removeItem('oauth_taxi_country');
      } catch (err) {
        console.error('❌ Exception création taxi_driver OAuth:', err);
      }
    };

    // ✅ NOUVEAU: Fonction pour créer professional_service pour prestataires OAuth
    const createServiceForOAuthPrestataire = async (authUser: User) => {
      try {
        const oauthServiceType = localStorage.getItem('oauth_service_type');
        if (!oauthServiceType || oauthServiceType === 'general') {
          console.log('ℹ️ Pas de service type spécifique, skip création');
          return;
        }

        const meta: any = (authUser as any).user_metadata || {};
        const fullName = (meta.full_name || meta.name || '').toString().trim();
        // Priorité au nom d'établissement saisi à l'inscription (pharmacie/clinique…),
        // transmis via la métadonnée business_name ou le localStorage oauth_business_name.
        const storedBusinessName = (() => {
          try { return localStorage.getItem('oauth_business_name')?.trim() || ''; } catch { return ''; }
        })();
        const businessName = (meta.business_name && String(meta.business_name).trim())
          || storedBusinessName
          || fullName
          || authUser.email?.split('@')[0]
          || 'Mon Service';

        // Vérifier si un professional_service existe déjà
        const { data: existingService } = await supabase
          .from('professional_services')
          .select('id')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (existingService) {
          console.log('ℹ️ Professional service existe déjà, skip création');
          localStorage.removeItem('oauth_service_type');
          try { localStorage.removeItem('oauth_business_name'); } catch { /* ignore */ }
          return;
        }

        const { data: serviceTypeData } = await supabase
          .from('service_types')
          .select('id')
          .eq('code', oauthServiceType)
          .maybeSingle();

        if (serviceTypeData) {
          const { error: psError } = await supabase
            .from('professional_services')
            .insert({
              user_id: authUser.id,
              service_type_id: serviceTypeData.id,
              business_name: businessName,
              city: meta.city || null,
              address: meta.city || null,
              phone: meta.phone || null,
              status: 'active',
              verification_status: 'unverified',
              email: authUser.email || '',
            });
          if (psError) {
            console.error('❌ Erreur création professional_service:', psError);
          } else {
            console.log('✅ Professional service créé pour prestataire:', oauthServiceType);
            localStorage.removeItem('oauth_service_type');
            try { localStorage.removeItem('oauth_business_name'); } catch { /* ignore */ }
          }
        } else {
          console.warn('⚠️ Service type non trouvé pour le code:', oauthServiceType);
        }
      } catch (err) {
        console.error('❌ Exception création service prestataire OAuth:', err);
      }
    };

    setProfileLoading(true);
    console.log('[PROFILE] Loading profile...', { email: user.email, userId: user.id });

    // Timeout sécurité: ne jamais bloquer plus de 4 secondes
    const profileTimeout = setTimeout(() => {
      console.warn('[TIMEOUT TRIGGERED] Profile load timeout (4s) - usage cache/fallback');
      const cachedProfile = localStorage.getItem(profileCacheKey);
      if (cachedProfile && !profileRef.current) {
        try {
          setProfile(JSON.parse(cachedProfile) as Profile);
        } catch (_e) {}
      }
      setProfileLoading(false);
    }, 4000);

    try {
      // ✨ NOUVEAU: En mode offline, utiliser le profil en cache
      if (isOffline()) {
        console.log('📡 Mode hors ligne - utilisation profil en cache');
        const cachedProfile = localStorage.getItem(profileCacheKey);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile) as Profile;
            console.log('✅ Profil restauré depuis cache:', parsed.role);
            setProfile(parsed);
          } catch (_e) {
            console.warn('⚠️ Erreur parsing profil cache');
          }
        }
        setProfileLoading(false);
        return;
      }

      // Récupérer les flags OAuth
      const intendedRoleRaw = localStorage.getItem('oauth_intent_role') || '';
      const intendedRole = intendedRoleRaw ? mapAccountTypeToRole(intendedRoleRaw) : null;
      const isNewOAuthSignup = localStorage.getItem('oauth_is_new_signup') === 'true';

      // 1. Vérifier si un profil existe déjà pour cet utilisateur
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        // ✨ NOUVEAU: Ignorer erreurs réseau et utiliser cache
        if (profileError.message?.includes('network') || profileError.message?.includes('fetch')) {
          console.warn('⚠️ Erreur réseau - utilisation profil en cache');
          logFirstSupabaseError('refreshProfile.profile_query.network', profileError);
          const cachedProfile = localStorage.getItem(profileCacheKey);
          if (cachedProfile) {
            try {
              const parsedProfile = JSON.parse(cachedProfile) as Profile;
              setProfile(parsedProfile);
              console.log('[PROFILE LOADED]', { source: 'cache_after_network_error', role: parsedProfile.role });
            } catch (_e) {}
          }
          setProfileLoading(false);
          return;
        }

        console.error('❌ Erreur chargement profil:', profileError);
        logFirstSupabaseError('refreshProfile.profile_query.error', profileError);
        localStorage.removeItem('oauth_intent_role');
        localStorage.removeItem('oauth_is_new_signup');
        applyMinimalProfileFallback('profile_query_error');
        console.log('[PROFILE LOADED]', { source: 'minimal_fallback', role: 'client' });
        return;
      }

      // 2. Profil existant trouvé
      if (existingProfile) {
        const current = existingProfile as Profile;
        console.log('✅ Profil existant trouvé:', current.email, '| Rôle:', current.role);

        // Si l'utilisateur essayait de créer un compte (isNewOAuthSignup=true)
        // et le profil a été créé par le trigger avec le rôle par défaut 'client'
        // mais l'utilisateur avait choisi un rôle différent → mettre à jour le rôle
        if (isNewOAuthSignup && intendedRole && intendedRole !== 'client' && current.role === 'client') {
          console.log('🔄 Mise à jour du rôle OAuth:', current.role, '→', intendedRole);

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: intendedRole as any })
            .eq('id', user.id);

          if (!updateError) {
            const updatedProfile = { ...current, role: intendedRole } as Profile;
            localStorage.setItem(profileCacheKey, JSON.stringify(updatedProfile));

            // Créer les entités métier selon le rôle
            // Pour taxi: await pour que la ligne existe avant le redirect
            if (intendedRole === 'vendeur') {
              void createVendorForOAuth(user);
            } else if (intendedRole === 'prestataire') {
              // await : la ligne professional_services (type pharmacie/…) doit exister AVANT le
              // redirect, et oauth_service_type ne doit pas être effacé avant lecture.
              await createServiceForOAuthPrestataire(user);
            } else if (intendedRole === 'taxi') {
              await createTaxiDriverForOAuth(user);
            }

            const roleLabels: Record<string, string> = {
              client: 'Client',
              vendeur: 'Marchand',
              prestataire: 'Prestataire de Service',
              livreur: 'Livreur',
              taxi: 'Chauffeur Taxi',
              transitaire: 'Transitaire',
            };
            toast.success(
              `Compte créé avec succès !`,
              {
                duration: 5000,
                description: `Vous êtes inscrit en tant que ${roleLabels[intendedRole] || intendedRole}.`,
              }
            );

            // ✅ Supprimer les flags AVANT setProfile : quand React flush setProfile,
            // Flags nettoyés AVANT setProfile : isNewSignup=false au prochain rendu (pas de double insert taxi_drivers)
            localStorage.removeItem('oauth_intent_role');
            localStorage.removeItem('oauth_is_new_signup');
            setProfile(updatedProfile);
            return;
          } else {
            console.error('❌ Erreur mise à jour rôle OAuth:', updateError);
            setProfile(current);
            localStorage.setItem(profileCacheKey, JSON.stringify(current));
          }

          localStorage.removeItem('oauth_intent_role');
          localStorage.removeItem('oauth_is_new_signup');
          return;
        }

        // Si l'utilisateur essayait de créer un compte mais le profil existait DÉJÀ avant
        if (isNewOAuthSignup) {
          console.log('⚠️ Tentative d\'inscription mais compte existe déjà');

          toast.warning(
            `Cet email est déjà enregistré ! Vous avez été connecté à votre compte ${current.role} existant.`,
            {
              duration: 6000,
              description: 'Votre compte existant a été utilisé pour la connexion.',
            }
          );
        } else {
          // Connexion normale - afficher le toast une seule fois par session
          const welcomeShownKey = `welcome_shown_${user.id}`;
          if (!sessionStorage.getItem(welcomeShownKey)) {
            const roleLabels: Record<string, string> = {
              client: 'Client',
              vendeur: 'Marchand',
              livreur: 'Livreur',
              taxi: 'Taxi Moto',
              transitaire: 'Transitaire',
              admin: 'Administrateur',
              ceo: 'PDG',
              agent: 'Agent',
              syndicat: 'Syndicat',
            };
            toast.success(`Bienvenue ! Vous êtes connecté en tant que ${roleLabels[current.role] || current.role}.`);
            sessionStorage.setItem(welcomeShownKey, 'true');
          }
        }

        // 🩹 FILET : un prestataire dont le professional_services n'a pas pu être créé à l'inscription
        // (insert RLS bloqué faute de session quand la confirmation email est active) le voit (re)créé
        // ici, une fois authentifié. Idempotent : no-op si oauth_service_type absent ou service déjà présent.
        if ((current.role as string) === 'prestataire' && localStorage.getItem('oauth_service_type')) {
          await createServiceForOAuthPrestataire(user);
        }

        // NE JAMAIS modifier le rôle d'un profil existant (sauf cas OAuth ci-dessus)
        setProfile(current);
        console.log('[PROFILE LOADED]', { source: 'existing_profile', role: current.role, userId: current.id });

        // ✨ NOUVEAU: Mettre en cache le profil pour mode offline
        localStorage.setItem(profileCacheKey, JSON.stringify(current));

        // Nettoyer immédiatement les flags
        localStorage.removeItem('oauth_intent_role');
        localStorage.removeItem('oauth_is_new_signup');
        return;
      }

      // 3. Vérifier si l'email existe déjà dans un AUTRE profil (cas rare mais possible)
      if (user.email) {
        const { data: emailCheck } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('email', user.email)
          .neq('id', user.id)
          .maybeSingle();

        if (emailCheck) {
          console.log('⚠️ Email déjà utilisé par un autre compte:', emailCheck.email);
          toast.warning(t('useAuth.cetEmailEstDejaAssocie'));
          // Ne pas créer de doublon
          localStorage.removeItem('oauth_intent_role');
          localStorage.removeItem('oauth_is_new_signup');
          setProfileLoading(false);
          return;
        }
      }

      // 4. Aucun profil existant → Créer un nouveau profil (vraie nouvelle inscription)
      console.log('📝 Création nouveau profil pour:', user.email);

      const meta: any = (user as any).user_metadata || {};
      const fullName = (meta.full_name || meta.name || '').toString().trim();
      const firstName = (meta.first_name || (fullName ? fullName.split(' ')[0] : '') || '').toString().trim();
      const lastName = (meta.last_name || (fullName ? fullName.split(' ').slice(1).join(' ') : '') || '').toString().trim();

      // Utiliser le rôle choisi lors de l'inscription OU client par défaut
      const roleToUse = intendedRole || mapAccountTypeToRole(meta.account_type || '') || 'client';

      const profileToCreate = {
        id: user.id,
        email: user.email || '',
        first_name: firstName || null,
        last_name: lastName || null,
        role: roleToUse,
        avatar_url: (meta.avatar_url || meta.picture || null) as string | null,
        is_active: true,
      };

      console.log('📝 Nouveau profil avec rôle:', roleToUse);

      const { error: insertError } = await supabase
        .from('profiles')
        .insert(profileToCreate as any);

      if (insertError) {
        console.error('❌ Erreur création profil:', insertError);
        // Si erreur de duplicat (conflit), essayer de récupérer le profil existant
        if (insertError.code === '23505') {
          const { data: conflictProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          if (conflictProfile) {
            setProfile(conflictProfile as Profile);
          }
        }
        localStorage.removeItem('oauth_intent_role');
        localStorage.removeItem('oauth_is_new_signup');
        return;
      }

      // Recharger le profil créé
      const { data: createdProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (createdProfile) {
        console.log('✅ Nouveau profil créé avec succès:', createdProfile.role);

        // Créer les entités métier selon le rôle
        if (createdProfile.role === 'vendeur') {
          void createVendorForOAuth(user);
        } else if ((createdProfile.role as string) === 'prestataire') {
          await createServiceForOAuthPrestataire(user);
        } else if ((createdProfile.role as string) === 'taxi') {
          await createTaxiDriverForOAuth(user);
        }

        const roleLabels: Record<string, string> = {
          client: 'Client',
          vendeur: 'Marchand',
          prestataire: 'Prestataire de Service',
          livreur: 'Livreur',
          taxi: 'Chauffeur Taxi',
          transitaire: 'Transitaire',
        };

        toast.success(
          `Compte créé avec succès !`,
          {
            duration: 5000,
            description: `Vous êtes inscrit en tant que ${roleLabels[createdProfile.role] || createdProfile.role}. Complétez votre profil pour continuer.`,
          }
        );

        localStorage.setItem('needs_profile_completion', 'true');
        localStorage.setItem(profileCacheKey, JSON.stringify(createdProfile));

        // ✅ Supprimer les flags AVANT setProfile : quand React flush setProfile,
        // Flags nettoyés AVANT setProfile : isNewSignup=false au prochain rendu (pas de double insert taxi_drivers)
        localStorage.removeItem('oauth_intent_role');
        localStorage.removeItem('oauth_is_new_signup');
        setProfile(createdProfile as Profile);
        console.log('[PROFILE LOADED]', { source: 'created_profile', role: createdProfile.role, userId: createdProfile.id });
        return;
      } else {
        setProfile(profileToCreate as any);
        console.log('[PROFILE LOADED]', { source: 'profile_fallback_object', role: profileToCreate.role, userId: profileToCreate.id });
        localStorage.setItem(profileCacheKey, JSON.stringify(profileToCreate));
      }

      // Nettoyer les flags (chemin fallback uniquement — le chemin principal retourne plus haut)
      localStorage.removeItem('oauth_intent_role');
      localStorage.removeItem('oauth_is_new_signup');
    } catch (error) {
      console.error('❌ Erreur dans refreshProfile:', error);
      localStorage.removeItem('oauth_intent_role');
      localStorage.removeItem('oauth_is_new_signup');
      applyMinimalProfileFallback('refresh_profile_exception');
    } finally {
      clearTimeout(profileTimeout);
      setProfileLoading(false);
      isRefreshingProfileRef.current = false;
      const durationMs = Math.round(performance.now() - refreshStartedAt);
      console.log('🧭 [useAuth] refreshProfile:end', { userId: user.id, durationMs });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    // IMPORTANT: on écoute d'abord les changements auth, puis on lit la session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('🔔 Auth state change:', event, nextSession?.user?.email || 'no user');
      console.log('AUTH STATE:', {
        event,
        hasSession: !!nextSession,
        hasUser: !!nextSession?.user,
      });

      // ✨ Ignorer les événements TOKEN_REFRESHED pour éviter les re-renders inutiles
      // Ces événements ne changent pas l'utilisateur, juste le token
      if (event === 'TOKEN_REFRESHED') {
        console.log('⏭️ Token refresh ignoré (pas de re-render)');
        // Mettre à jour silencieusement la session sans déclencher de re-render du user
        setSession(nextSession);
        return;
      }

      // Au retour dans l'onglet/app, Supabase ré-émet SIGNED_IN / INITIAL_SESSION avec le MÊME
      // utilisateur. Si on remplaçait `user`/`session` par de nouveaux objets, useCurrentVendor
      // (qui dépend de auth.user) se relancerait → refetch → l'interface vendeur « s'actualise ».
      // On préserve donc les références tant que l'ID utilisateur et le token n'ont pas changé.
      const nextUser = nextSession?.user ?? null;
      setSession(prev => (prev?.access_token && prev.access_token === nextSession?.access_token ? prev : nextSession));
      setUser(prev => (prev?.id && prev.id === nextUser?.id ? prev : nextUser));

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        stopSessionMonitor();
      } else {
        startSessionMonitor();
      }

      setLoading(false);
    });

    const init = async () => {
      const initStartedAt = performance.now();
      console.log('🧭 [useAuth] init:start');
      console.log('🔍 Vérification session...');

      // Timeout de sécurité - court pour ne pas bloquer l'UI
      const timeoutMs = isOffline() ? 1000 : 3000;
      const timeoutId = setTimeout(() => {
        console.warn('[TIMEOUT TRIGGERED] Auth init timeout - fallback local session');
        if (isOffline()) {
          const localSession = getLocalSession();
          if (localSession?.access_token) {
            console.log('[AUTH LOADED]', { source: 'local_session_timeout', userId: localSession.user?.id });
            setSession(localSession as unknown as Session);
            setUser(localSession.user);
          }
        }
        setLoading(false);
      }, timeoutMs);

      try {
        if (isOffline()) {
          console.log('📡 Mode hors ligne détecté - utilisation session locale');
          const localSession = getLocalSession();
          clearTimeout(timeoutId);

          if (localSession?.access_token) {
            const offlineSession = {
              access_token: localSession.access_token,
              refresh_token: localSession.refresh_token,
              expires_at: localSession.expires_at,
              expires_in: localSession.expires_in,
              token_type: 'bearer',
              user: localSession.user
            } as Session;

            setSession(offlineSession);
            setUser(localSession.user);
            console.log('[AUTH LOADED]', { source: 'offline_local_session', userId: localSession.user?.id });
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
          return;
        }

        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        clearTimeout(timeoutId);

        if (error) {
          logFirstSupabaseError('auth.getSession.error', error);
          if (error.message?.includes('network') || error.message?.includes('fetch')) {
            console.warn('⚠️ Erreur réseau - utilisation session locale');
            const localSession = getLocalSession();
            if (localSession?.access_token) {
              setSession(localSession as unknown as Session);
              setUser(localSession.user);
              console.log('[AUTH LOADED]', { source: 'local_session_after_network_error', userId: localSession.user?.id });
              setLoading(false);
              return;
            }
          }

          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          startSessionMonitor();
          console.log('[AUTH LOADED]', { source: 'supabase_session', userId: initialSession.user.id });
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          console.log('[AUTH LOADED]', { source: 'no_session' });
        }
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error?.message?.includes('network') || error?.message?.includes('fetch') || error?.message?.includes('Failed to fetch')) {
          logFirstSupabaseError('auth.getSession.catch.network', error);
          const localSession = getLocalSession();
          if (localSession?.access_token) {
            setSession(localSession as unknown as Session);
            setUser(localSession.user);
            console.log('[AUTH LOADED]', { source: 'local_session_after_exception', userId: localSession.user?.id });
            setLoading(false);
            return;
          }
        }

        logFirstSupabaseError('auth.getSession.catch.unexpected', error);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
        const durationMs = Math.round(performance.now() - initStartedAt);
        console.log('🧭 [useAuth] init:end', { durationMs });
      }
    };

    init();

    return () => {
      subscription.unsubscribe();
      stopSessionMonitor();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (user) {
      refreshProfile();
    } else {
      setProfile(null);
      ensuredSetupForUserRef.current = null;
    }
  }, [user, refreshProfile]);

  // Setup automatique: NON-BLOQUANT, en arrière-plan après un délai
  // Ne doit JAMAIS bloquer l'affichage de l'UI
  useEffect(() => {
    if (!user || profileLoading || !profile) return;
    if (ensuredSetupForUserRef.current === user.id) return;

    ensuredSetupForUserRef.current = user.id;

    // Lancer le setup en arrière-plan après 2s pour ne pas bloquer le rendu
    const timer = setTimeout(() => {
      ensureUserSetup().catch((err) => {
        console.warn('⚠️ Setup arrière-plan échoué (non bloquant):', err);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, profile, profileLoading, ensureUserSetup]);

  const signOut = async () => {
    try {
      // Nettoyer immédiatement l'état local
      setSession(null);
      setUser(null);
      setProfile(null);
      stopSessionMonitor();

      // Essayer de déconnecter côté Supabase
      const { error } = await supabase.auth.signOut();

      // Si la session n'existait pas côté serveur, ce n'est pas grave
      // L'important est que l'état local soit nettoyé
      if (error && error.message !== 'Session not found') {
        console.error('Erreur déconnexion Supabase:', error);
      }

      // Nettoyer aussi le localStorage de façon explicite — TOUTES les sessions, sinon une
      // déconnexion laisse l'accès UI agent/bureau actif (ProtectedRoute.checkCustomSession) et
      // le cache profil offline pourrait reconférer un rôle.
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-uakkxaibujzxdiqzpnpr-auth-token');
      // Sessions custom agent / bureau (UI) + jetons associés
      localStorage.removeItem('agent_token');
      localStorage.removeItem('agent_session');
      localStorage.removeItem('agent_user');
      localStorage.removeItem('bureau_token');
      localStorage.removeItem('bureau_session');
      localStorage.removeItem('bureau_user');
      // Cache profil offline (évite de reconférer un rôle après déconnexion en mode hors ligne)
      try {
        Object.keys(localStorage).filter((k) => k.startsWith('profile_cache_')).forEach((k) => localStorage.removeItem(k));
      } catch { /* noop */ }
      sessionStorage.clear();

      console.log('✅ Déconnexion réussie');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, on nettoie l'état local
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    signOut,
    refreshProfile,
    ensureUserSetup
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};