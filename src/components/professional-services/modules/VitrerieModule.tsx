/**
 * MODULE VITRERIE (artisan) — Phase 2. Calculateur de verre (Smart Glazier-like).
 */
import { Square } from 'lucide-react';
import { ArtisanModuleShell } from './artisan/ArtisanModuleShell';
import { GlassQuote } from './artisan/quoteForms';

export function VitrerieModule({ businessName }: { serviceId: string; businessName?: string }) {
  return (
    <ArtisanModuleShell
      serviceType="vitrerie" title="Vitrerie" Icon={Square} businessName={businessName}
      renderQuote={(createQuote) => <GlassQuote onCreate={createQuote} />}
    />
  );
}
export default VitrerieModule;
