/**
 * REPÈRES LOCAUX DE CONAKRY
 * En Guinée, les adresses se donnent souvent par repères (mosquée, marché,
 * hôpital) plutôt que par numéros de rue. Coordonnées approximatives à vérifier
 * sur le terrain — elles servent de point de départ, l'itinéraire réel est
 * recalculé par Google Maps.
 * 224Solutions — Taxi-Moto
 */

export interface ConakryLandmark {
  id: string;
  name: string;
  nameAlt?: string;
  category: 'marche' | 'hopital' | 'universite' | 'aeroport' | 'mosque' | 'quartier' | 'administration' | 'transport';
  latitude: number;
  longitude: number;
  commune: string;
}

export const CONAKRY_LANDMARKS: ConakryLandmark[] = [
  // Marchés
  { id: 'madina', name: 'Marché Madina', nameAlt: 'Madina', category: 'marche', latitude: 9.5853, longitude: -13.6234, commune: 'Matoto' },
  { id: 'rignyi', name: 'Marché Rignyi', nameAlt: 'Rignyi', category: 'marche', latitude: 9.5418, longitude: -13.6928, commune: 'Kaloum' },
  { id: 'marche_km36', name: 'Marché KM36', category: 'marche', latitude: 9.7012, longitude: -13.5541, commune: 'Coyah' },
  { id: 'cosa', name: 'Marché COSA', category: 'marche', latitude: 9.5731, longitude: -13.6412, commune: 'Dixinn' },

  // Hôpitaux
  { id: 'donka', name: 'CHU Donka', nameAlt: 'Hôpital Donka', category: 'hopital', latitude: 9.5586, longitude: -13.6722, commune: 'Dixinn' },
  { id: 'ignace_dean', name: 'Hôpital Ignace Deen', nameAlt: 'Ignace Deen', category: 'hopital', latitude: 9.5137, longitude: -13.7089, commune: 'Kaloum' },
  { id: 'kipe', name: 'Hôpital de Kipé', category: 'hopital', latitude: 9.6012, longitude: -13.6134, commune: 'Ratoma' },

  // Universités
  { id: 'ugan', name: 'Université Gamal Abdel Nasser', nameAlt: 'Université Conakry', category: 'universite', latitude: 9.5553, longitude: -13.6756, commune: 'Dixinn' },
  { id: 'isic', name: 'ISIC', category: 'universite', latitude: 9.5634, longitude: -13.6589, commune: 'Matam' },

  // Aéroport
  { id: 'gbessia', name: 'Aéroport Gbessia', nameAlt: 'Aéroport de Conakry', category: 'aeroport', latitude: 9.5789, longitude: -13.6122, commune: 'Matoto' },

  // Quartiers / zones clés
  { id: 'kaloum', name: 'Centre Kaloum', nameAlt: 'Kaloum', category: 'quartier', latitude: 9.5159, longitude: -13.7089, commune: 'Kaloum' },
  { id: 'ratoma', name: 'Centre Ratoma', nameAlt: 'Ratoma', category: 'quartier', latitude: 9.6167, longitude: -13.6167, commune: 'Ratoma' },
  { id: 'lambanyi', name: 'Lambanyi', category: 'quartier', latitude: 9.6312, longitude: -13.6034, commune: 'Ratoma' },

  // Administration / Transport
  { id: 'primature', name: 'Primature', category: 'administration', latitude: 9.5213, longitude: -13.7023, commune: 'Kaloum' },
  { id: 'gare_vot', name: 'Gare Voiture Bambeto', nameAlt: 'Gare Bambeto', category: 'transport', latitude: 9.6234, longitude: -13.6189, commune: 'Ratoma' },
];

/** Recherche par texte (min 2 caractères) dans name + nameAlt + commune. */
export function searchLandmarks(query: string): ConakryLandmark[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return CONAKRY_LANDMARKS.filter(
    (lm) =>
      lm.name.toLowerCase().includes(q) ||
      lm.nameAlt?.toLowerCase().includes(q) ||
      lm.commune.toLowerCase().includes(q),
  ).slice(0, 5);
}

/** Emoji par catégorie. */
export function getLandmarkIcon(category: ConakryLandmark['category']): string {
  const icons: Record<ConakryLandmark['category'], string> = {
    marche: '🛍️',
    hopital: '🏥',
    universite: '🎓',
    aeroport: '✈️',
    mosque: '🕌',
    quartier: '📍',
    administration: '🏛️',
    transport: '🚌',
  };
  return icons[category] || '📍';
}
