/**
 * GLOBAL LOADER COMPONENT
 * Composant de chargement unifié pour tous les Suspense fallbacks
 * 224Solutions - Optimisation UX
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface GlobalLoaderProps {
  /** Taille du loader: 'sm' | 'md' | 'lg' */
  size?: 'sm' | 'md' | 'lg';
  /** Texte affiché sous le loader */
  text?: string;
  /** Classe CSS additionnelle */
  className?: string;
  /** Afficher en plein écran */
  fullScreen?: boolean;
  /** Variante de couleur */
  variant?: 'primary' | 'muted';
}

// ============================================================================
// Constantes de style
// ============================================================================

const SIZES = {
  sm: {
    dot: 'w-2 h-2',
    text: 'text-xs',
    gap: 'gap-2',
    padding: 'p-4',
  },
  md: {
    dot: 'w-3 h-3',
    text: 'text-sm',
    gap: 'gap-3',
    padding: 'p-8',
  },
  lg: {
    dot: 'w-4 h-4',
    text: 'text-base',
    gap: 'gap-4',
    padding: 'p-12',
  },
} as const;

const VARIANTS = {
  primary: {
    dots: ['bg-blue-600', 'bg-[#04439e]', 'bg-[#04439e]'],
    text: 'text-slate-700',
  },
  muted: {
    dots: ['bg-gray-400', 'bg-gray-500', 'bg-gray-600'],
    text: 'text-muted-foreground',
  },
} as const;

// ============================================================================
// Composant principal
// ============================================================================

/**
 * Loader global unifié pour les Suspense fallbacks
 * Utilise des dots animés avec délai progressif
 */
const GlobalLoader = memo(function GlobalLoader({
  size = 'md',
  text,
  className,
  fullScreen = false,
  variant = 'primary',
}: GlobalLoaderProps) {
  const sizeConfig = SIZES[size];
  const variantConfig = VARIANTS[variant];

  const containerClasses = cn(
    'flex items-center justify-center',
    sizeConfig.padding,
    fullScreen && 'min-h-screen bg-background',
    className
  );

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      <div className={cn('flex items-center', sizeConfig.gap)}>
        {/* Dots animés */}
        {variantConfig.dots.map((color, index) => (
          <div
            key={index}
            className={cn(
              sizeConfig.dot,
              'rounded-full animate-pulse',
              color
            )}
            style={{
              animationDelay: `${index * 150}ms`,
            }}
            aria-hidden="true"
          />
        ))}

        {/* Texte optionnel */}
        {text && (
          <span className={cn('font-medium', sizeConfig.text, variantConfig.text)}>
            {text}
          </span>
        )}

        {/* Screen reader text */}
        <span className="sr-only">{text || 'Chargement en cours...'}</span>
      </div>
    </div>
  );
});

// ============================================================================
// Variantes prédéfinies exportées
// ============================================================================

/**
 * Loader pour les pages complètes
 */
export const PageLoader = memo(function PageLoader({ text = 'Chargement...' }: { text?: string }) {
  return <GlobalLoader size="lg" text={text} fullScreen />;
});

/**
 * Loader pour les sections/cartes
 */
export const SectionLoader = memo(function SectionLoader({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <GlobalLoader size="md" text={text} />
    </div>
  );
});

/**
 * Loader compact pour les widgets
 */
export const WidgetLoader = memo(function WidgetLoader() {
  return <GlobalLoader size="sm" variant="muted" />;
});

/**
 * Loader spinner classique (alternatif)
 */
export const SpinnerLoader = memo(function SpinnerLoader({
  size = 'md',
  text,
  className,
}: Pick<GlobalLoaderProps, 'size' | 'text' | 'className'>) {
  const spinnerSizes = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'animate-spin rounded-full border-b-2 border-primary',
          spinnerSizes[size]
        )}
        aria-hidden="true"
      />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
      <span className="sr-only">{text || 'Chargement en cours...'}</span>
    </div>
  );
});

export { GlobalLoader };
export default GlobalLoader;
