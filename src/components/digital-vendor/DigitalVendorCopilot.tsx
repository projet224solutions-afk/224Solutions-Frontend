import { memo } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Copilot224 from '@/components/service-common/Copilot224';

const DigitalVendorCopilot = memo(function DigitalVendorCopilot() {
  return (
    <section className="space-y-5 animate-fade-in">
      <header className="overflow-hidden rounded-[28px] border-0 bg-[#04439e] p-5 shadow-[0_22px_55px_rgba(4,67,158,0.30)] sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white">
            <Bot className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold tracking-[0.01em] text-white sm:text-2xl">Copilote IA Vendeur</h1>
              <Badge className="border-0 bg-[#ff4000] text-xs font-semibold text-white shadow-none">
                Priorités business
              </Badge>
            </div>
            <p className="mt-2 text-sm text-white/65 sm:text-base">
              Analyse ventes, produits et performances, puis vous propose des actions concrètes.
            </p>
          </div>
          <Badge variant="outline" className="border-white/25 bg-white/12 text-xs text-white">
            <Sparkles className="h-3 w-3 mr-1" />
            Enterprise
          </Badge>
        </div>
      </header>

      <Copilot224 variant="embedded" service="ecommerce" title="Copilot 224" height="calc(100vh - 120px)" />
    </section>
  );
});

export default DigitalVendorCopilot;
