/**
 * MediaAutoCarousel - Carousel automatique vidéos + images
 * Joue les vidéos une par une, puis défile les images, puis boucle
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface MediaAutoCarouselProps {
  videos?: string[];
  images: string[];
  alt?: string;
  className?: string;
  imageDisplayDuration?: number;
  autoPlay?: boolean;
  showControls?: boolean;
  muted?: boolean;
}

export function MediaAutoCarousel({
  videos = [],
  images = [],
  alt = 'Product',
  className,
  imageDisplayDuration = 15000,
  autoPlay = true,
  showControls = true,
  muted: initialMuted = true,
}: MediaAutoCarouselProps) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(videos.length > 0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isHovered, setIsHovered] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([0]));

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Nettoyer le timer d'image
  const clearImageTimer = useCallback(() => {
    if (imageTimerRef.current) {
      clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }
  }, []);

  // Passer à l'élément suivant
  const goToNext = useCallback(() => {
    if (!isAutoPlaying) return;

    if (isPlayingVideo) {
      if (currentVideoIndex < videos.length - 1) {
        setCurrentVideoIndex(prev => prev + 1);
      } else {
        if (images.length > 0) {
          setIsPlayingVideo(false);
          setCurrentImageIndex(0);
        } else {
          setCurrentVideoIndex(0);
        }
      }
    } else {
      if (currentImageIndex < images.length - 1) {
        setCurrentImageIndex(prev => prev + 1);
        setLoadedImages(prev => new Set(prev).add(currentImageIndex + 1));
      } else {
        if (videos.length > 0) {
          setIsPlayingVideo(true);
          setCurrentVideoIndex(0);
        } else {
          setCurrentImageIndex(0);
        }
      }
    }
  }, [isAutoPlaying, isPlayingVideo, currentVideoIndex, currentImageIndex, videos.length, images.length]);

  // Gérer la fin d'une vidéo
  const handleVideoEnded = useCallback(() => {
    if (isAutoPlaying) {
      goToNext();
    }
  }, [isAutoPlaying, goToNext]);

  // Attacher l'événement de fin de vidéo
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.addEventListener('ended', handleVideoEnded);
      return () => video.removeEventListener('ended', handleVideoEnded);
    }
  }, [handleVideoEnded]);

  // Timer pour les images
  useEffect(() => {
    clearImageTimer();

    if (isAutoPlaying && !isPlayingVideo && images.length > 0) {
      imageTimerRef.current = setTimeout(() => {
        goToNext();
      }, imageDisplayDuration);
    }

    return clearImageTimer;
  }, [isAutoPlaying, isPlayingVideo, currentImageIndex, imageDisplayDuration, goToNext, clearImageTimer, images.length]);

  // Autoplay de la vidéo quand elle change
  useEffect(() => {
    if (isPlayingVideo && videoRef.current && isAutoPlaying) {
      videoRef.current.play().catch(() => {});
    }
  }, [isPlayingVideo, currentVideoIndex, isAutoPlaying]);

  // Reset quand les vidéos changent
  useEffect(() => {
    setCurrentVideoIndex(0);
    setCurrentImageIndex(0);
    setIsPlayingVideo(videos.length > 0);
  }, [videos.length]);

  // Toggle autoplay
  const toggleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      clearImageTimer();
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      setIsAutoPlaying(true);
      if (isPlayingVideo && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isAutoPlaying, isPlayingVideo, clearImageTimer]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  // Preload images on hover
  useEffect(() => {
    if (isHovered) {
      images.forEach((_, index) => {
        setLoadedImages(prev => new Set(prev).add(index));
      });
    }
  }, [isHovered, images]);

  // Pas de media
  if (videos.length === 0 && images.length === 0) {
    return (
      <div className={cn('relative w-full aspect-square bg-muted/30 rounded-lg overflow-hidden', className)}>
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          Aucune image
        </div>
      </div>
    );
  }

  const totalItems = videos.length + images.length;
  const currentIndex = isPlayingVideo ? currentVideoIndex : videos.length + currentImageIndex;

  return (
    <div
      className={cn(
        'relative w-full aspect-square bg-gradient-to-br from-muted/5 to-muted/20 rounded-lg overflow-hidden group',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Video Player */}
      {isPlayingVideo && videos.length > 0 && (
        <video
          ref={videoRef}
          src={videos[currentVideoIndex]}
          className="absolute inset-0 w-full h-full object-cover z-10"
          autoPlay={isAutoPlaying}
          muted={isMuted}
          playsInline
          loop={videos.length === 1 && images.length === 0}
        />
      )}

      {/* Images */}
      {!isPlayingVideo && images.length > 0 && (
        <div className="relative w-full h-full">
          {images.map((image, index) => {
            const isActive = index === currentImageIndex;
            const shouldLoad = loadedImages.has(index);

            return (
              <div
                key={index}
                className={cn(
                  'absolute inset-0 transition-all duration-700 ease-out',
                  isActive
                    ? 'opacity-100 scale-100 z-10'
                    : 'opacity-0 scale-95 z-0'
                )}
              >
                {shouldLoad ? (
                  <img
                    src={image}
                    alt={`${alt} ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-product.png';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-muted/20 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Video indicator badge */}
      {videos.length > 0 && (
        <div className="absolute top-2 left-2 z-30">
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
            isPlayingVideo
              ? "bg-[#ff4000] text-white"
              : "bg-black/60 backdrop-blur-sm text-white"
          )}>
            <Play className="w-3 h-3" />
            {isPlayingVideo ? `Vidéo ${currentVideoIndex + 1}/${videos.length}` : `${videos.length} vidéo(s)`}
          </div>
        </div>
      )}

      {/* Controls overlay */}
      {showControls && (
        <div className={cn(
          "absolute bottom-2 right-2 z-30 flex items-center gap-1",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        )}>
          {/* Play/Pause */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAutoPlay();
            }}
            className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-background hover:text-foreground transition-colors"
            aria-label={isAutoPlaying ? 'Pause' : 'Play'}
          >
            {isAutoPlaying ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </button>

          {/* Mute/Unmute (only for videos) */}
          {videos.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-background hover:text-foreground transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Progress dots */}
      {totalItems > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-30">
          {/* Video dots */}
          {videos.map((_, index) => (
            <button
              key={`video-${index}`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentVideoIndex(index);
                setIsPlayingVideo(true);
              }}
              className={cn(
                'transition-all duration-300 rounded-full',
                isPlayingVideo && index === currentVideoIndex
                  ? 'w-6 h-1.5 bg-[#ff4000] shadow-lg'
                  : 'w-1.5 h-1.5 bg-[#ff4000]/50 hover:bg-[#ff4000]/80'
              )}
              aria-label={`Video ${index + 1}`}
            />
          ))}

          {/* Separator */}
          {videos.length > 0 && images.length > 0 && (
            <div className="w-px h-2 bg-white/30 mx-0.5" />
          )}

          {/* Image dots */}
          {images.map((_, index) => (
            <button
              key={`image-${index}`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentImageIndex(index);
                setIsPlayingVideo(false);
                setLoadedImages(prev => new Set(prev).add(index));
              }}
              className={cn(
                'transition-all duration-300 rounded-full',
                !isPlayingVideo && index === currentImageIndex
                  ? 'w-6 h-1.5 bg-white shadow-lg'
                  : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
              )}
              aria-label={`Image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Item counter */}
      {totalItems > 1 && (
        <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-white text-xs font-medium">
            {currentIndex + 1}/{totalItems}
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaAutoCarousel;
