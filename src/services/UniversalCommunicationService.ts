/**
 * 🎯 SERVICE DE COMMUNICATION UNIVERSEL - 224SOLUTIONS
 * Service professionnel pour la gestion des communications
 * Version: 2.0.0
 *
 * Features:
 * - Gestion des conversations (création, récupération)
 * - Gestion des messages (texte, fichiers, audio, vidéo)
 * - Gestion des appels (audio, vidéo)
 * - Notifications et audit
 * - Recherche utilisateurs
 * - Subscriptions temps réel
 */

import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import type {
  Message,
  Conversation,
  Call,
  CommunicationNotification,
  UserProfile,
  MessageType,
} from '@/types/communication.types';
import {
  buildPhoneSearchTerms,
  parseUserSearchInput,
  sanitizePostgrestSearchTerm,
  stripPhoneToDigits,
} from '@/lib/communication/userSearch';
import {
  resolveCommunicationFileUrl,
  signMessagesFileUrls,
} from '@/lib/communication/fileUrls';

// Re-export des types pour compatibilité
export type {
  Message,
  Conversation,
  Call,
  CommunicationNotification,
  UserProfile,
};

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_MESSAGE_LENGTH = 5000;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const STORAGE_BUCKET = 'communication-files';

// ============================================================================
// HELPERS
// ============================================================================

function isDirectConversation(conversationId: string): boolean {
  return conversationId.startsWith('direct_');
}

function extractRecipientFromDirectId(conversationId: string): string {
  return conversationId.replace('direct_', '');
}

function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function getFileType(mimeType: string, fileName: string): MessageType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/') || fileName.startsWith('audio_') || fileName.startsWith('vocal_')) return 'audio';
  return 'file';
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class UniversalCommunicationService {

  // ==========================================================================
  // CONVERSATIONS
  // ==========================================================================

  /**
   * Récupérer toutes les conversations de l'utilisateur
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    if (!validateUUID(userId)) {
      const error = new Error('ID utilisateur invalide');
      console.error('[Communication] ❌ Validation failed:', { userId });
      throw error;
    }

    try {
      console.log('[Communication] 📥 Chargement conversations pour:', userId);

      // Récupérer les conversations avec conversation_id (avec timeout)
      const normalConvsPromise = Promise.race([
        supabase.rpc('get_user_conversations', { p_user_id: userId }),
        new Promise<{ data: null; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout get_user_conversations')), 10000)
        )
      ]);

      const { data: normalConvs, error: convError } = await normalConvsPromise;

      if (convError) {
        console.error('[Communication] ❌ Erreur RPC get_user_conversations:', {
          error: convError,
          userId,
          message: convError.message,
          code: convError.code
        });
        throw new Error(`Échec chargement conversations: ${convError.message || 'Erreur inconnue'}`);
      }

      // Récupérer les conversations directes (sans conversation_id) - non bloquant
      let directConvs: any[] = [];
      try {
        const directConvsPromise = Promise.race([
          supabase.rpc('get_user_direct_message_conversations', { p_user_id: userId }),
          new Promise<{ data: null; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout direct messages')), 10000)
          )
        ]);

        const { data, error: directError } = await directConvsPromise;

        if (directError) {
          console.warn('[Communication] ⚠️ Erreur RPC direct messages (non-bloquant):', directError.message);
        } else {
          directConvs = data || [];
        }
      } catch (directErr) {
        console.warn('[Communication] ⚠️ Conversations directes non disponibles:', directErr);
      }

      // Fusionner et trier par date avec validation
      const allConversations = [
        ...(Array.isArray(normalConvs) ? normalConvs : []),
        ...(Array.isArray(directConvs) ? directConvs : [])
      ].filter(conv => conv && conv.id) // Filtrer les conversations invalides
      .sort((a, b) => {
        try {
          const dateA = new Date(a.last_message_at || a.created_at);
          const dateB = new Date(b.last_message_at || b.created_at);
          return dateB.getTime() - dateA.getTime();
        } catch (err) {
          console.warn('[Communication] ⚠️ Erreur tri conversation:', err);
          return 0;
        }
      });

      console.log('[Communication] ✅ Conversations chargées:', {
        total: allConversations.length,
        normal: Array.isArray(normalConvs) ? normalConvs.length : 0,
        direct: directConvs.length
      });

      return allConversations as unknown as Conversation[];
    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur inconnue';
      console.error('[Communication] ❌ Erreur critique getConversations:', {
        error: errorMessage,
        userId,
        stack: error?.stack
      });
      throw new Error(`Impossible de charger les conversations: ${errorMessage}`);
    }
  }

  /**
   * Créer une nouvelle conversation
   */
  async createConversation(
    participantIds: string[],
    creatorId: string,
    name?: string,
    type: 'private' | 'group' = 'private'
  ): Promise<Conversation> {
    if (!validateUUID(creatorId)) {
      throw new Error('ID créateur invalide');
    }

    for (const id of participantIds) {
      if (!validateUUID(id)) {
        throw new Error(`ID participant invalide: ${id}`);
      }
    }

    try {
      console.log('[Communication] Création conversation:', { participantIds, creatorId, type });

      // Créer la conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type,
          name: name || null,
          creator_id: creatorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (convError) throw convError;

      // Ajouter les participants
      const allParticipantIds = Array.from(new Set([creatorId, ...participantIds]));
      const participants = allParticipantIds.map((userId, index) => ({
        conversation_id: conversation.id,
        user_id: userId,
        role: index === 0 ? 'admin' : 'member',
        joined_at: new Date().toISOString()
      }));

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (participantsError) {
        // Rollback: supprimer la conversation
        await supabase.from('conversations').delete().eq('id', conversation.id);
        throw participantsError;
      }

      // Log audit
      await this.logAudit(creatorId, 'conversation_created', conversation.id);

      // Récupérer la conversation complète
      return await this.getConversationById(conversation.id);
    } catch (error) {
      console.error('[Communication] Erreur createConversation:', error);
      throw error;
    }
  }

  /**
   * Récupérer une conversation par ID
   */
  async getConversationById(conversationId: string): Promise<Conversation> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        throw new Error('Non authentifié');
      }

      const conversations = await this.getConversations(session.session.user.id);
      const conversation = conversations.find(c => c.id === conversationId);

      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      return conversation;
    } catch (error) {
      console.error('[Communication] Erreur getConversationById:', error);
      throw error;
    }
  }

  // ==========================================================================
  // MESSAGES
  // ==========================================================================

  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    try {
      console.log('[Communication] Chargement messages pour:', conversationId);

      let query;

      if (isDirectConversation(conversationId)) {
        // Conversation directe
        const otherUserId = extractRecipientFromDirectId(conversationId);
        const { data: session } = await supabase.auth.getSession();

        if (!session?.session?.user) {
          throw new Error('Non authentifié');
        }

        const currentUserId = session.session.user.id;

        query = supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey (
              id, first_name, last_name, email, avatar_url
            )
          `)
          .is('conversation_id', null)
          .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`)
          .order('created_at', { ascending: false })
          .limit(limit);
      } else {
        // Conversation normale
        query = supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey (
              id, first_name, last_name, email, avatar_url
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const messages = (data || []).reverse();
      console.log('[Communication] Messages chargés:', messages.length);

      // 🔐 Signer les pièces jointes (bucket privé)
      const signed = await signMessagesFileUrls(messages as Message[]);
      return signed as Message[];
    } catch (error) {
      console.error('[Communication] Erreur getMessages:', error);
      throw error;
    }
  }

  /**
   * Envoyer un message texte
   */
  async sendTextMessage(
    conversationId: string,
    senderId: string,
    content: string
  ): Promise<Message> {
    // Validation stricte avec sanitization
    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new Error('Le message ne peut pas être vide');
    }

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères (actuellement: ${trimmedContent.length})`);
    }

    if (!validateUUID(senderId)) {
      throw new Error('ID expéditeur invalide');
    }

    // Sanitize content: enlever caractères dangereux
    const sanitizedContent = trimmedContent
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Enlever caractères de contrôle
      .substring(0, MAX_MESSAGE_LENGTH); // Limite stricte

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log('[Communication] 📤 Envoi message texte:', {
          conversationId,
          senderId,
          length: sanitizedContent.length,
          retry: retryCount
        });

        let recipientId: string;
        let dbConversationId: string | null;

        if (isDirectConversation(conversationId)) {
          recipientId = extractRecipientFromDirectId(conversationId);
          if (!validateUUID(recipientId)) {
            throw new Error('ID destinataire invalide dans conversation directe');
          }
          dbConversationId = null;
        } else {
          if (!validateUUID(conversationId)) {
            throw new Error('ID conversation invalide');
          }
          const conversation = await this.getConversationById(conversationId);
          const recipient = conversation.participants.find(p => p.user_id !== senderId);
          if (!recipient) {
            throw new Error('Aucun destinataire trouvé dans la conversation');
          }
          recipientId = recipient.user_id;
          dbConversationId = conversationId;
        }

        const { data, error } = await supabase
          .from('messages')
          .insert({
            conversation_id: dbConversationId,
            sender_id: senderId,
            recipient_id: recipientId,
            content: sanitizedContent,
            type: 'text',
            status: 'sent',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('[Communication] ❌ Erreur insertion message:', {
            error: error.message,
            code: error.code,
            retry: retryCount
          });
          throw error;
        }

        // Audit log non-bloquant
        this.logAudit(senderId, 'message_sent', data.id).catch(err =>
          console.warn('[Communication] ⚠️ Audit log failed (non-bloquant):', err)
        );

        console.log('[Communication] ✅ Message envoyé:', { id: data.id, retry: retryCount });
        return data as Message;

      } catch (error: any) {
        retryCount++;

        // Erreurs non-retriables
        if (error.message?.includes('invalide') || error.code === '23505') {
          console.error('[Communication] ❌ Erreur non-retriable:', error.message);
          throw error;
        }

        if (retryCount >= maxRetries) {
          console.error('[Communication] ❌ Échec après', maxRetries, 'tentatives:', error);
          throw new Error(`Échec envoi message après ${maxRetries} tentatives: ${error.message}`);
        }

        // Attendre avant retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`[Communication] ⏳ Retry ${retryCount}/${maxRetries} dans ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Échec envoi message: nombre max de tentatives atteint');
  }

  /**
   * Envoyer un fichier
   */
  async sendFileMessage(
    conversationId: string,
    senderId: string,
    file: File,
    type?: 'image' | 'video' | 'file' | 'audio'
  ): Promise<Message> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Le fichier ne peut pas dépasser ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    try {
      console.log('[Communication] Envoi fichier:', {
        conversationId,
        senderId,
        fileName: file.name,
        fileSize: file.size
      });

      // Déterminer le type de fichier
      const fileType = type || getFileType(file.type, file.name);

      // Upload du fichier
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
      const filePath = `communication/${conversationId}/${fileName}`;
      const uploadContentType = file.type?.split(';')[0].trim() || 'application/octet-stream';

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          contentType: uploadContentType,
          upsert: true,
        });

      if (uploadError) {
        console.error('[Communication] Erreur upload:', uploadError);
        throw new Error(`Échec upload: ${uploadError.message}`);
      }

      // 🔐 Bucket privé : on STOCKE le chemin (pas une URL publique).
      // L'affichage utilise une URL signée générée à la lecture.
      const storedFileRef = filePath;

      // Déterminer le destinataire
      let recipientId: string;

      if (isDirectConversation(conversationId)) {
        recipientId = extractRecipientFromDirectId(conversationId);
      } else {
        const conversation = await this.getConversationById(conversationId);
        const recipient = conversation.participants.find(p => p.user_id !== senderId);
        recipientId = recipient?.user_id || senderId;
      }

      // Créer le message avec les informations audio si applicable
      const messageData: Record<string, any> = {
        sender_id: senderId,
        recipient_id: recipientId,
        content: file.name,
        type: fileType,
        status: 'sent',
        file_url: storedFileRef,
        file_name: file.name,
        file_size: file.size,
      };

      // Ajouter le format audio si c'est un fichier audio
      if (fileType === 'audio') {
        const audioExt = file.name.split('.').pop()?.toLowerCase();
        messageData.audio_format = audioExt;
        messageData.audio_mime_type = file.type;
        console.log('[Communication] 🎤 Format audio détecté:', {
          format: audioExt,
          mimeType: file.type
        });
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData as any)
        .select()
        .single();

      if (error) throw error;

      await this.logAudit(senderId, 'message_sent', data.id);

      console.log('[Communication] Fichier envoyé:', data.id);

      // URL signée pour l'affichage immédiat (le DB ne contient que le chemin)
      const signedUrl = await resolveCommunicationFileUrl(storedFileRef);

      // 🎵 Conversion iOS héritée (legacy) : ne se déclenche QUE pour les anciens formats.
      // Les nouveaux enregistrements sont déjà transcodés en WAV (lu partout) côté client.
      if (fileType === 'audio') {
        const audioExt = file.name.split('.').pop()?.toLowerCase();
        const formatsNeedingConversion = ['webm', 'ogg', 'opus'];

        if (audioExt && formatsNeedingConversion.includes(audioExt)) {
          import('@/services/AudioConversionService').then(({ autoConvertIfNeeded }) => {
            autoConvertIfNeeded(data.id, signedUrl || storedFileRef, file.name)
              .catch(err => console.error('[Communication] Erreur conversion:', err));
          });
        }
      }

      // 🌍 Traduction vocale automatique (ex. FR→EN) : si l'expéditeur et le destinataire
      // ont des langues différentes, on déclenche le pipeline backend (Whisper→trad→TTS).
      // Non bloquant : le destinataire reçoit l'audio dans SA langue dès que c'est prêt.
      if (fileType === 'audio' && recipientId && recipientId !== senderId) {
        void (async () => {
          try {
            const { data: profs } = await supabase
              .from('profiles').select('id, preferred_language').in('id', [senderId, recipientId]);
            const sLang = (profs?.find((p: any) => p.id === senderId)?.preferred_language as string) || 'fr';
            const rLang = (profs?.find((p: any) => p.id === recipientId)?.preferred_language as string) || 'fr';
            if (sLang === rLang) return;

            const audioUrl = signedUrl || (await resolveCommunicationFileUrl(storedFileRef));
            if (!audioUrl) return;

            await supabase.from('messages').update({ audio_translation_status: 'pending', target_language: rLang }).eq('id', data.id);
            await backendFetch('/edge-functions/translate-audio', {
              method: 'POST',
              body: { audioUrl, messageId: data.id, sourceLanguage: sLang, targetLanguage: rLang },
            });
          } catch (e) {
            console.error('[Communication] Traduction vocale échouée:', e);
          }
        })();
      }

      return { ...data, file_url: signedUrl || storedFileRef } as Message;
    } catch (error) {
      console.error('[Communication] Erreur sendFileMessage:', error);
      throw error;
    }
  }

  /**
   * Marquer les messages comme lus
   */
  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      if (isDirectConversation(conversationId)) {
        const otherUserId = extractRecipientFromDirectId(conversationId);

        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .is('conversation_id', null)
          .eq('sender_id', otherUserId)
          .eq('recipient_id', userId)
          .is('read_at', null);
      } else {
        await supabase.rpc('mark_messages_as_read', {
          p_conversation_id: conversationId,
          p_user_id: userId
        });
      }

      // Ne pas bloquer sur l'audit, utiliser un UUID valide si disponible
      const auditTargetId = isDirectConversation(conversationId) ? extractRecipientFromDirectId(conversationId) : conversationId;
      this.logAudit(userId, 'message_read', validateUUID(auditTargetId) ? auditTargetId : undefined).catch(() => {});
    } catch (error) {
      console.error('[Communication] Erreur markMessagesAsRead:', error);
      throw error;
    }
  }

  /**
   * Supprimer un message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    try {
      // Vérifier l'auteur
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      if (message.sender_id !== userId) {
        throw new Error('Vous ne pouvez supprimer que vos propres messages');
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      await this.logAudit(userId, 'message_deleted', messageId);
    } catch (error) {
      console.error('[Communication] Erreur deleteMessage:', error);
      throw error;
    }
  }

  /**
   * Modifier un message
   */
  async editMessage(messageId: string, userId: string, newContent: string): Promise<void> {
    if (!newContent.trim()) {
      throw new Error('Le message ne peut pas être vide');
    }

    try {
      // Vérifier l'auteur
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      if (message.sender_id !== userId) {
        throw new Error('Vous ne pouvez modifier que vos propres messages');
      }

      const { error } = await supabase
        .from('messages')
        .update({
          content: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      await this.logAudit(userId, 'message_edited', messageId);
    } catch (error) {
      console.error('[Communication] Erreur editMessage:', error);
      throw error;
    }
  }

  // ==========================================================================
  // CALLS
  // ==========================================================================

  /**
   * Démarrer un appel
   */
  async startCall(
    callerId: string,
    receiverId: string,
    callType: 'audio' | 'video'
  ): Promise<Call> {
    if (!validateUUID(callerId) || !validateUUID(receiverId)) {
      throw new Error('IDs invalides');
    }

    try {
      // Générer un channel court et valide pour Agora (max 64 chars, alphanumérique)
      const timestamp = Date.now().toString(36);
      const agoraChannel = `call_${timestamp}`;

      console.log('[Communication] Création appel avec channel Agora:', agoraChannel);

      const { data, error } = await supabase
        .from('calls')
        .insert({
          caller_id: callerId,
          receiver_id: receiverId,
          call_type: callType,
          status: 'ringing',
          started_at: new Date().toISOString(),
          metadata: {
            agora_channel: agoraChannel,
            initiated_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Ajouter le channel au résultat
      const callWithChannel = {
        ...data,
        agora_channel: agoraChannel
      };

      await this.logAudit(callerId, 'call_started', data.id);
      console.log('[Communication] Appel créé:', callWithChannel);

      return callWithChannel as Call;
    } catch (error) {
      console.error('[Communication] Erreur startCall:', error);
      throw error;
    }
  }

  /**
   * Terminer un appel
   */
  async endCall(callId: string, duration: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration
        })
        .eq('id', callId);

      if (error) throw error;

      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        await this.logAudit(session.session.user.id, 'call_ended', callId);
      }
    } catch (error) {
      console.error('[Communication] Erreur endCall:', error);
      throw error;
    }
  }

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================

  /**
   * Récupérer les notifications non lues
   */
  async getUnreadNotifications(userId: string): Promise<CommunicationNotification[]> {
    try {
      const { data, error } = await supabase
        .from('communication_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CommunicationNotification[];
    } catch (error) {
      console.error('[Communication] Erreur getUnreadNotifications:', error);
      throw error;
    }
  }

  /**
   * Marquer une notification comme lue
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('communication_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('[Communication] Erreur markNotificationAsRead:', error);
      throw error;
    }
  }

  // ==========================================================================
  // USERS
  // ==========================================================================

  /**
   * Rechercher des utilisateurs
   */
  async searchUsers(query: string): Promise<UserProfile[]> {
    const parsed = parseUserSearchInput(query);
    if (!parsed.trimmed || parsed.trimmed.length < 2) {
      return [];
    }

    try {
      const search = parsed.trimmed;
      let profiles: UserProfile[] = [];
      const addProfiles = (items?: UserProfile[] | null) => {
        if (items?.length) profiles = profiles.concat(items);
      };

      // Recherche via la fonction RPC sécurisée (accès auth.users pour emails manquants)
      try {
        const { data: rpcData } = await supabase.rpc('search_profiles_for_messaging', {
          search_term: search,
          max_results: 10
        });
        if (rpcData && rpcData.length > 0) {
          addProfiles(rpcData as UserProfile[]);
          // Dédupliquer et retourner directement si on a des résultats
          const unique = profiles.filter((p, i, self) => i === self.findIndex((x) => x.id === p.id));
          if (unique.length > 0) return unique;
        }
      } catch {
        // Fallback sur les requêtes directes si la fonction RPC n'existe pas encore
      }

      // Recherche par ID interne (UUID)
      if (parsed.kind === 'uuid') {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id, phone')
          .eq('id', search)
          .maybeSingle();
        if (data) return [data as UserProfile];
      }

      // Recherche par custom_id (user_ids)
      if (parsed.kind === 'custom_id') {
        const { data: userIdData } = await supabase
          .from('user_ids')
          .select('user_id')
          .eq('custom_id', parsed.upper)
          .maybeSingle();
        if (userIdData?.user_id) {
          const { data } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, avatar_url, public_id, phone')
            .eq('id', userIdData.user_id)
            .maybeSingle();
          if (data) return [data as UserProfile];
        }
      }

      // Recherche par public_id
      const { data: publicIdData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, public_id, phone')
        .ilike('public_id', `%${parsed.upper}%`)
        .limit(5);
      if (publicIdData && publicIdData.length > 0) {
        profiles = profiles.concat(publicIdData as UserProfile[]);
      }

      // Recherche par email
      if (parsed.kind === 'email') {
        const { data: emailData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id, phone')
          .ilike('email', `%${search}%`)
          .limit(5);
        if (emailData && emailData.length > 0) {
          profiles = profiles.concat(emailData as UserProfile[]);
        }
      }

      // Recherche par téléphone
      if (parsed.kind === 'phone') {
        const phoneTerms = buildPhoneSearchTerms(search);
        const phoneFilters = phoneTerms
          .map((term) => `phone.ilike.%${term}%`)
          .join(',');

        if (phoneFilters) {
          const { data: phoneData } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, avatar_url, public_id, phone')
            .or(phoneFilters)
            .limit(5);
          addProfiles(phoneData as UserProfile[] | null);
        }

        const referenceDigits = stripPhoneToDigits(search).replace(/^224/, '');
        if (referenceDigits.length >= 4) {
          const looseTerm = referenceDigits.slice(-4);
          const { data: loosePhoneData } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, avatar_url, public_id, phone')
            .ilike('phone', `%${looseTerm}%`)
            .limit(20);

          const normalizedMatches = (loosePhoneData || []).filter((profile) => {
            const candidateDigits = stripPhoneToDigits(profile.phone || '').replace(/^224/, '');
            return candidateDigits && (candidateDigits.includes(referenceDigits) || referenceDigits.includes(candidateDigits));
          });
          addProfiles(normalizedMatches as UserProfile[]);
        }
      }

      // Recherche générique (nom, prénom, email, téléphone)
      const safeSearch = sanitizePostgrestSearchTerm(search);
      try {
        const vendorFilters = [
          `business_name.ilike.%${safeSearch}%`,
          `email.ilike.%${safeSearch}%`,
          `public_id.ilike.%${parsed.upper}%`,
          `vendor_code.ilike.%${parsed.upper}%`,
          `phone.ilike.%${safeSearch}%`,
        ];

        if (parsed.kind === 'phone') {
          buildPhoneSearchTerms(search).forEach((term) => {
            vendorFilters.push(`phone.ilike.%${term}%`);
          });
        }

        const { data: vendorMatches, error: vendorSearchError } = await supabase
          .from('vendors')
          .select('user_id, business_name, email, phone, public_id, vendor_code, logo_url')
          .or(vendorFilters.join(','))
          .limit(20);

        if (vendorSearchError) {
          console.warn('[Communication] Recherche vendors ignoree:', vendorSearchError.message);
        } else {
          const vendorUserIds = Array.from(
            new Set((vendorMatches || []).map((vendor) => vendor.user_id).filter(Boolean))
          );

          if (vendorUserIds.length > 0) {
            const { data: vendorProfiles } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, email, avatar_url, public_id, phone')
              .in('id', vendorUserIds);
            addProfiles(vendorProfiles as UserProfile[] | null);

            const readableProfileIds = new Set((vendorProfiles || []).map((profile) => profile.id));
            const fallbackVendorProfiles = (vendorMatches || [])
              .filter((vendor) => vendor.user_id && !readableProfileIds.has(vendor.user_id))
              .map((vendor) => ({
                id: vendor.user_id,
                first_name: vendor.business_name || 'Vendeur',
                last_name: '',
                email: vendor.email || '',
                avatar_url: vendor.logo_url || undefined,
                public_id: vendor.public_id || vendor.vendor_code || undefined,
                phone: vendor.phone || undefined,
              }));
            addProfiles(fallbackVendorProfiles as UserProfile[]);
          }
        }
      } catch (vendorError) {
        console.warn('[Communication] Recherche vendors non bloquante:', vendorError);
      }

      if (safeSearch.length >= 2) {
        const { data: genericData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id, phone')
          .or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`)
          .limit(10);
        addProfiles(genericData as UserProfile[] | null);
      }

      // Supprimer les doublons par id
      const uniqueProfiles = profiles.filter((profile, index, self) =>
        index === self.findIndex((p) => p.id === profile.id)
      );

      return uniqueProfiles;
    } catch (error) {
      console.error('[Communication] Erreur searchUsers:', error);
      throw error;
    }
  }

  /**
   * Récupérer un utilisateur par UUID
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    if (!validateUUID(userId)) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, public_id')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Communication] Erreur getUserById:', error);
        return null;
      }

      return data as UserProfile | null;
    } catch (error) {
      console.error('[Communication] Erreur getUserById:', error);
      return null;
    }
  }

  /**
   * Récupérer un utilisateur par ID personnalisé
   */
  async getUserByCustomId(customId: string): Promise<UserProfile | null> {
    const normalizedId = customId.toUpperCase().trim();
    console.log('[Communication] Recherche utilisateur par custom ID:', normalizedId);

    try {
      // Format: 3 lettres + 4 chiffres (USR0001, VEN0001, etc.)
      const customIdRegex = /^[A-Z]{3}\d{4}$/;
      if (customIdRegex.test(normalizedId)) {
        // Chercher dans user_ids
        const { data: userIdData } = await supabase
          .from('user_ids')
          .select('user_id')
          .eq('custom_id', normalizedId)
          .maybeSingle();

        if (userIdData?.user_id) {
          return await this.getUserById(userIdData.user_id);
        }

        // Fallback: profiles.public_id
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id')
          .eq('public_id', normalizedId)
          .maybeSingle();

        if (profileData) {
          return profileData as UserProfile;
        }
      }

      // Format: 224-XXX-XXX
      const publicIdRegex = /^224-[A-Z]{3}-\d{3}$/;
      if (publicIdRegex.test(normalizedId)) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id')
          .eq('public_id', normalizedId)
          .maybeSingle();

        if (profileData) {
          return profileData as UserProfile;
        }
      }

      console.log('[Communication] Utilisateur non trouvé pour ID:', normalizedId);
      return null;
    } catch (error) {
      console.error('[Communication] Erreur getUserByCustomId:', error);
      return null;
    }
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  /**
   * S'abonner aux nouveaux messages d'une conversation
   */
  subscribeToMessages(
    conversationId: string,
    callback: (message: Message) => void
  ) {
    console.log('[Communication] 🔔 Subscription messages:', conversationId);

    const channel = supabase
      .channel(`messages:${conversationId}`, {
        config: {
          presence: { key: conversationId },
          broadcast: { self: false }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          try {
            console.log('[Communication] 📨 Nouveau message reçu:', payload.new.id);

            // Récupérer le message complet avec le profil (avec timeout)
            const fetchPromise = supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!messages_sender_id_fkey (
                  id, first_name, last_name, email, avatar_url
                )
              `)
              .eq('id', payload.new.id)
              .single();

            const timeoutPromise = new Promise<{ data: null }>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout fetch message')), 5000)
            );

            const { data } = await Promise.race([fetchPromise, timeoutPromise]);

            if (data) {
              // 🔐 Signer la pièce jointe éventuelle (bucket privé)
              const fileUrl = (data as any).file_url
                ? await resolveCommunicationFileUrl((data as any).file_url)
                : (data as any).file_url;
              callback({ ...(data as any), file_url: fileUrl } as Message);
            } else {
              console.warn('[Communication] ⚠️ Message non trouvé après insertion:', payload.new.id);
            }
          } catch (error: any) {
            console.error('[Communication] ❌ Erreur traitement nouveau message:', {
              error: error.message,
              messageId: payload.new.id
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Communication] ✅ Subscription active:', conversationId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Communication] ❌ Erreur channel:', err);
        } else if (status === 'TIMED_OUT') {
          console.error('[Communication] ⏱️ Timeout subscription:', conversationId);
        } else if (status === 'CLOSED') {
          console.log('[Communication] 🔌 Subscription fermée:', conversationId);
        }
      });

    // Retourner le channel avec cleanup amélioré
    const originalUnsubscribe = channel.unsubscribe.bind(channel);
    channel.unsubscribe = async (): Promise<"error" | "ok" | "timed out"> => {
      console.log('[Communication] 🔌 Cleanup subscription:', conversationId);
      try {
        const result = await originalUnsubscribe();
        console.log('[Communication] ✅ Subscription nettoyée:', conversationId);
        return result;
      } catch (error) {
        console.error('[Communication] ❌ Erreur cleanup subscription:', error);
        return 'error';
      }
    };

    return channel;
  }

  /**
   * S'abonner aux notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: (notification: CommunicationNotification) => void
  ) {
    console.log('[Communication] Subscription notifications:', userId);

    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as CommunicationNotification);
        }
      )
      .subscribe();
  }

  // ==========================================================================
  // AUDIT
  // ==========================================================================

  /**
   * Enregistrer un log d'audit
   */
  private auditFailureCount = 0;
  private auditCircuitOpen = false;
  private auditCircuitResetTime = 0;
  private readonly AUDIT_CIRCUIT_THRESHOLD = 5;
  private readonly AUDIT_CIRCUIT_RESET_MS = 60000; // 1 minute

  private async logAudit(
    userId: string,
    actionType: string,
    targetId?: string
  ): Promise<void> {
    // Circuit breaker: si trop d'échecs, skip audit temporairement
    const now = Date.now();
    if (this.auditCircuitOpen) {
      if (now < this.auditCircuitResetTime) {
        console.warn('[Communication] ⚠️ Audit circuit ouvert, skip log');
        return;
      } else {
        // Reset circuit
        console.log('[Communication] 🔄 Reset audit circuit breaker');
        this.auditCircuitOpen = false;
        this.auditFailureCount = 0;
      }
    }

    try {
      const { error } = await supabase.from('communication_audit_logs').insert({
        user_id: userId,
        action_type: actionType,
        target_id: targetId,
        metadata: {
          timestamp: new Date().toISOString(),
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
        },
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      // Reset failure count on success
      if (this.auditFailureCount > 0) {
        this.auditFailureCount = 0;
        console.log('[Communication] ✅ Audit rétabli après échecs');
      }
    } catch (error: any) {
      this.auditFailureCount++;

      console.warn('[Communication] ⚠️ Échec audit log:', {
        error: error.message,
        failureCount: this.auditFailureCount,
        userId,
        actionType
      });

      // Ouvrir le circuit si trop d'échecs
      if (this.auditFailureCount >= this.AUDIT_CIRCUIT_THRESHOLD) {
        this.auditCircuitOpen = true;
        this.auditCircuitResetTime = now + this.AUDIT_CIRCUIT_RESET_MS;
        console.error('[Communication] 🔴 Audit circuit breaker OUVERT pour 1 minute');
      }
    }
  }

  // ==========================================================================
  // NOUVELLES FONCTIONNALITÉS - PRESENCE & READ RECEIPTS
  // ==========================================================================

  /**
   * Envoyer un message avec réponse à un autre message
   */
  async sendReplyMessage(
    conversationId: string,
    senderId: string,
    content: string,
    replyToMessageId: string
  ): Promise<Message> {
    if (!content.trim()) {
      throw new Error('Le message ne peut pas être vide');
    }

    try {
      console.log('[Communication] 📤 Envoi réponse:', { conversationId, replyToMessageId });

      let recipientId: string;
      let dbConversationId: string | null;

      if (isDirectConversation(conversationId)) {
        recipientId = extractRecipientFromDirectId(conversationId);
        dbConversationId = null;
      } else {
        const conversation = await this.getConversationById(conversationId);
        const recipient = conversation.participants.find(p => p.user_id !== senderId);
        if (!recipient) throw new Error('Aucun destinataire trouvé');
        recipientId = recipient.user_id;
        dbConversationId = conversationId;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: dbConversationId,
          sender_id: senderId,
          recipient_id: recipientId,
          content: content.trim(),
          type: 'text',
          status: 'sent',
          reply_to_id: replyToMessageId,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;

      console.log('[Communication] ✅ Réponse envoyée:', data.id);
      return data as Message;
    } catch (error) {
      console.error('[Communication] Erreur sendReplyMessage:', error);
      throw error;
    }
  }

  /**
   * Supprimer un message (soft delete)
   */
  async softDeleteMessage(
    messageId: string,
    userId: string,
    deleteForEveryone: boolean = false
  ): Promise<boolean> {
    try {
      console.log('[Communication] 🗑️ Tentative suppression message:', { messageId, userId, deleteForEveryone });

      // Essayer d'abord avec la fonction RPC
      const { data, error } = await supabase.rpc('soft_delete_message', {
        p_message_id: messageId,
        p_user_id: userId,
        p_delete_for_everyone: deleteForEveryone,
      });

      if (error) {
        console.warn('[Communication] RPC soft_delete_message failed:', error.message);

        // Fallback: utiliser une requête directe
        if (deleteForEveryone) {
          console.log('[Communication] Tentative suppression pour tous via requête directe');

          // Vérifier que l'utilisateur est l'expéditeur
          const { data: msgData, error: selectError } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('id', messageId)
            .single();

          if (selectError) {
            console.error('[Communication] Erreur select message:', selectError);
            throw new Error('Message non trouvé');
          }

          if (msgData?.sender_id === userId) {
            const { error: updateError } = await supabase
              .from('messages')
              .update({
                deleted_at: new Date().toISOString(),
                content: '[Message supprimé]'
              })
              .eq('id', messageId);

            if (updateError) {
              console.error('[Communication] Erreur update deleted_at:', updateError);
              throw updateError;
            }
            console.log('[Communication] ✅ Message supprimé pour tous');
          } else {
            throw new Error('Vous ne pouvez supprimer ce message pour tous que si vous en êtes l\'expéditeur');
          }
        } else {
          console.log('[Communication] Tentative suppression pour moi via requête directe');

          // Supprimer uniquement pour cet utilisateur
          // Récupérer puis mettre à jour manuellement
          const { data: msgData } = await supabase
            .from('messages')
            .select('deleted_for')
            .eq('id', messageId)
            .single();

          const currentDeletedFor = (msgData?.deleted_for as string[]) || [];

          let updateError: any = null;
          if (!currentDeletedFor.includes(userId)) {
            const newDeletedFor = [...currentDeletedFor, userId];
            const { error } = await supabase
              .from('messages')
              .update({ deleted_for: newDeletedFor })
              .eq('id', messageId);
            updateError = error;
          }

          if (updateError) {
            console.warn('[Communication] Erreur update deleted_for avec SQL:', updateError);

            // Fallback 2: récupérer et mettre à jour manuellement
            const { data: msgData } = await supabase
              .from('messages')
              .select('deleted_for')
              .eq('id', messageId)
              .single();

            const currentDeletedFor = (msgData?.deleted_for as string[]) || [];

            if (!currentDeletedFor.includes(userId)) {
              const newDeletedFor = [...currentDeletedFor, userId];
              const { error: updateError2 } = await supabase
                .from('messages')
                .update({ deleted_for: newDeletedFor })
                .eq('id', messageId);

              if (updateError2) {
                console.error('[Communication] Erreur update deleted_for:', updateError2);
                throw updateError2;
              }
            }
          }
          console.log('[Communication] ✅ Message supprimé pour moi');
        }
      } else {
        console.log('[Communication] ✅ Message supprimé via RPC');
      }

      await this.logAudit(userId, 'message_deleted', messageId).catch(() => {});
      return true;
    } catch (error) {
      console.error('[Communication] Erreur softDeleteMessage:', error);
      throw error;
    }
  }

  /**
   * Marquer un message spécifique comme lu
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      await supabase.rpc('mark_message_read_v2', {
        p_message_id: messageId,
        p_user_id: userId,
      });
      console.log('[Communication] ✅ Message marqué comme lu:', messageId);
    } catch (error) {
      console.error('[Communication] Erreur markMessageAsRead:', error);
      // Non-bloquant
    }
  }

  /**
   * Marquer tous les messages d'une conversation comme lus
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('mark_conversation_messages_read', {
        p_conversation_id: conversationId,
        p_user_id: userId,
      });

      if (error) throw error;

      console.log('[Communication] ✅ Conversation marquée comme lue:', data, 'messages');
      return data || 0;
    } catch (error) {
      console.error('[Communication] Erreur markConversationAsRead:', error);
      return 0;
    }
  }

  /**
   * Obtenir les accusés de lecture d'un message
   */
  async getMessageReadReceipts(messageId: string): Promise<Array<{ user_id: string; read_at: string }>> {
    try {
      const { data, error } = await supabase
        .from('message_read_receipts')
        .select('user_id, read_at')
        .eq('message_id', messageId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Communication] Erreur getMessageReadReceipts:', error);
      return [];
    }
  }

  /**
   * Obtenir le message original d'une réponse
   */
  async getReplyToMessage(messageId: string): Promise<Message | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('id', messageId)
        .single();

      if (error) throw error;
      return data as unknown as Message;
    } catch (error) {
      console.error('[Communication] Erreur getReplyToMessage:', error);
      return null;
    }
  }

  /**
   * S'abonner aux changements de statut de lecture des messages
   */
  subscribeToReadReceipts(
    conversationId: string,
    callback: (receipt: { message_id: string; user_id: string; read_at: string }) => void
  ) {
    console.log('[Communication] 🔔 Subscription read receipts:', conversationId);

    const channel = supabase
      .channel(`read_receipts:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts',
        },
        (payload) => {
          callback(payload.new as any);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.read_at) {
            callback({
              message_id: newMsg.id,
              user_id: newMsg.recipient_id,
              read_at: newMsg.read_at,
            });
          }
        }
      )
      .subscribe();

    return channel;
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const universalCommunicationService = new UniversalCommunicationService();
