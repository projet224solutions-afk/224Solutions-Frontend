/**
 * MODULE PLOMBERIE (artisan) — Phase 1 (ServiceTitan / Housecall Pro-like).
 * Flux d'intervention type Uber + devis terrain (catalogue + urgence) via le shell partagé.
 */
import { Wrench } from 'lucide-react';
import { ArtisanModuleShell } from './artisan/ArtisanModuleShell';
import { PlumbingQuote } from './artisan/quoteForms';

export function PlumberModule({ businessName }: { serviceId: string; businessName?: string }) {
  return (
    <ArtisanModuleShell
      serviceType="plomberie" title="Plomberie" Icon={Wrench} businessName={businessName}
      renderQuote={(createQuote) => <PlumbingQuote onCreate={createQuote} />}
    />
  );
}
export default PlumberModule;
