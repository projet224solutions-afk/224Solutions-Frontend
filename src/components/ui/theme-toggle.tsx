/**
 * THEME TOGGLE - Light/Dark Mode Switcher
 * 224Solutions - Premium Theme Control
 */

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'full';
}

export function ThemeToggle({ className, variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-10 w-10 rounded-full', className)}
        disabled
      >
        <Sun className="w-5 h-5 text-muted-foreground" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  if (variant === 'full') {
    return (
      <Button
        variant="outline"
        onClick={toggleTheme}
        className={cn(
          'gap-2 rounded-xl transition-all duration-300',
          className
        )}
      >
        {isDark ? (
          <>
            <Sun className="w-4 h-4" />
            <span>Mode clair</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4" />
            <span>Mode sombre</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        'relative h-10 w-10 rounded-full hover:bg-primary/10 transition-all duration-300',
        className
      )}
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
    >
      <Sun className={cn(
        'absolute w-5 h-5 transition-all duration-300',
        isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
      )} />
      <Moon className={cn(
        'absolute w-5 h-5 transition-all duration-300',
        isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
      )} />
    </Button>
  );
}

export default ThemeToggle;
