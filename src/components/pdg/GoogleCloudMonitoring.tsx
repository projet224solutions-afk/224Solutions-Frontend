/**
 * GOOGLE CLOUD MONITORING - 224SOLUTIONS
 * Composant de test et monitoring des APIs Google Cloud
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle, AlertTriangle, MapPin, Navigation, Loader2 } from 'lucide-react';
import { mapService } from '@/services/mapService';
import { useCurrentLocation } from '@/hooks/useGeolocation';
import { toast } from 'sonner';

interface ApiTest {
  name: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  latency?: number;
  result?: any;
  error?: string;
}

export default function GoogleCloudMonitoring() {
  const { t } = useTranslation();
  const { getCurrentLocation, location, loading: _geoLoading } = useCurrentLocation();
  const [testAddress, setTestAddress] = useState('Tour Eiffel, Paris');
  const [tests, setTests] = useState<Record<string, ApiTest>>({
    geocoding: { name: 'Geocoding API', status: 'idle' },
    reverseGeocoding: { name: 'Reverse Geocoding', status: 'idle' },
    directions: { name: 'Directions API', status: 'idle' },
    geolocation: { name: 'Géolocalisation', status: 'idle' }
  });

  const updateTest = (key: string, update: Partial<ApiTest>) => {
    setTests(prev => ({
      ...prev,
      [key]: { ...prev[key], ...update }
    }));
  };

  const testGeocoding = async () => {
    updateTest('geocoding', { status: 'loading' });
    const startTime = Date.now();

    try {
      const results = await mapService.geocodeAddress(testAddress);
      const latency = Date.now() - startTime;

      if (results.length > 0) {
        updateTest('geocoding', {
          status: 'success',
          latency,
          result: results[0]
        });
        toast.success(t('googleCloudMonitoring.geocodageReussi'), {
          description: `Trouvé: ${results[0].address}`
        });
      } else {
        updateTest('geocoding', {
          status: 'error',
          error: 'Aucun résultat trouvé'
        });
        toast.error(t('googleCloudMonitoring.aucunResultatTrouve'));
      }
    } catch (error: any) {
      updateTest('geocoding', {
        status: 'error',
        error: error.message
      });
      toast.error(t('googleCloudMonitoring.erreurDeGeocodage'), {
        description: t('googleCloudMonitoring.verifiezQueLaCleApi')
      });
    }
  };

  const testApiConfiguration = async () => {
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/test-google-cloud-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      });

      const data = await response.json();

      if (data.status === 'success') {
        toast.success(t('googleCloudMonitoring.configurationApiValidee'), {
          description: data.message
        });
        return true;
      } else {
        toast.error(t('googleCloudMonitoring.problemeDeConfiguration'), {
          description: data.message,
          duration: 10000
        });

        if (data.instructions) {
          console.error('Instructions de configuration:', data.instructions);
        }
        return false;
      }
    } catch (error: any) {
      toast.error(t('googleCloudMonitoring.erreurDeTestDeConfiguration'), {
        description: error.message
      });
      return false;
    }
  };

  const testReverseGeocoding = async () => {
    updateTest('reverseGeocoding', { status: 'loading' });
    const startTime = Date.now();

    try {
      // Paris coordinates
      const address = await mapService.reverseGeocode(48.8566, 2.3522);
      const latency = Date.now() - startTime;

      updateTest('reverseGeocoding', {
        status: 'success',
        latency,
        result: address
      });
      toast.success(t('googleCloudMonitoring.reverseGeocodingReussi'), {
        description: `Adresse: ${address}`
      });
    } catch (error: any) {
      updateTest('reverseGeocoding', {
        status: 'error',
        error: error.message
      });
      toast.error('Erreur reverse geocoding', { description: error.message });
    }
  };

  const testDirections = async () => {
    updateTest('directions', { status: 'loading' });
    const startTime = Date.now();

    try {
      // Paris to Lyon
      const route = await mapService.calculateRoute(
        { latitude: 48.8566, longitude: 2.3522 },
        { latitude: 45.7640, longitude: 4.8357 }
      );
      const latency = Date.now() - startTime;

      updateTest('directions', {
        status: 'success',
        latency,
        result: route
      });
      toast.success(t('googleCloudMonitoring.calculDItineraireReussi'), {
        description: `Distance: ${route.distance.toFixed(1)}km, Durée: ${route.duration}min`
      });
    } catch (error: any) {
      updateTest('directions', {
        status: 'error',
        error: error.message
      });
      toast.error(t('googleCloudMonitoring.erreurDeCalculDItineraire'), { description: error.message });
    }
  };

  const testGeolocation = async () => {
    updateTest('geolocation', { status: 'loading' });
    const startTime = Date.now();

    try {
      const pos = await getCurrentLocation();
      const latency = Date.now() - startTime;

      updateTest('geolocation', {
        status: 'success',
        latency,
        result: pos
      });
      toast.success(t('googleCloudMonitoring.geolocalisationReussie'), {
        description: `Position: ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`
      });
    } catch (error: any) {
      updateTest('geolocation', {
        status: 'error',
        error: error.message
      });
      toast.error(t('googleCloudMonitoring.erreurDeGeolocalisation'), { description: error.message });
    }
  };

  const testAll = async () => {
    // D'abord tester la configuration
    const configOk = await testApiConfiguration();
    if (!configOk) {
      toast.error('Configuration invalide', {
        description: t('googleCloudMonitoring.veuillezConfigurerLaCleApi'),
        duration: 5000
      });
      return;
    }

    await testGeolocation();
    await testGeocoding();
    await testReverseGeocoding();
    await testDirections();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-[#ff4000]" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-[#ff4000]" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'loading':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Test en cours</Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">{t('googleCloudMonitoring.operationnel')}</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20">Erreur</Badge>;
      default:
        return <Badge variant="outline">{t('googleCloudMonitoring.nonTeste')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Monitoring Google Cloud APIs</h2>
        <p className="text-muted-foreground">{t('googleCloudMonitoring.testezEtSurveillezLesApis')}</p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('googleCloudMonitoring.testsDesApis')}</CardTitle>
            <CardDescription>{t('googleCloudMonitoring.lancezDesTestsPourVerifier')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                placeholder={t('googleCloudMonitoring.adresseAGeocoder')}
                className="flex-1"
              />
              <Button onClick={testApiConfiguration} variant="outline">
                <Activity className="w-4 h-4 mr-2" />
                Vérifier Config
              </Button>
              <Button onClick={testAll} variant="default">
                <Activity className="w-4 h-4 mr-2" />
                Tout tester
              </Button>
            </div>

            <div className="space-y-3">
              {/* Géolocalisation */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(tests.geolocation.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <p className="font-medium">{tests.geolocation.name}</p>
                    </div>
                    {tests.geolocation.latency && (
                      <p className="text-sm text-muted-foreground">Latence: {tests.geolocation.latency}ms</p>
                    )}
                    {tests.geolocation.result && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Position: {tests.geolocation.result.latitude.toFixed(4)}, {tests.geolocation.result.longitude.toFixed(4)}
                      </p>
                    )}
                    {tests.geolocation.error && (
                      <p className="text-xs text-[#ff4000] mt-1">{tests.geolocation.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(tests.geolocation.status)}
                  <Button size="sm" onClick={testGeolocation} disabled={tests.geolocation.status === 'loading'}>
                    Test
                  </Button>
                </div>
              </div>

              {/* Geocoding */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(tests.geocoding.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <p className="font-medium">{tests.geocoding.name}</p>
                    </div>
                    {tests.geocoding.latency && (
                      <p className="text-sm text-muted-foreground">Latence: {tests.geocoding.latency}ms</p>
                    )}
                    {tests.geocoding.result && (
                      <p className="text-xs text-muted-foreground mt-1">{tests.geocoding.result.address}</p>
                    )}
                    {tests.geocoding.error && (
                      <p className="text-xs text-[#ff4000] mt-1">{tests.geocoding.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(tests.geocoding.status)}
                  <Button size="sm" onClick={testGeocoding} disabled={tests.geocoding.status === 'loading'}>
                    Test
                  </Button>
                </div>
              </div>

              {/* Reverse Geocoding */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(tests.reverseGeocoding.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <p className="font-medium">{tests.reverseGeocoding.name}</p>
                    </div>
                    {tests.reverseGeocoding.latency && (
                      <p className="text-sm text-muted-foreground">Latence: {tests.reverseGeocoding.latency}ms</p>
                    )}
                    {tests.reverseGeocoding.result && (
                      <p className="text-xs text-muted-foreground mt-1">{tests.reverseGeocoding.result}</p>
                    )}
                    {tests.reverseGeocoding.error && (
                      <p className="text-xs text-[#ff4000] mt-1">{tests.reverseGeocoding.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(tests.reverseGeocoding.status)}
                  <Button size="sm" onClick={testReverseGeocoding} disabled={tests.reverseGeocoding.status === 'loading'}>
                    Test
                  </Button>
                </div>
              </div>

              {/* Directions */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(tests.directions.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4" />
                      <p className="font-medium">{tests.directions.name}</p>
                    </div>
                    {tests.directions.latency && (
                      <p className="text-sm text-muted-foreground">Latence: {tests.directions.latency}ms</p>
                    )}
                    {tests.directions.result && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Distance: {tests.directions.result.distance.toFixed(1)}km,
                        Durée: {tests.directions.result.duration}min
                      </p>
                    )}
                    {tests.directions.error && (
                      <p className="text-xs text-[#ff4000] mt-1">{tests.directions.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(tests.directions.status)}
                  <Button size="sm" onClick={testDirections} disabled={tests.directions.status === 'loading'}>
                    Test
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {location && (
          <Card>
            <CardHeader>
              <CardTitle>Position Actuelle</CardTitle>
              <CardDescription>{t('googleCloudMonitoring.votrePositionGpsActuelle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Latitude:</span>
                  <span className="font-mono">{location.latitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Longitude:</span>
                  <span className="font-mono">{location.longitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('googleCloudMonitoring.precision')}</span>
                  <span className="font-mono">{location.accuracy.toFixed(0)}m</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
