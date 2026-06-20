/**
 * HOOK RESPONSIVE COMPLET
 * Détection précise des breakpoints mobile, tablette et desktop
 * 224Solutions - Responsive System
 */

import { useState, useEffect } from 'react';

// Breakpoints standards (correspond à Tailwind)
const BREAKPOINTS = {
  mobile: 640,    // sm
  tablet: 768,    // md
  laptop: 1024,   // lg
  desktop: 1280,  // xl
  wide: 1536,     // 2xl
} as const;

export type DeviceType = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'wide';
export type Orientation = 'portrait' | 'landscape';

export interface ResponsiveState {
  // Type d'appareil
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  isDesktop: boolean;
  isWide: boolean;

  // Dimensions
  width: number;
  height: number;

  // Orientation
  orientation: Orientation;
  isPortrait: boolean;
  isLandscape: boolean;

  // Utilitaires
  isTouchDevice: boolean;
  isStandalone: boolean; // PWA mode
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => getResponsiveState());

  useEffect(() => {
    const handleResize = () => {
      setState(getResponsiveState());
    };

    const handleOrientationChange = () => {
      // Petit délai pour laisser le temps au navigateur de se réorganiser
      setTimeout(() => {
        setState(getResponsiveState());
      }, 100);
    };

    // Écouter les changements de taille
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return state;
}

/**
 * Détermine l'état responsive actuel
 */
function getResponsiveState(): ResponsiveState {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Déterminer le type d'appareil
  let deviceType: DeviceType = 'mobile';
  if (width >= BREAKPOINTS.wide) {
    deviceType = 'wide';
  } else if (width >= BREAKPOINTS.desktop) {
    deviceType = 'desktop';
  } else if (width >= BREAKPOINTS.laptop) {
    deviceType = 'laptop';
  } else if (width >= BREAKPOINTS.tablet) {
    deviceType = 'tablet';
  }

  // Orientation
  const orientation: Orientation = width > height ? 'landscape' : 'portrait';

  // Détection tactile
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Mode standalone (PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isLaptop: deviceType === 'laptop',
    isDesktop: deviceType === 'desktop',
    isWide: deviceType === 'wide',

    width,
    height,

    orientation,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',

    isTouchDevice,
    isStandalone,
  };
}

/**
 * Hook pour obtenir uniquement le type d'appareil (plus léger)
 */
export function useDeviceType(): DeviceType {
  const { deviceType } = useResponsive();
  return deviceType;
}

/**
 * Hook pour vérifier si on est sur mobile (plus léger que useResponsive)
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return window.innerWidth < BREAKPOINTS.tablet;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.tablet);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

/**
 * Hook pour obtenir des classes CSS conditionnelles basées sur le device
 */
export function useResponsiveClasses() {
  const responsive = useResponsive();

  return {
    // Classes pour conteneurs
    container: responsive.isMobile
      ? 'px-4 py-3'
      : responsive.isTablet
        ? 'px-6 py-4'
        : 'px-8 py-6',

    // Classes pour grilles
    grid: responsive.isMobile
      ? 'grid-cols-1'
      : responsive.isTablet
        ? 'grid-cols-2'
        : 'grid-cols-3',

    // Classes pour texte
    heading: responsive.isMobile
      ? 'text-2xl'
      : responsive.isTablet
        ? 'text-3xl'
        : 'text-4xl',

    // Classes pour spacing
    gap: responsive.isMobile ? 'gap-3' : 'gap-4',

    // Classes pour cards
    card: responsive.isMobile
      ? 'p-4'
      : responsive.isTablet
        ? 'p-5'
        : 'p-6',
  };
}

export default useResponsive;
