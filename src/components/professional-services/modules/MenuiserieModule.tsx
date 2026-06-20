/**
 * MODULE MENUISERIE (artisan) — Phase 3. Devis sur mesure (Tradify-like).
 * (Gestion des phases 1ère/2ème pose = onglet à enrichir ; base : devis par ouvrages.)
 */
import { Hammer } from 'lucide-react';
import { ArtisanModuleShell } from './artisan/ArtisanModuleShell';
import { CarpentryQuote } from './artisan/quoteForms';

export function MenuiserieModule({ businessName }: { serviceId: string; businessName?: string }) {
  return (
    <ArtisanModuleShell
      serviceType="menuiserie" title="Menuiserie" Icon={Hammer} businessName={businessName}
      renderQuote={(createQuote) => <CarpentryQuote onCreate={createQuote} />}
    />
  );
}
export default MenuiserieModule;
