/**
 * Hook: Gestion du menu restaurant
 * CRUD catégories et plats avec professional_service_id
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import offlineDB from '@/lib/offlineDB';

// Cache du menu (catégories + plats) pour que la CAISSE restaurant fonctionne hors ligne.
// IndexedDB (offlineDB), même mécanique que le catalogue du POS vendeur.
const MENU_CATS_CACHE = (sid: string) => `restaurant_menu_cats_${sid}`;
const MENU_ITEMS_CACHE = (sid: string) => `restaurant_menu_items_${sid}`;
const MENU_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

export interface MenuCategory {
  id: string;
  professional_service_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  available_from: string | null;
  available_until: string | null;
  image_url: string | null;
  created_at: string;
}

export interface MenuItem {
  id: string;
  professional_service_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  image_url: string | null;
  images: string[] | null;
  video_url: string | null;
  preparation_time: number;
  calories: number | null;
  allergens: string[] | null;
  dietary_tags: string[] | null;
  spicy_level: number;
  is_available: boolean;
  is_featured: boolean;
  is_new: boolean;
  display_order: number;
  ingredients: any;
  variants: any;
  stock_quantity: number | null;   // NULL = illimité ; nombre = portions restantes
  section: string | null;          // regroupement libre (ex. « Midi », « Bar ») en plus de la catégorie
  created_at: string;
  category?: MenuCategory;
}

export function useRestaurantMenu(serviceId: string) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    // HORS LIGNE : servir directement le dernier menu connu depuis le cache (zéro réseau)
    // → la caisse restaurant reste utilisable sans connexion.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      try {
        const [cats, items] = await Promise.all([
          offlineDB.getCachedData<MenuCategory[]>(MENU_CATS_CACHE(serviceId)),
          offlineDB.getCachedData<MenuItem[]>(MENU_ITEMS_CACHE(serviceId)),
        ]);
        if (cats) setCategories(cats);
        if (items) setMenuItems(items);
      } catch (cacheErr) {
        console.warn('⚠️ [Restaurant] Lecture cache menu échouée:', cacheErr);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Charger les catégories
      const { data: categoriesData, error: catError } = await supabase
        .from('restaurant_menu_categories')
        .select('*')
        .eq('professional_service_id', serviceId)
        .order('display_order', { ascending: true });

      if (catError) throw catError;
      setCategories(categoriesData || []);

      // Charger les plats
      const { data: itemsData, error: itemsError } = await supabase
        .from('restaurant_menu_items')
        .select('*')
        .eq('professional_service_id', serviceId)
        .order('display_order', { ascending: true });

      if (itemsError) throw itemsError;
      setMenuItems(itemsData || []);

      // Mettre le menu en cache pour un usage hors ligne ultérieur (non bloquant).
      void offlineDB.cacheData(MENU_CATS_CACHE(serviceId), categoriesData || [], MENU_CACHE_TTL, false);
      void offlineDB.cacheData(MENU_ITEMS_CACHE(serviceId), itemsData || [], MENU_CACHE_TTL, false);

    } catch (err: any) {
      console.error('Erreur chargement menu:', err);
      // Repli : si le réseau échoue silencieusement, servir le dernier menu connu.
      try {
        const [cats, items] = await Promise.all([
          offlineDB.getCachedData<MenuCategory[]>(MENU_CATS_CACHE(serviceId)),
          offlineDB.getCachedData<MenuItem[]>(MENU_ITEMS_CACHE(serviceId)),
        ]);
        if (cats || items) {
          if (cats) setCategories(cats);
          if (items) setMenuItems(items);
        } else {
          setError(err.message);
        }
      } catch {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  // CRUD Catégories
  const createCategory = async (data: { name: string } & Partial<Omit<MenuCategory, 'name'>>) => {
    const { data: newCat, error } = await supabase
      .from('restaurant_menu_categories')
      .insert([{
        name: data.name,
        description: data.description,
        icon: data.icon,
        display_order: data.display_order ?? 0,
        is_active: data.is_active ?? true,
        available_from: data.available_from,
        available_until: data.available_until,
        image_url: data.image_url,
        professional_service_id: serviceId
      }])
      .select()
      .single();

    if (error) throw error;
    setCategories(prev => [...prev, newCat]);
    return newCat;
  };

  const updateCategory = async (id: string, data: Partial<MenuCategory>) => {
    const { data: updated, error } = await supabase
      .from('restaurant_menu_categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setCategories(prev => prev.map(c => c.id === id ? updated : c));
    return updated;
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from('restaurant_menu_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  // CRUD Menu Items
  const createMenuItem = async (data: { name: string; price: number } & Partial<Omit<MenuItem, 'name' | 'price'>>) => {
    const { data: newItem, error } = await supabase
      .from('restaurant_menu_items')
      .insert([{
        name: data.name,
        price: data.price,
        description: data.description,
        category_id: data.category_id,
        image_url: data.image_url,
        images: data.images ?? [],
        video_url: data.video_url ?? null,
        preparation_time: data.preparation_time ?? 15,
        is_available: data.is_available ?? true,
        is_featured: data.is_featured ?? false,
        is_new: data.is_new ?? false,
        spicy_level: data.spicy_level ?? 0,
        display_order: data.display_order ?? 0,
        allergens: data.allergens,
        dietary_tags: data.dietary_tags,
        variants: data.variants ?? null,        // ⚠️ options/suppléments — était oublié (perdues à la création)
        ingredients: data.ingredients ?? null,
        stock_quantity: data.stock_quantity ?? null,  // NULL = illimité
        section: (data.section ?? null) || null,
        professional_service_id: serviceId
      }])
      .select()
      .single();

    if (error) throw error;
    setMenuItems(prev => [...prev, newItem]);
    return newItem;
  };

  const updateMenuItem = async (id: string, data: Partial<MenuItem>) => {
    const { data: updated, error } = await supabase
      .from('restaurant_menu_items')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setMenuItems(prev => prev.map(i => i.id === id ? updated : i));
    return updated;
  };

  const deleteMenuItem = async (id: string) => {
    const { error } = await supabase
      .from('restaurant_menu_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setMenuItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleItemAvailability = async (id: string) => {
    const item = menuItems.find(i => i.id === id);
    if (!item) return;

    await updateMenuItem(id, { is_available: !item.is_available });
  };

  // Décrément LOCAL du stock pour une vente encaissée HORS LIGNE : met à jour l'affichage ET le
  // cache (sans réseau), pour que le « restant » baisse immédiatement et survive à un rechargement
  // hors ligne. Le vrai décrément serveur se fait à la resync (RPC). Plats à stock NULL = illimités,
  // ignorés. Au retour en ligne, loadMenu recharge le stock réel et écrase ce cache.
  const decrementLocalStock = useCallback((lines: { menuItemId: string; quantity: number }[]) => {
    setMenuItems(prev => {
      const updated = prev.map(item => {
        const line = lines.find(l => l.menuItemId === item.id);
        if (!line || item.stock_quantity == null) return item;
        const next = Math.max(0, item.stock_quantity - line.quantity);
        return { ...item, stock_quantity: next, is_available: next > 0 ? item.is_available : false };
      });
      void offlineDB.cacheData(MENU_ITEMS_CACHE(serviceId), updated, MENU_CACHE_TTL, false);
      return updated;
    });
  }, [serviceId]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // ✅ Alertes stock : plats à stock suivi sous le seuil (rupture imminente) ou épuisés.
  // Stock NULL = illimité → ignoré.
  const LOW_STOCK_THRESHOLD = 5;
  const lowStockItems = useMemo(
    () => menuItems.filter(
      (m) => m.stock_quantity != null && m.stock_quantity > 0 && m.stock_quantity <= LOW_STOCK_THRESHOLD
    ),
    [menuItems]
  );
  const outOfStockItems = useMemo(
    () => menuItems.filter((m) => m.stock_quantity != null && m.stock_quantity <= 0),
    [menuItems]
  );

  return {
    categories,
    menuItems,
    loading,
    error,
    refresh: loadMenu,
    createCategory,
    updateCategory,
    deleteCategory,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleItemAvailability,
    decrementLocalStock,
    lowStockItems,
    outOfStockItems,
  };
}
