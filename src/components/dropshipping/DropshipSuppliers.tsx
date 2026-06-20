/**
 * Liste des fournisseurs Dropshipping
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Star,
  Globe,
  Truck,
  CheckCircle,
  ExternalLink,
  MapPin
} from 'lucide-react';
import type { DropshipSupplier } from '@/types/dropshipping';

interface DropshipSuppliersProps {
  suppliers: DropshipSupplier[];
}

export function DropshipSuppliers({ suppliers }: DropshipSuppliersProps) {
  const { t } = useTranslation();
  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'CN': '🇨🇳',
      'EU': '🇪🇺',
      'US': '🇺🇸',
      'SN': '🇸🇳',
      'AE': '🇦🇪',
      'GN': '🇬🇳'
    };
    return flags[country] || '🌍';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fournisseurs Disponibles</h3>
          <p className="text-sm text-muted-foreground">
            Parcourez les catalogues des fournisseurs vérifiés
          </p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium text-lg mb-2">{t('dropshipSuppliers.aucunFournisseurDisponible')}</h3>
            <p>{t('dropshipSuppliers.lesFournisseursSerontAjoutesProchainemen')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">
                      {getCountryFlag(supplier.country)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{supplier.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {supplier.country}
                        </span>
                        {supplier.is_verified && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Vérifié
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplier.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {supplier.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                    <span className="font-medium">
                      {supplier.reliability_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Truck className="w-4 h-4" />
                    <span>~{supplier.average_delivery_days} jours</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    <span>{supplier.currency}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {supplier.supported_countries.slice(0, 5).map((code) => (
                    <Badge key={code} variant="outline" className="text-xs">
                      {code}
                    </Badge>
                  ))}
                  {supplier.supported_countries.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{supplier.supported_countries.length - 5}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {supplier.website_url && (
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <a href={supplier.website_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Visiter
                      </a>
                    </Button>
                  )}
                  <Button size="sm" className="flex-1">
                    Voir Catalogue
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
