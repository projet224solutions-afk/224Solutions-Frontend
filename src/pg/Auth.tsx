import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { AlertCircle, Loader2, Store, ArrowLeft, Eye, EyeOff, Search, ChevronDown, Check, RefreshCw, Zap, LogIn, UserPlus, Briefcase, CheckCircle2, Laptop, ShoppingBag, Bike, Truck, Utensils, Scissors, Car, Wrench, Sparkles, Dumbbell, Building2, Camera, Heart, Home, Phone, Lock, Mail, Square, Hammer, Flame, Pill } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import QuickFooter from "@/components/QuickFooter";
import { z } from "zod";
import { useTranslation } from "@/hooks/useTranslation";
import LanguageSelector from "@/components/LanguageSelector";

import { syncCognitoProfile } from "@/services/cognitoSyncService";
import { getSafeBrowserGeo } from "@/lib/safeGeo";
import { resolvePostAuthRoute, cleanupOAuthFlags, cleanupAffiliateFlags, getValidatedPostAuthRedirect } from "@/utils/postAuthRoute";
import { COUNTRY_PHONE_CODES, WORLD_PHONE_CODES, PHONE_VALIDATION_RULES, validatePhoneNumber, getPhoneExample, getPhoneLengthHint } from "@/utils/phoneData";

// Validation schemas avec tous les rôles
// Password strength: 8+ chars, uppercase, lowercase, digit
const passwordSchema = z.string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre");

const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis")
});

const signupSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: passwordSchema,
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  role: z.enum(['client', 'vendeur', 'livreur', 'taxi', 'syndicat', 'transitaire', 'admin', 'prestataire']),
  city: z.string().min(1, "La ville est requise")
});

type UserRole = 'client' | 'vendeur' | 'livreur' | 'taxi' | 'syndicat' | 'transitaire' | 'admin' | 'prestataire';

interface QuickRoleOption {
  role: UserRole;
  name: string;
  desc: string;
  icon: any;
  image: string;
  logoImage?: string;
}

interface ServiceSelectionOption {
  id: string;
  name: string;
  desc: string;
  icon: any;
  image: string;
  logoImage?: string;
}

// Pays où la distinction Voiture / Moto-taxi existe
const MOTO_TAXI_COUNTRY_NAMES = ['Guinée', 'Sierra Leone', 'Liberia', 'Mali', 'Burkina Faso', 'Niger', 'Guinée-Bissau'];

const QUICK_ROLE_OPTIONS: QuickRoleOption[] = [
  { role: 'taxi', name: 'Taxi', desc: 'Conducteur taxi', icon: Bike, image: 'https://images.unsplash.com/photo-1556122071-e404eaedb77f?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/vtc.png' },
  { role: 'livreur', name: 'Livreur', desc: 'Coursier & livraison', icon: Truck, image: 'https://images.unsplash.com/photo-1648394794449-5dbe63f6a8b5?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/livraison.png' },
  { role: 'transitaire', name: 'Transitaire', desc: 'Import & export', icon: Briefcase, image: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?auto=format&fit=crop&w=800&q=80' },
];

const PROXIMITY_SERVICE_OPTIONS: ServiceSelectionOption[] = [
  { id: 'restaurant', name: 'Restaurant', desc: 'Cuisine & plats', icon: Utensils, image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/restaurant.png' },
  { id: 'beaute', name: 'Beauté & Coiffure', desc: 'Soins & styling', icon: Scissors, image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/beaute.png' },
  { id: 'vtc', name: 'Transport VTC', desc: 'Véhicules privés', icon: Car, image: 'https://images.unsplash.com/photo-1601979107535-46367552bc25?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/vtc.png' },
  { id: 'reparation', name: 'Réparation', desc: 'Électro & mécanique', icon: Wrench, image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/reparation.png' },
  { id: 'menage', name: 'Nettoyage', desc: 'Ménage & pressing', icon: Sparkles, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/nettoyage.png' },
  { id: 'informatique', name: 'Informatique', desc: 'Tech & dépannage', icon: Laptop, image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/informatique.png' },
  { id: 'livraison', name: 'Livraison', desc: 'Coursier & colis', icon: Truck, image: 'https://images.unsplash.com/photo-1648394794449-5dbe63f6a8b5?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/livraison.png' },
  { id: 'ecommerce', name: 'Boutique', desc: 'E-commerce', icon: Store, image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/boutique.png' },
];

const PROFESSIONAL_SERVICE_OPTIONS: ServiceSelectionOption[] = [
  { id: 'sport', name: 'Sport & Fitness', desc: 'Coaching', icon: Dumbbell, image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/sport.png' },
  { id: 'location', name: 'Immobilier', desc: 'Location & vente', icon: Building2, image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80', logoImage: '/service-icons-3d/immobilier.png' },
  { id: 'media', name: 'Photo & Vidéo', desc: 'Événements', icon: Camera, image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/media.png' },
  { id: 'construction', name: 'Construction & BTP', desc: 'Bâtiment', icon: Building2, image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/construction.png' },
  { id: 'plomberie', name: 'Plomberie', desc: 'Fuites, sanitaires & urgence', icon: Wrench, image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/plomberie.png' },
  { id: 'vitrerie', name: 'Vitrerie', desc: 'Vitres, miroirs & double vitrage', icon: Square, image: 'https://images.unsplash.com/photo-1527352774566-e4916e36c645?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/vitrerie.png' },
  { id: 'menuiserie', name: 'Menuiserie', desc: 'Bois sur mesure & pose', icon: Hammer, image: 'https://images.unsplash.com/photo-1497219055242-93359eeed651?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/menuiserie.png' },
  { id: 'soudure', name: 'Soudure & Métallerie', desc: 'Portails, ferronnerie & métal', icon: Flame, image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/soudure.png' },
  { id: 'agriculture', name: 'Agriculture', desc: 'Produits locaux', icon: ShoppingBag, image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/agriculture.png' },
  { id: 'freelance', name: 'Administratif', desc: 'Secrétariat', icon: Briefcase, image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/freelance.png' },
  // « Santé & Bien-être » = catégorie : au clic, un sous-menu propose Pharmacie / Clinique.
  { id: 'sante', name: 'Santé & Bien-être', desc: 'Pharmacie & clinique', icon: Heart, image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/sante.png' },
  { id: 'maison', name: 'Maison & Déco', desc: 'Intérieur', icon: Home, image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/maison.png' },
];

// Sous-types du domaine « Santé & Bien-être » affichés dans le sous-menu à l'inscription :
// UNIQUEMENT Pharmacie et Clinique. Chaque id = un code service_types.
const HEALTH_SUBTYPE_OPTIONS: ServiceSelectionOption[] = [
  { id: 'pharmacie', name: 'Pharmacie', desc: 'Médicaments & ordonnances', icon: Pill, image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/sante.png' },
  { id: 'clinique', name: 'Clinique', desc: 'Consultations & analyses', icon: Building2, image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80', logoImage: '/service-icons-3d/sante.png' },
];

export default function Auth() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const [_isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null);
  const [oauthRetrying, setOauthRetrying] = useState(false);
  const [oauthAttempts, setOauthAttempts] = useState<{ google: number; facebook: number }>({ google: 0, facebook: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [checkingResetLink, setCheckingResetLink] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [_resetCode, setResetCode] = useState('');
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetFormattedPhone, setResetFormattedPhone] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [phoneNotFoundReset, setPhoneNotFoundReset] = useState(false);

  // Login par numéro de téléphone
  const [loginPhoneOtpSent, setLoginPhoneOtpSent] = useState(false);
  const [loginFormattedPhone, setLoginFormattedPhone] = useState('');
  const [loginPhoneOtp, setLoginPhoneOtp] = useState('');
  const [loginPhoneNotFound, setLoginPhoneNotFound] = useState(false);
  const [loginResendCooldown, setLoginResendCooldown] = useState(0);
  const [resetResendCooldown, setResetResendCooldown] = useState(0);

  // Inscription par numéro de téléphone
  const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email');
  const [phoneSignupOtpSent, setPhoneSignupOtpSent] = useState(false);
  const [phoneSignupPhone, setPhoneSignupPhone] = useState('');
  const [phoneSignupOtp, setPhoneSignupOtp] = useState('');
  const [phoneSignupResendCooldown, setPhoneSignupResendCooldown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  // Cognito désactivé comme auth principal - Supabase est le système principal
  const navigate = useNavigate();

  // ✓ FIX: Ref pour bloquer le handler SIGNED_IN pendant que handleSubmit gère la création
  const isFormSubmittingRef = useRef(false);

  // === AFFILIATION AGENT ===
  // Lire le token d'affiliation depuis localStorage (stocké par AgentAffiliateRedirect)
  const [affiliateData, setAffiliateData] = useState<{
    token: string | null;
    agentName: string | null;
    targetRole: string | null;
  }>({ token: null, agentName: null, targetRole: null });

  // Charger les données d'affiliation au montage
  useEffect(() => {
    const token = localStorage.getItem('affiliate_token');
    const agentName = localStorage.getItem('affiliate_agent_name');
    const targetRole = localStorage.getItem('affiliate_target_role');
    const timestamp = localStorage.getItem('affiliate_timestamp');

    // Vérifier si le token est encore valide (max 24h)
    const isValid = timestamp && (Date.now() - parseInt(timestamp)) < 24 * 60 * 60 * 1000;

    if (token && isValid) {
      setAffiliateData({ token, agentName, targetRole });
      // Afficher un message si venant d'un lien d'affiliation
      const locationState = location.state as { fromAffiliate?: boolean } | null;
      if (locationState?.fromAffiliate) {
        toast({
          title: `Bienvenue !`,
          description: `Vous avez été invité par ${agentName || 'un agent'}. Créez votre compte pour continuer.`,
        });
        // Passer automatiquement en mode inscription
        setShowSignup(true);
      }
    } else {
      // Nettoyer les données expirées
      localStorage.removeItem('affiliate_token');
      localStorage.removeItem('affiliate_agent_name');
      localStorage.removeItem('affiliate_agent_id');
      localStorage.removeItem('affiliate_target_role');
      localStorage.removeItem('affiliate_timestamp');
    }
  }, [location.state, toast]);

  // Form data - MUST be declared before trackOAuthEvent uses them
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);
  // Sous-menu de la catégorie « Santé & Bien-être » (Pharmacie / Clinique / Soins).
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [showServiceSelection, setShowServiceSelection] = useState(false);
  const [showRoleSelectionModal, setShowRoleSelectionModal] = useState(false);
  const [vendorShopType, setVendorShopType] = useState<'physical' | 'digital' | null>(null);
  const [showVendorTypeSelection, setShowVendorTypeSelection] = useState(false);
  const [currentClientEmail, setCurrentClientEmail] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [_successRedirectRoute, setSuccessRedirectRoute] = useState<string | null>(null);

  // === OAUTH HANDLERS AMÉLIORÉS (Google & Facebook) ===

  // 📈 Analytics tracking
  const trackOAuthEvent = useCallback((provider: 'google' | 'facebook', event: 'click' | 'success' | 'error', metadata?: any) => {
    const timestamp = Date.now();
    const analyticsData = {
      provider,
      event,
      timestamp,
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      role: selectedRole || 'none',
      mode: showSignup ? 'signup' : 'login',
      ...metadata
    };

    // Log to console (en dev) ou envoyer à analytics service (en prod)
    console.log('📈 OAuth Analytics:', analyticsData);

    // TODO: Envoyer à Google Analytics, Mixpanel, ou autre
    // analytics.track('oauth_event', analyticsData);

    // Sauvegarder localement pour debug
    try {
      const existingLogs = JSON.parse(localStorage.getItem('oauth_analytics') || '[]');
      existingLogs.push(analyticsData);
      // Garder seulement les 50 derniers événements
      if (existingLogs.length > 50) existingLogs.shift();
      localStorage.setItem('oauth_analytics', JSON.stringify(existingLogs));
    } catch (_e) {
      // Ignore storage errors
    }
  }, [selectedRole, showSignup]);

  const handleGoogleLogin = async (isRetry = false) => {
    // 🛡️ Rate limiting: Max 3 tentatives par minute
    const now = Date.now();
    const lastAttemptKey = 'oauth_google_last_attempt';
    const lastAttempt = parseInt(localStorage.getItem(lastAttemptKey) || '0');

    if (!isRetry && now - lastAttempt < 20000 && oauthAttempts.google >= 3) {
      toast({
        title: t('auth.tropDeTentatives'),
        description: t('auth.veuillezPatienter20SecondesAvant'),
        variant: "destructive",
      });
      return;
    }

    // Si l'utilisateur est en mode inscription mais n'a pas choisi de rôle, on force un choix
    if (showSignup && !selectedRole) {
      setShowRoleSelectionModal(true);
      trackOAuthEvent('google', 'click', { blocked: 'no_role' });
      return;
    }

    // Persister l'intention (rôle) pour que le callback OAuth crée/ajuste le profil correctement
    if (selectedRole) {
      localStorage.setItem('oauth_intent_role', selectedRole);
    }
    // Marquer comme nouvelle inscription si en mode signup
    if (showSignup) {
      localStorage.setItem('oauth_is_new_signup', 'true');
    }
    // ✓ FIX: Persister le type de boutique pour les vendeurs
    if (vendorShopType) {
      localStorage.setItem('oauth_vendor_shop_type', vendorShopType);
    }
    // ✓ Persister le service type pour les prestataires
    if (selectedServiceType) {
      localStorage.setItem('oauth_service_type', selectedServiceType);
    }

    // 📈 Track click
    trackOAuthEvent('google', 'click', { attempt: oauthAttempts.google + 1, isRetry });

    setOauthLoading('google');
    if (isRetry) setOauthRetrying(true);
    setError(null);
    setOauthAttempts(prev => ({ ...prev, google: prev.google + 1 }));
    localStorage.setItem(lastAttemptKey, now.toString());

    try {
      // Forcer HTTPS sur le domaine production (sinon session perdue entre http/https)
      const origin = window.location.origin;
      const safeOrigin = origin.includes('224solution.net') ? origin.replace('http://', 'https://') : origin;
      const redirectUrl = `${safeOrigin}/`;

      // ✨ Toast de démarrage
      toast({
        title: t('auth.connexionGoogle'),
        description: "Redirection vers Google en cours...",
      });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      // 📈 Track success
      trackOAuthEvent('google', 'success');

    } catch (err) {
      const message = err instanceof Error ? err.message: t('auth.erreurDeConnexionGoogle');
      setError(message);
      console.error('✕ Erreur Google OAuth:', err);

      // 📈 Track error
      trackOAuthEvent('google', 'error', { error: message });

      // 🔄 Toast d'erreur avec option retry
      toast({
        title: t('auth.erreurDeConnexion'),
        description: message + " • Cliquez sur le bouton Google pour réessayer.",
        variant: "destructive",
      });
    } finally {
      setOauthLoading(null);
      setOauthRetrying(false);
    }
  };

  const _handleFacebookLogin = async (isRetry = false) => {
    // 🛡️ Rate limiting
    const now = Date.now();
    const lastAttemptKey = 'oauth_facebook_last_attempt';
    const lastAttempt = parseInt(localStorage.getItem(lastAttemptKey) || '0');

    if (!isRetry && now - lastAttempt < 20000 && oauthAttempts.facebook >= 3) {
      toast({
        title: t('auth.tropDeTentatives'),
        description: t('auth.veuillezPatienter20SecondesAvant'),
        variant: "destructive",
      });
      return;
    }

    if (showSignup && !selectedRole) {
      setShowRoleSelectionModal(true);
      trackOAuthEvent('facebook', 'click', { blocked: 'no_role' });
      return;
    }

    if (selectedRole) {
      localStorage.setItem('oauth_intent_role', selectedRole);
    }
    if (showSignup) {
      localStorage.setItem('oauth_is_new_signup', 'true');
    }
    // ✓ FIX: Persister le type de boutique pour les vendeurs
    if (vendorShopType) {
      localStorage.setItem('oauth_vendor_shop_type', vendorShopType);
    }
    // ✓ Persister le service type pour les prestataires
    if (selectedServiceType) {
      localStorage.setItem('oauth_service_type', selectedServiceType);
    }

    // 📈 Track click
    trackOAuthEvent('facebook', 'click', { attempt: oauthAttempts.facebook + 1, isRetry });

    setOauthLoading('facebook');
    if (isRetry) setOauthRetrying(true);
    setError(null);
    setOauthAttempts(prev => ({ ...prev, facebook: prev.facebook + 1 }));
    localStorage.setItem(lastAttemptKey, now.toString());

    try {
      const origin = window.location.origin;
      const safeOrigin = origin.includes('224solution.net') ? origin.replace('http://', 'https://') : origin;
      const redirectUrl = `${safeOrigin}/`;

      // ✨ Toast de démarrage
      toast({
        title: t('auth.connexionFacebook'),
        description: "Redirection vers Facebook en cours...",
      });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      // 📈 Track success
      trackOAuthEvent('facebook', 'success');

    } catch (err) {
      const message = err instanceof Error ? err.message: t('auth.erreurDeConnexionFacebook');
      setError(message);
      console.error('✕ Erreur Facebook OAuth:', err);

      // 📈 Track error
      trackOAuthEvent('facebook', 'error', { error: message });

      // 🔄 Toast d'erreur avec option retry
      toast({
        title: t('auth.erreurDeConnexion'),
        description: message + " • Cliquez sur le bouton Facebook pour réessayer.",
        variant: "destructive",
      });
    } finally {
      setOauthLoading(null);
      setOauthRetrying(false);
    }
  };

  // ⚠ IMPORTANT: Écouter les événements OAuth et PASSWORD_RECOVERY pour rediriger correctement
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 [Auth] Auth state change:', event, session?.user?.email || 'no user');

      // ✓ Gérer l'événement PASSWORD_RECOVERY (quand l'utilisateur clique sur le lien de réinitialisation)
      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔐 [Auth] PASSWORD_RECOVERY détecté - affichage du formulaire de nouveau mot de passe');
        setShowNewPasswordForm(true);
        setShowResetPassword(false);
        setIsLogin(false);
        return;
      }

      // Rediriger après connexion OAuth réussie
      if (event === 'SIGNED_IN' && session?.user) {
        // ✓ FIX: Ne pas interférer si handleSubmit est en cours d'exécution
        // handleSubmit gère lui-même la création vendor/service et la redirection
        if (isFormSubmittingRef.current) {
          console.log('⏱️ [Auth] SIGNED_IN ignoré - handleSubmit en cours');
          return;
        }

        // ✓ Ne pas rediriger si on est en mode réinitialisation de mot de passe
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const isReset = params.get('reset') === 'true' || hashParams.get('type') === 'recovery';

        if (isReset) {
          console.log('🔐 [Auth] Mode réinitialisation détecté, affichage du formulaire');
          setShowNewPasswordForm(true);
          setShowResetPassword(false);
          setIsLogin(false);
          return;
        }

        console.log('🔐 [Auth] SIGNED_IN détecté - vérification du profil...');
        setIsAuthenticating(true);

        // Vérifier si c'est une connexion OAuth (Google/Facebook)
        const provider = session.user.app_metadata?.provider;
        const isOAuthUser = provider === 'google' || provider === 'facebook';

        // ✓ IMPORTANT: Lire le rôle OAuth AVANT de poller le profil
        // Ce rôle a été défini AVANT la redirection OAuth et persiste dans localStorage
        const oauthIntentRole = localStorage.getItem('oauth_intent_role');
        const isNewOAuthSignup = localStorage.getItem('oauth_is_new_signup') === 'true';

        // Délai pour laisser useAuth (source unique) créer/charger le profil
        // useAuth.tsx gère TOUTE la création de profil OAuth - pas de duplication ici
        const maxWait = 15;
        let profile: any = null;

        try {
          for (let i = 0; i < maxWait; i++) {
            await new Promise(resolve => setTimeout(resolve, 800));
            const { data } = await supabase
              .from('profiles')
              .select('id, role, public_id, has_password')
              .eq('id', session.user.id)
              .maybeSingle();

            if (data?.role) {
              // ✓ FIX: Si c'est une nouvelle inscription OAuth avec un rôle choisi,
              // attendre que useAuth.tsx mette à jour le rôle (pas le rôle 'client' du trigger)
              if (isNewOAuthSignup && oauthIntentRole && oauthIntentRole !== 'client' && data.role === 'client') {
                console.log(`⏳ [Auth] Attente mise à jour rôle OAuth... (${i + 1}/${maxWait}) - actuel: client, attendu: ${oauthIntentRole}`);
                // Continuer à attendre que useAuth mette à jour le rôle
                continue;
              }
              profile = data;
              break;
            }
            console.log(`⏳ [Auth] Attente profil... (${i + 1}/${maxWait})`);
          }

          // ✓ Si après l'attente le rôle est toujours 'client' mais on attendait un autre rôle,
          // utiliser le rôle intentionnel directement
          const effectiveRole = (isNewOAuthSignup && oauthIntentRole && oauthIntentRole !== 'client' && profile?.role === 'client')
            ? oauthIntentRole
            : profile?.role;

          // Vérifier si l'utilisateur OAuth a déjà défini un mot de passe ou passé l'étape
          const hasSetPassword = localStorage.getItem(`oauth_password_set_${session.user.id}`);
          const alreadyHandled = hasSetPassword === 'true' || hasSetPassword === 'skipped';
          const hasPasswordInDB = (profile as any)?.has_password === true;
          const needsPassword = isOAuthUser && !alreadyHandled && !hasPasswordInDB;

          // Si le mot de passe est défini en BDD mais pas en localStorage, synchroniser
          if (hasPasswordInDB && !alreadyHandled) {
            localStorage.setItem(`oauth_password_set_${session.user.id}`, 'true');
          }

          if (needsPassword) {
            console.log('🔐 [Auth] Utilisateur OAuth sans mot de passe, redirection vers /auth/set-password');
            localStorage.setItem('needs_oauth_password', 'true');
            localStorage.removeItem('oauth_is_new_signup');
            navigate('/auth/set-password', { replace: true });
            setIsAuthenticating(false);
            return;
          }

          if (effectiveRole) {
            const oauthShopType = localStorage.getItem('oauth_vendor_shop_type');
            const targetRoute = await resolvePostAuthRoute({
              userId: session.user.id,
              role: effectiveRole,
              vendorShopType: oauthShopType,
            });

            console.log(`🚀 [Auth] Redirection vers ${targetRoute} (rôle effectif: ${effectiveRole}, DB: ${profile?.role})`);

            toast({
              title: t('auth.connexionReussie'),
              description: `Bienvenue ! Redirection vers votre espace ${effectiveRole}...`,
            });

            cleanupOAuthFlags();
            const pendingRedirectOAuth = sessionStorage.getItem('post_auth_redirect');
            if (pendingRedirectOAuth) {
              sessionStorage.removeItem('post_auth_redirect');
              const validatedRedirect = getValidatedPostAuthRedirect(pendingRedirectOAuth, effectiveRole, targetRoute);
              console.log('🔗 [Auth OAuth] Redirection validée:', validatedRedirect, '(demandée:', pendingRedirectOAuth, ')');
              navigate(validatedRedirect, { replace: true });
            } else {
              navigate(targetRoute, { replace: true });
            }
          } else {
            console.log('⚠️ [Auth] Pas de rôle trouvé, reste sur /auth');
          }
        } catch (err) {
          console.error('✕ [Auth] Erreur callback OAuth:', err);
        } finally {
          setIsAuthenticating(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  // Vérifier si l'utilisateur est déjà connecté au chargement de la page
  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      // Ne pas vérifier si on est en train de se connecter
      if (isAuthenticating) return;

      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      const isReset = params.get('reset') === 'true';
      const isRecoveryHash = hashParams.get('type') === 'recovery';
      const hasAccessToken = hash.includes('access_token');

      // Ne pas rediriger si c'est une réinitialisation de mot de passe
      // (via query param OU via hash fragment du lien email)
      if (isReset || isRecoveryHash || (hasAccessToken && hash.includes('type=recovery'))) {
        console.log('🔐 [Auth Mount] Mode réinitialisation détecté, pas de redirection automatique');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && isMounted) {
        console.log('🔍 [Auth Mount] Utilisateur déjà connecté détecté');

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileData?.role && isMounted) {
          const targetRoute = await resolvePostAuthRoute({
            userId: session.user.id,
            role: profileData.role,
          });
          console.log('🚀 [Auth Mount] Redirection utilisateur existant vers:', targetRoute);
          const pendingRedirectMount = sessionStorage.getItem('post_auth_redirect');
          if (pendingRedirectMount) {
            sessionStorage.removeItem('post_auth_redirect');
            const validatedRedirect = getValidatedPostAuthRedirect(pendingRedirectMount, profileData.role, targetRoute);
            console.log('🔗 [Auth Mount] Redirection validée:', validatedRedirect, '(demandée:', pendingRedirectMount, ')');
            navigate(validatedRedirect, { replace: true });
          } else {
            navigate(targetRoute, { replace: true });
          }
        }
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticating]); // Ajouter isAuthenticating comme dépendance

  // Détecter si on vient d'un lien de réinitialisation et vérifier la session
  useEffect(() => {
    const checkResetSession = async () => {
      // Supabase gère le reset par lien (pas par code)

      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));

      // Détecter tous les cas de réinitialisation possibles
      const isResetQuery = params.get('reset') === 'true';
      const isRecoveryType = hashParams.get('type') === 'recovery';
      const hasAccessToken = hash.includes('access_token');
      const hasErrorInHash = hashParams.get('error_description');

      console.log('🔍 [Auth] Vérification reset:', {
        isResetQuery,
        isRecoveryType,
        hasAccessToken,
        hasErrorInHash,
        hash: hash.substring(0, 100) + '...'
      });

      // Si erreur dans le hash (lien expiré)
      if (hasErrorInHash) {
        const errorDesc = decodeURIComponent(hashParams.get('error_description') || '');
        console.error('✕ Erreur dans le lien:', errorDesc);
        setError(`Le lien de réinitialisation est invalide ou a expiré. ${errorDesc.includes('expired') ? 'Veuillez demander un nouveau lien.' : ''}`);
        setShowResetPassword(true);
        setShowNewPasswordForm(false);
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      const isReset = isResetQuery || isRecoveryType || (hasAccessToken && hash.includes('type=recovery'));

      if (isReset || (hasAccessToken && !hash.includes('type=signup'))) {
        console.log('🔑 Lien de réinitialisation détecté, vérification de la session...');
        setCheckingResetLink(true);
        setLoading(true);

        // ✓ Méthode améliorée: utiliser setSession pour traiter le hash directement
        if (hasAccessToken) {
          console.log('🔐 Traitement du hash avec access_token...');

          // Extraire les tokens du hash
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            try {
              const { data, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });

              if (sessionError) {
                console.error('✕ Erreur setSession:', sessionError);
                throw sessionError;
              }

              if (data.session) {
                console.log('✓ Session créée avec succès via setSession');
                setShowNewPasswordForm(true);
                setShowResetPassword(false);
                setIsLogin(false);
                setError(null);
                // Nettoyer l'URL pour éviter les re-traitements
                window.history.replaceState({}, document.title, window.location.pathname + '?reset=true');
                setLoading(false);
                setCheckingResetLink(false);
                return;
              }
            } catch (e) {
              console.error('✕ Exception lors de setSession:', e);
            }
          }
        }

        // Fallback: attendre que Supabase traite le hash automatiquement
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Vérifier qu'on a bien une session active
        const { data: { session }, error } = await supabase.auth.getSession();

        console.log('🔐 Session après attente:', {
          hasSession: !!session,
          userId: session?.user?.id?.substring(0, 8),
          error
        });

        if (session) {
          console.log('✓ Session de réinitialisation active - affichage du formulaire');
          setShowNewPasswordForm(true);
          setShowResetPassword(false);
          setIsLogin(false);
          setError(null);
          // Nettoyer l'URL pour éviter les re-traitements
          window.history.replaceState({}, document.title, window.location.pathname + '?reset=true');
        } else {
          console.error('✕ Aucune session trouvée après traitement du hash:', error);
          setError('Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.');
          setShowResetPassword(true);
          setShowNewPasswordForm(false);
          // Nettoyer l'URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        setLoading(false);
        setCheckingResetLink(false);
      }
    };

    checkResetSession();
  }, []);

  // Form data is already declared above (before trackOAuthEvent)

  // Détecter si l'utilisateur vient de "Devenir Marchand" pour créer un compte séparé
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const role = params.get('role');
    const clientEmail = params.get('currentEmail');

    if (mode === 'signup' && role === 'merchant' && clientEmail) {
      console.log('🏪 Création compte marchand séparé détectée pour:', clientEmail);
      setShowSignup(true);
      setIsLogin(false);
      setSelectedRole('vendeur');
      setCurrentClientEmail(clientEmail);
      setError(`Veuillez utiliser une adresse email différente de ${clientEmail} pour créer votre compte marchand.`);
    }
  }, []);

  // Phone code data is now imported from @/utils/phoneData

  // Phone validation rules and helpers are now imported from @/utils/phoneData

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState('+224');
  const [phoneCodeOpen, setPhoneCodeOpen] = useState(false);
  const [countrySelectOpen, setCountrySelectOpen] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    city: '',
    businessName: '',
    address: ''
  });

  // Auto-détection de l'indicatif téléphonique basé sur le pays
  useEffect(() => {
    if (formData.country) {
      const countryLower = formData.country.toLowerCase().trim();
      const code = COUNTRY_PHONE_CODES[countryLower];
      if (code) {
        setPhoneCode(code);
      }
    }
  }, [formData.country]);

  // Validation du numéro quand il change
  useEffect(() => {
    if (formData.phone) {
      const isValid = validatePhoneNumber(formData.phone, phoneCode);
      if (!isValid) {
        const hint = getPhoneLengthHint(phoneCode);
        setPhoneError(`Format invalide pour ${phoneCode}. Attendu: ${hint}`);
      } else {
        setPhoneError(null);
      }
    } else {
      setPhoneError(null);
    }
  }, [formData.phone, phoneCode]);

  const [manualCityEntry, setManualCityEntry] = useState(false);
  const [taxiCategory, setTaxiCategory] = useState<'car' | 'motorcycle' | null>(null);
  const [taxiDropdownOpen, setTaxiDropdownOpen] = useState(false);
  const showMotoTaxiSelector = selectedRole === 'taxi'
    && !!formData.country
    && MOTO_TAXI_COUNTRY_NAMES.includes(formData.country);

  const [bureaus, setBureaus] = useState<Array<{ id: string; commune: string; prefecture: string }>>([]);

  // Countdown pour le bouton "Renvoyer le code"
  useEffect(() => {
    if (loginResendCooldown <= 0) return;
    const t = setTimeout(() => setLoginResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [loginResendCooldown]);

  useEffect(() => {
    if (resetResendCooldown <= 0) return;
    const t = setTimeout(() => setResetResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resetResendCooldown]);

  useEffect(() => {
    if (phoneSignupResendCooldown <= 0) return;
    const t = setTimeout(() => setPhoneSignupResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phoneSignupResendCooldown]);

  // Charger les bureaux syndicaux disponibles
  useEffect(() => {
    const loadBureaus = async () => {
      const { data, error } = await supabase
        .from('bureaus')
        .select('id, commune, prefecture')
        .eq('status', 'active')
        .order('prefecture', { ascending: true });

      if (!error && data) {
        setBureaus(data);
      }
    };
    loadBureaus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsAuthenticating(true);
    isFormSubmittingRef.current = true; // ✓ FIX: Bloquer le handler SIGNED_IN
    setError(null);
    setSuccess(null);

    try {
      if (showSignup) {
        // Inscription
        if (!selectedRole) {
          throw new Error("Veuillez d'abord sélectionner un type de compte ci-dessus (Client, Marchand, Livreur, etc.)");
        }

        // Vérifier que l'email est différent de celui du compte client actuel (si création de compte marchand séparé)
        if (currentClientEmail && formData.email.toLowerCase() === currentClientEmail.toLowerCase()) {
          throw new Error(`Vous devez utiliser une adresse email différente de ${currentClientEmail} pour créer votre compte marchand. Les comptes client et marchand doivent être séparés.`);
        }

        if (formData.password !== formData.confirmPassword) {
          throw new Error("Les mots de passe ne correspondent pas");
        }

        // Validation du numéro de téléphone
        if (!validatePhoneNumber(formData.phone, phoneCode)) {
          const hint = getPhoneLengthHint(phoneCode);
          throw new Error(`Numéro de téléphone invalide pour ${phoneCode}. Format attendu: ${hint}`);
        }

        // ── Inscription par téléphone ──
        if (signupMethod === 'phone') {
          passwordSchema.parse(formData.password);
          if (formData.password !== formData.confirmPassword) {
            throw new Error('Les mots de passe ne correspondent pas');
          }
          const rawPhone = (phoneCode + formData.phone).trim().replace(/[\s\-().]/g, '');
          const phoneDigits = rawPhone.replace(/[^\d]/g, '');
          let normalizedSignupPhone: string;
          if (rawPhone.startsWith('+')) normalizedSignupPhone = rawPhone;
          else if (phoneDigits.startsWith('00224') && phoneDigits.length >= 14) normalizedSignupPhone = '+' + phoneDigits.slice(2);
          else if (phoneDigits.startsWith('224') && phoneDigits.length >= 12) normalizedSignupPhone = '+' + phoneDigits;
          else if (phoneDigits.length === 9) normalizedSignupPhone = '+224' + phoneDigits;
          else normalizedSignupPhone = '+' + phoneDigits;

          const { data: sendData, error: sendError } = await supabase.functions.invoke('phone-signup-send', {
            body: { phone: normalizedSignupPhone },
          });

          if (sendError || !sendData?.success) {
            if (sendData?.alreadyExists) throw new Error('Ce numéro est déjà associé à un compte. Connectez-vous.');
            throw new Error(sendData?.error || 'Impossible d\'envoyer le code SMS. Vérifiez le numéro.');
          }

          setPhoneSignupPhone(sendData.phone || normalizedSignupPhone);
          setPhoneSignupOtpSent(true);
          setPhoneSignupResendCooldown(60);
          toast({ title: t('auth.codeEnvoye'), description: `SMS envoyé au ${sendData.phone || normalizedSignupPhone}` });
          return;
        }

        const validatedData = signupSchema.parse({ ...formData, role: selectedRole });

        // Générer un ID utilisateur avec le bon préfixe selon le rôle
        const { data: userCustomId, error: generateError } = await supabase
          .rpc('generate_custom_id_with_role', { p_role: selectedRole });

        if (generateError) {
          console.error('Erreur génération ID:', generateError);
          throw new Error('Erreur lors de la génération de votre identifiant');
        }

        // Supabase est le système principal - pas de Cognito signup

        // 🔑 ÉTAPE 2: Synchroniser avec Supabase Auth (pour RLS/DB)
        // Supabase est le système principal - sync Cloud SQL en arrière-plan

        // 🔑 Signup Supabase directement (principal). En cas de PANNE réseau, signUp peut throw.
        let authData: any = null;
        let error: any = null;
        try {
          const r = await supabase.auth.signUp({
            email: validatedData.email,
            password: validatedData.password,
            options: {
              data: {
                first_name: validatedData.firstName,
                last_name: validatedData.lastName,
                role: validatedData.role,
                phone: `${phoneCode} ${formData.phone}`,
                country: formData.country,
                city: validatedData.city,
                custom_id: userCustomId,
                cognito_user_id: undefined,
                business_name: (validatedData.role === 'vendeur' || validatedData.role === 'prestataire')
                  ? (formData.businessName?.trim() || `${validatedData.firstName} ${validatedData.lastName}`)
                  : null,
                service_type: validatedData.role === 'prestataire' ? selectedServiceType : null
              },
              emailRedirectTo: `${window.location.origin}/`
            }
          });
          authData = r.data; error = r.error;
        } catch (netErr) {
          error = netErr; // panne réseau Supabase → traité comme indisponibilité ci-dessous
        }

        // 🔁 FAILOVER COGNITO (inscription) : si Supabase est INDISPONIBLE (réseau/5xx/timeout),
        // Cognito prend le relais pour ne pas perdre l'inscription. On NE bascule PAS sur une
        // erreur métier normale (email déjà pris…) → celle-ci suit le flux Supabase habituel.
        const isOutage = !!error && /failed to fetch|networkerror|load failed|timeout|fetch error|503|502|504|500|service unavailable|gateway|temporar|injoignable|indisponible/i.test(String(error?.message || error).toLowerCase());
        if (isOutage) {
          try {
            const { backendFetch } = await import('@/services/backendApi');
            const fo = await backendFetch<any>('/api/auth/failover/register', {
              method: 'POST', allowAnonymous: true,
              body: {
                email: validatedData.email, password: validatedData.password, role: selectedRole,
                firstName: validatedData.firstName, lastName: validatedData.lastName,
                serviceType: validatedData.role === 'prestataire' ? selectedServiceType : null,
                phone: `${phoneCode} ${formData.phone}`, city: validatedData.city, country: formData.country,
              },
            });
            if (fo.success) {
              setSuccess('Compte créé en mode secours (service momentanément indisponible). Vous pourrez vous connecter dans quelques instants.');
              toast({ title: t('auth.compteCreeModeSecours'), description: t('auth.connexionDisponibleDesLeRetablissement') });
              setLoading(false);
              return;
            }
            if ((fo as any).code === 'USER_EXISTS') throw new Error('Cette adresse e-mail est déjà inscrite. Veuillez vous connecter.');
          } catch (foErr: any) {
            if (foErr?.message?.includes('déjà inscrite')) throw foErr;
            // Relais Cognito indisponible → on laisse l'erreur Supabase suivre son cours normal.
          }
        }

        // Si c'est un taxi-motard, créer son profil conducteur et le lier à son bureau
        if (!error && authData.user && validatedData.role === 'taxi') {
          try {
            // Trouver le bureau de la ville sélectionnée
            const bureau = bureaus.find(b => b.commune === validatedData.city);

            // 1. Créer l'entrée taxi_drivers avec les infos du bureau pour la synchronisation
            const { error: driverError } = await supabase
              .from('taxi_drivers')
              .insert({
                user_id: authData.user.id,
                is_online: false,
                status: 'pending_verification',
                taxi_category: taxiCategory ?? (showMotoTaxiSelector ? null : 'car'),
                vehicle: {
                  commune: validatedData.city,
                  bureau_id: bureau?.id || null,
                  prefecture: bureau?.prefecture || null,
                  registration_date: new Date().toISOString()
                }
              });

            if (driverError) {
              console.error('✕ Erreur création profil conducteur:', driverError);
            } else {
              console.log('✓ Profil taxi-motard créé avec succès');
            }

            // 2. SYNCHRONISATION BUREAU: Créer l'entrée dans la table members pour que le bureau le voit
            if (bureau?.id) {
              const { error: memberError } = await supabase
                .from('members')
                .insert({
                  bureau_id: bureau.id,
                  name: `${validatedData.firstName} ${validatedData.lastName}`,
                  email: validatedData.email,
                  phone: `${phoneCode} ${formData.phone}`,
                  status: 'pending', // En attente de validation par le bureau
                  cotisation_status: 'pending',
                  join_date: new Date().toISOString().split('T')[0],
                  custom_id: userCustomId
                });

              if (memberError) {
                console.error('✕ Erreur synchronisation bureau:', memberError);
              } else {
                console.log('✓ Taxi-motard synchronisé avec le bureau syndical de', validatedData.city);
              }
            } else {
              console.warn('⚠️ Aucun bureau trouvé pour la ville:', validatedData.city);
            }
          } catch (syncError) {
            console.error('✕ Erreur synchronisation:', syncError);
          }
        }

        // Si c'est un vendeur (marchand), créer automatiquement son profil vendor avec le nom d'entreprise
        // ✓ IMPORTANT: Les services professionnels n'utilisent PLUS le rôle vendeur
        if (!error && authData.user && validatedData.role === 'vendeur') {
          try {
            const businessName = formData.businessName?.trim() || `${validatedData.firstName} ${validatedData.lastName}`;

            // 1. Créer le profil vendor (PAS de service professionnel ici)
            const { error: vendorError } = await supabase
              .from('vendors')
              .insert({
                user_id: authData.user.id,
                business_name: businessName,
                email: validatedData.email,
                phone: `${phoneCode} ${formData.phone}`,
                address: validatedData.city,
                city: validatedData.city,
                is_verified: false,
                is_active: true,
                service_type: 'general',
                business_type: vendorShopType || 'physical'
              });

            if (vendorError) {
              console.error('✕ Erreur création profil vendeur:', vendorError);
              toast({
                title: t('auth.erreurDeCreationDuProfil'),
                description: vendorError.message || "Impossible de créer le profil vendeur. Contactez le support.",
                variant: "destructive"
              });
            } else {
              console.log('✓ Profil vendeur créé avec nom entreprise:', businessName);
            }
          } catch (vendorSyncError) {
            console.error('✕ Erreur synchronisation vendeur:', vendorSyncError);
          }
        }

        // ✓ NOUVEAU: Si c'est un prestataire de service, créer le professional_service SANS vendor
        if (!error && authData.user && validatedData.role === 'prestataire' && selectedServiceType) {
          // Filet : si la confirmation email est active, l'insert ci-dessous est bloqué par RLS
          // (pas de session avant confirmation). On mémorise le type de service pour que useAuth
          // (re)crée le professional_services au 1er chargement authentifié (idempotent).
          localStorage.setItem('oauth_service_type', selectedServiceType);
          // Mémoriser le nom de l'établissement (pharmacie/clinique…) pour que le filet useAuth
          // le réutilise si l'insert ci-dessous est bloqué par RLS (confirmation email = pas de session).
          if (formData.businessName?.trim()) {
            localStorage.setItem('oauth_business_name', formData.businessName.trim());
          }
          try {
            const businessName = formData.businessName?.trim() || `${validatedData.firstName} ${validatedData.lastName}`;
            console.log('🔧 Création du professional_service pour prestataire:', selectedServiceType);

            // Récupérer le service_type_id à partir du code
            const { data: serviceType, error: serviceTypeError } = await supabase
              .from('service_types')
              .select('id')
              .eq('code', selectedServiceType)
              .maybeSingle();

            if (serviceTypeError) {
              console.error('✕ Erreur récupération service_type:', serviceTypeError);
            } else if (serviceType) {
              const { error: professionalServiceError } = await supabase
                .from('professional_services')
                .insert({
                  user_id: authData.user.id,
                  service_type_id: serviceType.id,
                  business_name: businessName,
                  city: validatedData.city,
                  address: validatedData.city,
                  phone: `${phoneCode} ${formData.phone}`,
                  email: validatedData.email,
                  status: 'active',
                  verification_status: 'unverified'
                });

              if (professionalServiceError) {
                // Pas de session (confirmation email active) → l'insert est bloqué par RLS.
                // Ce n'est PAS un échec : le filet useAuth (re)crée le service au 1er login
                // (avec le nom mémorisé). On n'alarme donc pas l'utilisateur dans ce cas.
                const code = (professionalServiceError as { code?: string }).code;
                const isRlsNoSession = code === '42501'
                  || /row-level security|permission denied|jwt|not authenticated/i.test(professionalServiceError.message || '');
                if (isRlsNoSession) {
                  console.warn('ℹ️ Service prestataire sera créé au 1er login (pas de session à l\'inscription).');
                } else {
                  console.error('✕ Erreur création professional_service:', professionalServiceError);
                  toast({
                    title: t('auth.erreurDeCreationDuService'),
                    description: professionalServiceError.message || "Le service n'a pas pu être créé.",
                    variant: "destructive"
                  });
                }
              } else {
                console.log('✓ Professional service créé pour prestataire:', selectedServiceType);
              }
            } else {
              console.warn('⚠️ Service type non trouvé pour le code:', selectedServiceType);
            }
          } catch (serviceError) {
            console.error('✕ Erreur création service prestataire:', serviceError);
          }
        }

        if (error) {
          if (error.message.includes('User already registered') || error.message.includes('already been registered')) {
            throw new Error('Cette adresse e-mail est déjà inscrite. Veuillez vous connecter ou utiliser une autre adresse.');
          } else if (error.message.includes('rate limit') || error.message.includes('email rate limit exceeded') || error.status === 429) {
            throw new Error('Trop de tentatives d\'inscription. Veuillez patienter quelques minutes avant de réessayer.');
          } else {
            throw error;
          }
        }

        // ✓ FIX: Supabase ne retourne pas toujours une erreur pour les emails existants
        // Il retourne un user sans identities[] si l'email existe déjà (comportement sécurité)
        if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
          throw new Error('Cette adresse e-mail est déjà inscrite. Veuillez vous connecter ou utiliser une autre adresse.');
        }

        // === AFFILIATION AGENT: Enregistrer le parrainage si token présent ===
        if (authData.user && affiliateData.token) {
          try {
            console.log('🔗 [Affiliation] Enregistrement du parrainage...');
            const { backendFetch } = await import('@/services/backendApi');
            const affiliateResult = await backendFetch<any>('/api/agents/affiliate-links/register', {
              body: {
                user_id: authData.user.id,
                email: validatedData.email,
                phone: `${phoneCode} ${formData.phone}`,
                first_name: validatedData.firstName,
                last_name: validatedData.lastName,
                role: validatedData.role,
                affiliate_token: affiliateData.token
              }
            });

            if (!affiliateResult?.success) {
              console.error('⚠️ [Affiliation] Erreur:', affiliateResult?.error);
            } else {
              console.log('✓ [Affiliation] Parrainage enregistré avec succès');
              toast({
                title: t('auth.parrainageEnregistre'),
                description: `Vous avez été parrainé par ${affiliateData.agentName || 'un agent'}.`,
              });
            }

            cleanupAffiliateFlags();
          } catch (affiliateErr) {
            console.error('⚠️ [Affiliation] Erreur inattendue:', affiliateErr);
          }
        }

        // ✓ Afficher le modal de succès puis rediriger
        if (authData.user) {
          // Attendre que le profil soit créé avec retry (max 5 secondes)
          let profileData = null;
          let attempts = 0;
          const maxAttempts = 10;

          while (!profileData && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));

            const { data } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', authData.user.id)
              .maybeSingle();

            if (data?.role) {
              profileData = data;
              break;
            }

            attempts++;
            console.log(`⏳ Attente création profil... (tentative ${attempts}/${maxAttempts})`);
          }

          // Déterminer la route cible
          let targetRoute = '/home';
          if (profileData?.role) {
            targetRoute = await resolvePostAuthRoute({
              userId: authData.user!.id,
              role: profileData.role,
              vendorShopType,
            });
          }

          // Afficher le modal de succès
          setSuccessRedirectRoute(targetRoute);
          setShowSuccessModal(true);

          // Rediriger après 2.5 secondes
          setTimeout(() => {
            setShowSuccessModal(false);
            const pendingRedirectSignup = sessionStorage.getItem('post_auth_redirect');
            if (pendingRedirectSignup) {
              sessionStorage.removeItem('post_auth_redirect');
              const validatedRedirect = getValidatedPostAuthRedirect(pendingRedirectSignup, profileData.role, targetRoute);
              console.log('🔗 [Auth Signup] Redirection validée:', validatedRedirect, '(demandée:', pendingRedirectSignup, ')');
              navigate(validatedRedirect, { replace: true });
            } else {
              console.log('🚀 [Auth Signup] Redirection vers:', targetRoute);
              navigate(targetRoute, { replace: true });
            }
          }, 2500);
        } else {
          setSuccess("Inscription réussie ! Vérifiez votre boîte mail pour confirmer votre compte, puis connectez-vous.");
        }
      } else {
        // Connexion - Supabase Auth est le système principal
        console.log('🔐 [Auth] Tentative de connexion Supabase...');

        // ── Détection automatique téléphone ──
        if (isPhoneIdentifier(formData.email)) {
          const raw = formData.email.trim();
          const clean = raw.replace(/[\s\-().]/g, '');
          const digits = clean.replace(/[^\d]/g, '');

          // Normalisation intelligente E.164 (évite le double-préfixe 224)
          let primaryFormatted: string;
          if (clean.startsWith('+')) {
            primaryFormatted = clean;
          } else if (digits.startsWith('00224') && digits.length >= 14) {
            primaryFormatted = '+' + digits.slice(2);
          } else if (digits.startsWith('224') && digits.length >= 12) {
            primaryFormatted = '+' + digits;
          } else {
            primaryFormatted = '+224' + digits;
          }

          setLoginFormattedPhone(primaryFormatted);
          setLoginPhoneNotFound(false);

          // phone-send-otp : trouve le profil + envoie SMS via Twilio directement
          const { data: sendData, error: sendError } = await supabase.functions.invoke('phone-send-otp', {
            body: { phone: primaryFormatted },
          });

          if (sendError || !sendData?.success || !sendData?.found) {
            setLoginPhoneNotFound(true);
            return;
          }

          setLoginFormattedPhone(sendData.phone);
          setLoginPhoneOtpSent(true);
          setLoginResendCooldown(60);
          toast({ title: t('auth.codeEnvoye'), description: `SMS envoyé au ${sendData.phone}` });
          return;
        }

        const validatedData = loginSchema.parse(formData);

        // 🔑 Login via le backend (verrouillage anti-brute-force serveur), avec repli
        // automatique sur Supabase direct si le backend est injoignable ou ne gère pas
        // l'endpoint → le login n'est JAMAIS cassé. On n'honore la réponse backend que
        // sur succès, ou sur 401/429 explicites (identifiants invalides / compte verrouillé).
        let data: any = null;
        let error: any = null;
        let handledByBackend = false;
        try {
          const { resolveBackendUrl } = await import('@/config/backend');
          const resp = await fetch(resolveBackendUrl('/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: validatedData.email, password: validatedData.password }),
          });
          let json: any = null;
          try { json = await resp.json(); } catch { json = null; }

          if (resp.ok && json?.success === true && json.session?.access_token) {
            // Persiste la session côté client pour le reste de l'app (RLS, realtime…)
            const { data: sess, error: setErr } = await supabase.auth.setSession({
              access_token: json.session.access_token,
              refresh_token: json.session.refresh_token,
            });
            if (!setErr) {
              data = { user: json.user || sess.user, session: sess.session || json.session };
              handledByBackend = true;
            }
          } else if ((resp.status === 401 || resp.status === 429) && json?.success === false) {
            error = { message: json.error || 'Échec de connexion' };
            handledByBackend = true;
          }
          // Autre cas (404/500/non-JSON) → repli ci-dessous.
        } catch {
          // Backend injoignable → repli direct.
        }

        if (!handledByBackend) {
          const direct = await supabase.auth.signInWithPassword({
            email: validatedData.email,
            password: validatedData.password,
          });
          data = direct.data;
          error = direct.error;
        }

        // 🔁 FAILOVER COGNITO (login) : si Supabase échoue (panne) OU si le compte a été créé en
        // relais Cognito pendant une panne (absent de Supabase), on vérifie via Cognito et on
        // réconcilie vers Supabase, puis on réessaie le login Supabase normal. Pas de masquage :
        // le backend ne réconcilie que si les identifiants sont RÉELLEMENT valides dans Cognito.
        if (error && !String(error.message || '').includes('Email not confirmed')) {
          try {
            const { backendFetch } = await import('@/services/backendApi');
            const fo = await backendFetch<any>('/api/auth/failover/login', {
              method: 'POST', allowAnonymous: true,
              body: { email: validatedData.email, password: validatedData.password },
            });
            if (fo.success && (fo as any).reconciled) {
              const retry = await supabase.auth.signInWithPassword({ email: validatedData.email, password: validatedData.password });
              if (!retry.error && retry.data?.user) { data = retry.data; error = null; }
            }
          } catch { /* failover indisponible → on garde l'erreur Supabase d'origine */ }
        }

        if (error) {
          const msg = String(error.message || '');
          if (msg.includes('Email not confirmed')) {
            throw new Error('Email non confirmé. Veuillez vérifier votre boîte mail et cliquer sur le lien de confirmation.');
          } else if (msg.includes('Invalid login credentials')) {
            throw new Error('Email ou mot de passe incorrect. Veuillez réessayer.');
          } else {
            throw new Error(msg || 'Échec de connexion');
          }
        }

        console.log('✓ [Auth] Login Supabase réussi');

        // 🔄 Sync Cloud SQL en arrière-plan (non bloquant)
        if (data.session?.access_token) {
          syncCognitoProfile(data.session.access_token).catch(err => {
            console.warn('⚠️ [Auth] Sync Cloud SQL échouée (non bloquant):', err);
          });
        }


        if (data.user) {
          setSuccess("Connexion réussie ! Redirection en cours...");

          // ⚠ Récupérer le profil avec retry pour s'assurer qu'il est chargé
          let profileData = null;
          let attempts = 0;
          const maxAttempts = 10;
          const userId = data.user.id;

          while (!profileData && attempts < maxAttempts) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', userId)
              .maybeSingle();

            if (profile?.role) {
              profileData = profile;
              break;
            }

            // Attendre 200ms entre chaque tentative (max 2s total)
            if (attempts < maxAttempts - 1) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            attempts++;
            console.log(`⏳ [Auth Login] Chargement profil... (tentative ${attempts}/${maxAttempts})`);
          }

          if (profileData?.role) {
            const targetRoute = await resolvePostAuthRoute({
              userId,
              role: profileData.role,
            });
            console.log('🚀 [Auth Login] Redirection vers:', targetRoute, '(rôle:', profileData.role, ')');
            await new Promise(resolve => setTimeout(resolve, 300));
            const pendingRedirectLogin = sessionStorage.getItem('post_auth_redirect');
            if (pendingRedirectLogin) {
              sessionStorage.removeItem('post_auth_redirect');
              const validatedRedirect = getValidatedPostAuthRedirect(pendingRedirectLogin, profileData.role, targetRoute);
              console.log('🔗 [Auth Login] Redirection validée:', validatedRedirect, '(demandée:', pendingRedirectLogin, ')');
              navigate(validatedRedirect, { replace: true });
            } else {
              navigate(targetRoute, { replace: true });
            }
          } else {
            // Fallback: rediriger vers home, useRoleRedirect prendra le relais
            console.log('⚠️ [Auth Login] Pas de profil trouvé, redirection vers /home');
            navigate('/home', { replace: true });
          }
        }
      }
    } catch (err) {
      let errorMessage = 'Une erreur est survenue';

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      // Gestion des erreurs de validation Zod
      if (err && typeof err === 'object' && 'issues' in err) {
        const zodError = err as any;
        errorMessage = zodError.issues[0]?.message || errorMessage;
      }

      setError(errorMessage);
      console.error('Erreur authentification:', err);
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
      isFormSubmittingRef.current = false; // ✓ FIX: Débloquer le handler SIGNED_IN
    }
  };

  const handleRoleClick = (role: UserRole) => {
    // Si on clique sur un autre rôle que vendeur et que showServiceSelection est ouvert, le fermer
    if (role !== 'vendeur' && showServiceSelection) {
      setShowServiceSelection(false);
      setSelectedServiceType(null);
    }

    if (role === 'vendeur') {
      // Pour les marchands, afficher d'abord la sélection du type de service
      setShowServiceSelection(true);
      setSelectedRole(role);
      // Scroll vers le milieu pour afficher la fenêtre de sélection
      setTimeout(() => {
        const serviceCard = document.getElementById('service-selection-card');
        if (serviceCard) {
          serviceCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    } else {
      setSelectedRole(role);
      setShowSignup(true);
    }
  };

  // Fonction pour fermer la sélection de service quand on clique ailleurs
  const handleCloseServiceSelection = () => {
    setShowServiceSelection(false);
    setSelectedServiceType(null);
    setSelectedRole(null);
  };

  const _handleSkipServiceSelection = () => {
    setShowServiceSelection(false);
    setSelectedServiceType(null); // Pas de service professionnel sélectionné
    setShowSignup(true);
  };

  const handleServiceTypeSelect = (serviceTypeId: string) => {
    // ✓ FIX: Traitement spécial pour les types non-service
    if (serviceTypeId === 'digital') {
      // Produits numériques → vendeur digital (pas un service professionnel)
      setSelectedServiceType(null);
      setSelectedRole('vendeur');
      setVendorShopType('digital');
      setShowServiceSelection(false);
      setShowSignup(true);
      console.log('🔧 [Auth] Type digital sélectionné → vendeur digital');
      return;
    }

    if (serviceTypeId === 'ecommerce') {
      // Boutique e-commerce → vendeur classique (pas un service professionnel)
      setSelectedServiceType(null);
      setSelectedRole('vendeur');
      setVendorShopType('physical');
      setShowServiceSelection(false);
      setShowSignup(true);
      console.log('🔧 [Auth] Type ecommerce sélectionné → vendeur physique');
      return;
    }

    // « Santé & Bien-être » est une CATÉGORIE → ouvrir le sous-menu (Pharmacie / Clinique / Soins).
    if (serviceTypeId === 'sante') {
      setHealthDialogOpen(true);
      return;
    }

    // ✓ NOUVEAU: Les services professionnels utilisent le rôle 'prestataire' (PAS 'vendeur')
    setSelectedServiceType(serviceTypeId);
    setSelectedRole('prestataire');
    setVendorShopType(null);
    setShowServiceSelection(false);
    setShowSignup(true);
    console.log('🔧 [Auth] Service sélectionné:', serviceTypeId, '→ rôle: prestataire (indépendant du vendeur)');
  };

  // Sélection d'un sous-type santé (pharmacie / clinique / sante) → prestataire.
  const handleHealthSubtypeSelect = (code: string) => {
    setHealthDialogOpen(false);
    setSelectedServiceType(code);
    setSelectedRole('prestataire');
    setVendorShopType(null);
    setShowServiceSelection(false);
    setShowSignup(true);
    console.log('🔧 [Auth] Sous-type santé sélectionné:', code, '→ rôle: prestataire');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const identifier = resetEmail.trim();
      const isPhone = !identifier.includes('@') && /^\+?[\d\s\-().]{6,}$/.test(identifier);

      if (isPhone) {
        const clean = identifier.replace(/[\s\-().]/g, '');
        const digits = clean.replace(/[^\d]/g, '');

        // Normalisation intelligente E.164
        let formatted: string;
        if (clean.startsWith('+')) {
          formatted = clean;
        } else if (digits.startsWith('00224') && digits.length >= 14) {
          formatted = '+' + digits.slice(2);
        } else if (digits.startsWith('224') && digits.length >= 12) {
          formatted = '+' + digits;
        } else {
          formatted = '+224' + digits;
        }

        setResetFormattedPhone(formatted);
        setPhoneNotFoundReset(false);

        // phone-send-otp : trouve le profil + envoie SMS via Twilio directement
        const { data: sendData, error: sendError } = await supabase.functions.invoke('phone-send-otp', {
          body: { phone: formatted },
        });

        if (sendError || !sendData?.success || !sendData?.found) {
          setPhoneNotFoundReset(true);
          setLoading(false);
          return;
        }

        const storedPhone: string = sendData.phone;
        setResetFormattedPhone(storedPhone);
        setResetOtpSent(true);
        setResetResendCooldown(60);
        toast({ title: t('auth.codeEnvoye'), description: `Code SMS envoyé au ${storedPhone}` });
      } else {
        const emailSchema = z.string().email("Adresse email invalide");
        emailSchema.parse(identifier);
        const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccess("Lien de réinitialisation envoyé. Vérifiez votre email.");
        setShowResetPassword(false);
        setIsLogin(true);
      }
    } catch (err) {
      let errorMessage = 'Une erreur est survenue';
      if (err instanceof Error) errorMessage = err.message;
      if (err && typeof err === 'object' && 'issues' in err) {
        errorMessage = (err as any).issues[0]?.message || errorMessage;
      }
      setError(errorMessage);
      console.error('Erreur réinitialisation mot de passe:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('phone-verify-otp', {
        body: { phone: resetFormattedPhone, otp: resetOtpCode },
      });

      if (verifyError) throw new Error(verifyError.message);
      if (!verifyData?.success) throw new Error(verifyData?.error || 'Code invalide');

      // Créer la session via le token magic link retourné par l'edge function
      const { error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: verifyData.tokenHash,
        type: 'magiclink',
      });
      if (sessionError) throw sessionError;

      setResetOtpSent(false);
      setShowNewPasswordForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleResendLoginOtp = async () => {
    if (loginResendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('phone-send-otp', {
        body: { phone: loginFormattedPhone },
      });
      if (error || !data?.success) throw new Error('Impossible de renvoyer le code');
      setLoginResendCooldown(60);
      toast({ title: t('auth.codeRenvoye'), description: `Nouveau SMS envoyé au ${loginFormattedPhone}` });
    } catch (err) {
      setError(err instanceof Error ? err.message: t('auth.erreurLorsDuRenvoi'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resetResendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('phone-send-otp', {
        body: { phone: resetFormattedPhone },
      });
      if (error || !data?.success) throw new Error('Impossible de renvoyer le code');
      setResetResendCooldown(60);
      toast({ title: t('auth.codeRenvoye'), description: `Nouveau SMS envoyé au ${resetFormattedPhone}` });
    } catch (err) {
      setError(err instanceof Error ? err.message: t('auth.erreurLorsDuRenvoi'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendPhoneSignupOtp = async () => {
    if (phoneSignupResendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('phone-signup-send', {
        body: { phone: phoneSignupPhone },
      });
      if (error || !data?.success) throw new Error('Impossible de renvoyer le code');
      setPhoneSignupResendCooldown(60);
      toast({ title: t('auth.codeRenvoye'), description: `Nouveau SMS envoyé au ${phoneSignupPhone}` });
    } catch (err) {
      setError(err instanceof Error ? err.message: t('auth.erreurLorsDuRenvoi'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsAuthenticating(true);
    isFormSubmittingRef.current = true;
    setError(null);

    try {
      const { data: userCustomId } = await supabase.rpc('generate_custom_id_with_role', { p_role: selectedRole! });

      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('phone-signup-verify', {
        body: {
          phone: phoneSignupPhone,
          otp: phoneSignupOtp,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: selectedRole,
          city: formData.city,
          country: formData.country,
          businessName: formData.businessName || null,
          serviceType: selectedServiceType || null,
          customId: userCustomId || null,
        },
      });

      if (verifyError) throw new Error(verifyError.message);
      if (!verifyData?.success) throw new Error(verifyData?.error || 'Code invalide');

      const userId: string = verifyData.userId;
      const proxyEmail: string = verifyData.email;

      // Connexion immédiate avec l'email proxy
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: proxyEmail,
        password: formData.password,
      });
      if (signInError) throw signInError;

      const authUser = signInData.user;
      if (!authUser) throw new Error('Erreur de connexion après inscription');

      // Inserts spécifiques au rôle (identique au parcours email)
      if (selectedRole === 'taxi') {
        try {
          const bureau = bureaus.find(b => b.commune === formData.city);
          await supabase.from('taxi_drivers').insert({
            user_id: authUser.id,
            is_online: false,
            status: 'pending_verification',
            taxi_category: taxiCategory ?? (showMotoTaxiSelector ? null : 'car'),
            vehicle: {
              commune: formData.city,
              bureau_id: bureau?.id || null,
              prefecture: bureau?.prefecture || null,
              registration_date: new Date().toISOString(),
            },
          });
          if (bureau?.id) {
            await supabase.from('members').insert({
              bureau_id: bureau.id,
              name: `${formData.firstName} ${formData.lastName}`,
              email: proxyEmail,
              phone: phoneSignupPhone,
              status: 'pending',
              cotisation_status: 'pending',
              join_date: new Date().toISOString().split('T')[0],
              custom_id: userCustomId,
            });
          }
        } catch (e) { console.error('Erreur sync taxi:', e); }
      }

      if (selectedRole === 'vendeur') {
        try {
          const businessName = formData.businessName?.trim() || `${formData.firstName} ${formData.lastName}`;
          await supabase.from('vendors').insert({
            user_id: authUser.id,
            business_name: businessName,
            email: proxyEmail,
            phone: phoneSignupPhone,
            address: formData.city,
            city: formData.city,
            is_verified: false,
            is_active: true,
            service_type: 'general',
            business_type: vendorShopType || 'physical',
          });
        } catch (e) { console.error('Erreur sync vendeur:', e); }
      }

      if (selectedRole === 'prestataire' && selectedServiceType) {
        try {
          const { data: serviceType } = await supabase
            .from('service_types').select('id').eq('code', selectedServiceType).maybeSingle();
          if (serviceType) {
            await supabase.from('professional_services').insert({
              user_id: authUser.id,
              service_type_id: serviceType.id,
              business_name: formData.businessName?.trim() || `${formData.firstName} ${formData.lastName}`,
              address: formData.city,
              phone: phoneSignupPhone,
              email: proxyEmail,
              status: 'active',
              verification_status: 'unverified',
            });
          }
        } catch (e) { console.error('Erreur sync prestataire:', e); }
      }

      // Affiliation (backend Node)
      if (affiliateData.token) {
        try {
          const { backendFetch } = await import('@/services/backendApi');
          await backendFetch('/api/agents/affiliate-links/register', {
            body: {
              user_id: authUser.id,
              email: proxyEmail,
              phone: phoneSignupPhone,
              first_name: formData.firstName,
              last_name: formData.lastName,
              role: selectedRole,
              affiliate_token: affiliateData.token,
            },
          });
          cleanupAffiliateFlags();
        } catch (e) { console.error('Erreur affiliation:', e); }
      }

      // Attendre la création du profil
      let profileData = null;
      let attempts = 0;
      while (!profileData && attempts < 10) {
        await new Promise(r => setTimeout(r, 500));
        const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
        if (data?.role) { profileData = data; break; }
        attempts++;
      }

      const targetRoute = profileData?.role
        ? await resolvePostAuthRoute({ userId, role: profileData.role, vendorShopType })
        : '/home';

      setSuccessRedirectRoute(targetRoute);
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        navigate(targetRoute, { replace: true });
      }, 2500);

    } catch (err) {
      setError(err instanceof Error ? err.message: t('auth.codeInvalideOuErreurServeur'));
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
      isFormSubmittingRef.current = false;
    }
  };

  const isPhoneIdentifier = (val: string): boolean => {
    const v = val.trim();
    if (v.length < 6 || v.includes('@')) return false;
    // Accepte : +224XXXXXXX, 224XXXXXXX, 00224XXXXXXX, XXXXXXXXX (chiffres + séparateurs courants)
    return /^\+?[\d\s\-().]{6,}$/.test(v);
  };

  const handleLoginVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Vérifier via notre edge function (OTP stocké dans auth_otp_codes)
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('phone-verify-otp', {
        body: { phone: loginFormattedPhone, otp: loginPhoneOtp },
      });

      if (verifyError) throw new Error(verifyError.message);
      if (!verifyData?.success) throw new Error(verifyData?.error || 'Code invalide');

      // Créer la session Supabase via le token magic link
      const { data, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: verifyData.tokenHash,
        type: 'magiclink',
      });
      if (sessionError) throw sessionError;

      toast({ title: t('auth.connexionReussie'), description: 'Bienvenue !' });

      if (data.user) {
        let profileData = null;
        let attempts = 0;
        while (!profileData && attempts < 10) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
          if (profile?.role) { profileData = profile; break; }
          if (attempts < 9) await new Promise(r => setTimeout(r, 300));
          attempts++;
        }
        const roleRoutes: Record<string, string> = {
          admin: '/pdg', ceo: '/pdg', vendeur: '/vendeur', livreur: '/livreur',
          taxi: '/taxi-moto/driver', syndicat: '/syndicat', transitaire: '/transitaire',
          client: '/client', agent: '/agent',
        };
        navigate(profileData?.role ? (roleRoutes[profileData.role] || '/home') : '/home', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validation du nouveau mot de passe (mêmes règles que l'inscription)
      passwordSchema.parse(newPassword);

      if (newPassword !== confirmNewPassword) {
        throw new Error("Les mots de passe ne correspondent pas");
      }

      // Supabase Auth - mise à jour du mot de passe via session de recovery
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Session expirée. Veuillez demander un nouveau lien de réinitialisation.");
      }

      console.log('🔐 Session active, mise à jour du mot de passe...');

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('✕ Erreur Supabase:', error);
        throw error;
      }

      console.log('Mot de passe mis à jour avec succès');
      setSuccess("Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.");
      setNewPassword('');
      setConfirmNewPassword('');

      await supabase.auth.signOut();

      setTimeout(() => {
        setShowNewPasswordForm(false);
        setIsLogin(true);
        setSuccess(null);
        navigate('/auth');
      }, 2000);
    } catch (err) {
      let errorMessage = 'Une erreur est survenue';

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      console.error('✕ Erreur changement mot de passe:', err);
    } finally {
      setLoading(false);
    }
  };

  // UI: panneau d'inscription (à droite) uniquement quand on est vraiment en mode inscription
  // (pas pendant reset password / nouveau mot de passe)
  const showSignupLayout = (showSignup || showVendorTypeSelection) && !showResetPassword && !showNewPasswordForm;

  return (
    <div className="min-h-screen bg-white pb-24 overflow-x-hidden">
      {/* Header avec 224SOLUTIONS et boutons */}
      <div className="text-center py-8 px-4">
        <div className="flex justify-end mb-4 px-4">
          <LanguageSelector variant="compact" />
        </div>
        <img src="/logo-224solutions.png" alt="224Solutions" className="w-24 h-24 mx-auto mb-4 object-contain rounded-2xl bg-primary/5 p-2 shadow-sm" />
        <h1 className="text-4xl font-bold text-primary mb-6">224Solutions</h1>


        {/* Titre principal - encore plus rapproché du bloc de sélection */}
        <h2 className="text-2xl text-gray-600 mb-2">
          {t('auth.connectToSpace')} <span className="font-bold text-gray-800">{t('auth.professionalSpace')}</span>
        </h2>
      </div>

      {/* NB: Les types de comptes sont désormais affichés dans le panneau d'inscription (à droite) */}

      {/* Sélection du type de service professionnel pour les marchands */}
      {showServiceSelection && (
        <>
          {/* Overlay cliquable pour fermer */}
          <div
            className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
            onClick={handleCloseServiceSelection}
          />
          <div className="max-w-6xl mx-auto px-4 mt-6 relative z-50">
            <Card id="service-selection-card" className="shadow-2xl border-2 border-primary bg-white overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center justify-start mb-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowServiceSelection(false);
                    setSelectedRole(null);
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </Button>
              </div>


              <div className="text-center mb-6">
                <h3 className="text-xl md:text-2xl font-bold mb-2">
                  Choisissez votre type de service
                </h3>
                <p className="text-muted-foreground text-sm">
                  Sélectionnez le service que vous souhaitez proposer sur la plateforme
                </p>
              </div>

              {/* Section: Inscription directe par rôle */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#ff4000] mb-3 flex items-center justify-center gap-2">
                  <span className="w-8 h-0.5 bg-[#ff4000] rounded"></span>
                  Inscription Rapide
                  <span className="w-8 h-0.5 bg-[#ff4000] rounded"></span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {QUICK_ROLE_OPTIONS.map((item) => {
                    const Icon = item.icon;
                    return (
                    <button
                      key={item.role}
                      onClick={() => {
                        setShowServiceSelection(false);
                        setSelectedServiceType(null);
                        setSelectedRole(item.role);
                        setShowSignup(true);
                      }}
                      className="group flex flex-col items-center p-3 bg-[#ff4000]/5 rounded-xl border-2 hover:border-[#ff4000] hover:shadow-lg hover:scale-[1.02] transition-all border-orange-200"
                    >
                      <div className="relative mb-2 h-24 w-full overflow-hidden rounded-xl">
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent" />
                        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                            {item.logoImage ? (
                              <img src={item.logoImage} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <Icon className="h-6 w-6 text-[#ff4000]" />
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                    </button>
                    );
                  })}
                </div>
              </div>

              {/* Section: Services de proximité */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-primary mb-3 flex items-center justify-center gap-2">
                  <span className="w-8 h-0.5 bg-primary rounded"></span>
                  Services de proximité
                  <span className="w-8 h-0.5 bg-primary rounded"></span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PROXIMITY_SERVICE_OPTIONS.map((service) => {
                    const Icon = service.icon;
                    return (
                    <button
                      key={service.id}
                      onClick={() => handleServiceTypeSelect(service.id)}
                      className={`group flex flex-col items-center p-3 bg-white rounded-xl border-2 hover:border-primary hover:shadow-lg hover:scale-[1.02] transition-all ${
                        selectedServiceType === service.id ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-slate-200'
                      }`}
                    >
                      <div className="relative mb-2 h-24 w-full overflow-hidden rounded-xl">
                        <img src={service.image} alt={service.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />
                        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                            {service.logoImage ? (
                              <img src={service.logoImage} alt={service.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <Icon className="h-6 w-6 text-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{service.name}</span>
                      <span className="text-[10px] text-muted-foreground">{service.desc}</span>
                    </button>
                    );
                  })}
                </div>
              </div>

              {/* Section: Services Professionnels */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-[#04439e] mb-3 flex items-center justify-center gap-2">
                  <span className="w-8 h-0.5 bg-[#04439e] rounded"></span>
                  Services Professionnels
                  <span className="w-8 h-0.5 bg-[#04439e] rounded"></span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PROFESSIONAL_SERVICE_OPTIONS.map((service) => {
                    const Icon = service.icon;
                    return (
                    <button
                      key={service.id}
                      onClick={() => handleServiceTypeSelect(service.id)}
                      className={`group flex flex-col items-center p-3 bg-white rounded-xl border-2 hover:border-[#04439e] hover:shadow-lg hover:scale-[1.02] transition-all ${
                        selectedServiceType === service.id ? 'border-[#04439e] ring-2 ring-[#04439e]/30' : 'border-blue-200'
                      }`}
                    >
                      <div className="relative mb-2 h-24 w-full overflow-hidden rounded-xl">
                        <img src={service.image} alt={service.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />
                        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                            {service.logoImage ? (
                              <img src={service.logoImage} alt={service.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <Icon className="h-6 w-6 text-[#04439e]" />
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{service.name}</span>
                      <span className="text-[10px] text-muted-foreground">{service.desc}</span>
                    </button>
                    );
                  })}
                </div>
              </div>

              {/* Sous-menu « Santé & Bien-être » : Pharmacie / Clinique / Soins */}
              <Dialog open={healthDialogOpen} onOpenChange={setHealthDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <div className="mb-2 space-y-1">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <Heart className="h-5 w-5 text-[#ff4000]" /> Santé & Bien-être
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Choisissez votre type d'établissement de santé.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {HEALTH_SUBTYPE_OPTIONS.map((service) => {
                      const Icon = service.icon;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => handleHealthSubtypeSelect(service.id)}
                          className="group flex items-center gap-3 rounded-xl border-2 border-blue-200 bg-white p-3 text-left transition-all hover:border-[#04439e] hover:shadow-lg"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                            {service.logoImage ? (
                              <img src={service.logoImage} alt={service.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <Icon className="h-6 w-6 text-[#04439e]" />
                            )}
                          </div>
                          <div>
                            <span className="block text-sm font-semibold text-foreground">{service.name}</span>
                            <span className="block text-[11px] text-muted-foreground">{service.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Google OAuth pour inscription service */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center mb-3">{t('auth.orCreateProAccountWith')}</p>
                <button
                  type="button"
                  onClick={() => {
                    // ✓ NOUVEAU: Les services utilisent le rôle 'prestataire' (pas 'vendeur')
                    setSelectedRole('prestataire');
                    setShowServiceSelection(false);
                    localStorage.setItem('oauth_intent_role', 'prestataire');
                    localStorage.setItem('oauth_is_new_signup', 'true');
                    if (selectedServiceType) {
                      localStorage.setItem('oauth_service_type', selectedServiceType);
                    }
                    handleGoogleLogin(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md transition-all duration-200"
                  disabled={oauthLoading !== null}
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span className="font-semibold text-gray-700 text-sm">
                    {oauthLoading === 'google' ? 'Connexion...' : "S'inscrire avec Google"}
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}

      {/* Formulaire de connexion/inscription/reset */}
      {!showServiceSelection && (
        <div className="max-w-md mx-auto px-4 mt-1">
              <div>
                <Card className="shadow-lg border-2 border-primary/20">
                  <CardContent className="p-8">
            {/* Écran de chargement pendant la vérification du lien de réinitialisation */}
            {checkingResetLink ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">{t('auth.verifyingInProgress')}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Validation de votre lien de réinitialisation
                  </p>
                </div>
              </div>
            ) : (
            <>
            {/* Bouton retour pour le reset password */}
            {showResetPassword && (
              <Button
                variant="ghost"
                onClick={() => {
                  setShowResetPassword(false);
                  setError(null);
                  setSuccess(null);
                  setResetEmail('');
                }}
                className="gap-2 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Button>
            )}

            {/* Messages d'information */}
            {/* Boutons Connexion / Créer un compte - toujours visibles sauf reset password */}
            {/* Onglets Connexion / Inscription - Design professionnel */}
            {!showResetPassword && !showNewPasswordForm && (
              <div className="mb-6">
                <div className="relative flex p-1 rounded-2xl border border-border/50">
                  {/* Indicateur animé */}
                  <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#04439e] rounded-xl shadow-lg transition-all duration-300 ease-out ${
                      showSignup ? 'left-[calc(50%+2px)]' : 'left-1'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignup(false);
                      setSelectedRole(null);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`relative z-10 flex-1 py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${
                      !showSignup
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <LogIn className="h-4 w-4 flex-shrink-0" />
                      Connexion
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignup(true);
                      setIsLogin(false);
                      setSelectedRole(null);
                      setShowVendorTypeSelection(false);
                      setShowServiceSelection(false);
                      setVendorShopType(null);
                      setSelectedServiceType(null);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`relative z-10 flex-1 py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${
                      showSignup
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <UserPlus className="h-4 w-4 flex-shrink-0" />
                      Marchand/Service
                    </span>
                  </button>
                </div>
              </div>
            )}

            {!showSignup && !showResetPassword && !showVendorTypeSelection && (
              <>
                <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-xl shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-semibold text-sm mb-1">{t('auth.smartLogin')}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Utilisez vos identifiants habituels. Le système reconnaîtra automatiquement votre type de compte.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mb-6 p-3 bg-[#ff4000]/5 border border-orange-200/60 rounded-xl">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#ff4000] flex-shrink-0" />
                    <p className="text-[#ff4000] text-xs">
                      Nouveau inscrit ? Confirmez votre email avant de vous connecter.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Types de comptes - Vendeur classique & Service */}
            {/* Sélection du type de boutique vendeur - Page dédiée */}
            {showVendorTypeSelection && !showSignup && (
              <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

                <div className="bg-muted/10 border border-border/50 rounded-2xl p-6 shadow-sm">
                  <div className="text-center mb-5">
                    <div className="w-14 h-14 flex items-center justify-center mx-auto mb-3">
                      <span className="text-4xl leading-none select-none" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.28))' }} role="img" aria-label="Boutique">🏪</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1">{t('auth.classicSeller')}</h3>
                    <p className="text-xs text-muted-foreground">{t('auth.whatProductsToSell')}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* E-commerce - Produits physiques */}
                    <button
                      type="button"
                      onClick={() => {
                        setVendorShopType('physical');
                        setSelectedServiceType(null);
                        setSelectedRole('vendeur');
                        setShowServiceSelection(false);
                        setShowVendorTypeSelection(false);
                        setShowSignup(true);
                      }}
                      className="group flex flex-col items-center text-center gap-2 sm:gap-3 p-3 sm:p-5 rounded-xl border-2 border-border/60 bg-background hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                        <span className="text-3xl sm:text-4xl leading-none select-none" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.28))' }} role="img" aria-label="E-commerce">🛍️</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-foreground block mb-0.5 sm:mb-1">E-commerce</span>
                        <span className="text-[10px] sm:text-[11px] leading-tight text-muted-foreground block">{t('auth.physicalProductsExamples')}</span>
                      </div>
                    </button>

                    {/* Produits digitaux */}
                    <button
                      type="button"
                      onClick={() => {
                        setVendorShopType('digital');
                        setSelectedServiceType(null);
                        setSelectedRole('vendeur');
                        setShowServiceSelection(false);
                        setShowVendorTypeSelection(false);
                        setShowSignup(true);
                      }}
                      className="group flex flex-col items-center text-center gap-2 sm:gap-3 p-3 sm:p-5 rounded-xl border-2 border-border/60 bg-background hover:border-[#04439e] hover:bg-blue-50/60 hover:shadow-lg hover:shadow-[#04439e]/10 transition-all duration-200"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                        <span className="text-3xl sm:text-4xl leading-none select-none" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.28))' }} role="img" aria-label="Digitaux">💻</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-foreground block mb-0.5 sm:mb-1">Digitaux</span>
                        <span className="text-[10px] sm:text-[11px] leading-tight text-muted-foreground block">Fichiers, formations, ebooks, logiciels...</span>
                      </div>
                    </button>
                  </div>

                  {/* Google OAuth pour vendeur classique */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground text-center mb-3">{t('auth.orCreateShopWith')}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('vendeur');
                        localStorage.setItem('oauth_intent_role', 'vendeur');
                        localStorage.setItem('oauth_is_new_signup', 'true');
                        handleGoogleLogin(false);
                      }}
                      className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md transition-all duration-200"
                      disabled={oauthLoading !== null}
                    >
                      {oauthLoading === 'google' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      <span className="font-semibold text-gray-700 text-sm">
                        {oauthLoading === 'google' ? 'Connexion...' : "S'inscrire avec Google"}
                      </span>
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* Types de comptes - Vendeur classique & Service */}
            {showSignupLayout && !showVendorTypeSelection && !selectedRole && (
              <div className="mb-6 bg-muted/10 border border-border/50 rounded-2xl p-5 shadow-sm">
                <div className="text-center mb-4">
                  <h3 className="text-sm font-bold text-foreground mb-1">{t('auth.chooseYourProfile')}</h3>
                  <p className="text-xs text-muted-foreground">{t('auth.selectMatchingAccount')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Vendeur classique - Un seul bouton qui ouvre la page dédiée */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowVendorTypeSelection(true);
                      setShowSignup(false);
                      setSelectedRole(null);
                      setSelectedServiceType(null);
                    }}
                    className={`group flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedRole === 'vendeur' && !selectedServiceType
                        ? 'bg-[#04439e] border-primary text-white shadow-lg shadow-primary/25 scale-[1.02]'
                        : 'bg-background border-border/60 hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="w-12 h-12 flex items-center justify-center">
                      <span className="text-3xl leading-none select-none" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.28))' }} role="img" aria-label="Vendeur">🏪</span>
                    </div>
                    <span className={`text-sm font-semibold ${selectedRole === 'vendeur' && !selectedServiceType ? 'text-white' : 'text-foreground'}`}>
                      Vendeur classique
                    </span>
                    <span className={`text-[10px] ${selectedRole === 'vendeur' && !selectedServiceType ? 'text-white/80' : 'text-muted-foreground'}`}>
                      Vendre des produits
                    </span>
                  </button>

                  {/* Service */}
                  <button
                    type="button"
                    onClick={() => handleRoleClick('vendeur')}
                    className={`group flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedRole === 'prestataire'
                        ? 'bg-[#ff4000] border-[#ff4000] text-white shadow-lg shadow-[#ff4000]/25 scale-[1.02]'
                        : 'bg-background border-border/60 hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    <div className="w-12 h-12 flex items-center justify-center">
                      <span className="text-3xl leading-none select-none" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.28))' }} role="img" aria-label="Service">💼</span>
                    </div>
                    <span className={`text-sm font-semibold ${selectedRole === 'prestataire' ? 'text-white' : 'text-foreground'}`}>
                      Service
                    </span>
                    <span className={`text-[10px] ${selectedRole === 'prestataire' ? 'text-white/80' : 'text-muted-foreground'}`}>
                      Proposer des services
                    </span>
                  </button>
                </div>
              </div>
            )}

              {showSignup && selectedRole && (
              <div className={`mb-6 p-4 rounded-lg border ${
                selectedRole === 'vendeur' ? 'bg-primary/5 border-primary/20' :
                selectedRole === 'prestataire' ? 'bg-orange-50 border-orange-200' :
                selectedRole === 'livreur' ? 'bg-orange-50 border-orange-200' :
                selectedRole === 'taxi' ? 'bg-orange-50 border-orange-200' :
                selectedRole === 'transitaire' ? 'bg-blue-50 border-blue-200' :
                selectedRole === 'client' ? 'bg-orange-50 border-orange-200' :
                'bg-muted/50 border-border'
              }`}>
                <p className={`text-sm ${
                  selectedRole === 'vendeur' ? 'text-primary' :
                  selectedRole === 'prestataire' ? 'text-[#ff4000]' :
                  selectedRole === 'livreur' ? 'text-orange-800' :
                  selectedRole === 'taxi' ? 'text-[#ff4000]' :
                  selectedRole === 'transitaire' ? 'text-[#04439e]' :
                  selectedRole === 'client' ? 'text-[#ff4000]' :
                  'text-foreground'
                }`}>
                  <strong>{t('auth.createAccount')} :</strong> {t('auth.fillInfoBelow')} {selectedRole ? `en tant que ${selectedRole === 'prestataire' ? 'prestataire de service' : selectedRole === 'vendeur' ? 'vendeur e-commerce' : selectedRole}` : ''}.
                  {selectedServiceType && (
                    <span className={`block mt-2 font-semibold ${
                      selectedRole === 'vendeur' ? 'text-primary' :
                      selectedRole === 'livreur' ? 'text-orange-700' :
                      selectedRole === 'taxi' ? 'text-[#ff4000]' :
                      selectedRole === 'transitaire' ? 'text-[#04439e]' :
                      selectedRole === 'client' ? 'text-[#ff4000]' :
                      'text-primary'
                    }`}>
                      Service sélectionné : {(() => {
                        const allServices = [...PROXIMITY_SERVICE_OPTIONS, ...PROFESSIONAL_SERVICE_OPTIONS];
                        const service = allServices.find((s) => s.id === selectedServiceType);
                        return service ? service.name : selectedServiceType;
                      })()}
                    </span>
                  )}
                  {selectedRole === 'vendeur' && !selectedServiceType && vendorShopType === 'digital' && (
                    <span className="block mt-1 font-semibold text-[#04439e]">
                      Mode produits digitaux (fichiers, formations, e-books)
                    </span>
                  )}
                  {selectedRole === 'vendeur' && !selectedServiceType && vendorShopType !== 'digital' && (
                    <span className="block mt-1 font-semibold text-blue-700">
                      Mode boutique e-commerce (produits physiques)
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Formulaire de réinitialisation de mot de passe */}
            {showResetPassword ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                {error && (
                  <Alert className="bg-orange-50 border-orange-200">
                    <AlertCircle className="h-4 w-4 text-[#ff4000]" />
                    <AlertDescription className="text-[#ff4000]">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-orange-50 border-orange-200">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      {success}
                    </AlertDescription>
                  </Alert>
                )}

                {resetOtpSent ? (
                  <form onSubmit={handleResetVerifyOtp} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t('auth.smsCodeSentTo')} <strong>{resetFormattedPhone}</strong>. {t('auth.enterCodeToContinue')}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="reset-otp">{t('auth.verificationCode')}</Label>
                      <Input
                        id="reset-otp"
                        type="text"
                        placeholder="123456"
                        value={resetOtpCode}
                        onChange={(e) => setResetOtpCode(e.target.value)}
                        className="text-center tracking-widest font-mono"
                        maxLength={6}
                        required
                        autoFocus
                      />
                    </div>
                    {error && (
                      <Alert className="bg-orange-50 border-orange-200">
                        <AlertCircle className="h-4 w-4 text-[#ff4000]" />
                        <AlertDescription className="text-[#ff4000]">{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading || resetOtpCode.length < 4}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('auth.checking')}</> : t('auth.verifyCode')}
                    </Button>
                    <button
                      type="button"
                      onClick={handleResendResetOtp}
                      disabled={loading || resetResendCooldown > 0}
                      className="w-full text-sm text-blue-600 hover:underline disabled:text-muted-foreground disabled:no-underline py-1"
                    >
                      {resetResendCooldown > 0 ? `Renvoyer le code (${resetResendCooldown}s)` : 'Renvoyer le code'}
                    </button>
                    <Button type="button" variant="ghost" className="w-full" onClick={() => setResetOtpSent(false)}>
                      Changer de numéro
                    </Button>
                  </form>
                ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    Entrez votre email ou numéro de téléphone pour réinitialiser votre mot de passe.
                  </p>
                  <Label htmlFor="reset-email">{t('auth.emailOrPhone')}</Label>
                  <Input
                    id="reset-email"
                    type="text"
                    placeholder={t('auth.emailOrPhone')}
                    value={resetEmail}
                    onChange={(e) => { setResetEmail(e.target.value); setPhoneNotFoundReset(false); }}
                    required
                  />
                </div>
                )}

                {phoneNotFoundReset && !resetOtpSent && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-[#ff4000] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#ff4000]">{t('auth.numberNotRecognized')}</p>
                        <p className="text-xs text-[#ff4000]">{t('auth.numberNotLinked')}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full bg-[#ff4000] hover:bg-[#ff4000] text-white text-sm"
                      onClick={() => {
                        setShowResetPassword(false);
                        setPhoneNotFoundReset(false);
                        // Pré-remplir le numéro depuis le champ de réinitialisation
                        const rawPh = resetEmail.trim().replace(/[\s\-().]/g, '');
                        const ph = rawPh.replace(/[^\d]/g, '');
                        if (ph.startsWith('224') && ph.length === 12) {
                          setPhoneCode('+224');
                          handleInputChange('phone', ph.slice(3));
                        } else if (ph.length === 9) {
                          setPhoneCode('+224');
                          handleInputChange('phone', ph);
                        } else {
                          handleInputChange('phone', ph);
                        }
                        // Ouvrir la modal de création de compte client
                        setShowRoleSelectionModal(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Créer un compte avec ce numéro
                    </Button>
                  </div>
                )}

                {!resetOtpSent && !phoneNotFoundReset && (
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    resetEmail.includes('@') ? 'Envoyer le lien par email' : 'Envoyer le code SMS'
                  )}
                </Button>
                )}

                {!resetOtpSent && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowResetPassword(false);
                    setError(null);
                    setSuccess(null);
                    setResetCode('');
                    setPhoneNotFoundReset(false);
                    setResetOtpSent(false);
                  }}
                >
                  Retour à la connexion
                </Button>
                )}
              </form>
            ) : showNewPasswordForm ? (
              <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
                {error && (
                  <Alert className="bg-orange-50 border-orange-200">
                    <AlertCircle className="h-4 w-4 text-[#ff4000]" />
                    <AlertDescription className="text-[#ff4000]">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-orange-50 border-orange-200">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      {success}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    Choisissez votre nouveau mot de passe.
                  </p>

                  <Label htmlFor="new-password">{t('auth.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth.minChars')}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">{t('auth.confirmPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t('auth.retypePassword')}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#04439e] hover:bg-[#04439e]/90 text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Réinitialisation en cours...
                    </>
                  ) : (
                    'Réinitialiser mon mot de passe'
                  )}
                </Button>
              </form>
            ) : showVendorTypeSelection ? null : (
              <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">{success}</AlertDescription>
                </Alert>
              )}

              {showSignup && selectedRole && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">{t('auth.firstName')}</Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        placeholder={t('auth.firstName')}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">{t('auth.lastName')}</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        placeholder={t('auth.lastName')}
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Champ Nom d'entreprise - uniquement pour les marchands */}
                  {selectedRole === 'vendeur' && (
                    <div>
                      <Label htmlFor="businessName">
                        <Store className="inline w-4 h-4 mr-1" />
                        Nom de l'entreprise / Boutique
                      </Label>
                      <Input
                        id="businessName"
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => handleInputChange('businessName', e.target.value)}
                        placeholder={t('auth.businessNameExample')}
                        required
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* Nom de l'établissement de santé — pharmacie / clinique (après nom & prénom) */}
                  {selectedRole === 'prestataire' && (selectedServiceType === 'pharmacie' || selectedServiceType === 'clinique') && (
                    <div>
                      <Label htmlFor="businessName">
                        {selectedServiceType === 'pharmacie' ? (
                          <Pill className="inline w-4 h-4 mr-1 text-[#04439e]" />
                        ) : (
                          <Building2 className="inline w-4 h-4 mr-1 text-[#04439e]" />
                        )}
                        {selectedServiceType === 'pharmacie' ? 'Nom de la pharmacie' : 'Nom de la clinique'}
                      </Label>
                      <Input
                        id="businessName"
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => handleInputChange('businessName', e.target.value)}
                        placeholder={selectedServiceType === 'pharmacie' ? 'Ex: Pharmacie de la Paix' : 'Ex: Clinique du Centre'}
                        required
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* Bouton détection position */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-primary border-primary/30 hover:bg-primary/5"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const data = getSafeBrowserGeo();
                        handleInputChange('country', data.countryName || 'Guinée');
                        handleInputChange('city', data.city || 'Conakry');
                        handleInputChange('address', [data.region, data.city, data.countryName].filter(Boolean).join(', '));
                        toast({ title: t('auth.positionDetectee'), description: `${data.city || 'Conakry'}, ${data.countryName || 'Guinée'}` });
                      } catch {
                        toast({ title: "Erreur", description: t('auth.impossibleDeDetecterLaPosition'), variant: "destructive" });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Détecter ma position automatiquement
                  </Button>

                  <div>
                    <Label htmlFor="country">Pays</Label>
                    <Popover open={countrySelectOpen} onOpenChange={setCountrySelectOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={countrySelectOpen}
                          className="w-full justify-between mt-1 font-normal"
                        >
                          <span className="truncate">
                            {formData.country
                              ? (() => {
                                  const found = WORLD_PHONE_CODES.find(c => c.country === formData.country);
                                  return found ? `${found.flag} ${found.country}` : formData.country;
                                })()
                              : "Sélectionner un pays..."}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0 bg-background border shadow-lg z-[100]" align="start">
                        <Command>
                          <CommandInput placeholder={t('auth.searchCountry')} className="h-9" />
                          <CommandList>
                            <CommandEmpty>{t('auth.noCountryFound')}</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-auto">
                              {WORLD_PHONE_CODES.map((item) => (
                                <CommandItem
                                  key={`country-${item.code}-${item.country}`}
                                  value={`${item.country}`}
                                  onSelect={() => {
                                    handleInputChange('country', item.country);
                                    setCountrySelectOpen(false);
                                    setTaxiCategory(null);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <span className="mr-2">{item.flag}</span>
                                  <span className="flex-1 truncate text-sm">{item.country}</span>
                                  {formData.country === item.country && (
                                    <Check className="ml-2 h-4 w-4 text-primary" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="city">Ville / Commune</Label>
                      {/* Afficher le bouton de sélection uniquement pour taxi (synchronisation bureau) */}
                      {selectedRole === 'taxi' && (
                        <button
                          type="button"
                          onClick={() => {
                            setManualCityEntry(!manualCityEntry);
                            setFormData({ ...formData, city: '' });
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {manualCityEntry ? 'Choisir dans la liste' : 'Saisir manuellement'}
                        </button>
                      )}
                    </div>

                    {/* Le MENU DÉROULANT des bureaux syndicaux est réservé au TAXI (qui doit choisir
                        une commune de bureau pour la synchronisation). TOUS les autres rôles — dont le
                        prestataire (pharmacie, beauté, santé…) — saisissent LIBREMENT leur ville. */}
                    {selectedRole === 'taxi' && !manualCityEntry ? (
                      <select
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        required
                        className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring z-50"
                      >
                        <option value="">{t('auth.selectYourCity')}</option>
                        {bureaus.map((bureau) => (
                          <option key={bureau.id} value={bureau.commune}>
                            {bureau.commune} - {bureau.prefecture}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="city"
                        type="text"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder={t('auth.enterYourCity')}
                        required
                        className="mt-1"
                      />
                    )}

                    {selectedRole === 'taxi' && formData.city && !manualCityEntry && (
                      <p className="text-xs text-[#ff4000] mt-1">
                        Vous serez automatiquement synchronisé avec le bureau syndical de {formData.city}
                      </p>
                    )}
                    {selectedRole === 'taxi' && formData.city && manualCityEntry && (
                      <p className="text-xs text-[#ff4000] mt-1">
                        Ville saisie manuellement - synchronisation bureau non garantie
                      </p>
                    )}
                  </div>

                  {/* ── TYPE DE TAXI ── dropdown avec icônes sous Ville */}
                  {selectedRole === 'taxi' && (showMotoTaxiSelector || !formData.country) && (
                    <div>
                      <Label className="text-sm font-medium">
                        Type de taxi <span className="text-[#ff4000]">*</span>
                      </Label>
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() => setTaxiDropdownOpen(o => !o)}
                          className="w-full flex items-center justify-between px-3 py-2 border border-input rounded-md bg-background text-sm hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                        >
                          {taxiCategory === 'car' ? (
                            <span className="flex items-center gap-2 text-foreground font-medium">
                              <Car className="h-4 w-4 text-blue-600" /> Taxi Voiture
                            </span>
                          ) : taxiCategory === 'motorcycle' ? (
                            <span className="flex items-center gap-2 text-foreground font-medium">
                              <Bike className="h-4 w-4 text-orange-500" /> Taxi Moto
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t('auth.selectTaxiType')}</span>
                          )}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${taxiDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {taxiDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => { setTaxiCategory('car'); setTaxiDropdownOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-blue-50 ${taxiCategory === 'car' ? 'bg-blue-50 text-blue-700' : 'text-foreground'}`}
                            >
                              <Car className="h-5 w-5 text-blue-600 shrink-0" />
                              <div>
                                <p className="font-medium">Taxi Voiture</p>
                                <p className="text-xs text-muted-foreground">Berline, SUV, citadine</p>
                              </div>
                              {taxiCategory === 'car' && <Check className="h-4 w-4 text-blue-600 ml-auto" />}
                            </button>
                            <div className="border-t border-border/40" />
                            <button
                              type="button"
                              onClick={() => { setTaxiCategory('motorcycle'); setTaxiDropdownOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-orange-50 ${taxiCategory === 'motorcycle' ? 'bg-orange-50 text-orange-700' : 'text-foreground'}`}
                            >
                              <Bike className="h-5 w-5 text-[#ff4000] shrink-0" />
                              <div>
                                <p className="font-medium">Taxi Moto</p>
                                <p className="text-xs text-muted-foreground">Moto, scooter, taxi-moto</p>
                              </div>
                              {taxiCategory === 'motorcycle' && <Check className="h-4 w-4 text-orange-500 ml-auto" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="address">Adresse</Label>
                    <Input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Ex: Quartier Madina, Rue KA-020"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">{t('auth.phoneNumber')}</Label>
                    <div className="flex gap-2 mt-1">
                      {/* Sélecteur d'indicatif pays avec recherche */}
                      <Popover open={phoneCodeOpen} onOpenChange={setPhoneCodeOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={phoneCodeOpen}
                            className="w-32 justify-between px-2 font-medium"
                          >
                            <span className="flex items-center gap-1 truncate">
                              {WORLD_PHONE_CODES.find(c => c.code === phoneCode)?.flag} {phoneCode}
                            </span>
                            <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0 bg-background border shadow-lg z-[100]" align="start">
                          <Command>
                            <CommandInput placeholder={t('auth.searchCountry')} className="h-9" />
                            <CommandList>
                              <CommandEmpty>{t('auth.noCountryFound')}</CommandEmpty>
                              <CommandGroup className="max-h-60 overflow-auto">
                                {WORLD_PHONE_CODES.map((item) => (
                                  <CommandItem
                                    key={`${item.code}-${item.country}`}
                                    value={`${item.country} ${item.code}`}
                                    onSelect={() => {
                                      setPhoneCode(item.code);
                                      setPhoneCodeOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <span className="mr-2">{item.flag}</span>
                                    <span className="flex-1 truncate">{item.country}</span>
                                    <span className="ml-2 text-muted-foreground">{item.code}</span>
                                    {phoneCode === item.code && (
                                      <Check className="ml-2 h-4 w-4 text-primary" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {/* Numéro de téléphone */}
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          // Nettoyer le numéro (enlever espaces et caractères non numériques)
                          const cleaned = e.target.value.replace(/[^\d]/g, '');
                          handleInputChange('phone', cleaned);
                        }}
                        placeholder={getPhoneExample(phoneCode)}
                        required
                        className={`flex-1 ${phoneError ? 'border-[#ff4000] focus:ring-[#ff4000]' : ''}`}
                      />
                    </div>
                    {phoneError ? (
                      <p className="text-xs text-[#ff4000] mt-1">
                        ✕ {phoneError}
                      </p>
                    ) : formData.phone && !phoneError ? (
                      <p className="text-xs text-[#ff4000] mt-1">
                        ✓ Format valide ({getPhoneLengthHint(phoneCode)})
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Format attendu: {getPhoneLengthHint(phoneCode)} • Ex: {getPhoneExample(phoneCode)}
                      </p>
                    )}
                  </div>
                </>
              )}

              {(!showSignup || selectedRole) && (<>

              {/* Formulaire OTP téléphone — connexion */}
              {loginPhoneOtpSent ? (
                <form onSubmit={handleLoginVerifyPhoneOtp} className="space-y-4">
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <Phone className="h-4 w-4 text-blue-600 shrink-0" />
                    <p className="text-sm text-blue-800">{t('auth.smsCodeSentTo')} <strong>{loginFormattedPhone}</strong></p>
                  </div>
                  <div>
                    <Label htmlFor="login-otp" className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> {t('auth.verificationCode')}</Label>
                    <Input
                      id="login-otp"
                      type="text"
                      placeholder="123456"
                      value={loginPhoneOtp}
                      onChange={(e) => setLoginPhoneOtp(e.target.value)}
                      className="mt-1 text-center tracking-widest font-mono text-lg"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 text-[#ff4000] shrink-0" />
                      <p className="text-sm text-[#ff4000]">{error}</p>
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading || loginPhoneOtp.length < 4}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('auth.checking')}</> : t('auth.login')}
                  </Button>
                  <button
                    type="button"
                    onClick={handleResendLoginOtp}
                    disabled={loading || loginResendCooldown > 0}
                    className="w-full text-sm text-blue-600 hover:underline disabled:text-muted-foreground disabled:no-underline py-1"
                  >
                    {loginResendCooldown > 0 ? `Renvoyer le code (${loginResendCooldown}s)` : 'Renvoyer le code'}
                  </button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => { setLoginPhoneOtpSent(false); setLoginPhoneOtp(''); setError(null); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Changer de numéro
                  </Button>
                </form>

              /* Formulaire OTP téléphone — inscription */
              ) : phoneSignupOtpSent ? (
                <form onSubmit={handlePhoneSignupVerify} className="space-y-4">
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <Phone className="h-4 w-4 text-[#ff4000] shrink-0" />
                    <p className="text-sm text-[#ff4000]">{t('auth.smsCodeSentTo')} <strong>{phoneSignupPhone}</strong></p>
                  </div>
                  <div>
                    <Label htmlFor="signup-otp" className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> {t('auth.verificationCode')}</Label>
                    <Input
                      id="signup-otp"
                      type="text"
                      placeholder="123456"
                      value={phoneSignupOtp}
                      onChange={(e) => setPhoneSignupOtp(e.target.value)}
                      className="mt-1 text-center tracking-widest font-mono text-lg"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 text-[#ff4000] shrink-0" />
                      <p className="text-sm text-[#ff4000]">{error}</p>
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-[#ff4000] hover:bg-[#ff4000] text-white" disabled={loading || phoneSignupOtp.length < 4}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('auth.creatingAccount')}</> : t('auth.createMyAccount')}
                  </Button>
                  <button
                    type="button"
                    onClick={handleResendPhoneSignupOtp}
                    disabled={loading || phoneSignupResendCooldown > 0}
                    className="w-full text-sm text-[#ff4000] hover:underline disabled:text-muted-foreground disabled:no-underline py-1"
                  >
                    {phoneSignupResendCooldown > 0 ? `Renvoyer le code (${phoneSignupResendCooldown}s)` : 'Renvoyer le code'}
                  </button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => { setPhoneSignupOtpSent(false); setPhoneSignupOtp(''); setError(null); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Changer de numéro
                  </Button>
                </form>

              ) : (
              <>
              {/* Toggle méthode d'inscription — visible uniquement en mode inscription */}
              {showSignup && selectedRole && (
                <div className="flex gap-1 p-1 bg-muted rounded-xl mb-2">
                  <button
                    type="button"
                    onClick={() => setSignupMethod('email')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      signupMethod === 'email'
                        ? 'bg-white shadow-sm text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupMethod('phone')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      signupMethod === 'phone'
                        ? 'bg-white shadow-sm text-[#ff4000]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Phone className="h-3.5 w-3.5" /> Téléphone
                  </button>
                </div>
              )}

              {/* Champ email — masqué si inscription par téléphone */}
              {(!showSignup || signupMethod === 'email') && (
              <div>
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  {!showSignup && isPhoneIdentifier(formData.email) ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  {!showSignup && isPhoneIdentifier(formData.email) ? 'Numéro de téléphone' : 'Email'}
                </Label>
                <Input
                  id="email"
                  type="text"
                  value={formData.email}
                  onChange={(e) => { handleInputChange('email', e.target.value); setLoginPhoneNotFound(false); }}
                  placeholder={showSignup ? 'Adresse email' : 'Email ou numéro de téléphone'}
                  required
                  className="mt-1"
                />
              </div>
              )}

              {/* Numéro utilisé pour l'inscription par téléphone */}
              {showSignup && signupMethod === 'phone' && (
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <Phone className="h-4 w-4 text-[#ff4000] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#ff4000]">
                    Votre numéro <strong>{phoneCode} {formData.phone || '...'}</strong> sera utilisé pour vous connecter par SMS.
                  </p>
                </div>
              )}

              {loginPhoneNotFound && !showSignup && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-[#ff4000] mt-0.5 shrink-0" />
                    <p className="text-sm text-[#ff4000]">{t('auth.numberNotLinked')}</p>
                  </div>
                  <Button
                    type="button"
                    className="w-full bg-[#ff4000] hover:bg-[#ff4000] text-white text-sm"
                    onClick={() => {
                      setLoginPhoneNotFound(false);
                      // Pré-remplir le numéro depuis le champ de connexion
                      const rawPh = formData.email.trim().replace(/[\s\-().]/g, '');
                      const ph = rawPh.replace(/[^\d]/g, '');
                      if (ph.startsWith('224') && ph.length === 12) {
                        setPhoneCode('+224');
                        handleInputChange('phone', ph.slice(3));
                      } else if (ph.length === 9) {
                        setPhoneCode('+224');
                        handleInputChange('phone', ph);
                      } else {
                        handleInputChange('phone', ph);
                      }
                      // Ouvrir la modal de création de compte client
                      setShowRoleSelectionModal(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Créer un compte avec ce numéro
                  </Button>
                </div>
              )}

              {/* Mot de passe — masqué uniquement en connexion par téléphone */}
              {(!showSignup ? !isPhoneIdentifier(formData.email) : true) && (
              <div>
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder={t('auth.password')}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              )}

              {showSignup && (
                <div>
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder={t('auth.confirmPassword')}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {!showSignup && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPassword(true);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-sm text-[#04439e] hover:underline"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading || oauthLoading !== null}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {showSignup ? t('auth.registering') : t('auth.loggingIn')}
                  </>
                ) : (
                  showSignup
                    ? (signupMethod === 'phone' ? 'Envoyer le code SMS' : t('auth.register'))
                    : t('auth.login')
                )}
              </Button>
              </>)}
              </>)}

              {/* ===== OAUTH BUTTONS ===== */}
              {(
                <>
                  <div className="relative my-6">
                    <Separator />
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-sm text-muted-foreground">
                      {showSignup ? t('auth.orSignUpWith') : t('auth.orContinueWith')}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <div className="relative w-full max-w-sm">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-14 gap-3 font-medium text-base hover:bg-orange-50 hover:border-orange-300 hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
                        onClick={() => handleGoogleLogin(false)}
                        disabled={loading || oauthLoading !== null}
                        aria-label={showSignup ? "S'inscrire avec Google" : "Se connecter avec Google"}
                        aria-busy={oauthLoading === 'google'}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                        {oauthLoading === 'google' ? (
                          <>
                            {oauthRetrying ? (
                              <RefreshCw className="h-6 w-6 animate-spin" />
                            ) : (
                              <Loader2 className="h-6 w-6 animate-spin" />
                            )}
                            <span>{oauthRetrying ? 'Nouvelle tentative...' : 'Connexion...'}</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>{showSignup ? "S'inscrire avec Google" : 'Continuer avec Google'}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {oauthLoading === 'google' && (
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-600 animate-pulse">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span>{t('auth.secureGoogleRedirect')}</span>
                    </div>
                  )}
                </>
              )}

              {/* Section basculer Connexion / Inscription - Design compact */}
              <div className="mt-3 pt-3 border-t border-border/30">
                {!showSignup ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('auth.noAccount')}</span>
                    <button
                      type="button"
                      onClick={() => { setShowRoleSelectionModal(true); setError(null); setSuccess(null); }}
                      className="inline-flex items-center gap-1.5 py-2 px-4 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all duration-200"
                    >
                      <UserPlus className="h-4 w-4" />
                      Créer un compte
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('auth.hasAccount')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSignup(false);
                        setSelectedRole(null);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="inline-flex items-center gap-1.5 py-2 px-4 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all duration-200"
                    >
                      <LogIn className="h-4 w-4" />
                      Se connecter
                    </button>
                  </div>
                )}
              </div>

            </form>
            )}
            </>
            )}
                  </CardContent>
                </Card>
              </div>
        </div>
      )}

      {/* Modal de création de compte Client */}
      {showRoleSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowRoleSelectionModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 animate-in zoom-in-95 duration-200 my-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-center mb-1 text-gray-800">
              Créer un compte Client
            </h3>
            <p className="text-xs text-muted-foreground text-center mb-4">
              Remplissez vos informations pour vous inscrire
            </p>

            {/* Formulaire d'inscription Client directement dans la modal */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              // Ensure role is set before submission
              setSelectedRole('client');
              setShowSignup(true);
              // Small delay to let state update, then trigger submit
              setLoading(true);
              setIsAuthenticating(true);
              setError(null);
              setSuccess(null);
              try {
                if (formData.password !== formData.confirmPassword) {
                  throw new Error("Les mots de passe ne correspondent pas");
                }
                if (!validatePhoneNumber(formData.phone, phoneCode)) {
                  const hint = getPhoneLengthHint(phoneCode);
                  throw new Error(`Numéro de téléphone invalide pour ${phoneCode}. Format attendu: ${hint}`);
                }
                const validatedData = signupSchema.parse({ ...formData, role: 'client' });
                const { data: userCustomId, error: generateError } = await supabase
                  .rpc('generate_custom_id_with_role', { p_role: 'client' });
                if (generateError) throw new Error('Erreur lors de la génération de votre identifiant');

                // 🔑 Cognito signup d'abord (principal)
                // Supabase signup directement (pas de Cognito)

                // Sync avec Supabase pour RLS
                try {
                  await supabase.functions.invoke('cognito-sync-session', {
                    body: {
                      email: validatedData.email,
                      password: validatedData.password,
                      role: 'client',
                      firstName: validatedData.firstName,
                      lastName: validatedData.lastName,
                      phone: `${phoneCode} ${formData.phone}`,
                      city: validatedData.city,
                      country: formData.country,
                      customId: userCustomId,
                      mode: 'signup',
                    },
                  });
                } catch (syncErr) {
                  console.warn('Sync Supabase échouée:', syncErr);
                }

                const { data: _authData, error: signUpError } = await supabase.auth.signUp({
                  email: validatedData.email,
                  password: validatedData.password,
                  options: {
                    data: {
                      first_name: validatedData.firstName,
                      last_name: validatedData.lastName,
                      role: 'client',
                      phone: `${phoneCode} ${formData.phone}`,
                      country: formData.country,
                      city: validatedData.city,
                      custom_id: userCustomId,
                    },
                    emailRedirectTo: `${window.location.origin}/`
                  }
                });
                if (signUpError) throw signUpError;
                setShowRoleSelectionModal(false);
                setSuccess("Compte créé ! Vérifiez votre email pour confirmer votre inscription.");
              } catch (err: any) {
                setError(err.message || 'Erreur lors de la création du compte');
              } finally {
                setLoading(false);
                setIsAuthenticating(false);
              }
            }} className="space-y-3">
              {/* Prénom & Nom */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="modal-firstName" className="text-xs">{t('auth.firstName')}</Label>
                  <Input
                    id="modal-firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder={t('auth.firstName')}
                    className="h-9 text-sm"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="modal-lastName" className="text-xs">{t('auth.lastName')}</Label>
                  <Input
                    id="modal-lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Nom"
                    className="h-9 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="modal-email" className="text-xs">{t('auth.email')}</Label>
                <Input
                  id="modal-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="email@exemple.com"
                  className="h-9 text-sm"
                  required
                />
              </div>

              {/* Téléphone */}
              <div>
                <Label htmlFor="modal-phone" className="text-xs">{t('auth.phone')}</Label>
                <div className="flex gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-28 h-9 justify-between px-2 text-xs font-medium shrink-0"
                      >
                        <span className="flex items-center gap-1 truncate">
                          {WORLD_PHONE_CODES.find(c => c.code === phoneCode)?.flag} {phoneCode}
                        </span>
                        <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 z-[200]" align="start">
                      <Command>
                        <CommandInput placeholder={t('auth.searchEllipsis')} className="h-9" />
                        <CommandList>
                          <CommandEmpty>{t('auth.noCountryFound')}</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {WORLD_PHONE_CODES.map((item) => (
                              <CommandItem
                                key={`modal-${item.code}-${item.country}`}
                                value={`${item.country} ${item.code}`}
                                onSelect={() => setPhoneCode(item.code)}
                                className="cursor-pointer"
                              >
                                <span className="mr-2">{item.flag}</span>
                                <span className="flex-1 truncate text-xs">{item.country}</span>
                                <span className="ml-2 text-muted-foreground text-xs">{item.code}</span>
                                {phoneCode === item.code && (
                                  <Check className="ml-1 h-3 w-3 text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    id="modal-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, ''))}
                    placeholder={getPhoneExample(phoneCode)}
                    className="h-9 text-sm flex-1"
                    required
                  />
                </div>
                {phoneError && <p className="text-[10px] text-[#ff4000] mt-0.5">{phoneError}</p>}
              </div>

              {/* Pays & Ville */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="modal-country" className="text-xs">{t('auth.country')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full h-9 text-sm justify-between font-normal"
                      >
                        <span className="truncate">
                          {formData.country
                            ? WORLD_PHONE_CODES.find(c => c.country === formData.country)
                              ? `${WORLD_PHONE_CODES.find(c => c.country === formData.country)!.flag} ${formData.country}`
                              : formData.country
                            : 'Sélectionner...'}
                        </span>
                        <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-0 z-[200]" align="start">
                      <Command>
                        <CommandInput placeholder={t('auth.searchCountry')} className="h-8 text-sm" />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>{t('auth.noCountryFound')}</CommandEmpty>
                          <CommandGroup>
                            {WORLD_PHONE_CODES.map((entry) => (
                              <CommandItem
                                key={entry.code + entry.country}
                                value={entry.country}
                                onSelect={() => handleInputChange('country', entry.country)}
                                className="text-sm"
                              >
                                <span className="mr-2">{entry.flag}</span>
                                <span className="truncate">{entry.country}</span>
                                {formData.country === entry.country && (
                                  <Check className="ml-auto h-3 w-3" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="modal-city" className="text-xs">{t('auth.city')}</Label>
                  <Input
                    id="modal-city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Ville"
                    className="h-9 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <Label htmlFor="modal-password" className="text-xs">{t('auth.password')}</Label>
                <Input
                  id="modal-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="h-9 text-sm"
                  required
                />
              </div>

              {/* Confirmer mot de passe */}
              <div>
                <Label htmlFor="modal-confirmPassword" className="text-xs">{t('auth.confirmPassword')}</Label>
                <Input
                  id="modal-confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="••••••••"
                  className="h-9 text-sm"
                  required
                />
              </div>

              {error && (
                <p className="text-xs text-[#ff4000] bg-orange-50 p-2 rounded-md">{error}</p>
              )}

              {/* Bouton Créer */}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                {loading ? 'Création...' : 'Créer mon compte'}
              </Button>
            </form>

            {/* Séparateur OAuth */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200"></span>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-muted-foreground">{t('auth.orSignUpWith')}</span>
              </div>
            </div>

            {/* Bouton Google OAuth */}
            <button
              onClick={() => {
                setSelectedRole('client');
                setShowRoleSelectionModal(false);
                handleGoogleLogin(false);
              }}
              className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl bg-white border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md transition-all duration-200"
              disabled={oauthLoading !== null}
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="font-semibold text-gray-700 text-sm">
                {oauthLoading === 'google' ? 'Connexion...' : 'Continuer avec Google'}
              </span>
            </button>

            {/* Bouton fermer */}
            <button
              onClick={() => setShowRoleSelectionModal(false)}
              className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL SUCCES INSCRIPTION ===== */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl rounded-2xl p-0 overflow-hidden [&>button]:hidden max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col items-center text-center p-8">
            {/* Cercle animé avec checkmark */}
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-[#ff4000] flex items-center justify-center shadow-lg shadow-orange-500/30 animate-[scale-in_0.4s_ease-out]">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 w-20 h-20 rounded-full bg-orange-400/30 animate-ping" style={{ animationDuration: '1.5s' }} />
            </div>

            <h3 className="text-xl font-bold text-foreground mb-2">
              Inscription réussie !
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Votre compte a été créé avec succès. Vous allez être redirigé vers votre espace.
            </p>

            {/* Barre de progression */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ff4000] rounded-full"
                style={{
                  animation: 'progress-fill 2.5s ease-in-out forwards'
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Redirection en cours...
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes progress-fill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Footer de navigation */}
      <QuickFooter />
    </div>
  );
}
