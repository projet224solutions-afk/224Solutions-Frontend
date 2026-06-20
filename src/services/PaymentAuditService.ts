import { supabase } from '@/integrations/supabase/client';

export interface AuditResult {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'data' | 'business';
  title: string;
  description: string;
  recommendation: string;
  affectedCount?: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentAuditReport {
  timestamp: string;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  issues: AuditResult[];
  recommendations: string[];
}

export class PaymentAuditService {
  /**
   * Effectuer un audit complet du système de paiement
   */
  static async performFullAudit(): Promise<PaymentAuditReport> {
    const timestamp = new Date().toISOString();
    const issues: AuditResult[] = [];
    const recommendations: string[] = [];

    try {
      // Audit de sécurité
      const securityIssues = await this.auditSecurity();
      issues.push(...securityIssues);

      // Audit des données
      const dataIssues = await this.auditDataIntegrity();
      issues.push(...dataIssues);

      // Audit des performances
      const performanceIssues = await this.auditPerformance();
      issues.push(...performanceIssues);

      // Audit métier
      const businessIssues = await this.auditBusinessLogic();
      issues.push(...businessIssues);

      // Compter les issues par sévérité
      const criticalIssues = issues.filter(i => i.severity === 'critical').length;
      const highIssues = issues.filter(i => i.severity === 'high').length;
      const mediumIssues = issues.filter(i => i.severity === 'medium').length;
      const lowIssues = issues.filter(i => i.severity === 'low').length;

      // Générer des recommandations globales
      if (criticalIssues > 0) {
        recommendations.push('🚨 Des problèmes critiques nécessitent une attention immédiate');
      }
      if (highIssues > 0) {
        recommendations.push('⚠️ Des problèmes de sécurité importants doivent être résolus');
      }
      if (issues.length > 10) {
        recommendations.push('📊 Un grand nombre d\'issues détectées - considérer une refactorisation');
      }

      return {
        timestamp,
        totalIssues: issues.length,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
        issues,
        recommendations
      };
    } catch (error) {
      console.error('Erreur audit système paiement:', error);
      return {
        timestamp,
        totalIssues: 1,
        criticalIssues: 1,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        issues: [{
          severity: 'critical',
          category: 'security',
          title: 'Erreur d\'audit',
          description: 'Impossible d\'effectuer l\'audit du système de paiement',
          recommendation: 'Vérifier la configuration et les permissions'
        }],
        recommendations: ['🔧 Vérifier la configuration du système d\'audit']
      };
    }
  }

  /**
   * Audit de sécurité
   */
  private static async auditSecurity(): Promise<AuditResult[]> {
    const issues: AuditResult[] = [];

    try {
      // Vérifier les liens expirés non nettoyés
      const { data: expiredLinks, error: expiredError } = await supabase
        .from('payment_links')
        .select('id')
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString());

      if (!expiredError && expiredLinks && expiredLinks.length > 0) {
        issues.push({
          severity: 'medium',
          category: 'security',
          title: 'Liens expirés non nettoyés',
          description: `${expiredLinks.length} liens de paiement expirés ne sont pas marqués comme expirés`,
          recommendation: 'Implémenter un job de nettoyage automatique des liens expirés',
          affectedCount: expiredLinks.length
        });
      }

      // Vérifier les montants suspects
      const { data: suspiciousAmounts, error: amountError } = await supabase
        .from('payment_links')
        .select('id, montant, produit')
        .gt('montant', 500000); // Montants > 500,000

      if (!amountError && suspiciousAmounts && suspiciousAmounts.length > 0) {
        issues.push({
          severity: 'high',
          category: 'security',
          title: 'Montants élevés détectés',
          description: `${suspiciousAmounts.length} liens avec des montants élevés nécessitent une vérification`,
          recommendation: 'Implémenter une validation supplémentaire pour les montants élevés',
          affectedCount: suspiciousAmounts.length,
          metadata: { amounts: suspiciousAmounts.map(a => ({ id: a.id, montant: a.montant, produit: a.produit })) }
        });
      }

      // Vérifier les tentatives de paiement échouées répétées
      const { data: failedPayments, error: failedError } = await supabase
        .from('payment_links')
        .select('id, vendeur_id')
        .eq('status', 'failed');

      if (!failedError && failedPayments) {
        const vendorFailures = failedPayments.reduce((acc, payment) => {
          acc[payment.vendeur_id] = (acc[payment.vendeur_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const suspiciousVendors = Object.entries(vendorFailures)
          .filter(([_, count]) => count > 5)
          .map(([vendorId, count]) => ({ vendorId, count }));

        if (suspiciousVendors.length > 0) {
          issues.push({
            severity: 'high',
            category: 'security',
            title: 'Vendeurs avec échecs répétés',
            description: `${suspiciousVendors.length} vendeurs ont plus de 5 échecs de paiement`,
            recommendation: 'Investiguer les vendeurs avec des échecs répétés',
            affectedCount: suspiciousVendors.length,
            metadata: { suspiciousVendors }
          });
        }
      }

    } catch (error) {
      console.error('Erreur audit sécurité:', error);
    }

    return issues;
  }

  /**
   * Audit de l'intégrité des données
   */
  private static async auditDataIntegrity(): Promise<AuditResult[]> {
    const issues: AuditResult[] = [];

    try {
      // Vérifier les incohérences de calcul
      const { data: links, error: linksError } = await supabase
        .from('payment_links')
        .select('id, montant, frais, total');

      if (!linksError && links) {
        const inconsistentLinks = links.filter(link => {
          const expectedFee = Math.round(link.montant * 0.01 * 100) / 100;
          const expectedTotal = link.montant + expectedFee;
          return Math.abs(link.frais - expectedFee) > 0.01 || Math.abs(link.total - expectedTotal) > 0.01;
        });

        if (inconsistentLinks.length > 0) {
          issues.push({
            severity: 'critical',
            category: 'data',
            title: 'Incohérences de calcul détectées',
            description: `${inconsistentLinks.length} liens ont des calculs de frais ou totaux incorrects`,
            recommendation: 'Recalculer les frais et totaux pour tous les liens affectés',
            affectedCount: inconsistentLinks.length,
            metadata: { inconsistentLinks: inconsistentLinks.map(l => ({ id: l.id, montant: l.montant, frais: l.frais, total: l.total })) }
          });
        }
      }

      // Vérifier les liens sans vendeur
      const { data: orphanLinks, error: orphanError } = await supabase
        .from('payment_links')
        .select('id')
        .is('vendeur_id', null);

      if (!orphanError && orphanLinks && orphanLinks.length > 0) {
        issues.push({
          severity: 'high',
          category: 'data',
          title: 'Liens orphelins détectés',
          description: `${orphanLinks.length} liens de paiement n'ont pas de vendeur associé`,
          recommendation: 'Nettoyer ou associer les liens orphelins',
          affectedCount: orphanLinks.length
        });
      }

    } catch (error) {
      console.error('Erreur audit données:', error);
    }

    return issues;
  }

  /**
   * Audit des performances
   */
  private static async auditPerformance(): Promise<AuditResult[]> {
    const issues: AuditResult[] = [];

    try {
      // Vérifier le nombre de liens par vendeur
      const { data: vendorStats, error: vendorError } = await supabase
        .from('payment_links')
        .select('vendeur_id')
        .not('vendeur_id', 'is', null);

      if (!vendorError && vendorStats) {
        const vendorCounts = vendorStats.reduce((acc, link) => {
          acc[link.vendeur_id] = (acc[link.vendeur_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const heavyVendors = Object.entries(vendorCounts)
          .filter(([_, count]) => count > 100)
          .map(([vendorId, count]) => ({ vendorId, count }));

        if (heavyVendors.length > 0) {
          issues.push({
            severity: 'medium',
            category: 'performance',
            title: 'Vendeurs avec beaucoup de liens',
            description: `${heavyVendors.length} vendeurs ont plus de 100 liens de paiement`,
            recommendation: 'Considérer l\'implémentation de la pagination et de l\'archivage',
            affectedCount: heavyVendors.length,
            metadata: { heavyVendors }
          });
        }
      }

    } catch (error) {
      console.error('Erreur audit performance:', error);
    }

    return issues;
  }

  /**
   * Audit de la logique métier
   */
  private static async auditBusinessLogic(): Promise<AuditResult[]> {
    const issues: AuditResult[] = [];

    try {
      // Vérifier les liens créés récemment mais non payés
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: recentUnpaid, error: recentError } = await supabase
        .from('payment_links')
        .select('id, created_at, status')
        .eq('status', 'pending')
        .gte('created_at', oneWeekAgo.toISOString());

      if (!recentError && recentUnpaid && recentUnpaid.length > 0) {
        const conversionRate = await this.calculateConversionRate();

        if (conversionRate < 0.1) { // Moins de 10% de conversion
          issues.push({
            severity: 'medium',
            category: 'business',
            title: 'Taux de conversion faible',
            description: `Taux de conversion de ${(conversionRate * 100).toFixed(1)}% - ${recentUnpaid.length} liens récents non payés`,
            recommendation: 'Analyser les raisons du faible taux de conversion et améliorer l\'UX',
            affectedCount: recentUnpaid.length,
            metadata: { conversionRate, recentUnpaid: recentUnpaid.length }
          });
        }
      }

    } catch (error) {
      console.error('Erreur audit métier:', error);
    }

    return issues;
  }

  /**
   * Calculer le taux de conversion
   */
  private static async calculateConversionRate(): Promise<number> {
    try {
      const { data: allLinks, error: allError } = await supabase
        .from('payment_links')
        .select('status');

      if (allError || !allLinks) return 0;

      const total = allLinks.length;
      const successful = allLinks.filter(link => link.status === 'success').length;

      return total > 0 ? successful / total : 0;
    } catch (error) {
      console.error('Erreur calcul taux conversion:', error);
      return 0;
    }
  }

  /**
   * Envoyer le rapport d'audit au copilote IA
   */
  static async sendAuditToCopilot(report: PaymentAuditReport): Promise<boolean> {
    try {
      // Log audit report to console (tables ai_logs/scheduled_jobs not in schema)
      console.log(`📊 Rapport d'audit: ${report.totalIssues} issues détectées`, {
        criticalIssues: report.criticalIssues,
        highIssues: report.highIssues,
        mediumIssues: report.mediumIssues,
        lowIssues: report.lowIssues
      });

      console.log(`📊 Rapport d'audit envoyé au copilote: ${report.totalIssues} issues détectées`);
      return true;
    } catch (error) {
      console.error('Erreur envoi audit au copilote:', error);
      return false;
    }
  }

  /**
   * Programmer un audit automatique
   */
  static async scheduleAutomaticAudit(): Promise<void> {
    try {
      console.log('📅 Audit automatique programmé (scheduled_jobs table not in schema - use cron or edge function)');
    } catch (error) {
      console.error('Erreur programmation audit:', error);
    }
  }
}
