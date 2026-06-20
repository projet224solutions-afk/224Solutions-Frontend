/**
 * ProductImageCarousel - Composant Premium pour Marketplace
 * 224Solutions - Auto-défilement fluide avec animations premium
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PlayCircle, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImageCarouselProps {
  images: string[];
  videos?: string[];
  alt?: string;
  className?: string;
  autoPlayInterval?: number;
  showDots?: boolean;
}

interface MediaItem {
  type: 'image' | 'video';
  src: string;
}

export function ProductImageCarousel({
  images = [],
  videos = [],
  alt = 'Product image',
  className,
  autoPlayInterval = 15000,
  showDots = true,
}: ProductImageCarouselProps) {
  const mediaItems = useMemo<MediaItem[]>(() => [
    ...videos.filter(Boolean).map((src) => ({ type: 'video' as const, src })),
    ...images.filter(Boolean).map((src) => ({ type: 'image' as const, src })),
  ], [videos, images]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [loadedMedia, setLoadedMedia] = useState<Set<number>>(new Set([0]));
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isMuted, setIsMuted] = useState(true);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Refs pour accès direct au DOM — React ne met pas à jour muted de façon réactive
  const videoRefsMap = useRef<Map<number, HTMLVideoElement>>(new Map());
  const singleVideoRef = useRef<HTMLVideoElement | null>(null);

  const hasVideos = mediaItems.some(m => m.type === 'video');

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const next = !isMuted;
    setIsMuted(next);
    // Appliquer directement sur les éléments DOM
    videoRefsMap.current.forEach(el => { el.muted = next; });
    if (singleVideoRef.current) singleVideoRef.current.muted = next;
  }, [isMuted]);

  useEffect(() => {
    if (mediaItems.length <= 1 || isHovered) {
      return;
    }

    const interval = setInterval(() => {
      setDirection('next');
      setCurrentIndex((prev) => {
        const next = (prev + 1) % mediaItems.length;
        setLoadedMedia((loaded) => new Set(loaded).add(next));
        return next;
      });
    }, autoPlayInterval);

    return () => {
      clearInterval(interval);
    };
  }, [mediaItems.length, autoPlayInterval, isHovered]);

  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isHovered) {
      mediaItems.forEach((_, index) => {
        setLoadedMedia((loaded) => new Set(loaded).add(index));
      });
    }
  }, [isHovered, mediaItems]);

  if (mediaItems.length === 0) {
    return (
      <div className={cn('relative w-full aspect-square bg-muted/30 rounded-lg overflow-hidden', className)}>
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          No image
        </div>
      </div>
    );
  }

  if (mediaItems.length === 1) {
    const item = mediaItems[0];

    return (
      <div className={cn('relative w-full aspect-square bg-muted/10 rounded-lg overflow-hidden', className)}>
        {item.type === 'video' ? (
          <>
            <video
              ref={singleVideoRef}
              src={item.src}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
            />
            <div className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white">
              <PlayCircle className="h-4 w-4" />
            </div>
            <button
              onClick={toggleMute}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors z-20"
              title={isMuted ? 'Activer le son' : 'Couper le son'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </>
        ) : (
          <img
            src={item.src}
            alt={alt}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-product.png';
            }}
          />
        )}
      </div>
    );
  }

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (currentIndex !== 0) {
      setDirection('prev');
      setCurrentIndex(0);
    }
  };

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsHovered(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 2000);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setDirection('next');
      setCurrentIndex((prev) => {
        const next = (prev + 1) % mediaItems.length;
        setLoadedMedia((loaded) => new Set(loaded).add(next));
        return next;
      });
    }

    if (isRightSwipe) {
      setDirection('prev');
      setCurrentIndex((prev) => {
        const next = (prev - 1 + mediaItems.length) % mediaItems.length;
        setLoadedMedia((loaded) => new Set(loaded).add(next));
        return next;
      });
    }

    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 2000);
  };

  return (
    <div
      className={cn(
        'relative w-full aspect-square bg-gradient-to-br from-muted/5 to-muted/20 rounded-lg overflow-hidden group',
        'cursor-pointer select-none',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative w-full h-full">
        {mediaItems.map((item, index) => {
          const isActive = index === currentIndex;
          const shouldLoad = loadedMedia.has(index);

          return (
            <div
              key={`${item.type}-${item.src}-${index}`}
              className={cn(
                'absolute inset-0 transition-all duration-700 ease-out',
                isActive
                  ? 'opacity-100 scale-100 z-10'
                  : 'opacity-0 scale-95 z-0',
                direction === 'next' && isActive && 'animate-slide-in-right',
                direction === 'prev' && isActive && 'animate-slide-in-left'
              )}
            >
              {shouldLoad ? (
                item.type === 'video' ? (
                  <>
                    <video
                      ref={(el) => {
                        if (el) videoRefsMap.current.set(index, el);
                        else videoRefsMap.current.delete(index);
                      }}
                      src={item.src}
                      className={cn(
                        'w-full h-full object-cover transition-transform duration-700',
                        'group-hover:scale-105'
                      )}
                      muted
                      loop
                      playsInline
                      autoPlay={isActive}
                      preload="metadata"
                    />
                    <div className="absolute left-2 top-2 z-20 rounded-full bg-black/60 p-1 text-white">
                      <PlayCircle className="h-4 w-4" />
                    </div>
                  </>
                ) : (
                  <img
                    src={item.src}
                    alt={`${alt} ${index + 1}`}
                    className={cn(
                      'w-full h-full object-cover transition-transform duration-700',
                      'group-hover:scale-105'
                    )}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-product.png';
                    }}
                  />
                )
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-muted/10 to-muted/30 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20'
        )}
      />

      {showDots && mediaItems.length > 1 && (
        <div className="absolute top-2 right-10 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-white text-xs font-medium">
            {currentIndex + 1}/{mediaItems.length}
          </div>
        </div>
      )}

      {hasVideos && (
        <button
          onClick={toggleMute}
          className="absolute right-2 top-2 z-30 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
          title={isMuted ? 'Activer le son' : 'Couper le son'}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {!loadedMedia.has(0) && (
        <div className="absolute inset-0 z-40 bg-muted/20 animate-pulse">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductImageCarousel;
