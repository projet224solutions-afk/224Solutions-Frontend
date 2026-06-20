/**
 * RESTAURANT MENU - Stub (backward compatibility)
 */

import { Card, CardContent } from '@/components/ui/card';
import { UtensilsCrossed } from 'lucide-react';

interface RestaurantMenuProps {
  serviceId: string;
}

export function RestaurantMenu({ serviceId }: RestaurantMenuProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          🍽️ Gestion du menu en cours de développement
        </p>
      </CardContent>
    </Card>
  );
}

export default RestaurantMenu;
