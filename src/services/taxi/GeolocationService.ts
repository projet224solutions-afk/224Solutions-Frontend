/**
 * SERVICE DE GÉOLOCALISATION TAXI - 224SOLUTIONS
 * Re-exporte le service commun pour éviter la duplication d'API
 */

import CommonGeoService from "@/services/geolocation/GeolocationService";

// Re-exporter les types et classes du service commun
export { GeolocationService } from "@/services/geolocation/GeolocationService";
export default CommonGeoService;
