import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';
import { MapPin, Calculator, Send } from 'lucide-react';
import { useFormPersistence } from '@/hooks/useAppPersistence';
import { toast } from 'sonner';

interface TaxiFormData {
  pickupLat: string;
  pickupLng: string;
  dropLat: string;
  dropLng: string;
}

export default function TaxiMotoRequestForm() {
  const { t } = useTranslation();
  // Utiliser la persistence pour les données du formulaire
  const { values, updateField, resetForm, isRestored } = useFormPersistence<TaxiFormData>(
    'taxi_moto_request',
    {
      pickupLat: '',
      pickupLng: '',
      dropLat: '',
      dropLng: '',
    },
    {
      maxAge: 30 * 60 * 1000, // 30 minutes
      onRestore: (data) => {
        if (data.pickupLat || data.dropLat) {
          toast.success(t('taxiMotoRequestForm.formulaireTaxiRestaure'), { duration: 2000 });
        }
      }
    }
  );

  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRideId, setLastRideId] = useState<string | null>(null);

  const calculateFare = async () => {
    setLoading(true);
    try {
      // Simple distance estimate (replace with real geodesic)
      const d = Math.max(0.5, Math.abs(parseFloat(values.dropLat) - parseFloat(values.pickupLat)) + Math.abs(parseFloat(values.dropLng) - parseFloat(values.pickupLng)));
      setDistanceKm(d);
      const durationEstimate = Math.ceil(d * 10); // Simple: 10 min per km
      const fareResult = await TaxiMotoService.calculateFare(d, durationEstimate);
      setEstimatedPrice(fareResult.total);
    } catch (e) {
      console.warn('Fare calc error:', e);
      setEstimatedPrice(null);
    } finally {
      setLoading(false);
    }
  };

  const createRide = async () => {
    setLoading(true);
    try {
      const ride = await TaxiMotoService.createRide({
        pickupLat: parseFloat(values.pickupLat),
        pickupLng: parseFloat(values.pickupLng),
        pickupAddress: 'Adresse de départ',
        dropoffLat: parseFloat(values.dropLat),
        dropoffLng: parseFloat(values.dropLng),
        dropoffAddress: 'Adresse d\'arrivée',
        distanceKm: distanceKm || 1,
        durationMin: Math.ceil((distanceKm || 1) * 10),
        estimatedPrice: estimatedPrice || 0
      });
      setLastRideId(ride.id);
      // Réinitialiser le formulaire après création
      resetForm();
      setEstimatedPrice(null);
      setDistanceKm(0);
    } catch (e) {
      console.error('Create ride error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4"/> {t('taxiMotoRequestForm.demandeDeTaxiMoto')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs">{t('taxiMotoRequestForm.departLat')}</label>
            <Input value={values.pickupLat} onChange={e => updateField('pickupLat', e.target.value)} placeholder="9.5" />
          </div>
          <div className="space-y-2">
            <label className="text-xs">{t('taxiMotoRequestForm.departLng')}</label>
            <Input value={values.pickupLng} onChange={e => updateField('pickupLng', e.target.value)} placeholder="-13.7" />
          </div>
          <div className="space-y-2">
            <label className="text-xs">{t('taxiMotoRequestForm.arriveeLat')}</label>
            <Input value={values.dropLat} onChange={e => updateField('dropLat', e.target.value)} placeholder="9.52" />
          </div>
          <div className="space-y-2">
            <label className="text-xs">{t('taxiMotoRequestForm.arriveeLng')}</label>
            <Input value={values.dropLng} onChange={e => updateField('dropLng', e.target.value)} placeholder="-13.69" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={calculateFare} disabled={loading} className="gap-2"><Calculator className="w-4 h-4"/> Estimer</Button>
          {estimatedPrice !== null && <Badge variant="outline"><Money amount={estimatedPrice} from="GNF" /></Badge>}
        </div>
        <div>
          <Button onClick={createRide} disabled={loading || estimatedPrice===null} className="gap-2"><Send className="w-4 h-4"/> {t('taxiMotoRequestForm.creerLaCourse')}</Button>
        </div>
        {lastRideId && <div className="text-xs text-muted-foreground">Course créée: {lastRideId.substring(0,8)}…</div>}
      </CardContent>
    </Card>
  );
}