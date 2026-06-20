/**
 * MFA SERVICE - 224SOLUTIONS
 * Service complet de Multi-Factor Authentication
 * Supporte TOTP, SMS, Email, et WebAuthn (biométrie)
 */

import { supabase } from '@/integrations/supabase/client';

// Cast du client pour les tables MFA non définies dans le schéma
const mfaDb = supabase as any;

// Types
export type MFAMethod = 'totp' | 'sms' | 'email' | 'webauthn';
export type MFAStatus = 'not_enrolled' | 'pending' | 'enrolled' | 'required';

export interface MFAFactor {
  id: string;
  method: MFAMethod;
  friendly_name: string;
  created_at: string;
  last_used_at?: string;
  is_primary: boolean;
  verified: boolean;
  phone_number?: string;
  email?: string;
}

export interface MFAEnrollmentResult {
  success: boolean;
  factor_id?: string;
  totp_uri?: string;
  qr_code?: string;
  backup_codes?: string[];
  error?: string;
}

export interface MFAVerifyResult {
  success: boolean;
  session_verified?: boolean;
  error?: string;
}

export interface MFAChallenge {
  id: string;
  factor_id: string;
  method: MFAMethod;
  expires_at: string;
}

// Configuration MFA par type d'utilisateur
export const MFA_REQUIREMENTS: Record<string, {
  required: boolean;
  methods: MFAMethod[];
  grace_period_days?: number;
}> = {
  // MFA obligatoire pour les vendeurs
  vendor: {
    required: true,
    methods: ['totp', 'sms'],
    grace_period_days: 7
  },
  // MFA obligatoire pour les agents
  agent: {
    required: true,
    methods: ['totp', 'sms', 'webauthn']
  },
  // MFA obligatoire pour les administrateurs
  admin: {
    required: true,
    methods: ['totp', 'webauthn']
  },
  // MFA recommandé pour les clients
  customer: {
    required: false,
    methods: ['totp', 'sms', 'email']
  },
  // MFA obligatoire pour les chauffeurs
  driver: {
    required: true,
    methods: ['sms'],
    grace_period_days: 3
  }
};

/**
 * Classe principale du service MFA
 */
export class MFAService {
  private userId: string | null = null;

  /**
   * Initialiser le service avec l'utilisateur courant
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  /**
   * Obtenir le statut MFA de l'utilisateur
   */
  async getMFAStatus(userType: string): Promise<{
    status: MFAStatus;
    factors: MFAFactor[];
    requiresSetup: boolean;
    gracePeriodEnds?: string;
  }> {
    if (!this.userId) throw new Error('MFA Service not initialized');

    // Récupérer les facteurs MFA depuis Supabase Auth
    const { data: authFactors } = await supabase.auth.mfa.listFactors();

    // Récupérer les facteurs personnalisés (SMS, email)
    const { data: customFactors } = await (supabase as any)
      .from('mfa_factors')
      .select('*')
      .eq('user_id', this.userId)
      .eq('verified', true);

    const factors: MFAFactor[] = [
      // Facteurs TOTP de Supabase
      ...(authFactors?.totp || []).map(f => ({
        id: f.id,
        method: 'totp' as MFAMethod,
        friendly_name: f.friendly_name || 'Authenticator',
        created_at: f.created_at,
        last_used_at: f.updated_at,
        is_primary: true,
        verified: f.status === 'verified'
      })),
      // Facteurs personnalisés
      ...(customFactors || []).map(f => ({
        id: f.id,
        method: f.method as MFAMethod,
        friendly_name: f.friendly_name,
        created_at: f.created_at,
        last_used_at: f.last_used_at,
        is_primary: f.is_primary,
        verified: f.verified,
        phone_number: f.phone_number,
        email: f.email
      }))
    ];

    const requirements = MFA_REQUIREMENTS[userType] || MFA_REQUIREMENTS.customer;
    const hasVerifiedFactor = factors.some(f => f.verified);

    let status: MFAStatus = 'not_enrolled';
    if (hasVerifiedFactor) {
      status = 'enrolled';
    } else if (factors.length > 0) {
      status = 'pending';
    }

    // Vérifier la période de grâce
    let gracePeriodEnds: string | undefined;
    if (requirements.required && requirements.grace_period_days && !hasVerifiedFactor) {
      const { data: user } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', this.userId)
        .single();

      if (user) {
        const graceEnd = new Date(user.created_at);
        graceEnd.setDate(graceEnd.getDate() + requirements.grace_period_days);
        gracePeriodEnds = graceEnd.toISOString();
      }
    }

    return {
      status,
      factors,
      requiresSetup: requirements.required && !hasVerifiedFactor,
      gracePeriodEnds
    };
  }

  /**
   * Enrôler un nouveau facteur TOTP
   */
  async enrollTOTP(friendlyName: string = 'Authenticator'): Promise<MFAEnrollmentResult> {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName
      });

      if (error) throw error;

      // Générer les codes de backup
      const backupCodes = this.generateBackupCodes();
      await this.saveBackupCodes(data.id, backupCodes);

      return {
        success: true,
        factor_id: data.id,
        totp_uri: data.totp.uri,
        qr_code: data.totp.qr_code,
        backup_codes: backupCodes
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enrôler un facteur SMS via Supabase Auth natif (Twilio)
   */
  async enrollSMS(phoneNumber: string): Promise<MFAEnrollmentResult> {
    try {
      const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.replace(/\s/g, '') : `+224${phoneNumber.replace(/\s/g, '')}`;
      if (!/^\+[0-9]{8,15}$/.test(cleanPhone)) {
        throw new Error('Numéro de téléphone invalide');
      }

      const { data, error } = await (supabase.auth.mfa as any).enroll({
        factorType: 'phone',
        phone: cleanPhone,
      });

      if (error) throw error;

      return {
        success: true,
        factor_id: data.id
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enrôler un facteur Email
   */
  async enrollEmail(email: string): Promise<MFAEnrollmentResult> {
    if (!this.userId) throw new Error('MFA Service not initialized');

    try {
      // Valider l'email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Email invalide');
      }

      // Créer le facteur
      const { data, error } = await mfaDb
        .from('mfa_factors')
        .insert({
          user_id: this.userId,
          method: 'email',
          friendly_name: 'Email',
          email,
          verified: false
        })
        .select()
        .single();

      if (error) throw error;

      // Envoyer un code de vérification
      await this.sendEmailCode(data.id, email);

      return {
        success: true,
        factor_id: data.id
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Vérifier un facteur TOTP
   */
  async verifyTOTP(factorId: string, code: string): Promise<MFAVerifyResult> {
    try {
      // Créer un challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) throw challengeError;

      // Vérifier le code
      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code
      });

      if (error) throw error;

      return {
        success: true,
        session_verified: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Vérifier un facteur SMS (Supabase natif) ou Email (table custom)
   */
  async verifyCode(factorId: string, code: string): Promise<MFAVerifyResult> {
    try {
      // Tenter via Supabase Auth natif (phone MFA)
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (!challengeError && challenge) {
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        });
        if (verifyError) throw verifyError;
        return { success: true, session_verified: true };
      }

      // Fallback: table custom (email MFA)
      const { data: challengeRow, error: fetchError } = await mfaDb
        .from('mfa_challenges')
        .select('*')
        .eq('factor_id', factorId)
        .eq('code', code)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (fetchError || !challengeRow) throw new Error('Code invalide ou expiré');

      await mfaDb.from('mfa_factors').update({ verified: true, last_used_at: new Date().toISOString() }).eq('id', factorId);
      await mfaDb.from('mfa_challenges').delete().eq('id', (challengeRow as any).id);

      return { success: true, session_verified: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Créer un challenge MFA
   */
  async createChallenge(factorId: string): Promise<{ success: boolean; challenge?: MFAChallenge; error?: string }> {
    try {
      // Récupérer le facteur
      const { data: factor } = await mfaDb
        .from('mfa_factors')
        .select('*')
        .eq('id', factorId)
        .single();

      if (!factor) {
        throw new Error('Facteur non trouvé');
      }

      // Pour TOTP, utiliser Supabase Auth
      if (factor.method === 'totp') {
        const { data, error } = await supabase.auth.mfa.challenge({ factorId });
        if (error) throw error;

        return {
          success: true,
          challenge: {
            id: data.id,
            factor_id: factorId,
            method: 'totp',
            expires_at: String(data.expires_at)
          }
        };
      }

      // Pour SMS/Email, créer un challenge personnalisé
      const code = this.generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      const { data: challengeData, error } = await mfaDb
        .from('mfa_challenges')
        .insert({
          factor_id: factorId,
          code,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      // Envoyer le code
      if (factor.method === 'sms' && factor.phone_number) {
        await this.sendSMSCode(factorId, factor.phone_number, code);
      } else if (factor.method === 'email' && factor.email) {
        await this.sendEmailCode(factorId, factor.email, code);
      }

      return {
        success: true,
        challenge: {
          id: challengeData?.id || '',
          factor_id: factorId,
          method: (factor as any)?.method as MFAMethod || 'sms',
          expires_at: expiresAt
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Vérifier un code de backup
   */
  async verifyBackupCode(code: string): Promise<MFAVerifyResult> {
    if (!this.userId) throw new Error('MFA Service not initialized');

    try {
      const { data, error } = await mfaDb
        .from('mfa_backup_codes')
        .select('*')
        .eq('user_id', this.userId)
        .eq('code', code.toUpperCase())
        .eq('used', false)
        .single();

      if (error || !data) {
        throw new Error('Code de récupération invalide ou déjà utilisé');
      }

      // Marquer comme utilisé
      await mfaDb
        .from('mfa_backup_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', (data as any)?.id);

      return {
        success: true,
        session_verified: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Désactiver un facteur MFA
   */
  async unenrollFactor(factorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Vérifier si c'est un facteur TOTP Supabase
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const isTOTP = factors?.totp?.some(f => f.id === factorId);

      if (isTOTP) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId });
        if (error) throw error;
      } else {
        // Facteur personnalisé
        const { error } = await mfaDb
          .from('mfa_factors')
          .delete()
          .eq('id', factorId);
        if (error) throw error;
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Générer de nouveaux codes de backup
   */
  async regenerateBackupCodes(factorId: string): Promise<{ success: boolean; codes?: string[]; error?: string }> {
    if (!this.userId) throw new Error('MFA Service not initialized');

    try {
      // Supprimer les anciens codes
      await mfaDb
        .from('mfa_backup_codes')
        .delete()
        .eq('user_id', this.userId);

      // Générer de nouveaux codes
      const codes = this.generateBackupCodes();
      await this.saveBackupCodes(factorId, codes);

      return { success: true, codes };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Méthodes privées

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Array.from({ length: 8 }, () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('');
      codes.push(code);
    }
    return codes;
  }

  private async saveBackupCodes(factorId: string, codes: string[]): Promise<void> {
    if (!this.userId) return;

    const backupEntries = codes.map(code => ({
      user_id: this.userId!,
      factor_id: factorId,
      code,
      used: false
    }));

    await mfaDb
      .from('mfa_backup_codes')
      .insert(backupEntries);
  }

  private async sendSMSCode(factorId: string, phoneNumber: string, code?: string): Promise<void> {
    const otp = code || this.generateOTP();

    // Sauvegarder le challenge
    if (!code) {
      await mfaDb
        .from('mfa_challenges')
        .insert({
          factor_id: factorId,
          code: otp,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        });
    }

    // Appeler la Edge Function pour envoyer le SMS
    await supabase.functions.invoke('send-sms', {
      body: {
        to: phoneNumber,
        message: `Votre code de vérification 224Solutions: ${otp}. Valide 5 minutes.`
      }
    });
  }

  private async sendEmailCode(factorId: string, email: string, code?: string): Promise<void> {
    const otp = code || this.generateOTP();

    // Sauvegarder le challenge
    if (!code) {
      await mfaDb
        .from('mfa_challenges')
        .insert({
          factor_id: factorId,
          code: otp,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        });
    }

    // Appeler la Edge Function pour envoyer l'email OTP
    await supabase.functions.invoke('send-otp-email', {
      body: {
        email: email,
        otp: otp,
        userType: 'agent',
        userName: email
      }
    });
  }
}

// Instance singleton
export const mfaService = new MFAService();

export default mfaService;
