/**
 * Module principal Vol/Hôtel
 * Redirige vers le module d'affiliation aérienne
 */

import { AirlineAffiliateModule } from './AirlineAffiliateModule';

interface TravelModuleProps {
  onBack: () => void;
}

export function TravelModule({ onBack }: TravelModuleProps) {
  return <AirlineAffiliateModule onBack={onBack} />;
}
