import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Store, MapPin, Navigation } from "lucide-react";

const merchantSetupSchema = z.object({
  business_name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(6, "Numéro de téléphone trop court"),
  city: z.string().trim().min(2, "La ville est requise"),
  address: z.string().trim().optional().or(z.literal("")),
});

type MerchantSetupFormData = z.infer<typeof merchantSetupSchema>;

export default function MerchantOnboarding() {
  const { t } = useTranslation();
  const { user, profile, loading, profileLoading } = useAuth();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  const checkedForUserRef = useRef<string | null>(null);

  const form = useForm<MerchantSetupFormData>({
    resolver: zodResolver(merchantSetupSchema),
    defaultValues: {
      business_name: "",
      description: "",
      phone: profile?.phone || "",
      city: profile?.city || "",
      address: "",
    },
  });

  const handleGetPosition = async () => {
    setGpsLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('GPS non disponible')); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
      });
      setGpsCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      toast.success(t('merchantOnboarding.positionGpsCapturee'));
    } catch {
      toast.error(t('merchantOnboarding.impossibleDeCapturerLaPosition'));
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (loading || profileLoading) return;
      if (!user || !profile) {
        setOpen(false);
        return;
      }

      // Onboarding uniquement pour les marchands
      if (profile.role !== "vendeur") {
        setOpen(false);
        return;
      }

      if (checkedForUserRef.current === user.id) return;
      checkedForUserRef.current = user.id;

      const { data, error } = await supabase
        .from("vendors")
        .select("id,business_name,phone,address,city")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        // Ne pas bloquer l'interface si RLS / autre — mais informer.
        console.error("Erreur chargement vendor:", error);
        toast.error(t('merchantOnboarding.impossibleDeChargerVotreProfil'));
        return;
      }

      if (!data) {
        // Nouveau marchand : ouvrir automatiquement
        setVendorId(null);
        form.reset({
          business_name: "",
          description: "",
          phone: profile.phone || "",
          city: profile.city || "",
          address: "",
        });
        setOpen(true);
        return;
      }

      // ✅ Le vendeur a déjà un enregistrement vendors → profil considéré comme complet
      // Ne JAMAIS réafficher le dialog pour un vendeur qui a déjà un record
      setVendorId(data.id);
      console.log('✅ Vendeur existant détecté, dialog NON affiché:', {
        vendorId: data.id,
        business_name: data.business_name
      });
      setOpen(false);
    };

    run();
  }, [user, profile, loading, profileLoading, form]);

  const onSubmit = async (values: MerchantSetupFormData) => {
    if (!user) return;

    setSubmitting(true);
    try {
      let currentVendorId = vendorId;

      if (vendorId) {
        const { error } = await supabase
          .from("vendors")
          .update({
            business_name: values.business_name,
            description: values.description || null,
            phone: values.phone || null,
            address: values.address || null,
            city: values.city || null,
          })
          .eq("id", vendorId);

        if (error) throw error;
      } else {
        // Upsert: gère la course condition entre createVendorForOAuth (fire-and-forget)
        // et l'affichage du formulaire. Si le vendor existe déjà, on met simplement à jour.
        const { data, error } = await supabase
          .from("vendors")
          .upsert({
            user_id: user.id,
            business_name: values.business_name,
            description: values.description || null,
            phone: values.phone || null,
            address: values.address || null,
            city: values.city || null,
            is_active: true,
          }, { onConflict: 'user_id' })
          .select("id")
          .single();

        if (error) throw error;
        currentVendorId = data.id;
        setVendorId(data.id);
      }

      // Sauvegarder les coordonnées GPS si disponibles
      if (gpsCoords && currentVendorId) {
        await supabase
          .from("vendors")
          .update({ latitude: gpsCoords.lat, longitude: gpsCoords.lng })
          .eq("id", currentVendorId);
      }

      toast.success(t('merchantOnboarding.profilMarchandEnregistreAvecSucces'));
      setOpen(false);

      // Rediriger vers le dashboard vendeur pour voir le module
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'enregistrement";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Store className="h-5 w-5 text-primary" />
            </div>
            Finalisez votre compte marchand
          </DialogTitle>
          <DialogDescription>
            Complétez ces informations pour activer votre boutique et commencer à vendre.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('merchantOnboarding.nomDeLaBoutique')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('merchantOnboarding.exBoutiqueDiallo')}
                      {...field}
                      disabled={submitting}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('merchantOnboarding.descriptionDeLaBoutique')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('merchantOnboarding.decrivezVotreBoutiqueVosProduits')}
                      rows={3}
                      {...field}
                      disabled={submitting}
                      className="resize-none"
                    />
                  </FormControl>
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
                    <FormLabel>{t('merchantOnboarding.telephone')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+224 6xx xxx xxx"
                        {...field}
                        disabled={submitting}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('merchantOnboarding.conakryKindiaLabe')}
                        {...field}
                        disabled={submitting}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('merchantOnboarding.quartierCommuneReperes')}
                      {...field}
                      disabled={submitting}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bouton position GPS */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleGetPosition}
                disabled={gpsLoading || submitting}
                className="gap-2"
              >
                {gpsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                {gpsCoords ? 'Position capturée ✓' : 'Ajouter ma position'}
              </Button>
              {gpsCoords && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                </span>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Plus tard
              </Button>
              <Button type="submit" disabled={submitting} className="min-w-[140px]">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activer ma boutique
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
