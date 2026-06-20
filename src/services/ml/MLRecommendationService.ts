/**
 * SERVICE DE RECOMMANDATIONS ML - 224SOLUTIONS
 * Système de recommandations produits basé sur le comportement utilisateur
 * Algorithmes : Collaborative Filtering + Content-Based + Trending
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface ProductRecommendation {
  product_id: string;
  product_name: string;
  product_image: string;
  product_price: number;
  vendor_id: string;
  vendor_name: string;
  score: number;
  reason: 'similar_users' | 'similar_products' | 'trending' | 'viewed_together' | 'bought_together' | 'personalized';
  confidence: number;
}

export interface UserBehavior {
  user_id: string;
  viewed_products: string[];
  purchased_products: string[];
  cart_products: string[];
  searched_terms: string[];
  favorite_categories: string[];
  favorite_vendors: string[];
}

export interface RecommendationConfig {
  limit?: number;
  include_trending?: boolean;
  include_similar?: boolean;
  include_personalized?: boolean;
  exclude_purchased?: boolean;
  min_confidence?: number;
}

// Cache local pour performances
const recommendationCache = new Map<string, { data: ProductRecommendation[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Service principal de recommandations
 */
export class MLRecommendationService {

  /**
   * Obtenir des recommandations personnalisées pour un utilisateur
   */
  static async getPersonalizedRecommendations(
    userId: string,
    config: RecommendationConfig = {}
  ): Promise<ProductRecommendation[]> {
    const {
      limit = 12,
      include_trending = true,
      include_similar = true,
      include_personalized = true,
      exclude_purchased = true,
      min_confidence = 0.3
    } = config;

    // Vérifier le cache
    const cacheKey = `reco_${userId}_${JSON.stringify(config)}`;
    const cached = recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[ML] Returning cached recommendations');
      return cached.data;
    }

    try {
      // 1. Récupérer le comportement utilisateur
      const behavior = await this.getUserBehavior(userId);

      // 2. Collecter les recommandations de différentes sources
      const recommendations: ProductRecommendation[] = [];

      // Recommandations personnalisées basées sur l'historique
      if (include_personalized && behavior.viewed_products.length > 0) {
        const personalized = await this.getContentBasedRecommendations(behavior, limit);
        recommendations.push(...personalized);
      }

      // Produits similaires (collaborative filtering)
      if (include_similar && behavior.purchased_products.length > 0) {
        const similar = await this.getCollaborativeRecommendations(userId, behavior, limit);
        recommendations.push(...similar);
      }

      // Produits tendance
      if (include_trending) {
        const trending = await this.getTrendingProducts(limit);
        recommendations.push(...trending);
      }

      // 3. Fusionner et scorer
      const merged = this.mergeAndScore(recommendations, behavior, exclude_purchased);

      // 4. Filtrer par confiance minimum
      const filtered = merged.filter(r => r.confidence >= min_confidence);

      // 5. Limiter et trier
      const final = filtered
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Mettre en cache
      recommendationCache.set(cacheKey, { data: final, timestamp: Date.now() });

      console.log(`[ML] Generated ${final.length} recommendations for user ${userId}`);
      return final;

    } catch (error) {
      console.error('[ML] Error generating recommendations:', error);
      // Fallback : produits populaires
      return this.getTrendingProducts(limit);
    }
  }

  /**
   * Récupérer le comportement d'un utilisateur
   */
  static async getUserBehavior(userId: string): Promise<UserBehavior> {
    const behavior: UserBehavior = {
      user_id: userId,
      viewed_products: [],
      purchased_products: [],
      cart_products: [],
      searched_terms: [],
      favorite_categories: [],
      favorite_vendors: []
    };

    try {
      // Produits vus (30 derniers jours)
      const { data: views } = await supabase
        .from('product_views_raw')
        .select('product_id')
        .eq('user_id', userId)
        .gte('viewed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('viewed_at', { ascending: false })
        .limit(50);

      if (views) {
        behavior.viewed_products = [...new Set(views.map(v => v.product_id))];
      }

      // Produits achetés
      const { data: orders } = await supabase
        .from('order_items')
        .select('product_id, orders!inner(customer_id)')
        .eq('orders.customer_id', userId)
        .limit(100);

      if (orders) {
        behavior.purchased_products = [...new Set(orders.map(o => o.product_id))];
      }

      // Panier actuel
      const { data: cart } = await (supabase as any)
        .from('cart_items')
        .select('product_id')
        .eq('user_id', userId);

      if (cart) {
        behavior.cart_products = cart.map((c: any) => c.product_id);
      }

      // Termes recherchés (si table existe)
      const { data: searches } = await (supabase as any)
        .from('user_searches')
        .select('search_term')
        .eq('user_id', userId)
        .order('searched_at', { ascending: false })
        .limit(20);

      if (searches) {
        behavior.searched_terms = searches.map((s: any) => s.search_term);
      }

      // Catégories favorites (basées sur les achats)
      const { data: categories } = await (supabase as any)
        .from('products')
        .select('category_id')
        .in('id', behavior.purchased_products.slice(0, 20));

      if (categories) {
        const categoryCount: Record<string, number> = {};
        categories.forEach((c: any) => {
          if (c.category_id) {
            categoryCount[c.category_id] = (categoryCount[c.category_id] || 0) + 1;
          }
        });
        behavior.favorite_categories = Object.entries(categoryCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([cat]) => cat);
      }

      // Vendeurs favoris
      const { data: vendors } = await supabase
        .from('products')
        .select('vendor_id')
        .in('id', behavior.purchased_products.slice(0, 20));

      if (vendors) {
        const vendorCount: Record<string, number> = {};
        vendors.forEach(v => {
          if (v.vendor_id) {
            vendorCount[v.vendor_id] = (vendorCount[v.vendor_id] || 0) + 1;
          }
        });
        behavior.favorite_vendors = Object.entries(vendorCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([vendor]) => vendor);
      }

    } catch (error) {
      console.error('[ML] Error fetching user behavior:', error);
    }

    return behavior;
  }

  /**
   * Recommandations basées sur le contenu (Content-Based Filtering)
   * Trouve des produits similaires à ceux que l'utilisateur a aimés
   */
  static async getContentBasedRecommendations(
    behavior: UserBehavior,
    limit: number
  ): Promise<ProductRecommendation[]> {
    const recommendations: ProductRecommendation[] = [];

    try {
      // Récupérer les produits des catégories favorites
      if (behavior.favorite_categories.length > 0) {
        const { data: products } = await (supabase as any)
          .from('products')
          .select(`
            id,
            name,
            images,
            price,
            vendor_id,
            vendors!inner(business_name)
          `)
          .in('category', behavior.favorite_categories)
          .eq('is_active', true)
          .not('id', 'in', `(${behavior.purchased_products.join(',')})`)
          .order('created_at', { ascending: false })
          .limit(limit * 2);

        if (products) {
          products.forEach(p => {
            recommendations.push({
              product_id: p.id,
              product_name: p.name,
              product_image: Array.isArray(p.images) ? p.images[0] : p.images,
              product_price: p.price,
              vendor_id: p.vendor_id,
              vendor_name: (p.vendors as any)?.business_name || 'Vendeur',
              score: 0.7,
              reason: 'similar_products',
              confidence: 0.65
            });
          });
        }
      }

      // Récupérer les produits des vendeurs favoris
      if (behavior.favorite_vendors.length > 0) {
        const { data: vendorProducts } = await supabase
          .from('products')
          .select(`
            id,
            name,
            images,
            price,
            vendor_id,
            vendors!inner(business_name)
          `)
          .in('vendor_id', behavior.favorite_vendors)
          .eq('is_active', true)
          .not('id', 'in', `(${behavior.purchased_products.join(',')})`)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (vendorProducts) {
          vendorProducts.forEach(p => {
            // Éviter les doublons
            if (!recommendations.find(r => r.product_id === p.id)) {
              recommendations.push({
                product_id: p.id,
                product_name: p.name,
                product_image: Array.isArray(p.images) ? p.images[0] : p.images,
                product_price: p.price,
                vendor_id: p.vendor_id,
                vendor_name: (p.vendors as any)?.business_name || 'Vendeur',
                score: 0.6,
                reason: 'personalized',
                confidence: 0.55
              });
            }
          });
        }
      }

    } catch (error) {
      console.error('[ML] Error in content-based recommendations:', error);
    }

    return recommendations;
  }

  /**
   * Recommandations collaboratives (Collaborative Filtering)
   * "Les utilisateurs qui ont acheté X ont aussi acheté Y"
   */
  static async getCollaborativeRecommendations(
    userId: string,
    behavior: UserBehavior,
    limit: number
  ): Promise<ProductRecommendation[]> {
    const recommendations: ProductRecommendation[] = [];

    try {
      // Trouver les utilisateurs similaires (qui ont acheté les mêmes produits)
      if (behavior.purchased_products.length > 0) {
        const { data: similarUsers } = await supabase
          .from('order_items')
          .select('orders!inner(customer_id)')
          .in('product_id', behavior.purchased_products.slice(0, 10))
          .neq('orders.customer_id', userId)
          .limit(50);

        if (similarUsers && similarUsers.length > 0) {
          // Compter les utilisateurs par fréquence
          const userCount: Record<string, number> = {};
          similarUsers.forEach((item: any) => {
            const customerId = item.orders?.customer_id;
            if (customerId) {
              userCount[customerId] = (userCount[customerId] || 0) + 1;
            }
          });

          // Prendre les 10 utilisateurs les plus similaires
          const topSimilarUsers = Object.entries(userCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id]) => id);

          // Récupérer les produits achetés par ces utilisateurs
          const { data: collaborativeProducts } = await supabase
            .from('order_items')
            .select(`
              product_id,
              products!inner(id, name, images, price, vendor_id, vendors(business_name))
            `)
            .in('orders.customer_id', topSimilarUsers)
            .not('product_id', 'in', `(${behavior.purchased_products.join(',')})`)
            .limit(limit * 2);

          if (collaborativeProducts) {
            // Compter la fréquence de chaque produit
            const productFrequency: Record<string, number> = {};
            collaborativeProducts.forEach((item: any) => {
              productFrequency[item.product_id] = (productFrequency[item.product_id] || 0) + 1;
            });

            // Créer les recommandations
            const uniqueProducts = new Map<string, any>();
            collaborativeProducts.forEach((item: any) => {
              if (!uniqueProducts.has(item.product_id)) {
                uniqueProducts.set(item.product_id, item.products);
              }
            });

            uniqueProducts.forEach((product, productId) => {
              const frequency = productFrequency[productId] || 1;
              recommendations.push({
                product_id: productId,
                product_name: product.name,
                product_image: Array.isArray(product.images) ? product.images[0] : product.images,
                product_price: product.price,
                vendor_id: product.vendor_id,
                vendor_name: product.vendors?.business_name || 'Vendeur',
                score: Math.min(0.9, 0.5 + (frequency * 0.1)),
                reason: 'bought_together',
                confidence: Math.min(0.85, 0.4 + (frequency * 0.1))
              });
            });
          }
        }
      }

    } catch (error) {
      console.error('[ML] Error in collaborative recommendations:', error);
    }

    return recommendations;
  }

  /**
   * Produits tendance (Trending)
   * Basé sur les vues, ventes et ajouts au panier récents
   */
  static async getTrendingProducts(limit: number): Promise<ProductRecommendation[]> {
    const recommendations: ProductRecommendation[] = [];

    try {
      // Utiliser les stats quotidiennes si disponibles
      const { data: trendingStats } = await supabase
        .from('analytics_daily_stats')
        .select(`
          product_id,
          views_count,
          unique_visitors,
          products!inner(id, name, images, price, vendor_id, vendors(business_name))
        `)
        .gte('stat_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('views_count', { ascending: false })
        .limit(limit * 2);

      if (trendingStats && trendingStats.length > 0) {
        // Agréger par produit
        const productScores: Record<string, { score: number; product: any }> = {};

        trendingStats.forEach((stat: any) => {
          if (!productScores[stat.product_id]) {
            productScores[stat.product_id] = {
              score: 0,
              product: stat.products
            };
          }
          productScores[stat.product_id].score += stat.views_count + (stat.unique_visitors * 2);
        });

        // Trier et créer les recommandations
        Object.entries(productScores)
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, limit)
          .forEach(([productId, data]) => {
            recommendations.push({
              product_id: productId,
              product_name: data.product.name,
              product_image: Array.isArray(data.product.images) ? data.product.images[0] : data.product.images,
              product_price: data.product.price,
              vendor_id: data.product.vendor_id,
              vendor_name: data.product.vendors?.business_name || 'Vendeur',
              score: Math.min(0.8, data.score / 1000),
              reason: 'trending',
              confidence: 0.7
            });
          });
      } else {
        // Fallback : produits récents populaires
        const { data: recentProducts } = await supabase
          .from('products')
          .select(`
            id,
            name,
            images,
            price,
            vendor_id,
            vendors!inner(business_name)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (recentProducts) {
          recentProducts.forEach((p, index) => {
            recommendations.push({
              product_id: p.id,
              product_name: p.name,
              product_image: Array.isArray(p.images) ? p.images[0] : p.images,
              product_price: p.price,
              vendor_id: p.vendor_id,
              vendor_name: (p.vendors as any)?.business_name || 'Vendeur',
              score: 0.5 - (index * 0.02),
              reason: 'trending',
              confidence: 0.5
            });
          });
        }
      }

    } catch (error) {
      console.error('[ML] Error fetching trending products:', error);
    }

    return recommendations;
  }

  /**
   * Produits fréquemment achetés ensemble
   */
  static async getFrequentlyBoughtTogether(
    productId: string,
    limit: number = 4
  ): Promise<ProductRecommendation[]> {
    const recommendations: ProductRecommendation[] = [];

    try {
      // Trouver les commandes contenant ce produit
      const { data: orders } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('product_id', productId)
        .limit(100);

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.order_id);

        // Trouver les autres produits dans ces commandes
        const { data: relatedItems } = await supabase
          .from('order_items')
          .select(`
            product_id,
            products!inner(id, name, images, price, vendor_id, vendors(business_name))
          `)
          .in('order_id', orderIds)
          .neq('product_id', productId)
          .limit(50);

        if (relatedItems) {
          // Compter la fréquence
          const frequency: Record<string, { count: number; product: any }> = {};
          relatedItems.forEach((item: any) => {
            if (!frequency[item.product_id]) {
              frequency[item.product_id] = { count: 0, product: item.products };
            }
            frequency[item.product_id].count++;
          });

          // Trier par fréquence
          Object.entries(frequency)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit)
            .forEach(([pid, data]) => {
              recommendations.push({
                product_id: pid,
                product_name: data.product.name,
                product_image: Array.isArray(data.product.images) ? data.product.images[0] : data.product.images,
                product_price: data.product.price,
                vendor_id: data.product.vendor_id,
                vendor_name: data.product.vendors?.business_name || 'Vendeur',
                score: Math.min(0.9, 0.5 + (data.count * 0.05)),
                reason: 'bought_together',
                confidence: Math.min(0.85, 0.4 + (data.count * 0.05))
              });
            });
        }
      }

    } catch (error) {
      console.error('[ML] Error in frequently bought together:', error);
    }

    return recommendations;
  }

  /**
   * Produits vus ensemble
   */
  static async getViewedTogether(
    productId: string,
    limit: number = 4
  ): Promise<ProductRecommendation[]> {
    const recommendations: ProductRecommendation[] = [];

    try {
      // Trouver les utilisateurs qui ont vu ce produit
      const { data: viewers } = await supabase
        .from('product_views_raw')
        .select('user_id, session_id')
        .eq('product_id', productId)
        .gte('viewed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (viewers && viewers.length > 0) {
        const sessionIds = [...new Set(viewers.map(v => v.session_id).filter(Boolean))];

        if (sessionIds.length > 0) {
          // Trouver les autres produits vus dans ces sessions
          const { data: relatedViews } = await supabase
            .from('product_views_raw')
            .select(`
              product_id,
              products!inner(id, name, images, price, vendor_id, vendors(business_name))
            `)
            .in('session_id', sessionIds.slice(0, 50))
            .neq('product_id', productId)
            .limit(50);

          if (relatedViews) {
            // Compter la fréquence
            const frequency: Record<string, { count: number; product: any }> = {};
            relatedViews.forEach((item: any) => {
              if (!frequency[item.product_id]) {
                frequency[item.product_id] = { count: 0, product: item.products };
              }
              frequency[item.product_id].count++;
            });

            // Trier par fréquence
            Object.entries(frequency)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, limit)
              .forEach(([pid, data]) => {
                recommendations.push({
                  product_id: pid,
                  product_name: data.product.name,
                  product_image: Array.isArray(data.product.images) ? data.product.images[0] : data.product.images,
                  product_price: data.product.price,
                  vendor_id: data.product.vendor_id,
                  vendor_name: data.product.vendors?.business_name || 'Vendeur',
                  score: Math.min(0.7, 0.3 + (data.count * 0.04)),
                  reason: 'viewed_together',
                  confidence: Math.min(0.7, 0.3 + (data.count * 0.04))
                });
              });
          }
        }
      }

    } catch (error) {
      console.error('[ML] Error in viewed together:', error);
    }

    return recommendations;
  }

  /**
   * Fusionner et scorer les recommandations
   */
  private static mergeAndScore(
    recommendations: ProductRecommendation[],
    behavior: UserBehavior,
    excludePurchased: boolean
  ): ProductRecommendation[] {
    // Dédupliquer par product_id, garder le meilleur score
    const merged = new Map<string, ProductRecommendation>();

    recommendations.forEach(rec => {
      // Exclure les produits déjà achetés
      if (excludePurchased && behavior.purchased_products.includes(rec.product_id)) {
        return;
      }

      // Exclure les produits dans le panier
      if (behavior.cart_products.includes(rec.product_id)) {
        return;
      }

      const existing = merged.get(rec.product_id);
      if (!existing || rec.score > existing.score) {
        // Boost si le produit correspond aux recherches
        let boostedScore = rec.score;
        if (behavior.searched_terms.length > 0) {
          const nameWords = rec.product_name.toLowerCase().split(' ');
          const matchingTerms = behavior.searched_terms.filter(term =>
            nameWords.some(word => word.includes(term.toLowerCase()))
          );
          if (matchingTerms.length > 0) {
            boostedScore = Math.min(1, boostedScore + 0.15);
          }
        }

        merged.set(rec.product_id, {
          ...rec,
          score: boostedScore
        });
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Enregistrer une interaction (pour améliorer les recommandations)
   */
  static async trackInteraction(
    userId: string,
    productId: string,
    interactionType: 'view' | 'cart_add' | 'purchase' | 'wishlist'
  ): Promise<void> {
    try {
      await (supabase as any)
        .from('ml_interactions')
        .insert({
          user_id: userId,
          product_id: productId,
          interaction_type: interactionType,
          created_at: new Date().toISOString()
        });

      // Invalider le cache pour cet utilisateur
      recommendationCache.forEach((_, key) => {
        if (key.startsWith(`reco_${userId}`)) {
          recommendationCache.delete(key);
        }
      });

    } catch (error) {
      // Silently fail - tracking shouldn't break the app
      console.warn('[ML] Failed to track interaction:', error);
    }
  }

  /**
   * Vider le cache (utile après des changements majeurs)
   */
  static clearCache(): void {
    recommendationCache.clear();
    console.log('[ML] Recommendation cache cleared');
  }
}

export default MLRecommendationService;
