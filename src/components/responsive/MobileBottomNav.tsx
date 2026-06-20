/**
 * NAVIGATION BOTTOM MOBILE
 * Barre de navigation inférieure pour mobile avec icônes et labels
 * 224Solutions - Mobile Navigation
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface NavItem {
  value: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

interface MobileBottomNavProps {
  items: NavItem[];
  activeValue: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function MobileBottomNav({
  items,
  activeValue,
  onValueChange,
  className = '',
}: MobileBottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-card/95 backdrop-blur-lg border-t shadow-2xl',
        'safe-area-inset',
        className
      )}
    >
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-2 max-w-screen-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeValue === item.value;

          return (
            <Button
              key={item.value}
              variant="ghost"
              size="sm"
              onClick={() => onValueChange(item.value)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 h-auto py-2 px-1 rounded-xl',
                'transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5 transition-all duration-200', isActive && 'scale-110 text-primary-foreground')} />
                {item.badge && item.badge > 0 && (
                  <Badge
                    className={cn(
                      'absolute -top-2 -right-2 w-5 h-5 p-0',
                      'flex items-center justify-center text-xs',
                      'bg-destructive text-destructive-foreground'
                    )}
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium truncate w-full text-center',
                  isActive ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  className = '',
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40',
        'bg-card/95 backdrop-blur-lg border-b',
        'px-4 py-3',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {leftAction && <div className="flex-shrink-0">{leftAction}</div>}

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        {rightAction && <div className="flex-shrink-0 flex items-center gap-2">{rightAction}</div>}
      </div>
    </header>
  );
}
