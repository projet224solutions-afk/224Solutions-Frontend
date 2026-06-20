/**
 * 🎯 HOOK COPILOTE PDG
 * Interface React pour le service d'analyse PDG
 */

import { useState } from 'react';
import { PDGCopilotService, VendorAnalysis, CustomerAnalysis, FinancialSummary } from '@/services/PDGCopilotService';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any; // Données structurées (analysis, summary, etc.)
}

export const usePDGCopilot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 Bonjour PDG ! Je suis votre Copilote IA. Donnez-moi simplement un ID (vendeur, client, transaction) et je vous fournirai une analyse complète.',
      timestamp: new Date(),
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Envoyer une requête au Copilote
   */
  const sendMessage = async (userQuery: string) => {
    // Ajouter message utilisateur
    const userMessage: ChatMessage = {
      role: 'user',
      content: userQuery,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    setLoading(true);
    setError(null);

    try {
      // Appeler l'edge function pour analyse IA
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('pdg-copilot', {
        body: { query: userQuery }
      });

      if (aiError) throw aiError;

      // Ajouter réponse assistant
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date(),
        data: aiResponse.data,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: any) {
      console.error('[usePDGCopilot] Erreur:', err);
      setError(err.message || 'Erreur lors de l\'analyse');

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Erreur: ${err.message || 'Impossible de traiter votre demande'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Analyser un vendeur directement
   */
  const analyzeVendor = async (vendorId: string) => {
    setLoading(true);
    setError(null);

    try {
      const analysis = await PDGCopilotService.analyzeVendor(vendorId);

      if (!analysis) {
        throw new Error('Vendeur non trouvé');
      }

      const message: ChatMessage = {
        role: 'assistant',
        content: formatVendorAnalysis(analysis),
        timestamp: new Date(),
        data: { type: 'vendor', analysis },
      };
      setMessages(prev => [...prev, message]);

      return analysis;

    } catch (err: any) {
      console.error('[usePDGCopilot] Erreur analyse vendeur:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Analyser un client directement
   */
  const analyzeCustomer = async (customerId: string) => {
    setLoading(true);
    setError(null);

    try {
      const analysis = await PDGCopilotService.analyzeCustomer(customerId);

      if (!analysis) {
        throw new Error('Client non trouvé');
      }

      const message: ChatMessage = {
        role: 'assistant',
        content: formatCustomerAnalysis(analysis),
        timestamp: new Date(),
        data: { type: 'customer', analysis },
      };
      setMessages(prev => [...prev, message]);

      return analysis;

    } catch (err: any) {
      console.error('[usePDGCopilot] Erreur analyse client:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtenir résumé financier
   */
  const getFinancialSummary = async (startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);

    try {
      const summary = await PDGCopilotService.getFinancialSummary(startDate, endDate);

      if (!summary) {
        throw new Error('Impossible de récupérer le résumé financier');
      }

      const message: ChatMessage = {
        role: 'assistant',
        content: formatFinancialSummary(summary),
        timestamp: new Date(),
        data: { type: 'financial', summary },
      };
      setMessages(prev => [...prev, message]);

      return summary;

    } catch (err: any) {
      console.error('[usePDGCopilot] Erreur résumé financier:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Réinitialiser la conversation
   */
  const clearMessages = () => {
    setMessages([
      {
        role: 'assistant',
        content: '👋 Conversation réinitialisée. Que puis-je analyser pour vous ?',
        timestamp: new Date(),
      }
    ]);
    setError(null);
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    analyzeVendor,
    analyzeCustomer,
    getFinancialSummary,
    clearMessages,
  };
};

/**
 * Formater l'analyse d'un vendeur en texte
 */
function formatVendorAnalysis(analysis: VendorAnalysis): string {
  const riskEmoji = analysis.risk_level === 'high' ? '🔴' : analysis.risk_level === 'medium' ? '🟡' : '🟢';

  return `
📊 **ANALYSE VENDEUR**

**Identité**
• Boutique: ${analysis.shop_name}
• Email: ${analysis.user_email}
• ID: ${analysis.vendor_id}
• Créé le: ${new Date(analysis.created_at).toLocaleDateString('fr-FR')}

**Statut**
• Actif: ${analysis.is_active ? '✅' : '❌'}
• Abonnement: ${analysis.subscription_status.toUpperCase()}
• KYC: ${analysis.kyc_status}

**Activité Commerciale**
• Produits totaux: ${analysis.total_products}
• Produits actifs: ${analysis.active_products}
• Produits bloqués: ${analysis.blocked_products}
• Commandes: ${analysis.total_orders}
• Chiffre d'affaires: ${analysis.revenue.toLocaleString()} FCFA
• Taux de paiement réussi: ${analysis.payment_success_rate}%

**Finances**
• Solde wallet: ${analysis.wallet_balance.toLocaleString()} FCFA
• Retraits totaux: ${analysis.total_withdrawals.toLocaleString()} FCFA
• Paiements échoués: ${analysis.failed_payments}

**Clients & Réputation**
• Clients totaux: ${analysis.total_customers}
• Clients récurrents: ${analysis.recurring_customers}
• Note moyenne: ${analysis.average_rating}/5 ⭐
• Avis négatifs: ${analysis.negative_reviews}
• Litiges: ${analysis.disputes}

**Logistique**
• Livraisons réussies: ${analysis.successful_deliveries}
• Livraisons échouées: ${analysis.failed_deliveries}
• Tickets support ouverts: ${analysis.support_tickets_open}
• Tickets support fermés: ${analysis.support_tickets_closed}

**Marketing**
• Campagnes actives: ${analysis.active_campaigns}

**Score & Risque**
${riskEmoji} **Niveau de risque: ${analysis.risk_level.toUpperCase()}**
• Score de confiance: ${analysis.trust_score}/100

---
💡 **Recommandations**
${generateVendorRecommendations(analysis)}
  `.trim();
}

/**
 * Formater l'analyse d'un client en texte
 */
function formatCustomerAnalysis(analysis: CustomerAnalysis): string {
  const riskEmoji = analysis.risk_level === 'high' ? '🔴' : analysis.risk_level === 'medium' ? '🟡' : '🟢';

  return `
👤 **ANALYSE CLIENT**

**Identité**
• Email: ${analysis.user_email}
• ID: ${analysis.customer_id}
• Créé le: ${new Date(analysis.created_at).toLocaleDateString('fr-FR')}

**Activité**
• Commandes totales: ${analysis.total_orders}
• Total dépensé: ${analysis.total_spent.toLocaleString()} FCFA
• Panier moyen: ${analysis.average_order_value.toLocaleString()} FCFA

**Paiements**
• Paiements réussis: ${analysis.successful_payments}
• Paiements échoués: ${analysis.failed_payments}
• Moyens de paiement: ${analysis.payment_methods.join(', ')}

**Wallet**
• Solde: ${analysis.wallet_balance.toLocaleString()} FCFA
• Transactions: ${analysis.wallet_transactions}

**Réputation**
• Litiges déposés: ${analysis.disputes_filed}
• Litiges gagnés: ${analysis.disputes_won}
• Score de fiabilité: ${analysis.reliability_score}/100

**Risque**
${riskEmoji} **Niveau de risque: ${analysis.risk_level.toUpperCase()}**
• Alertes fraude: ${analysis.fraud_alerts}

---
💡 **Recommandations**
${generateCustomerRecommendations(analysis)}
  `.trim();
}

/**
 * Formater le résumé financier
 */
function formatFinancialSummary(summary: FinancialSummary): string {
  return `
💰 **RÉSUMÉ FINANCIER**

**Période: ${summary.period}**

**Vue d'ensemble**
• Transactions: ${summary.total_transactions}
• Revenus totaux: ${summary.total_revenue.toLocaleString()} FCFA
• Paiements réussis: ${summary.successful_payments}
• Paiements échoués: ${summary.failed_payments}

**Moyens de paiement**
${summary.payment_methods.map(pm =>
  `• ${pm.method}: ${pm.count} transactions (${pm.amount.toLocaleString()} FCFA)`
).join('\n')}

**Top 10 Vendeurs**
${summary.top_vendors.map((v, i) =>
  `${i + 1}. ${v.shop_name}: ${v.revenue.toLocaleString()} FCFA`
).join('\n')}
  `.trim();
}

/**
 * Générer des recommandations pour un vendeur
 */
function generateVendorRecommendations(analysis: VendorAnalysis): string {
  const recommendations: string[] = [];

  if (analysis.payment_success_rate < 80) {
    recommendations.push('⚠️ Taux de paiement faible - Vérifier la configuration des moyens de paiement');
  }

  if (analysis.negative_reviews > 5) {
    recommendations.push('⚠️ Trop d\'avis négatifs - Contacter le vendeur pour améliorer la qualité');
  }

  if (analysis.disputes > 3) {
    recommendations.push('🔴 Nombre de litiges élevé - Investigation recommandée');
  }

  if (analysis.support_tickets_open > 5) {
    recommendations.push('⚠️ Tickets support en attente - Support à renforcer');
  }

  if (analysis.risk_level === 'high') {
    recommendations.push('🔴 RISQUE ÉLEVÉ - Surveillance accrue nécessaire');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Aucun problème majeur détecté - Vendeur performant');
  }

  return recommendations.join('\n');
}

/**
 * Générer des recommandations pour un client
 */
function generateCustomerRecommendations(analysis: CustomerAnalysis): string {
  const recommendations: string[] = [];

  if (analysis.failed_payments > 3) {
    recommendations.push('⚠️ Paiements échoués fréquents - Vérifier la solvabilité');
  }

  if (analysis.disputes_filed > 2) {
    recommendations.push('⚠️ Client litigieux - Surveillance recommandée');
  }

  if (analysis.risk_level === 'high') {
    recommendations.push('🔴 RISQUE ÉLEVÉ - Limitation des transactions recommandée');
  }

  if (analysis.total_spent > 100000 && analysis.reliability_score > 80) {
    recommendations.push('⭐ Client VIP - Offrir des avantages fidélité');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Client fiable - Aucune action requise');
  }

  return recommendations.join('\n');
}
