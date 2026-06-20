/**
 * CONTENEUR RESPONSIVE UNIVERSEL
 * Composant intelligent qui s'adapte automatiquement aux différents devices
 * 224Solutions - Responsive System
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  /** Padding automatique basé sur le device */
  autoPadding?: boolean;
  /** Utiliser toute la largeur sur mobile */
  fullWidthMobile?: boolean;
  /** Largeur maximale */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
};

export function ResponsiveContainer({
  children,
  className = '',
  autoPadding = true,
  fullWidthMobile = false,
  maxWidth = 'full',
}: ResponsiveContainerProps) {
  const { isMobile, isTablet } = useResponsive();

  const paddingClass = autoPadding
    ? isMobile
      ? 'px-3 py-3'
      : isTablet
      ? 'px-5 py-4'
      : 'px-6 py-5'
    : '';

  const widthClass = fullWidthMobile && isMobile ? 'w-full' : maxWidthClasses[maxWidth];

  return (
    <div className={cn('mx-auto', widthClass, paddingClass, className)}>
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  /** Nombre de colonnes sur mobile */
  mobileCols?: 1 | 2;
  /** Nombre de colonnes sur tablette */
  tabletCols?: 2 | 3 | 4;
  /** Nombre de colonnes sur desktop */
  desktopCols?: 2 | 3 | 4 | 5 | 6;
  /** Gap entre les éléments */
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

export function ResponsiveGrid({
  children,
  className = '',
  mobileCols = 1,
  tabletCols = 2,
  desktopCols = 3,
  gap = 'md',
}: ResponsiveGridProps) {
  const { isMobile, isTablet } = useResponsive();

  const colsClass = isMobile
    ? `grid-cols-${mobileCols}`
    : isTablet
    ? `grid-cols-${tabletCols}`
    : `grid-cols-${desktopCols}`;

  return (
    <div className={cn('grid', colsClass, gapClasses[gap], className)}>
      {children}
    </div>
  );
}

interface ResponsiveStackProps {
  children: ReactNode;
  className?: string;
  /** Direction du stack */
  direction?: 'vertical' | 'horizontal' | 'responsive';
  /** Gap entre les éléments */
  gap?: 'sm' | 'md' | 'lg';
  /** Alignement des éléments */
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export function ResponsiveStack({
  children,
  className = '',
  direction = 'responsive',
  gap = 'md',
  align = 'start',
}: ResponsiveStackProps) {
  const { isMobile } = useResponsive();

  const directionClass =
    direction === 'responsive'
      ? isMobile
        ? 'flex-col'
        : 'flex-row'
      : direction === 'vertical'
      ? 'flex-col'
      : 'flex-row';

  const alignClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }[align];

  return (
    <div className={cn('flex', directionClass, alignClass, gapClasses[gap], className)}>
      {children}
    </div>
  );
}

interface ResponsiveCardProps {
  children: ReactNode;
  className?: string;
  /** Padding adaptatif */
  padding?: 'sm' | 'md' | 'lg';
}

export function ResponsiveCard({
  children,
  className = '',
  padding = 'md',
}: ResponsiveCardProps) {
  const { isMobile, isTablet } = useResponsive();

  const paddingClass =
    padding === 'sm'
      ? isMobile
        ? 'p-2'
        : 'p-3'
      : padding === 'lg'
      ? isMobile
        ? 'p-4'
        : isTablet
        ? 'p-6'
        : 'p-8'
      : isMobile
      ? 'p-3'
      : isTablet
      ? 'p-4'
      : 'p-6';

  return (
    <div className={cn('bg-card rounded-lg border shadow-sm', paddingClass, className)}>
      {children}
    </div>
  );
}

interface ResponsiveTextProps {
  children: ReactNode;
  className?: string;
  /** Type de texte */
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption';
}

export function ResponsiveText({
  children,
  className = '',
  variant = 'body',
}: ResponsiveTextProps) {
  const { isMobile, isTablet } = useResponsive();

  const sizeClass = {
    h1: isMobile ? 'text-2xl' : isTablet ? 'text-3xl' : 'text-4xl',
    h2: isMobile ? 'text-xl' : isTablet ? 'text-2xl' : 'text-3xl',
    h3: isMobile ? 'text-lg' : isTablet ? 'text-xl' : 'text-2xl',
    h4: isMobile ? 'text-base' : isTablet ? 'text-lg' : 'text-xl',
    body: 'text-sm md:text-base',
    caption: 'text-xs md:text-sm',
  }[variant];

  const weightClass = ['h1', 'h2', 'h3', 'h4'].includes(variant) ? 'font-bold' : '';

  return <div className={cn(sizeClass, weightClass, className)}>{children}</div>;
}
