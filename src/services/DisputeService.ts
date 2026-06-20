import { supabase } from '@/integrations/supabase/client';

export interface CreateDisputeRequest {
  order_id: string;
  escrow_id?: string;
  vendor_id: string;
  dispute_type: 'not_received' | 'defective' | 'incomplete' | 'wrong_item' | 'other';
  description: string;
  evidence_urls?: string[];
  request_type: 'full_refund' | 'partial_refund' | 'replacement' | 'resend';
  requested_amount?: number;
}

export interface RespondToDisputeRequest {
  dispute_id: string;
  response_type: 'accept' | 'counter_offer' | 'reject';
  vendor_response: string;
  counter_offer?: any;
}

export class DisputeService {
  /**
   * Create a new dispute
   */
  static async createDispute(request: CreateDisputeRequest) {
    try {
      const { data, error } = await supabase.functions.invoke('dispute-create', {
        body: request
      });

      if (error) throw error;

      return {
        success: true,
        dispute: data.dispute
      };
    } catch (error) {
      console.error('[DisputeService] Create error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la création du litige'
      };
    }
  }

  /**
   * Vendor responds to dispute
   */
  static async respondToDispute(request: RespondToDisputeRequest) {
    try {
      const { data, error } = await supabase.functions.invoke('dispute-respond', {
        body: request
      });

      if (error) throw error;

      return {
        success: true,
        dispute: data.dispute
      };
    } catch (error) {
      console.error('[DisputeService] Respond error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la réponse au litige'
      };
    }
  }

  /**
   * Trigger AI arbitration for a dispute
   */
  static async triggerAIArbitration(dispute_id: string) {
    try {
      const { data, error } = await supabase.functions.invoke('dispute-ai-arbitrate', {
        body: { dispute_id }
      });

      if (error) throw error;

      return {
        success: true,
        ...data
      };
    } catch (error) {
      console.error('[DisputeService] AI arbitration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'arbitrage IA'
      };
    }
  }

  /**
   * Resolve a dispute (Admin/PDG only)
   */
  static async resolveDispute(
    dispute_id: string,
    resolution: string,
    resolution_amount?: number,
    apply_to_escrow: boolean = true
  ) {
    try {
      const { data, error } = await supabase.functions.invoke('dispute-resolve', {
        body: {
          dispute_id,
          resolution,
          resolution_amount,
          apply_to_escrow
        }
      });

      if (error) throw error;

      return {
        success: true,
        dispute: data.dispute
      };
    } catch (error) {
      console.error('[DisputeService] Resolve error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la résolution du litige'
      };
    }
  }

  /**
   * Get disputes for current user
   */
  static async getUserDisputes(userId: string) {
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          client:client_id(id, email),
          vendor:vendor_id(id, email),
          escrow:escrow_id(*),
          order:order_id(*)
        `)
        .or(`client_id.eq.${userId},vendor_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[DisputeService] Get user disputes error:', error);
      return [];
    }
  }

  /**
   * Get all disputes (Admin/PDG only)
   */
  static async getAllDisputes(status?: string) {
    try {
      let query = supabase
        .from('disputes')
        .select(`
          *,
          client:client_id(id, email),
          vendor:vendor_id(id, email),
          escrow:escrow_id(*),
          order:order_id(*)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[DisputeService] Get all disputes error:', error);
      return [];
    }
  }

  /**
   * Get dispute by ID with messages
   */
  static async getDisputeDetails(dispute_id: string) {
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          client:client_id(id, email),
          vendor:vendor_id(id, email),
          escrow:escrow_id(*),
          order:order_id(*),
          messages:dispute_messages(*),
          actions:dispute_actions(*)
        `)
        .eq('id', dispute_id)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[DisputeService] Get dispute details error:', error);
      return null;
    }
  }

  /**
   * Send message in dispute
   */
  static async sendDisputeMessage(
    dispute_id: string,
    message: string,
    sender_type: 'client' | 'vendor' | 'admin',
    attachments?: string[]
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id,
          sender_id: user.id,
          sender_type,
          message,
          attachments: attachments || []
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        message: data
      };
    } catch (error) {
      console.error('[DisputeService] Send message error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'envoi du message'
      };
    }
  }

  /**
   * Check for disputes that need auto-escalation
   */
  static async checkAutoEscalation() {
    try {
      const { data, error } = await supabase.rpc('auto_escalate_disputes');

      if (error) throw error;

      return {
        success: true
      };
    } catch (error) {
      console.error('[DisputeService] Auto-escalation check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la vérification automatique'
      };
    }
  }
}