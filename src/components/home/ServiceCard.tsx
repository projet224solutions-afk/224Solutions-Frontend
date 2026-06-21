/**
 * SERVICE CARD - Ultra Professional Modern Design
 * 224Solutions - Premium Service Cards
 * Apple/Stripe-inspired with glassmorphism
 */

import { ReactNode } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomeServiceCardProps {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  count: number;
  gradient?: string;
  iconBg?: string;
  trending?: boolean;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

export function HomeServiceCard({
  id,
  icon,
  title,
  subtitle,
  count,
  gradient = 'bg-primary/10',
  iconBg = 'bg-primary/10',
  trending = false,
  onClick,
  className,
  compact = false,
}: HomeServiceCardProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'group relative w-full overflow-hidden',
          'p-4 rounded-2xl text-center',
          'bg-card border border-border/60',
          'shadow-[var(--shadow-card)]',
          'hover:border-primary/60 hover:bg-primary hover:shadow-lg hover:shadow-primary/20',
          'transition-all duration-250 ease-out',
          'active:scale-[0.97] active:bg-primary',
          className
        )}
      >
        {/* Trending indicator */}
        {trending && count > 0 && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-accent text-accent-foreground text-[8px] font-bold rounded-full shadow-sm">
            <TrendingUp className="w-2 h-2" />
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {/* Icon Container */}
          <div
            className={cn(
              'p-3 rounded-xl bg-muted/60',
              'transition-all duration-300',
              'group-hover:scale-105 group-hover:bg-white/20',
              '[&_svg]:transition-colors [&_svg]:duration-300 group-hover:[&_svg]:text-white group-active:[&_svg]:text-white'
            )}
          >
            {icon}
          </div>

          {/* Content */}
          <div className="space-y-1">
            <h3 className="font-semibold text-xs text-foreground group-hover:text-white group-active:text-white transition-colors line-clamp-1">
              {title}
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary group-hover:bg-white/20 group-hover:text-white group-active:text-white text-[10px] font-medium tabular-nums transition-colors">
              {count}
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full overflow-hidden',
        'p-5 rounded-3xl text-left',
        'bg-card',
        'border border-border/50',
        'hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5',
        'transition-all duration-500 ease-out',
        'active:scale-[0.98]',
        className
      )}
    >
      {/* Ambient glow effect */}
      <div className={cn(
        'absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 blur-3xl',
        gradient,
        'group-hover:opacity-60 transition-opacity duration-700'
      )} />

      {/* Trending indicator */}
      {trending && count > 0 && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-[#ff4000] text-white text-[10px] font-bold rounded-full shadow-lg shadow-[#ff4000]/40">
          <TrendingUp className="w-3 h-3" />
          Populaire
        </div>
      )}

      <div className="relative flex items-start gap-4">
        {/* Icon Container */}
        <div
          className={cn(
            'relative flex-shrink-0 p-4 rounded-2xl',
            'transition-all duration-500',
            iconBg,
            'group-hover:scale-110 group-hover:shadow-lg'
          )}
        >
          {icon}

          {/* Pulse ring on hover */}
          <div className="absolute inset-0 rounded-2xl border-2 border-current opacity-0 group-hover:opacity-20 group-hover:animate-ping" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-1">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {subtitle}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums">
              {count} disponible{count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="flex-shrink-0 self-center">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            'bg-muted/50 group-hover:bg-primary group-hover:text-primary-foreground',
            'transition-all duration-300'
          )}>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className={cn(
        'absolute bottom-0 left-0 right-0 h-0.5',
        'opacity-0 group-hover:opacity-100',
        gradient,
        'transition-opacity duration-500'
      )} />
    </button>
  );
}

export default HomeServiceCard;
