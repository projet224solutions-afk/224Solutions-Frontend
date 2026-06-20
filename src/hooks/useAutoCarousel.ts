import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAutoCarouselProps {
  videos: string[];
  images: string[];
  imageDisplayDuration?: number; // durée d'affichage de chaque image en ms
  enabled?: boolean;
}

interface UseAutoCarouselReturn {
  currentVideoIndex: number;
  currentImageIndex: number;
  isPlayingVideo: boolean;
  isAutoPlaying: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  goToVideo: (index: number) => void;
  goToImage: (index: number) => void;
  pauseAutoPlay: () => void;
  resumeAutoPlay: () => void;
  toggleAutoPlay: () => void;
}

export function useAutoCarousel({
  videos,
  images,
  imageDisplayDuration = 15000,
  enabled = true
}: UseAutoCarouselProps): UseAutoCarouselReturn {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(videos.length > 0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(enabled);

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
      // Si on joue une vidéo, passer à la vidéo suivante ou aux images
      if (currentVideoIndex < videos.length - 1) {
        setCurrentVideoIndex(prev => prev + 1);
      } else {
        // Toutes les vidéos sont terminées, passer aux images
        if (images.length > 0) {
          setIsPlayingVideo(false);
          setCurrentImageIndex(0);
        } else {
          // Pas d'images, recommencer les vidéos
          setCurrentVideoIndex(0);
        }
      }
    } else {
      // On affiche des images
      if (currentImageIndex < images.length - 1) {
        setCurrentImageIndex(prev => prev + 1);
      } else {
        // Toutes les images sont affichées, recommencer les vidéos
        if (videos.length > 0) {
          setIsPlayingVideo(true);
          setCurrentVideoIndex(0);
        } else {
          // Pas de vidéos, recommencer les images
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
      videoRef.current.play().catch(() => {
        // Autoplay bloqué par le navigateur, continuer quand même
      });
    }
  }, [isPlayingVideo, currentVideoIndex, isAutoPlaying]);

  // Aller à une vidéo spécifique (manuellement)
  const goToVideo = useCallback((index: number) => {
    if (index >= 0 && index < videos.length) {
      setCurrentVideoIndex(index);
      setIsPlayingVideo(true);
      clearImageTimer();
    }
  }, [videos.length, clearImageTimer]);

  // Aller à une image spécifique (manuellement)
  const goToImage = useCallback((index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentImageIndex(index);
      setIsPlayingVideo(false);
    }
  }, [images.length]);

  // Mettre en pause l'autoplay
  const pauseAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    clearImageTimer();
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [clearImageTimer]);

  // Reprendre l'autoplay
  const resumeAutoPlay = useCallback(() => {
    setIsAutoPlaying(true);
    if (isPlayingVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isPlayingVideo]);

  // Toggle autoplay
  const toggleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      pauseAutoPlay();
    } else {
      resumeAutoPlay();
    }
  }, [isAutoPlaying, pauseAutoPlay, resumeAutoPlay]);

  // Reset quand les vidéos/images changent
  useEffect(() => {
    setCurrentVideoIndex(0);
    setCurrentImageIndex(0);
    setIsPlayingVideo(videos.length > 0);
  }, [videos.length]);

  return {
    currentVideoIndex,
    currentImageIndex,
    isPlayingVideo,
    isAutoPlaying,
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    goToVideo,
    goToImage,
    pauseAutoPlay,
    resumeAutoPlay,
    toggleAutoPlay
  };
}
