/**
 * Sélecteur de mode pour le module Vol/Hôtel
 * Option A: API de réservation (Amadeus, Booking)
 * Option B: Système d'affiliation avancé
 * Option C: Affiliation simple structurée
 */

import {} from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Plane, Hotel, Search, Users, Briefcase,
  ArrowRight, Check, Settings, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type TravelMode = 'api' | 'affiliate' | 'simple';

interface TravelModeSelectorProps {
  currentMode: TravelMode;
  onModeSelect: (mode: TravelMode) => void;
}

const modes = [
  {
    id: 'api' as TravelMode,
    title: 'API de Réservation',
    description: 'Recherche en temps réel avec APIs (Amadeus, Booking)',
    icon: <Search className="w-6 h-6" />,
    gradient: '',
    features: [
      'Recherche vols/hôtels en direct',
      'Disponibilité temps réel',
      'Réservation intégrée',
      'Prix dynamiques'
    ],
    complexity: 'Avancé',
    badge: 'API Keys requis'
  },
  {
    id: 'affiliate' as TravelMode,
    title: 'Affiliation Avancée',
    description: 'Système complet pour affiliés avec suivi commissions',
    icon: <Users className="w-6 h-6" />,
    gradient: '',
    features: [
      'Inscription affiliés',
      'Catalogue partenaires',
      'Suivi des commissions',
      'Dashboard affilié'
    ],
    complexity: 'Intermédiaire',
    badge: 'Recommandé'
  },
  {
    id: 'simple' as TravelMode,
    title: 'Affiliation Simple',
    description: 'Structure catégorisée avec liens affiliés',
    icon: <Briefcase className="w-6 h-6" />,
    gradient: '',
    features: [
      'Catégories structurées',
      'Liens affiliés directs',
      'Interface simple',
      'Mise en place rapide'
    ],
    complexity: 'Simple',
    badge: 'Facile'
  }
];

export function TravelModeSelector({ currentMode, onModeSelect }: TravelModeSelectorProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full mb-3">
          <Settings className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary">Configuration</span>
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('travelModeSelector.choisissezVotreMode')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sélectionnez le type de fonctionnement pour Vol/Hôtel
        </p>
      </div>

      <div className="grid gap-4">
        {modes.map((mode) => (
          <Card
            key={mode.id}
            className={cn(
              'cursor-pointer transition-all duration-200 overflow-hidden',
              'hover:shadow-lg hover:scale-[1.01]',
              currentMode === mode.id && 'ring-2 ring-primary border-primary'
            )}
            onClick={() => onModeSelect(mode.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                  'bg-gradient-to-br text-white',
                  mode.gradient
                )}>
                  {mode.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{mode.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {mode.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {mode.description}
                  </p>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {mode.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="w-3 h-3 text-[#ff4000] shrink-0" />
                        <span className="truncate">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selection indicator */}
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0',
                  currentMode === mode.id
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/30'
                )}>
                  {currentMode === mode.id && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
