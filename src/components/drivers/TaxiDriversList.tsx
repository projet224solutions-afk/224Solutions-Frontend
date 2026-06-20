/**
 * TAXI DRIVERS LIST COMPONENT
 * Affichage par catégorie : Taxi Voiture (bleu) et Taxi Moto (émeraude)
 * 224Solutions - Production Ready
 */

import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bike,
  Car,
  MapPin,
  Star,
  RefreshCw,
  Phone,
  MessageCircle,
  Clock,
  User,
  AlertCircle
} from "lucide-react";
import {
  type TaxiDriver,
  formatDriverDistance,
  getVehiclePlateDisplay,
} from '@/lib/drivers';

// ============================================================================
// Props interfaces
// ============================================================================

interface TaxiDriverCardProps {
  driver: TaxiDriver;
  onBook: (driverId: string) => void;
}

interface TaxiDriversListProps {
  loading: boolean;
  error: string | null;
  drivers: TaxiDriver[];
  onRetry: () => void;
  onBook: (driverId: string) => void;
}

// ============================================================================
// TaxiDriverCard - Carte individuelle mémoïsée
// ============================================================================

const TaxiDriverCard = memo(function TaxiDriverCard({ driver, onBook }: TaxiDriverCardProps) {
  const navigate = useNavigate();
  const displayName = driver.profile?.first_name
    ? `${driver.profile.first_name}${driver.profile.last_name ? ` ${driver.profile.last_name.charAt(0)}.` : ''}`
    : 'Conducteur';
  const vehiclePlate = getVehiclePlateDisplay(driver);
  const isAvailable = driver.status === 'available';
  const isCar = driver.taxi_category === 'car';

  const avatarBg = isCar ? 'bg-blue-100' : 'bg-orange-100';
  const avatarIcon = isCar ? 'text-blue-600' : 'text-orange-500';
  const borderHover = isCar
    ? 'hover:border-blue-500/50'
    : 'hover:border-orange-500/50';

  const phone = driver.profile?.phone ?? null;

  const handleCall = () => {
    if (phone) window.open(`tel:${phone}`);
  };

  const handleMessage = () => {
    navigate(`/messages?recipientId=${driver.user_id}`);
  };

  return (
    <Card className={`border-border/50 ${borderHover} transition-colors`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className={`w-14 h-14 rounded-full ${avatarBg} flex items-center justify-center`}>
              {driver.profile?.avatar_url ? (
                <img
                  src={driver.profile.avatar_url}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <User className={`w-6 h-6 ${avatarIcon}`} />
              )}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              isAvailable ? 'bg-[#ff4000]' : 'bg-[#ff4000]'
            }`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {displayName}
              </h3>
              <Badge variant={isAvailable ? 'default' : 'secondary'} className="text-xs">
                {isAvailable ? 'Disponible' : 'En course'}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {driver.rating !== null && driver.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-[#ff4000] fill-[#ff4000]" />
                  {driver.rating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {driver.total_rides ?? 0} courses
              </span>
              {driver.distance !== undefined && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formatDriverDistance(driver.distance)}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {vehiclePlate}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5">
            <Button
              size="sm"
              onClick={handleCall}
              disabled={!phone}
              title={phone ? `Appeler ${phone}` : 'Numéro indisponible'}
              className={isCar ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}
            >
              <Phone className="w-3.5 h-3.5 mr-1" />
              Appeler
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleMessage}
              title="Envoyer un message"
              className={isCar ? 'border-blue-300 text-blue-600 hover:bg-blue-50' : 'border-orange-300 text-orange-500 hover:bg-orange-50'}
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1" />
              Message
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Section par catégorie
// ============================================================================

interface CategorySectionProps {
  title: string;
  icon: React.ReactNode;
  drivers: TaxiDriver[];
  onBook: (driverId: string) => void;
  accentClass: string;
}

const CategorySection = memo(function CategorySection({
  title, icon, drivers, onBook, accentClass
}: CategorySectionProps) {
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 px-1 pb-1 border-b ${accentClass}`}>
        {icon}
        <span className="font-semibold text-sm text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground ml-auto">{drivers.length} en ligne</span>
      </div>
      <div className="space-y-3">
        {drivers.map((driver) => (
          <TaxiDriverCard key={driver.id} driver={driver} onBook={onBook} />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// Skeleton de chargement
// ============================================================================

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

// ============================================================================
// État d'erreur
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState = memo(function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h3 className="font-semibold text-foreground mb-2">Erreur de chargement</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// État vide
// ============================================================================

interface EmptyStateProps {
  onRetry: () => void;
}

const EmptyState = memo(function EmptyState({ onRetry }: EmptyStateProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-8 text-center">
        <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-foreground mb-2">Aucun taxi disponible</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Réessayez dans quelques instants
        </p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Composant principal TaxiDriversList
// ============================================================================

const TaxiDriversList = memo(function TaxiDriversList({
  loading,
  error,
  drivers,
  onRetry,
  onBook,
}: TaxiDriversListProps) {
  // Chargement initial uniquement
  if (loading && drivers.length === 0) {
    return <LoadingSkeleton />;
  }

  // Erreur
  if (error && drivers.length === 0) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  // Liste vide
  if (drivers.length === 0) {
    return <EmptyState onRetry={onRetry} />;
  }

  const carDrivers = drivers.filter(d => d.taxi_category === 'car');
  const motoDrivers = drivers.filter(d => d.taxi_category !== 'car');
  const bothPresent = carDrivers.length > 0 && motoDrivers.length > 0;

  // Affichage avec sections si les deux catégories sont présentes
  if (bothPresent) {
    return (
      <div className="space-y-6">
        <CategorySection
          title="Taxi Voiture"
          icon={<Car className="w-4 h-4 text-blue-600" />}
          drivers={carDrivers}
          onBook={onBook}
          accentClass="border-blue-200"
        />
        <CategorySection
          title="Taxi Moto"
          icon={<Bike className="w-4 h-4 text-orange-500" />}
          drivers={motoDrivers}
          onBook={onBook}
          accentClass="border-orange-200"
        />
      </div>
    );
  }

  // Une seule catégorie disponible
  return (
    <div className="space-y-3">
      {drivers.map((driver) => (
        <TaxiDriverCard key={driver.id} driver={driver} onBook={onBook} />
      ))}
    </div>
  );
});

export { TaxiDriversList, TaxiDriverCard };
export type { TaxiDriversListProps, TaxiDriverCardProps };
