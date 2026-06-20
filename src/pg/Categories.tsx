/**
 * CATEGORIES PAGE - Catégories de produits et services
 * 224Solutions - Page des catégories
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, Store, ShoppingBag, Ticket, GraduationCap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  gradient: string;
  description: string;
  path: string;
}

const mainCategories: Category[] = [
  {
    id: 'boutiques',
    name: 'Boutiques Digitales',
    icon: <Store className="w-6 h-6" />,
    gradient: '',
    description: 'Explorez les boutiques en ligne',
    path: '/boutiques'
  },
  {
    id: 'billetterie',
    name: 'Billetterie',
    icon: <Ticket className="w-6 h-6" />,
    gradient: '',
    description: 'Événements, concerts, spectacles',
    path: '/events'
  },
  {
    id: 'formations',
    name: 'Formations',
    icon: <GraduationCap className="w-6 h-6" />,
    gradient: '',
    description: 'Cours et formations en ligne',
    path: '/formations'
  },
];


export default function Categories() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{t('categories.categories')}</h1>
            <p className="text-xs text-muted-foreground">{t('categories.explorezNosProduitsEtServices')}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Section principale */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">{t('categories.servicesPrincipaux')}</h2>
          <div className="space-y-3">
            {mainCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => navigate(category.path)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl',
                  'bg-card border border-border/50',
                  'hover:border-primary/30 hover:shadow-md',
                  'active:scale-[0.98] transition-all duration-200'
                )}
              >
                <div className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center',
                  'bg-gradient-to-br text-white shadow-lg',
                  category.gradient
                )}>
                  {category.icon}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-foreground">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>


        {/* CTA Marketplace */}
        <section className="pt-2">
          <button
            onClick={() => navigate('/marketplace')}
            className={cn(
              'w-full flex items-center justify-center gap-3 py-4 rounded-2xl',
              'bg-primary/10 border border-primary/20',
              'hover:bg-primary/15 hover:border-primary/30',
              'active:scale-[0.98] transition-all duration-200'
            )}
          >
            <ShoppingBag className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">{t('categories.explorerLeMarketplace')}</span>
            <ChevronRight className="w-5 h-5 text-primary" />
          </button>
        </section>
      </div>
    </div>
  );
}
