/**
 * 🔗 Service de Gestion des Invitations d'Agents - 224Solutions
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AgentInvitation {
  id: string;
  agent_id: string;
  pdg_id: string;
  invitation_token: string;
  email: string;
  phone?: string;
  status: 'pending' | 'accepted' | 'expired';
  sent_at: string;
  accepted_at?: string;
  expires_at: string;
}

export class AgentInvitationService {
  private static instance: AgentInvitationService;

  private constructor() {}

  static getInstance(): AgentInvitationService {
    if (!AgentInvitationService.instance) {
      AgentInvitationService.instance = new AgentInvitationService();
    }
    return AgentInvitationService.instance;
  }

  /**
   * Créer et envoyer une invitation à un agent
   */
  async createAndSendInvitation(data: {
    agentId: string;
    pdgId: string;
    agentEmail: string;
    agentName: string;
    agentPhone?: string;
    pdgName: string;
    sendMethod?: 'email' | 'sms' | 'both';
  }): Promise<{ success: boolean; invitationLink?: string; error?: string }> {
    try {
      // 1. Générer le token d'invitation
      const { data: tokenData, error: tokenError } = await supabase.rpc(
        'generate_invitation_token'
      );

      if (tokenError || !tokenData) {
        throw new Error('Erreur lors de la génération du token');
      }

      const token = tokenData as string;

      // 2. Créer l'invitation dans la base de données
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans 7 jours

      const { data: _invitation, error: invitationError } = await supabase
        .from('agent_invitations')
        .insert({
          agent_id: data.agentId,
          pdg_id: data.pdgId,
          invitation_token: token,
          email: data.agentEmail,
          phone: data.agentPhone,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (invitationError) throw invitationError;

      // 3. Créer le lien d'invitation
      const invitationLink = `${window.location.origin}/agent/activate/${token}`;

      const sendMethod = data.sendMethod || 'email';

      // 4. Envoyer l'email si demandé
      if (sendMethod === 'email' || sendMethod === 'both') {
        const { error: emailError } = await supabase.functions.invoke(
          'send-agent-invitation',
          {
            body: {
              agentName: data.agentName,
              agentEmail: data.agentEmail,
              invitationLink,
              pdgName: data.pdgName,
            },
          }
        );

        if (emailError) {
          console.error('Erreur envoi email:', emailError);
          if (sendMethod === 'email') {
            toast.warning('Invitation créée, mais email non envoyé');
          }
        } else {
          if (sendMethod === 'email') {
            toast.success(`✅ Email envoyé à ${data.agentEmail}`);
          }
        }
      }

      // 5. Envoyer le SMS si demandé
      if ((sendMethod === 'sms' || sendMethod === 'both') && data.agentPhone) {
        const smsMessage = `🎉 ${data.pdgName} vous invite à rejoindre 224Solutions!\n\n` +
          `Activez votre compte agent ici:\n${invitationLink}\n\n` +
          `Ce lien expire dans 7 jours.`;

        const { error: smsError } = await supabase.functions.invoke(
          'send-sms',
          {
            body: {
              to: data.agentPhone,
              message: smsMessage,
            },
          }
        );

        if (smsError) {
          console.error('Erreur envoi SMS:', smsError);
          if (sendMethod === 'sms') {
            toast.warning('Invitation créée, mais SMS non envoyé');
          }
        } else {
          if (sendMethod === 'sms') {
            toast.success(`✅ SMS envoyé au ${data.agentPhone}`);
          } else if (sendMethod === 'both') {
            toast.success(`✅ Email et SMS envoyés`);
          }
        }
      }

      // 6. Message de succès pour both
      if (sendMethod === 'both') {
        toast.success(`✅ Invitation envoyée par email et SMS`);
      }

      return {
        success: true,
        invitationLink,
      };
    } catch (error) {
      console.error('❌ Erreur création invitation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Vérifier la validité d'une invitation
   */
  async validateInvitation(token: string): Promise<{
    valid: boolean;
    invitation?: AgentInvitation;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('agent_invitations')
        .select(`
          *,
          agents_management!inner(name, email, role, permissions)
        `)
        .eq('invitation_token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        return { valid: false, error: 'Invitation non trouvée' };
      }

      // Vérifier si l'invitation a expiré
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        await supabase
          .from('agent_invitations')
          .update({ status: 'expired' })
          .eq('id', data.id);

        return { valid: false, error: 'Invitation expirée' };
      }

      return {
        valid: true,
        invitation: data as AgentInvitation,
      };
    } catch (error) {
      console.error('❌ Erreur validation invitation:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Accepter une invitation et activer le compte agent
   */
  async acceptInvitation(
    token: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Valider l'invitation
      const validation = await this.validateInvitation(token);
      if (!validation.valid || !validation.invitation) {
        return { success: false, error: validation.error };
      }

      // 2. Mettre à jour l'agent avec le user_id
      const { error: updateError } = await supabase
        .from('agents_management')
        .update({
          user_id: userId,
          is_active: true,
        })
        .eq('id', validation.invitation.agent_id);

      if (updateError) throw updateError;

      // 3. Marquer l'invitation comme acceptée
      const { error: invitationError } = await supabase
        .from('agent_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', validation.invitation.id);

      if (invitationError) throw invitationError;

      toast.success('🎉 Compte agent activé avec succès!');
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur acceptation invitation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Obtenir toutes les invitations d'un PDG
   */
  async getInvitationsByPDG(pdgId: string): Promise<AgentInvitation[]> {
    try {
      const { data, error } = await supabase
        .from('agent_invitations')
        .select('*')
        .eq('pdg_id', pdgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AgentInvitation[];
    } catch (error) {
      console.error('❌ Erreur récupération invitations:', error);
      return [];
    }
  }
}

export const agentInvitationService = AgentInvitationService.getInstance();
