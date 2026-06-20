/**
 * ServiceSelector - Sélecteur de services professionnels
 * Permet au vendeur de basculer entre ses différents services
 */

import { Check, ChevronsUpDown, Plus, Store } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import type { VendorProfessionalService } from '@/hooks/useVendorServices';

interface ServiceSelectorProps {
  services: VendorProfessionalService[];
  selectedServiceId: string | null;
  onSelectService: (serviceId: string) => void;
  onCreateNew?: () => void;
}

export function ServiceSelector({
  services,
  selectedServiceId,
  onSelectService,
  onCreateNew
}: ServiceSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selectedService = services.find(s => s.id === selectedServiceId);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Actif';
      case 'pending':
        return 'En attente';
      case 'suspended':
        return 'Suspendu';
      case 'inactive':
        return 'Inactif';
      default:
        return status;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full md:w-full max-w-[350px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Store className="w-4 h-4 text-muted-foreground shrink-0" />
            {selectedService ? (
              <>
                <span className="truncate">{selectedService.business_name}</span>
                <Badge
                  variant={getStatusBadgeVariant(selectedService.status)}
                  className="text-xs shrink-0"
                >
                  {selectedService.service_type?.name || 'Service'}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">{t('serviceSelector.selectionnerUnService')}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full md:w-full max-w-[350px] p-0">
        <Command>
          <CommandInput placeholder={t('serviceSelector.rechercherUnService')} />
          <CommandEmpty>{t('serviceSelector.aucunServiceTrouve')}</CommandEmpty>
          <CommandGroup>
            {services.map((service) => (
              <CommandItem
                key={service.id}
                value={service.business_name}
                onSelect={() => {
                  onSelectService(service.id);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedServiceId === service.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{service.business_name}</span>
                    <Badge
                      variant={getStatusBadgeVariant(service.status)}
                      className="text-xs shrink-0"
                    >
                      {getStatusLabel(service.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{service.service_type?.name || 'Service'}</span>
                    {service.verification_status === 'verified' && (
                      <Badge variant="outline" className="text-xs">
                        ✓ Vérifié
                      </Badge>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          {onCreateNew && (
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onCreateNew();
                  setOpen(false);
                }}
                className="cursor-pointer text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Créer un nouveau service
              </CommandItem>
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ServiceSelector;
