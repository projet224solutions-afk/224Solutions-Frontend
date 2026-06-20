/**
 * HorizontalScrollRow - Défilement horizontal professionnel style Alibaba/Amazon
 * Support: Touch swipe, boutons flèches, scroll molette, snap points
 */

import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HorizontalScrollRowProps {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  showArrows?: boolean;
  arrowSize?: 'sm' | 'md' | 'lg';
  snapAlign?: 'start' | 'center' | 'none';
  gap?: number;
  autoScroll?: boolean;
  autoScrollInterval?: number;
}

export function HorizontalScrollRow({
  children,
  className,
  showArrows = true,
  arrowSize = 'md',
  snapAlign = 'start',
  gap = 12,
  autoScroll = false,
  autoScrollInterval = 4000,
}: HorizontalScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, children]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll || isHovered) {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
      return;
    }
    autoScrollRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: el.clientWidth * 0.8, behavior: 'smooth' });
      }
    }, autoScrollInterval);
    return () => { if (autoScrollRef.current) clearInterval(autoScrollRef.current); };
  }, [autoScroll, autoScrollInterval, isHovered]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const arrowSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={cn('group/scroll relative', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left arrow */}
      {showArrows && canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-20',
            'bg-card/95 backdrop-blur-sm border border-border shadow-lg rounded-full',
            'flex items-center justify-center',
            'opacity-0 group-hover/scroll:opacity-100 transition-all duration-300',
            'hover:bg-white hover:text-foreground hover:scale-110',
            'active:scale-95',
            arrowSizes[arrowSize]
          )}
          aria-label="Défiler à gauche"
        >
          <ChevronLeft className={iconSizes[arrowSize]} />
        </button>
      )}

      {/* Right arrow */}
      {showArrows && canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-20',
            'bg-card/95 backdrop-blur-sm border border-border shadow-lg rounded-full',
            'flex items-center justify-center',
            'opacity-0 group-hover/scroll:opacity-100 transition-all duration-300',
            'hover:bg-white hover:text-foreground hover:scale-110',
            'active:scale-95',
            arrowSizes[arrowSize]
          )}
          aria-label="Défiler à droite"
        >
          <ChevronRight className={iconSizes[arrowSize]} />
        </button>
      )}

      {/* Fade edges */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className={cn(
          'flex overflow-x-auto scrollbar-hide',
          'scroll-smooth',
          snapAlign !== 'none' && 'snap-x snap-mandatory',
          '-webkit-overflow-scrolling-touch'
        )}
        style={{ gap: `${gap}px`, paddingLeft: 4, paddingRight: 4 }}
      >
        {children}
      </div>
    </div>
  );
}

/** Wrapper for items inside HorizontalScrollRow */
export function ScrollItem({
  children,
  className,
  width,
  snapAlign = 'start',
}: {
  children: ReactNode;
  className?: string;
  width?: string;
  snapAlign?: 'start' | 'center' | 'end';
}) {
  return (
    <div
      className={cn(
        'shrink-0',
        snapAlign === 'start' && 'snap-start',
        snapAlign === 'center' && 'snap-center',
        snapAlign === 'end' && 'snap-end',
        className
      )}
      style={width ? { width } : undefined}
    >
      {children}
    </div>
  );
}
