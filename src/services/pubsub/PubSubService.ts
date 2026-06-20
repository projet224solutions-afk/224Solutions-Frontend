import { supabase } from '@/integrations/supabase/client';

export interface PubSubMessage {
  messageId: string;
  data: Record<string, unknown>;
  attributes: Record<string, string>;
  publishTime: string;
}

export interface PublishResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PullResult {
  success: boolean;
  messages: PubSubMessage[];
  count: number;
  error?: string;
}

// Topics prédéfinis pour 224Solutions (noms valides commençant par lettres)
export const TOPICS = {
  // Transactions et paiements
  TRANSACTION_CREATED: 'transaction-created',
  TRANSACTION_COMPLETED: 'transaction-completed',
  TRANSACTION_FAILED: 'transaction-failed',
  PAYMENT_RECEIVED: 'payment-received',

  // Commandes
  ORDER_CREATED: 'order-created',
  ORDER_UPDATED: 'order-updated',
  ORDER_SHIPPED: 'order-shipped',
  ORDER_DELIVERED: 'order-delivered',
  ORDER_CANCELLED: 'order-cancelled',

  // Utilisateurs
  USER_REGISTERED: 'user-registered',
  USER_VERIFIED: 'user-verified',
  USER_SUBSCRIPTION_CHANGED: 'user-subscription-changed',

  // Notifications
  NOTIFICATION_SEND: 'notification-send',
  SMS_SEND: 'sms-send',
  EMAIL_SEND: 'email-send',

  // Taxi/Livraison
  RIDE_REQUESTED: 'ride-requested',
  RIDE_ACCEPTED: 'ride-accepted',
  RIDE_STARTED: 'ride-started',
  RIDE_COMPLETED: 'ride-completed',
  DRIVER_LOCATION_UPDATE: 'driver-location-update',

  // Wallet
  WALLET_CREDITED: 'wallet-credited',
  WALLET_DEBITED: 'wallet-debited',
  WALLET_TRANSFER: 'wallet-transfer',

  // Analytics
  ANALYTICS_EVENT: 'analytics-event',

  // Bureaux syndicaux
  BUREAU_MEMBER_ADDED: 'bureau-member-added',
  BUREAU_COTISATION_PAID: 'bureau-cotisation-paid',
} as const;

export type TopicName = typeof TOPICS[keyof typeof TOPICS];

class PubSubService {
  private static instance: PubSubService;

  private constructor() {}

  static getInstance(): PubSubService {
    if (!PubSubService.instance) {
      PubSubService.instance = new PubSubService();
    }
    return PubSubService.instance;
  }

  /**
   * Publier un message sur un topic
   */
  async publish(
    topic: TopicName | string,
    data: Record<string, unknown>,
    attributes?: Record<string, string>
  ): Promise<PublishResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-publish', {
        body: { topic, data, attributes }
      });

      if (error) {
        console.error('Pub/Sub publish error:', error);
        return { success: false, error: error.message };
      }

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error
      };
    } catch (error) {
      console.error('Pub/Sub publish exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Récupérer des messages d'une subscription
   */
  async pull(
    subscription: string,
    maxMessages: number = 10,
    autoAck: boolean = true
  ): Promise<PullResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-subscribe', {
        body: { subscription, maxMessages, autoAck }
      });

      if (error) {
        console.error('Pub/Sub pull error:', error);
        return { success: false, messages: [], count: 0, error: error.message };
      }

      return {
        success: result.success,
        messages: result.messages || [],
        count: result.count || 0,
        error: result.error
      };
    } catch (error) {
      console.error('Pub/Sub pull exception:', error);
      return {
        success: false,
        messages: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Créer un topic
   */
  async createTopic(topicName: string): Promise<{ success: boolean; created?: boolean; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'createTopic', topicName }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: result.success, created: result.result?.created, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Supprimer un topic
   */
  async deleteTopic(topicName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'deleteTopic', topicName }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Lister tous les topics
   */
  async listTopics(): Promise<{ success: boolean; topics?: string[]; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'listTopics' }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const topics = (result.result || []).map((t: any) => t.name?.split('/').pop() || t);
      return { success: result.success, topics, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Créer une subscription
   */
  async createSubscription(
    topicName: string,
    subscriptionName: string,
    pushEndpoint?: string
  ): Promise<{ success: boolean; created?: boolean; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'createSubscription', topicName, subscriptionName, pushEndpoint }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: result.success, created: result.result?.created, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Supprimer une subscription
   */
  async deleteSubscription(subscriptionName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'deleteSubscription', subscriptionName }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Lister toutes les subscriptions
   */
  async listSubscriptions(): Promise<{ success: boolean; subscriptions?: string[]; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'listSubscriptions' }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const subscriptions = (result.result || []).map((s: any) => s.name?.split('/').pop() || s);
      return { success: result.success, subscriptions, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Initialiser tous les topics nécessaires pour 224Solutions
   */
  async initializeTopics(): Promise<{ success: boolean; created: string[]; errors: string[] }> {
    const created: string[] = [];
    const errors: string[] = [];

    for (const [_key, topicName] of Object.entries(TOPICS)) {
      const result = await this.createTopic(topicName);
      if (result.success) {
        if (result.created) {
          created.push(topicName);
        }
      } else {
        errors.push(`${topicName}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      created,
      errors
    };
  }
}

export const pubsubService = PubSubService.getInstance();
export default pubsubService;
