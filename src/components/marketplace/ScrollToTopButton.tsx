/**
 * ScrollToTopButton - Bouton flottant pour remonter en haut
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScrollToTopButton() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={cn(
        'fixed bottom-24 right-4 z-50',
        'w-10 h-10 rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'flex items-center justify-center',
        'hover:scale-110 active:scale-95 transition-all duration-200',
        'animate-in fade-in slide-in-from-bottom-4'
      )}
      aria-label={t('scrollToTopButton.retourEnHaut')}
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
