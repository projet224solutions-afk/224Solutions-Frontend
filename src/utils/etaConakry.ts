/**
 * ETA adaptatif pour Conakry — vitesse moyenne variable selon l'heure
 * (trafic dense aux heures de pointe). Remplace les ETA à vitesse fixe.
 */

interface EtaOptions {
  distanceKm: number;
  at?: Date;
  minMinutes?: number;
}

/** Vitesse moyenne estimée (km/h) à Conakry selon l'heure (UTC = heure locale GMT). */
export function getConakrySpeedKmh(date: Date = new Date()): number {
  const hour = date.getUTCHours();
  if (hour >= 6 && hour < 9) return 12;   // pointe matin
  if (hour >= 16 && hour < 20) return 14; // pointe soir
  if (hour >= 9 && hour < 16) return 22;  // journée
  return 35;                              // nuit / tôt le matin
}

/** Minutes estimées pour parcourir distanceKm, bornées [minMinutes, 180]. */
export function estimateEtaMinutes({ distanceKm, at = new Date(), minMinutes = 1 }: EtaOptions): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return minMinutes;
  const speedKmh = getConakrySpeedKmh(at);
  const rawMinutes = (distanceKm / speedKmh) * 60;
  return Math.max(minMinutes, Math.ceil(Math.min(rawMinutes, 180)));
}

/** Formatte des minutes en "X min" ou "Xh Y min". */
export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m} min` : `${h}h`;
}
