import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface GPSPermissionHelperProps {
  onLocationGranted: () => void;
  currentError?: string | null;
}

export function GPSPermissionHelper({ onLocationGranted, currentError }: GPSPermissionHelperProps) {
  const { t } = useTranslation();
  const [permissionState, setPermissionState] = useState<'checking' | 'denied' | 'granted' | 'prompt' | 'unavailable'>('checking');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    checkPermission();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPermission = async () => {
    try {
      if (!navigator.geolocation) {
        setPermissionState('unavailable');
        return;
      }

      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setPermissionState(permission.state as any);

        permission.addEventListener('change', () => {
          setPermissionState(permission.state as any);
          if (permission.state === 'granted') {
            onLocationGranted();
          }
        });
      } else {
        setPermissionState('prompt');
      }
    } catch (error) {
      console.error('Erreur vérification permission:', error);
      setPermissionState('prompt');
    }
  };

  const requestPermission = async () => {
    setIsRequesting(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });

      toast.success(t('gPSPermissionHelper.gpsActiveAvecSucces'), {
        description: `Position: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
      });

      setPermissionState('granted');
      onLocationGranted();
    } catch (error: any) {
      console.error('Erreur GPS:', error);

      let errorMessage = 'Impossible d\'obtenir votre position';
      let errorDetails = '';

      switch (error.code) {
        case 1:
          errorMessage = 'Permission refusée';
          errorDetails = 'Vous devez autoriser l\'accès à votre position dans les paramètres de votre navigateur';
          setPermissionState('denied');
          break;
        case 2:
          errorMessage = 'Position indisponible';
          errorDetails = 'Veuillez activer votre GPS et réessayer';
          break;
        case 3:
          errorMessage = 'Délai dépassé';
          errorDetails = 'La recherche GPS a pris trop de temps. Vérifiez que votre GPS est activé';
          break;
        default:
          errorDetails = 'Vérifiez que le GPS est activé et que vous êtes connecté en HTTPS';
      }

      toast.error(errorMessage, { description: errorDetails });
    } finally {
      setIsRequesting(false);
    }
  };

  const openSettings = () => {
    toast.info(t('gPSPermissionHelper.commentActiverLeGps'), {
      description: 'Sur Chrome/Safari: Paramètres > Confidentialité > Localisation. Sur Firefox: Préférences > Vie privée > Permissions',
      duration: 10000
    });
  };

  if (permissionState === 'checking') {
    return (
      <Card className="bg-white/95 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
          <p className="text-gray-600">{t('gPSPermissionHelper.verificationDuGps')}</p>
        </CardContent>
      </Card>
    );
  }

  if (permissionState === 'unavailable') {
    return (
      <Card className="bg-white/95 backdrop-blur-sm border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#ff4000]">
            <AlertTriangle className="w-5 h-5" />
            GPS non disponible
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-orange-50 border-orange-200">
            <AlertDescription>
              Votre appareil ne supporte pas la géolocalisation ou celle-ci n'est pas disponible.
            </AlertDescription>
          </Alert>
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>{t('gPSPermissionHelper.verifiezQue')}</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('gPSPermissionHelper.vousUtilisezUnNavigateurModerne')}</li>
              <li>{t('gPSPermissionHelper.vousEtesConnecteEnHttps')}</li>
              <li>{t('gPSPermissionHelper.leGpsDeVotreAppareil')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (permissionState === 'denied') {
    return (
      <Card className="bg-white/95 backdrop-blur-sm border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            Permission GPS refusée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-orange-50 border-orange-200">
            <AlertDescription>
              Vous avez refusé l'accès à votre position. Pour utiliser cette fonctionnalité, vous devez autoriser l'accès au GPS.
            </AlertDescription>
          </Alert>

          <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-3">
            <p className="font-semibold text-blue-900">{t('gPSPermissionHelper.commentAutoriserLeGps')}</p>
            <ol className="list-decimal list-inside space-y-2 text-blue-800">
              <li>{t('gPSPermissionHelper.cliquezSurLIconeDe')}</li>
              <li>{t('gPSPermissionHelper.trouvezLocalisationOuPosition')}</li>
              <li>{t('gPSPermissionHelper.selectionnezAutoriser')}</li>
              <li>{t('gPSPermissionHelper.rechargezLaPage')}</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={openSettings}
              variant="outline"
              className="flex-1"
            >
              Voir les instructions
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recharger
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (permissionState === 'granted') {
    // Afficher un loader pendant que le parent charge la position
    return (
      <Card className="bg-[#ff4000]/5 border-orange-200">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-[#ff4000] animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-[#ff4000]">{t('gPSPermissionHelper.gpsActive')}</p>
              <p className="text-sm text-[#ff4000]">{t('gPSPermissionHelper.chargementDeLaCarte')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/95 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Activation du GPS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentError && (
          <Alert className="bg-orange-50 border-orange-200">
            <AlertTriangle className="w-4 h-4 text-[#ff4000]" />
            <AlertDescription className="text-[#ff4000]">
              {currentError}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-gray-600 space-y-2">
          <p>{t('gPSPermissionHelper.pourUtiliserLaNavigationNous')}</p>
          <p className="font-semibold">{t('gPSPermissionHelper.assurezVousQue')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{t('gPSPermissionHelper.leGpsDeVotreTelephone')}</li>
            <li>{t('gPSPermissionHelper.vousEtesALExterieur')}</li>
            <li>{t('gPSPermissionHelper.vousUtilisezUneConnexionHttps')}</li>
          </ul>
        </div>

        <Button
          onClick={requestPermission}
          disabled={isRequesting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          {isRequesting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Recherche GPS en cours...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 mr-2" />
              Activer le GPS
            </>
          )}
        </Button>

        <p className="text-xs text-center text-gray-500">
          En cliquant sur "Activer le GPS", votre navigateur vous demandera l'autorisation d'accéder à votre position
        </p>
      </CardContent>
    </Card>
  );
}
