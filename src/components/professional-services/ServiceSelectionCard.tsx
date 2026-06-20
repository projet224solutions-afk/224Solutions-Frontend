import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import type { ServiceType } from '@/hooks/useProfessionalServices';
import { useTranslation } from '@/hooks/useTranslation';

interface ServiceSelectionCardProps {
  service: ServiceType;
  selected?: boolean;
  onSelect: () => void;
}

export const ServiceSelectionCard = ({
  service,
  selected = false,
  onSelect,
}: ServiceSelectionCardProps) => {
  const { t } = useTranslation();
  const features = Array.isArray(service.features) ? service.features : [];

  return (
    <div className="transition-transform hover:scale-[1.02] active:scale-[0.98]">
      <Card
        className={`cursor-pointer transition-all duration-300 hover:shadow-xl ${
          selected
            ? 'border-primary shadow-lg ring-2 ring-primary'
            : 'border-border hover:border-primary/50'
        }`}
        onClick={onSelect}
      >
        <CardHeader className="relative">
          {selected && (
            <div className="absolute top-4 right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center animate-in zoom-in">
              <Check className="w-5 h-5 text-primary-foreground" />
            </div>
          )}

          <div className="text-5xl mb-3">{service.icon}</div>

          <CardTitle className="text-xl font-bold">{service.name}</CardTitle>

          <CardDescription className="text-sm mt-2">
            {service.description}
          </CardDescription>

          <div className="mt-3">
            <Badge variant="secondary" className="text-xs">
              {service.category}
            </Badge>
            <Badge variant="outline" className="text-xs ml-2">
              {t('serviceSelection.commission')} {service.commission_rate}%
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {t('serviceSelection.featuresIncluded')}
            </p>
            {features.slice(0, 3).map((feature, index) => (
              <div key={index} className="flex items-start space-x-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-xs text-muted-foreground">{feature}</span>
              </div>
            ))}
            {features.length > 3 && (
              <p className="text-xs text-primary font-medium mt-2">
                +{features.length - 3} {t('serviceSelection.moreFeatures')}
              </p>
            )}
          </div>

          <Button
            className="w-full mt-4"
            variant={selected ? 'default' : 'outline'}
            size="sm"
          >
            {selected ? t('serviceSelection.selected') : t('serviceSelection.selectService')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
