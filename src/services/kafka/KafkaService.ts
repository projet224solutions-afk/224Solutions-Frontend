/**
 * 🔄 KafkaService - Service principal de messaging
 * Implémente une interface Kafka-like utilisant Google Pub/Sub
 */

import { supabase } from '@/integrations/supabase/client';
import { KAFKA_TOPICS, KafkaTopicName, ALL_TOPIC_NAMES, TOPIC_CATEGORIES } from './KafkaTopics';

export interface KafkaMessage<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  topic: string;
  partition?: number;
  offset?: string;
  headers?: Record<string, string>;
}

export interface ProducerRecord<T = unknown> {
  topic: KafkaTopicName | string;
  key?: string;
  value: T;
  headers?: Record<string, string>;
  timestamp?: number;
}

export interface ConsumerMessage<T = unknown> {
  messageId: string;
  data: T;
  attributes: Record<string, string>;
  publishTime: string;
  topic: string;
}

export interface ProduceResult {
  success: boolean;
  messageId?: string;
  error?: string;
  topic: string;
  timestamp: number;
}

export interface ConsumeResult<T = unknown> {
  success: boolean;
  messages: ConsumerMessage<T>[];
  count: number;
  error?: string;
}

class KafkaService {
  private static instance: KafkaService;
  private isConnected: boolean = false;
  private messageBuffer: ProducerRecord[] = [];
  private batchSize: number = 10;
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startBatchProcessor();
  }

  static getInstance(): KafkaService {
    if (!KafkaService.instance) {
      KafkaService.instance = new KafkaService();
    }
    return KafkaService.instance;
  }

  /**
   * Vérifier la connexion au service
   */
  async connect(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'listTopics' }
      });

      this.isConnected = !error && data?.success;
      console.log(`🔌 Kafka connection status: ${this.isConnected ? 'connected' : 'disconnected'}`);
      return this.isConnected;
    } catch (error) {
      console.error('❌ Kafka connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Produire un message sur un topic
   */
  async produce<T>(record: ProducerRecord<T>): Promise<ProduceResult> {
    const timestamp = record.timestamp || Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('pubsub-publish', {
        body: {
          topic: record.topic,
          data: {
            key: record.key || crypto.randomUUID(),
            value: record.value,
            timestamp,
          },
          attributes: {
            ...record.headers,
            producer: 'kafka-service',
            producedAt: new Date(timestamp).toISOString(),
          }
        }
      });

      if (error) {
        console.error(`❌ Produce to ${record.topic} failed:`, error);
        return {
          success: false,
          error: error.message,
          topic: record.topic,
          timestamp
        };
      }

      console.log(`✅ Message produced to ${record.topic}:`, data.messageId);
      return {
        success: true,
        messageId: data.messageId,
        topic: record.topic,
        timestamp,
      };
    } catch (error) {
      console.error(`❌ Produce exception on ${record.topic}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        topic: record.topic,
        timestamp,
      };
    }
  }

  /**
   * Produire plusieurs messages en batch
   */
  async produceBatch<T>(records: ProducerRecord<T>[]): Promise<ProduceResult[]> {
    const results = await Promise.all(records.map(record => this.produce(record)));

    const successful = results.filter(r => r.success).length;
    console.log(`📦 Batch produced: ${successful}/${records.length} successful`);

    return results;
  }

  /**
   * Ajouter un message au buffer pour envoi batch
   */
  addToBuffer<T>(record: ProducerRecord<T>): void {
    this.messageBuffer.push(record as ProducerRecord);

    if (this.messageBuffer.length >= this.batchSize) {
      this.flushBuffer();
    }
  }

  /**
   * Envoyer tous les messages en buffer
   */
  async flushBuffer(): Promise<void> {
    if (this.messageBuffer.length === 0) return;

    const messages = [...this.messageBuffer];
    this.messageBuffer = [];

    await this.produceBatch(messages);
  }

  /**
   * Démarrer le processeur batch
   */
  private startBatchProcessor(): void {
    if (typeof window !== 'undefined') {
      this.flushInterval = setInterval(() => {
        if (this.messageBuffer.length > 0) {
          this.flushBuffer();
        }
      }, 5000); // Flush every 5 seconds
    }
  }

  /**
   * Consommer des messages d'une subscription
   */
  async consume<T = unknown>(
    subscription: string,
    maxMessages: number = 10,
    autoAck: boolean = true
  ): Promise<ConsumeResult<T>> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-subscribe', {
        body: { subscription, maxMessages, autoAck }
      });

      if (error) {
        console.error(`❌ Consume from ${subscription} failed:`, error);
        return { success: false, messages: [], count: 0, error: error.message };
      }

      const messages: ConsumerMessage<T>[] = (data.messages || []).map((msg: any) => ({
        messageId: msg.messageId,
        data: msg.data as T,
        attributes: msg.attributes || {},
        publishTime: msg.publishTime,
        topic: subscription,
      }));

      console.log(`📥 Consumed ${messages.length} messages from ${subscription}`);
      return {
        success: true,
        messages,
        count: messages.length,
      };
    } catch (error) {
      console.error(`❌ Consume exception on ${subscription}:`, error);
      return {
        success: false,
        messages: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==================== TOPIC MANAGEMENT ====================

  /**
   * Créer un topic
   */
  async createTopic(topicName: string): Promise<{ success: boolean; created: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'createTopic', topicName }
      });

      if (error) {
        return { success: false, created: false, error: error.message };
      }

      return {
        success: data.success,
        created: data.result?.created || false,
        error: data.error
      };
    } catch (error) {
      return {
        success: false,
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Supprimer un topic
   */
  async deleteTopic(topicName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'deleteTopic', topicName }
      });

      return { success: !error && data?.success, error: error?.message || data?.error };
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
  async listTopics(): Promise<{ success: boolean; topics: string[]; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'listTopics' }
      });

      if (error) {
        return { success: false, topics: [], error: error.message };
      }

      const topics = (data.result || []).map((t: any) =>
        typeof t === 'string' ? t : t.name?.split('/').pop() || t
      );

      return { success: true, topics };
    } catch (error) {
      return {
        success: false,
        topics: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  /**
   * Créer une subscription
   */
  async createSubscription(
    topicName: string,
    subscriptionName: string,
    pushEndpoint?: string
  ): Promise<{ success: boolean; created: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'createSubscription', topicName, subscriptionName, pushEndpoint }
      });

      return {
        success: !error && data?.success,
        created: data?.result?.created || false,
        error: error?.message || data?.error
      };
    } catch (error) {
      return {
        success: false,
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Supprimer une subscription
   */
  async deleteSubscription(subscriptionName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'deleteSubscription', subscriptionName }
      });

      return { success: !error && data?.success, error: error?.message || data?.error };
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
  async listSubscriptions(): Promise<{ success: boolean; subscriptions: string[]; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('pubsub-manage', {
        body: { action: 'listSubscriptions' }
      });

      if (error) {
        return { success: false, subscriptions: [], error: error.message };
      }

      const subscriptions = (data.result || []).map((s: any) =>
        typeof s === 'string' ? s : s.name?.split('/').pop() || s
      );

      return { success: true, subscriptions };
    } catch (error) {
      return {
        success: false,
        subscriptions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== INITIALIZATION ====================

  /**
   * Initialiser tous les topics Kafka
   */
  async initializeAllTopics(): Promise<{
    success: boolean;
    created: string[];
    existing: string[];
    errors: string[];
    total: number;
  }> {
    console.log('🚀 Initializing all Kafka topics...');

    const created: string[] = [];
    const existing: string[] = [];
    const errors: string[] = [];

    for (const topicName of ALL_TOPIC_NAMES) {
      const result = await this.createTopic(topicName);

      if (result.success) {
        if (result.created) {
          created.push(topicName);
        } else {
          existing.push(topicName);
        }
      } else {
        errors.push(`${topicName}: ${result.error}`);
      }
    }

    const successRate = ((created.length + existing.length) / ALL_TOPIC_NAMES.length * 100).toFixed(1);
    console.log(`✅ Topics initialized: ${created.length} created, ${existing.length} existing, ${errors.length} errors (${successRate}% success)`);

    return {
      success: errors.length === 0,
      created,
      existing,
      errors,
      total: ALL_TOPIC_NAMES.length,
    };
  }

  /**
   * Initialiser les topics par catégorie
   */
  async initializeCategoryTopics(category: keyof typeof TOPIC_CATEGORIES): Promise<{
    success: boolean;
    created: string[];
    errors: string[];
  }> {
    const topicNames = TOPIC_CATEGORIES[category];
    console.log(`🚀 Initializing ${category} topics (${topicNames.length})...`);

    const created: string[] = [];
    const errors: string[] = [];

    for (const topicName of topicNames) {
      const result = await this.createTopic(topicName);

      if (result.success && result.created) {
        created.push(topicName);
      } else if (!result.success) {
        errors.push(`${topicName}: ${result.error}`);
      }
    }

    return { success: errors.length === 0, created, errors };
  }

  /**
   * Créer les subscriptions par défaut pour un topic
   */
  async createDefaultSubscription(topicName: string): Promise<boolean> {
    const subscriptionName = `${topicName}-sub`;
    const result = await this.createSubscription(topicName, subscriptionName);
    return result.success;
  }

  /**
   * Obtenir les topics par catégorie
   */
  getTopicsByCategory(category: keyof typeof TOPIC_CATEGORIES): string[] {
    return [...TOPIC_CATEGORIES[category]];
  }

  /**
   * Obtenir toutes les catégories
   */
  getCategories(): (keyof typeof TOPIC_CATEGORIES)[] {
    return Object.keys(TOPIC_CATEGORIES) as (keyof typeof TOPIC_CATEGORIES)[];
  }

  /**
   * Cleanup
   */
  disconnect(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushBuffer();
    this.isConnected = false;
    console.log('🔌 Kafka disconnected');
  }
}

export const kafkaService = KafkaService.getInstance();
export { KAFKA_TOPICS, ALL_TOPIC_NAMES, TOPIC_CATEGORIES };
export type { KafkaTopicName };
export default kafkaService;
