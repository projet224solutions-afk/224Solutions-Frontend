/**
 * SERVICE D'AUDIT COMPLET
 * Enregistre toutes les actions sensibles pour la conformité et la sécurité
 * Similaire aux systèmes d'audit d'Amazon et Alibaba
 */

import { supabase } from '@/integrations/supabase/client';

export type AuditAction =
  | 'wallet_transfer'
  | 'wallet_deposit'
  | 'wallet_withdrawal'
  | 'user_login'
  | 'user_logout'
  | 'password_change'
  | 'profile_update'
  | 'kyc_submission'
  | 'transaction_cancel'
  | 'security_alert'
  | 'admin_action'
  | 'data_export'
  | 'data_deletion';

export type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditLogEntry {
  action: AuditAction;
  severity: AuditSeverity;
  user_id?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

class AuditService {
  /**
   * Enregistre une action dans le journal d'audit
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      const userId = entry.user_id || user?.id;

      // Récupérer l'IP et user agent (côté client)
      const ipAddress = entry.ip_address || await this.getClientIP();
      const userAgent = entry.user_agent || navigator.userAgent;

      await supabase
        .from('security_audit_logs' as any)
        .insert({
          user_id: userId,
          action: entry.action,
          severity: entry.severity,
          metadata: entry.metadata || {},
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: new Date().toISOString()
        });

      // Si critique, créer une alerte de sécurité
      if (entry.severity === 'critical') {
        await this.createSecurityAlert(entry);
      }
    } catch (error) {
      console.error('Audit log error:', error);
      // Ne pas bloquer l'opération si l'audit échoue
    }
  }

  /**
   * Enregistre une transaction wallet
   */
  async logTransaction(
    userId: string,
    action: 'transfer' | 'deposit' | 'withdrawal',
    amount: number,
    recipientId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: `wallet_${action}` as AuditAction,
      severity: amount > 100000 ? 'critical' : amount > 10000 ? 'warning' : 'info',
      user_id: userId,
      metadata: {
        amount,
        recipient_id: recipientId,
        ...metadata
      }
    });
  }

  /**
   * Enregistre une connexion utilisateur
   */
  async logLogin(userId: string, success: boolean): Promise<void> {
    await this.log({
      action: 'user_login',
      severity: success ? 'info' : 'warning',
      user_id: userId,
      metadata: { success }
    });
  }

  /**
   * Enregistre un changement de mot de passe
   */
  async logPasswordChange(userId: string): Promise<void> {
    await this.log({
      action: 'password_change',
      severity: 'warning',
      user_id: userId
    });
  }

  /**
   * Enregistre une action admin
   */
  async logAdminAction(
    adminId: string,
    action: string,
    targetUserId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: 'admin_action',
      severity: 'critical',
      user_id: adminId,
      metadata: {
        admin_action: action,
        target_user_id: targetUserId,
        ...metadata
      }
    });
  }

  /**
   * Crée une alerte de sécurité pour les actions critiques
   */
  private async createSecurityAlert(entry: AuditLogEntry): Promise<void> {
    try {
      await supabase
        .from('security_alerts' as any)
        .insert({
          alert_type: entry.action,
          severity: 'high',
          message: `Action critique détectée: ${entry.action}`,
          metadata: entry.metadata,
          user_id: entry.user_id,
          acknowledged: false,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Security alert creation error:', error);
    }
  }

  /**
   * Récupère l'IP du client (approximation côté client)
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return undefined;
    }
  }

  /**
   * Récupère l'historique d'audit pour un utilisateur
   */
  async getUserAuditHistory(userId: string, limit: number = 100) {
    try {
      const { data, error } = await supabase
        .from('security_audit_logs' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get audit history error:', error);
      return [];
    }
  }
}

export const auditService = new AuditService();
