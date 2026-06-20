/**
 * 🧠 TRACKING COMPORTEMENTAL ALIBABA-STYLE - 224SOLUTIONS
 * Track scroll depth, time spent, clicks, searches en temps réel
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BehaviorSession {
  productId?: string;
  sessionType: 'browse' | 'search' | 'category_browse' | 'product_view';
  categoryId?: string;
  searchQuery?: string;
}

export function useBehaviorTracking(session: BehaviorSession, enabled = true) {
  const startTime = useRef(Date.now());
  const scrollDepth = useRef(0);
  const clickCount = useRef(0);
  const savedRef = useRef(false);

  // Track scroll depth
  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const depth = Math.min(100, Math.round((scrollTop / (docHeight - winHeight)) * 100));
      if (depth > scrollDepth.current) scrollDepth.current = depth;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled]);

  // Track clicks
  useEffect(() => {
    if (!enabled) return;

    const handleClick = () => { clickCount.current++; };
    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [enabled]);

  // Save session on unmount or page change
  const saveSession = useCallback(async () => {
    if (savedRef.current) return;
    savedRef.current = true;

    const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
    if (timeSpent < 2) return; // Skip very short sessions

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await (supabase.from('user_behavior_sessions') as any).insert({
        user_id: user.id,
        product_id: session.productId || null,
        session_type: session.sessionType,
        scroll_depth: scrollDepth.current,
        time_spent_seconds: timeSpent,
        click_count: clickCount.current,
        search_query: session.searchQuery || null,
        category_id: session.categoryId || null,
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        referrer: document.referrer || null,
      });
    } catch (err) {
      console.warn('[BehaviorTracking] Save error:', err);
    }
  }, [session.productId, session.sessionType, session.categoryId, session.searchQuery]);

  useEffect(() => {
    if (!enabled) return;

    startTime.current = Date.now();
    scrollDepth.current = 0;
    clickCount.current = 0;
    savedRef.current = false;

    return () => { saveSession(); };
  }, [enabled, session.productId, session.sessionType, saveSession]);

  return { saveSession };
}

/** Track a search query for recommendation engine */
export async function trackSearchQuery(query: string, resultsCount: number, clickedProductIds?: string[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from('user_search_history') as any).insert({
      user_id: user.id,
      query,
      results_count: resultsCount,
      clicked_product_ids: clickedProductIds || [],
    });
  } catch (err) {
    console.warn('[BehaviorTracking] Search track error:', err);
  }
}
