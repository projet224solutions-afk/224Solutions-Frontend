/**
 * InfiniteScrollTrigger - Déclenche le chargement automatique au scroll
 * Utilise IntersectionObserver pour performance optimale
 */

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfiniteScrollTriggerProps {
  onTrigger: () => void;
  hasMore: boolean;
  isLoading: boolean;
  className?: string;
  /** Distance en pixels avant le bas de la liste pour déclencher le chargement */
  rootMargin?: string;
}

export function InfiniteScrollTrigger({
  onTrigger,
  hasMore,
  isLoading,
  className,
  rootMargin = '400px',
}: InfiniteScrollTriggerProps) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          onTrigger();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onTrigger, rootMargin]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} className={cn('flex justify-center py-6', className)}>
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Chargement...</span>
        </div>
      )}
    </div>
  );
}
