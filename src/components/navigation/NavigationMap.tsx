/**
 * 🗺️ CARTE DE NAVIGATION GPS - 224SOLUTIONS
 * Affichage itinéraire avec guidage visuel temps réel
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Navigation,
  MapPin,
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  navigationService,
  NavigationState,
  NavigationRoute,
  GPSPosition
} from '@/services/navigation/NavigationService';
import { cn } from '@/lib/utils';

interface NavigationMapProps {
  startAddress?: string;
  endAddress?: string;
  onNavigationEnd?: () => void;
  className?: string;
}

export const NavigationMap: React.FC<NavigationMapProps> = ({
  startAddress,
  endAddress,
  onNavigationEnd,
  className
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [startPosition, setStartPosition] = useState<GPSPosition | null>(null);
  const [endPosition, setEndPosition] = useState<GPSPosition | null>(null);

  // 🎯 Initialiser la navigation
  useEffect(() => {
    initializeNavigation();

    return () => {
      navigationService.stopNavigation();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAddress, endAddress]);

  // 📍 S'abonner aux mises à jour GPS
  useEffect(() => {
    const unsubscribe = navigationService.subscribe('navigation-map', (state) => {
      setNavigationState(state);

      // Synthèse vocale des instructions
      if (!isMuted && state.distanceToNextStep < 100 && state.distanceToNextStep > 50) {
        speakInstruction(state.nextInstruction);
      }
    });

    return unsubscribe;
  }, [isMuted]);

  /**
   * 🚀 Initialiser la navigation
   */
  const initializeNavigation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 Initialisation navigation GPS...');

      // 1️⃣ Détecter position actuelle
      console.log('📍 Détection position GPS...');
      const currentPos = await navigationService.getCurrentPosition();
      setStartPosition(currentPos);
      console.log('✅ Position détectée:', currentPos);

      // 2️⃣ Géocoder destination (si adresse fournie)
      let destination: GPSPosition;

      if (endAddress) {
        console.log(`🗺️ Géocodage destination: "${endAddress}"`);
        const results = await navigationService.geocodeAddress(endAddress, 'GN');

        if (results.length === 0) {
          throw new Error(`Destination "${endAddress}" introuvable`);
        }

        destination = results[0];
        setEndPosition(destination);
        console.log('✅ Destination trouvée:', destination);
      } else {
        throw new Error('Adresse de destination requise');
      }

      // 3️⃣ Calculer l'itinéraire
      console.log('🛣️ Calcul itinéraire...');
      const calculatedRoute = await navigationService.calculateRoute(currentPos, destination);
      setRoute(calculatedRoute);
      console.log('✅ Itinéraire calculé:', {
        distance: `${calculatedRoute.distance.toFixed(2)} km`,
        duration: `${Math.round(calculatedRoute.duration)} min`
      });

      // 4️⃣ Démarrer la navigation
      console.log('🧭 Démarrage navigation...');
      await navigationService.startNavigation(calculatedRoute);
      console.log('✅ Navigation démarrée!');

      setIsLoading(false);
    } catch (err: any) {
      console.error('❌ Erreur navigation:', err);
      setError(err.message || 'Erreur lors de l\'initialisation');
      setIsLoading(false);
    }
  };

  /**
   * 🔊 Synthèse vocale
   */
  const speakInstruction = (instruction: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(instruction);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  /**
   * 🛑 Arrêter la navigation
   */
  const handleStopNavigation = () => {
    navigationService.stopNavigation();
    setNavigationState(null);
    setRoute(null);
    onNavigationEnd?.();
  };

  /**
   * 🔄 Formater distance
   */
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  /**
   * ⏱️ Formater durée
   */
  const formatDuration = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  /**
   * 🎨 Rendu
   */
  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Carte (placeholder - intégrer Mapbox/Google Maps ici) */}
      <div
        ref={mapRef}
        className={cn(
          'w-full bg-slate-100 dark:bg-slate-900 relative overflow-hidden',
          isFullscreen ? 'fixed inset-0 z-50 h-screen' : 'h-[500px] rounded-lg'
        )}
      >
        {/* État de chargement */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 z-10">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <div className="space-y-2">
                <p className="font-medium">🧭 Initialisation navigation...</p>
                <p className="text-sm text-muted-foreground">
                  📍 Détection position GPS
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-black/90 z-10">
            <Card className="p-6 max-w-md mx-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <h3 className="font-semibold">Erreur navigation</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={initializeNavigation}
                      size="sm"
                    >
                      Réessayer
                    </Button>
                    <Button
                      onClick={handleStopNavigation}
                      variant="outline"
                      size="sm"
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Carte visuelle (Placeholder) */}
        {!isLoading && !error && (
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <Navigation className="h-16 w-16 text-primary mx-auto animate-pulse" />
              <div className="space-y-2">
                <p className="font-medium">🗺️ Carte de navigation</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Intégrer ici: Mapbox GL JS ou Google Maps avec affichage de l'itinéraire en bleu
                </p>
                {startPosition && endPosition && (
                  <div className="text-xs space-y-1 pt-4 border-t">
                    <p>📍 Départ: {startPosition.latitude.toFixed(6)}, {startPosition.longitude.toFixed(6)}</p>
                    <p>🎯 Arrivée: {endPosition.latitude.toFixed(6)}, {endPosition.longitude.toFixed(6)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header informations navigation */}
        {navigationState && (
          <Card className="absolute top-4 left-4 right-4 p-4 shadow-lg z-20">
            <div className="space-y-3">
              {/* Alerte hors route */}
              {navigationState.isOffRoute && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    Hors route - Recalcul en cours...
                  </span>
                </div>
              )}

              {/* Prochaine instruction */}
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-2">
                  <Navigation className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-muted-foreground">
                    Dans {formatDistance(navigationState.distanceToNextStep)}
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    {navigationState.nextInstruction}
                  </p>
                </div>
              </div>

              {/* Statistiques */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="font-semibold">{formatDistance(navigationState.distanceRemaining)}</p>
                  </div>
                  <div className="w-px h-8 bg-border"></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Temps</p>
                    <p className="font-semibold">{formatDuration(navigationState.timeRemaining)}</p>
                  </div>
                  <div className="w-px h-8 bg-border"></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Étape</p>
                    <p className="font-semibold">
                      {navigationState.currentStep + 1}/{route?.steps.length || 0}
                    </p>
                  </div>
                </div>

                {/* Précision GPS */}
                <Badge variant="outline" className="ml-auto">
                  GPS ±{navigationState.currentPosition.accuracy.toFixed(0)}m
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Contrôles */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
          {/* Bouton son */}
          <Button
            variant="secondary"
            size="icon"
            className="shadow-lg"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          {/* Bouton plein écran */}
          <Button
            variant="secondary"
            size="icon"
            className="shadow-lg"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {/* Bouton arrêt */}
          <Button
            variant="destructive"
            size="icon"
            className="shadow-lg"
            onClick={handleStopNavigation}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Liste des étapes (en dessous de la carte) */}
      {route && !isFullscreen && (
        <Card className="mt-4 p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Itinéraire détaillé
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {route.steps.map((step, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg transition-colors',
                  navigationState?.currentStep === index && 'bg-primary/10 border border-primary/20',
                  navigationState && navigationState.currentStep > index && 'opacity-50'
                )}
              >
                <div className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold',
                  navigationState?.currentStep === index
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.instruction}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistance(step.distance)} · {formatDuration(step.duration)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default NavigationMap;
