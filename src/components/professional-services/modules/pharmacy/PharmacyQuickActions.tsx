/**
 * Actions rapides pharmacie — inspiré CVS/Walgreens POS
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus, ShoppingCart, Users, FileText, Package,
  Pill, ClipboardList, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

interface PharmacyQuickActionsProps {
  onTabChange: (tab: string) => void;
}

const actions = [
  { icon: Plus, labelKey: 'pharmacyActions.newProduct', route: '/vendeur/products', color: 'bg-[#ff4000]' },
  { icon: Pill, labelKey: 'pharmacyActions.prescription', tab: 'prescriptions', color: 'bg-blue-500' },
  { icon: ShoppingCart, labelKey: 'pharmacyActions.orders', route: '/vendeur/orders', color: 'bg-[#04439e]' },
  { icon: Users, labelKey: 'pharmacyActions.patients', tab: 'clients', color: 'bg-[#ff4000]' },
  { icon: Package, labelKey: 'pharmacyActions.inventory', tab: 'inventory', color: 'bg-[#ff4000]' },
  { icon: ClipboardList, labelKey: 'pharmacyActions.stockAlerts', tab: 'inventory', color: 'bg-orange-500' },
  { icon: FileText, labelKey: 'pharmacyActions.reports', tab: 'reports', color: 'bg-[#04439e]' },
  { icon: BarChart3, labelKey: 'pharmacyActions.analytics', tab: 'overview', color: 'bg-[#04439e]' },
];

export function PharmacyQuickActions({ onTabChange }: PharmacyQuickActionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3">
          {actions.map((action) => (
            <button
              key={action.labelKey}
              onClick={() => {
                if (action.route) navigate(action.route);
                else if (action.tab) onTabChange(action.tab);
              }}
              className="flex flex-col items-center gap-1.5 p-2 md:p-3 rounded-xl hover:bg-muted/50 transition-all group"
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${action.color} flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all`}>
                <action.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <span className="text-[10px] md:text-xs font-medium text-muted-foreground text-center leading-tight">
                {t(action.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
