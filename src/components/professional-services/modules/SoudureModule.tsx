/**
 * MODULE SOUDURE / MÉTALLERIE (artisan) — Phase 4. Calculateur métal/poids (QuoteIQ-like).
 */
import { Flame } from 'lucide-react';
import { ArtisanModuleShell } from './artisan/ArtisanModuleShell';
import { MetalQuote } from './artisan/quoteForms';

export function SoudureModule({ businessName }: { serviceId: string; businessName?: string }) {
  return (
    <ArtisanModuleShell
      serviceType="soudure" title="Soudure / Métallerie" Icon={Flame} businessName={businessName}
      renderQuote={(createQuote) => <MetalQuote onCreate={createQuote} />}
    />
  );
}
export default SoudureModule;
