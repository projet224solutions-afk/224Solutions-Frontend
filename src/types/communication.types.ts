/**
 * 🎯 TYPES COMMUNICATION - 224SOLUTIONS
 * Types stricts pour remplacer les 'any' dans UniversalCommunicationService
 */

export interface ConversationParticipant {
  user_id: string;
  conversation_id: string;
  joined_at?: string;
  role?: 'admin' | 'member';
  user?: UserProfile;
}

export interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  avatar_url?: string;
  public_id?: string;
  role?: string;
  phone?: string;
  preferred_language?: string; // Langue préférée pour les traductions
}

export interface Message {
  id: string;
  conversation_id?: string | null;
  sender_id: string;
  recipient_id: string;
  content: string;
  type: MessageType;
  file_url?: string;
  file_url_ios?: string; // URL du fichier audio converti pour iOS
  file_name?: string;
  file_size?: number;
  audio_format?: string; // Format audio original (mp4, webm, ogg, etc.)
  audio_format_ios?: string; // Format audio converti pour iOS
  audio_mime_type?: string; // Type MIME complet
  // Champs de traduction texte (correspond aux colonnes DB)
  translated_text?: string; // Contenu traduit (colonne DB: translated_text)
  translated_content?: string; // Alias pour compatibilité
  original_language?: string; // Langue détectée du message original
  target_language?: string; // Langue cible de la traduction
  translation_status?: 'none' | 'pending' | 'completed' | 'failed'; // Statut de traduction texte (calculé)
  display_content?: string; // Contenu à afficher (traduit ou original)
  is_translated?: boolean; // Indique si le message affiché est une traduction
  // Champs de traduction audio
  transcribed_text?: string; // Texte transcrit du message audio (speech-to-text)
  translated_audio_url?: string; // URL de l'audio traduit et synthétisé
  audio_translation_status?: 'none' | 'pending' | 'text_only' | 'completed' | 'failed'; // Statut traduction audio
  status: MessageStatus;
  metadata?: MessageMetadata;
  created_at: string;
  read_at?: string;
  delivered_at?: string;
  edited_at?: string;
  deleted_at?: string;
  deleted_for?: string[];
  reply_to_id?: string;
  reply_to?: Message; // Message auquel on répond
  sender?: UserProfile;
  recipient?: UserProfile;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'system';

export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface MessageMetadata {
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  mentions?: string[];
  reply_to?: string;
  forwarded_from?: string;
  edited?: boolean;
  [key: string]: any;
}

export interface Conversation {
  id: string;
  name?: string;
  type: ConversationType;
  creator_id: string;
  last_message_at?: string;
  last_message_preview?: string;
  unread_count: number;
  participants: ConversationParticipant[];
  created_at: string;
  updated_at?: string;
  metadata?: ConversationMetadata;
}

export type ConversationType = 'private' | 'group' | 'channel';

export interface ConversationMetadata {
  description?: string;
  avatar_url?: string;
  archived?: boolean;
  muted?: boolean;
  pinned?: boolean;
  [key: string]: any;
}

export interface Call {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  started_at: string;
  ended_at?: string;
  duration?: number;
  quality_rating?: number;
  metadata?: CallMetadata;
  caller?: UserProfile;
  receiver?: UserProfile;
}

export type CallType = 'audio' | 'video';

export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'missed'
  | 'declined'
  | 'failed';

export interface CallMetadata {
  channel_name?: string;
  token?: string;
  network_quality?: number;
  [key: string]: any;
}

export interface CommunicationNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  conversation_id?: string;
  message_id?: string;
  call_id?: string;
  is_read: boolean;
  created_at: string;
  metadata?: NotificationMetadata;
}

export type NotificationType =
  | 'message'
  | 'call'
  | 'mention'
  | 'invitation'
  | 'system';

export interface NotificationMetadata {
  action_url?: string;
  icon?: string;
  priority?: 'low' | 'normal' | 'high';
  [key: string]: any;
}

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen: string;
  last_active?: string;
  current_device?: 'web' | 'mobile' | 'desktop';
  custom_status?: string;
  is_typing_in?: string;
  is_online: boolean;
}

export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy' | 'in_call';

// Read Receipt types
export interface MessageReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
  delivered_at?: string;
}

// Typing Indicator types
export interface TypingIndicator {
  conversation_id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  started_at: string;
  expires_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export type AuditAction =
  | 'conversation_created'
  | 'conversation_deleted'
  | 'message_sent'
  | 'message_deleted'
  | 'message_edited'
  | 'call_initiated'
  | 'call_ended'
  | 'participant_added'
  | 'participant_removed';

// Pagination types
export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_cursor?: string;
  };
}

// Search types
export interface SearchParams {
  query: string;
  type?: MessageType[];
  conversation_id?: string;
  sender_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface SearchResult {
  messages: Message[];
  total: number;
  highlights: Record<string, string[]>;
}

// Upload types
export interface UploadProgress {
  file_name: string;
  uploaded: number;
  total: number;
  percentage: number;
  status: 'uploading' | 'completed' | 'failed';
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  validate?: boolean;
  compress?: boolean;
  max_size?: number; // bytes
  allowed_types?: string[];
}
