/**
 * Sélecteur de mode de vente ultra professionnel
 * Design moderne aligné horizontalement
 */

import React from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Store,
  Link2,
  Check,
  Users,
  TrendingUp,
  Globe,
  ShieldCheck,
  Wallet,
  FileText,
  Zap,
  BarChart3,
  Percent,
  Crown,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type SalesMode = 'direct' | 'affiliate';

interface SalesModeSelectorProps {
  value: SalesMode;
  onChange: (mode: SalesMode) => void;
  disabled?: boolean;
  hideDirectSale?: boolean;
}

const salesModes = {
  direct: {
    id: 'direct',
    title: 'Vente Directe',
    subtitle: "Vendez vos propres produits",
    icon: Store,
    color: 'blue',
    badgeText: 'Recommandé',
    badgeVariant: 'secondary' as const,
    description: "Créez et vendez vos propres produits numériques",
    features: [
      { icon: Wallet, text: '100% des revenus' },
      { icon: ShieldCheck, text: 'Contrôle total' },
      { icon: Users, text: 'Votre clientèle' },
      { icon: FileText, text: 'Gestion fichiers' }
    ],
    highlight: 'Gardez 100% de vos ventes',
    commissionInfo: null
  },
  affiliate: {
    id: 'affiliate',
    title: 'Affiliation',
    subtitle: "Promouvez des partenaires",
    icon: Link2,
    color: 'orange',
    badgeText: 'Commission élevée',
    badgeVariant: 'default' as const,
    description: "Gagnez des commissions sur les ventes",
    features: [
      { icon: Percent, text: 'Jusqu\'à 75%' },
      { icon: Zap, text: 'Sans création' },
      { icon: Globe, text: 'Milliers de produits' },
      { icon: TrendingUp, text: 'Tracking auto' }
    ],
    highlight: 'Amazon, Booking, Systeme.io...',
    commissionInfo: {
      ranges: [
        { platform: 'Amazon', rate: '1-10%' },
        { platform: 'Systeme.io', rate: '40-60%' },
        { platform: 'ClickBank', rate: '50-75%' },
        { platform: 'Booking', rate: '25-40%' }
      ]
    }
  }
};

export function SalesModeSelector({ value, onChange, disabled, hideDirectSale }: SalesModeSelectorProps) {
  const { t } = useTranslation();
  // Filtrer les modes selon hideDirectSale
  const availableModes = hideDirectSale
    ? (['affiliate'] as SalesMode[])
    : (Object.keys(salesModes) as SalesMode[]);

  // Si on cache la vente directe et que la valeur actuelle est 'direct', forcer 'affiliate'
  React.useEffect(() => {
    if (hideDirectSale && value === 'direct') {
      onChange('affiliate');
    }
  }, [hideDirectSale, value, onChange]);

  // Si seulement l'affiliation est disponible, ne pas afficher le sélecteur
  if (hideDirectSale) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dbe6fb] bg-white px-4 py-1.5 shadow-sm">
          <Crown className="w-4 h-4 text-[#04439e]" />
          <span className="text-sm font-semibold text-[#04439e]">{t('salesModeSelector.modeleDeVente')}</span>
        </div>
        <h2 className="text-xl font-semibold text-[#0b1b33]">
          Choisissez votre stratégie
        </h2>
        <p className="text-sm text-slate-500">
          Sélectionnez le mode qui correspond à vos objectifs
        </p>
      </div>

      {/* Grille horizontale */}
      <div className="grid grid-cols-2 gap-4">
        {availableModes.map((modeKey, index) => {
          const mode = salesModes[modeKey];
          const isSelected = value === modeKey;
          const Icon = mode.icon;

          return (
            <motion.button
              key={modeKey}
              type="button"
              disabled={disabled}
              onClick={() => onChange(modeKey)}
              initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'relative text-left rounded-2xl p-4 transition-all duration-300 h-full shadow-sm',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#04439e]',
                isSelected
                  ? 'bg-[#04439e]/5 shadow-[0_12px_30px_rgba(4,67,158,0.12)]'
                  : 'bg-white hover:bg-[#04439e]/5 hover:shadow-md',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* Badge en haut à droite */}
              <div className="absolute top-3 right-3">
                <Badge
                  variant={mode.badgeVariant}
                  className={cn(
                    'text-[10px] font-medium',
                    mode.color === 'orange' && 'bg-[#ff4000] text-white border-0'
                  )}
                >
                  {mode.badgeText}
                </Badge>
              </div>

              {/* Indicateur de sélection */}
              <div className={cn(
                'absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                isSelected
                  ? 'border-[#04439e] bg-[#04439e]'
                  : 'border-slate-300'
              )}>
                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>

              {/* Contenu principal */}
              <div className="pt-6 space-y-3">
                {/* Icône */}
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center mx-auto',
                  mode.color === 'blue'
                    ? 'bg-[#04439e]'
                    : 'bg-[#ff4000]',
                  'text-white shadow-lg'
                )}>
                  <Icon className="w-6 h-6" />
                </div>

                {/* Titre */}
                <div className="text-center">
                  <h3 className="font-semibold text-[#0b1b33] text-base">{mode.title}</h3>
                  <p className="text-xs text-slate-500">{mode.subtitle}</p>
                </div>

                {/* Highlight */}
                <div className={cn(
                  'text-center py-2 px-3 rounded-lg text-xs font-medium',
                  mode.color === 'blue'
                    ? 'bg-[#04439e]/10 text-[#04439e]'
                    : 'bg-[#ff4000]/10 text-[#ff4000]'
                )}>
                  {mode.highlight}
                </div>

                {/* Features en liste */}
                <div className="space-y-1.5">
                  {mode.features.map((feature, idx) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <FeatureIcon className="w-3.5 h-3.5 text-[#04439e] shrink-0" />
                        <span>{feature.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Commission info pour affiliation */}
                {mode.commissionInfo && (
                  <div className="bg-muted/50 rounded-lg p-2 space-y-1">
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      Commissions typiques
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {mode.commissionInfo.ranges.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[10px]">
                          <span className="text-slate-500">{item.platform}</span>
                          <span className="font-semibold text-[#04439e]">{item.rate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Call to action */}
                <div className={cn(
                  'flex items-center justify-center gap-1 pt-2 text-xs font-medium transition-colors',
                  isSelected ? 'text-[#04439e]' : 'text-slate-500'
                )}>
                  <span>{isSelected ? 'Sélectionné' : 'Sélectionner'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
