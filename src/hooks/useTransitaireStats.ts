/**
 * HOOK TRANSITAIRE STATS - STUB
 * Module transitaire temporairement désactivé
 */

import { useState } from 'react';

export function useTransitaireStats() {
  const [stats, _setStats] = useState({
    totalShipments: 0,
    pendingShipments: 0,
    completedShipments: 0,
    totalRevenue: 0,
    customsInProgress: 0
  });
  const [loading, _setLoading] = useState(false);

  return {
    stats,
    loading,
    reloadStats: () => Promise.resolve()
  };
}
