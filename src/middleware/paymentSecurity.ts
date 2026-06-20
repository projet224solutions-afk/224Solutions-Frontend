import { supabase } from '@/integrations/supabase/client';

// Types locaux pour éviter les erreurs TS avec les tables non-standard
interface UserProfile {
  role: string;
  kyc_verified: boolean;
  status: string;
}

export interface SecurityValidation {
  isValid: boolean;
  error?: string;
  userRole?: string;
  kycVerified?: boolean;
}

export class PaymentSecurity {
  /**
   * Valider les permissions d'un utilisateur pour créer des liens de paiement
   */
  static async validatePaymentPermissions(userId: string): Promise<SecurityValidation> {
    try {
      // Vérifier que l'utilisateur existe et a un profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, kyc_verified, status')
        .eq('id', userId)
        .single() as { data: UserProfile | null; error: any };

      if (profileError || !profile) {
        return {
          isValid: false,
          error: 'Profil utilisateur non trouvé'
        };
      }

      // Vérifier le statut du compte
      if (profile.status !== 'active') {
        return {
          isValid: false,
          error: 'Compte utilisateur non actif'
        };
      }

      // Vérifier les rôles autorisés
      const allowedRoles = ['vendeur', 'admin', 'pdg'];
      if (!allowedRoles.includes(profile.role)) {
        return {
          isValid: false,
          error: 'Seuls les vendeurs peuvent créer des liens de paiement'
        };
      }

      // Vérifier le KYC pour les vendeurs
      if (profile.role === 'vendeur' && !profile.kyc_verified) {
        return {
          isValid: false,
          error: 'KYC non vérifié. Veuillez compléter votre profil.',
          userRole: profile.role,
          kycVerified: false
        };
      }

      return {
        isValid: true,
        userRole: profile.role,
        kycVerified: profile.kyc_verified
      };
    } catch (error) {
      console.error('Erreur validation permissions:', error);
      return {
        isValid: false,
        error: 'Erreur lors de la validation des permissions'
      };
    }
  }

  /**
   * Valider les données d'un lien de paiement
   */
  static validatePaymentData(data: {
    produit: string;
    montant: number;
    devise: string;
    description?: string;
  }): SecurityValidation {
    // Validation du produit
    if (!data.produit || data.produit.trim().length < 2) {
      return {
        isValid: false,
        error: 'Le nom du produit doit contenir au moins 2 caractères'
      };
    }

    if (data.produit.length > 255) {
      return {
        isValid: false,
        error: 'Le nom du produit ne peut pas dépasser 255 caractères'
      };
    }

    // Validation du montant
    if (!data.montant || data.montant <= 0) {
      return {
        isValid: false,
        error: 'Le montant doit être positif'
      };
    }

    if (data.montant > 1000000) { // Limite de sécurité
      return {
        isValid: false,
        error: 'Le montant ne peut pas dépasser 1,000,000'
      };
    }

    // Validation de la devise
    const allowedCurrencies = ['GNF', 'FCFA', 'USD', 'EUR'];
    if (!allowedCurrencies.includes(data.devise)) {
      return {
        isValid: false,
        error: 'Devise non supportée'
      };
    }

    // Validation de la description
    if (data.description && data.description.length > 1000) {
      return {
        isValid: false,
        error: 'La description ne peut pas dépasser 1000 caractères'
      };
    }

    return {
      isValid: true
    };
  }

  /**
   * Valider l'accès à un lien de paiement
   */
  static async validatePaymentAccess(paymentId: string, _userId?: string): Promise<SecurityValidation> {
    try {
      // Récupérer les détails du lien de paiement
      const { data: paymentLink, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('payment_id', paymentId)
        .single();

      if (error || !paymentLink) {
        return {
          isValid: false,
          error: 'Lien de paiement non trouvé'
        };
      }

      // Vérifier l'expiration
      const now = new Date();
      const expiresAt = new Date(paymentLink.expires_at);

      if (now > expiresAt && paymentLink.status === 'pending') {
        return {
          isValid: false,
          error: 'Ce lien de paiement a expiré'
        };
      }

      // Vérifier le statut
      if (paymentLink.status === 'success') {
        return {
          isValid: false,
          error: 'Ce lien de paiement a déjà été payé'
        };
      }

      if (paymentLink.status === 'cancelled') {
        return {
          isValid: false,
          error: 'Ce lien de paiement a été annulé'
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      console.error('Erreur validation accès paiement:', error);
      return {
        isValid: false,
        error: 'Erreur lors de la validation du lien de paiement'
      };
    }
  }

  /**
   * Valider les permissions d'administration
   */
  static async validateAdminPermissions(userId: string): Promise<SecurityValidation> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        return {
          isValid: false,
          error: 'Profil utilisateur non trouvé'
        };
      }

      const adminRoles = ['admin', 'pdg'];
      if (!adminRoles.includes(profile.role)) {
        return {
          isValid: false,
          error: 'Permissions administrateur requises'
        };
      }

      return {
        isValid: true,
        userRole: profile.role
      };
    } catch (error) {
      console.error('Erreur validation admin:', error);
      return {
        isValid: false,
        error: 'Erreur lors de la validation des permissions administrateur'
      };
    }
  }

  /**
   * Sanitizer les données d'entrée
   */
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Supprimer les balises HTML
      .replace(/javascript:/gi, '') // Supprimer les scripts
      .substring(0, 1000); // Limiter la longueur
  }

  /**
   * Valider le taux de frais
   */
  static validateFeeRate(amount: number, feeRate: number = 0.01): boolean {
    const calculatedFee = amount * feeRate;
    const maxFee = amount * 0.05; // Maximum 5% de frais

    return calculatedFee <= maxFee && calculatedFee >= 0;
  }

  /**
   * Vérifier les limites de création de liens
   */
  static async checkCreationLimits(userId: string): Promise<SecurityValidation> {
    try {
      // Compter les liens créés aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('payment_links')
        .select('*', { count: 'exact', head: true })
        .eq('vendeur_id', userId)
        .gte('created_at', today.toISOString());

      if (error) {
        console.error('Erreur vérification limites:', error);
        return {
          isValid: true // En cas d'erreur, autoriser la création
        };
      }

      const dailyLimit = 50; // Limite de 50 liens par jour
      if (count && count >= dailyLimit) {
        return {
          isValid: false,
          error: `Limite quotidienne atteinte (${dailyLimit} liens par jour)`
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      console.error('Erreur vérification limites:', error);
      return {
        isValid: true // En cas d'erreur, autoriser la création
      };
    }
  }
}
