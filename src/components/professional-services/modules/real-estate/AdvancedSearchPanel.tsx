/**
 * Panneau de recherche avancée pour les biens immobiliers
 */
import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

export interface SearchFilters {
  query: string;
  offer_type: string;
  property_type: string;
  city: string;
  min_price: number;
  max_price: number;
  min_rooms: number;
  status: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  offer_type: 'all',
  property_type: 'all',
  city: '',
  min_price: 0,
  max_price: 5000000000,
  min_rooms: 0,
  status: 'all',
};

interface AdvancedSearchPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  cities: string[];
}

export function AdvancedSearchPanel({ filters, onFiltersChange, cities }: AdvancedSearchPanelProps) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const formatPrice = useFormatCurrency();

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => onFiltersChange(DEFAULT_FILTERS);

  const activeFiltersCount = Object.entries(filters).filter(([key, val]) => {
    const def = DEFAULT_FILTERS[key as keyof SearchFilters];
    return val !== def;
  }).length;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('advancedSearchPanel.rechercherParTitreVilleQuartier')}
            className="pl-10"
            value={filters.query}
            onChange={e => updateFilter('query', e.target.value)}
          />
        </div>
        <Button
          variant={showAdvanced ? 'default' : 'outline'}
          size="icon"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="relative"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFiltersCount > 1 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {activeFiltersCount - (filters.query ? 1 : 0)}
            </span>
          )}
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'vente', 'location'].map(t => (
          <button
            key={t}
            onClick={() => updateFilter('offer_type', t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filters.offer_type === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {t === 'all' ? 'Tous' : t === 'vente' ? '🔑 Vente' : '📋 Location'}
          </button>
        ))}
        {['all', 'disponible', 'sous_option', 'vendu', 'loue'].map(s => (
          <button
            key={s}
            onClick={() => updateFilter('status', s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filters.status === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {s === 'all' ? 'Tout statut' : s === 'disponible' ? 'Disponible' : s === 'sous_option' ? 'Sous option' : s === 'vendu' ? 'Vendu' : 'Loué'}
          </button>
        ))}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{t('advancedSearchPanel.filtresAvances')}</h4>
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs">
                <RotateCcw className="h-3 w-3" /> Réinitialiser
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Property type */}
              <div className="space-y-1">
                <Label className="text-xs">{t('advancedSearchPanel.typeDeBien')}</Label>
                <Select value={filters.property_type} onValueChange={v => updateFilter('property_type', v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={t('advancedSearchPanel.tous')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('advancedSearchPanel.tous')}</SelectItem>
                    <SelectItem value="appartement">🏢 Appartement</SelectItem>
                    <SelectItem value="maison">🏠 Maison</SelectItem>
                    <SelectItem value="villa">🏡 Villa</SelectItem>
                    <SelectItem value="terrain">🌍 Terrain</SelectItem>
                    <SelectItem value="bureau">🏬 Bureau</SelectItem>
                    <SelectItem value="boutique">{t('advancedSearchPanel.boutique')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* City */}
              <div className="space-y-1">
                <Label className="text-xs">Ville</Label>
                <Select value={filters.city || 'all'} onValueChange={v => updateFilter('city', v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={t('advancedSearchPanel.toutes')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('advancedSearchPanel.toutes')}</SelectItem>
                    {cities.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Min rooms */}
              <div className="space-y-1">
                <Label className="text-xs">Chambres min.</Label>
                <Select value={String(filters.min_rooms)} onValueChange={v => updateFilter('min_rooms', Number(v))}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Tout</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                    <SelectItem value="5">5+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price range */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('advancedSearchPanel.fourchetteDePrix')}</Label>
                <span className="text-xs text-muted-foreground">
                  {formatPrice(filters.min_price)} — {filters.max_price >= 5000000000 ? '∞' : formatPrice(filters.max_price)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Min"
                  className="h-9 text-xs"
                  value={filters.min_price || ''}
                  onChange={e => updateFilter('min_price', Number(e.target.value) || 0)}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  className="h-9 text-xs"
                  value={filters.max_price >= 5000000000 ? '' : filters.max_price}
                  onChange={e => updateFilter('max_price', Number(e.target.value) || 5000000000)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { DEFAULT_FILTERS };
