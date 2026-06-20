import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import type { ServiceType } from '@/hooks/useProfessionalServices';

const serviceSetupSchema = z.object({
  business_name: z.string().min(3),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().min(2),
  address: z.string().optional(),
});

type ServiceSetupFormData = z.infer<typeof serviceSetupSchema>;

export interface ServiceSetupSubmitData extends ServiceSetupFormData {
  latitude?: number;
  longitude?: number;
}

interface ServiceSetupDialogProps {
  open: boolean;
  onClose: () => void;
  selectedService: ServiceType | null;
  onSubmit: (data: ServiceSetupSubmitData) => Promise<void>;
}

export const ServiceSetupDialog = ({
  open,
  onClose,
  selectedService,
  onSubmit,
}: ServiceSetupDialogProps) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const schema = useMemo(() => z.object({
    business_name: z.string().min(3, t('serviceSetup.nameMin')),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email(t('serviceSetup.emailInvalid')).optional().or(z.literal('')),
    city: z.string().min(2, t('serviceSetup.cityRequired')),
    address: z.string().optional(),
  }), [t]);

  const form = useForm<ServiceSetupFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: '',
      description: '',
      phone: '',
      email: '',
      city: '',
      address: '',
    },
  });

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t('serviceSetup.geoUnsupported'));
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoLoading(false);
        toast.success(t('serviceSetup.positionSuccess'));
      },
      (error) => {
        setGeoLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error(t('serviceSetup.permDenied'));
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error(t('serviceSetup.posUnavailable'));
            break;
          case error.TIMEOUT:
            toast.error(t('serviceSetup.timeout'));
            break;
          default:
            toast.error(t('serviceSetup.geoError'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (data: ServiceSetupFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...data,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      form.reset();
      setCoords(null);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <span className="text-3xl">{selectedService?.icon}</span>
            <span>{t('serviceSetup.createYour')} {selectedService?.name}</span>
          </DialogTitle>
          <DialogDescription>
            {t('serviceSetup.dialogDesc')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('serviceSetup.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('serviceSetup.namePlaceholder')}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('serviceSetup.nameDesc')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('serviceSetup.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('serviceSetup.descPlaceholder')}
                      rows={3}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('serviceSetup.descHelp')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('serviceSetup.phone')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+224 xxx xxx xxx"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('serviceSetup.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@exemple.com"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('serviceSetup.cityLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('serviceSetup.cityPlaceholder')}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('serviceSetup.cityDesc')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('serviceSetup.address')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('serviceSetup.addressPlaceholder')}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('serviceSetup.addressDesc')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bouton de géolocalisation */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">📍 {t('serviceSetup.positionTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('serviceSetup.positionDesc')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={coords ? 'outline' : 'default'}
                  size="sm"
                  onClick={handleGetLocation}
                  disabled={geoLoading || isSubmitting}
                  className="shrink-0"
                >
                  {geoLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('serviceSetup.locating')}
                    </>
                  ) : coords ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-[#ff4000]" />
                      {t('serviceSetup.reposition')}
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      {t('serviceSetup.myPosition')}
                    </>
                  )}
                </Button>
              </div>
              {coords && (
                <div className="flex items-center gap-2 text-xs text-[#ff4000] dark:text-[#ff4000] bg-orange-50 dark:bg-[#ff4000]/30 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('serviceSetup.positionSaved')} ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t('serviceSetup.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('serviceSetup.createService')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
