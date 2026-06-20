/**
 * 📍 SERVICE DE GÉOLOCALISATION - 224SOLUTIONS
 * Gestion complète du partage de position et géolocalisation
 */

export interface Position {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
    altitude?: number;
    speed?: number;
    heading?: number;
}

export interface LocationData {
    id: string;
    userId: string;
    position: Position;
    address?: string;
    city?: string;
    country?: string;
    isActive: boolean;
    lastUpdate: number;
    batteryLevel?: number;
    networkType?: string;
}

export interface Geofence {
    id: string;
    name: string;
    center: Position;
    radius: number; // en mètres
    isActive: boolean;
    onEnter?: () => void;
    onExit?: () => void;
}

export interface LocationSharing {
    id: string;
    fromUserId: string;
    toUserId: string;
    position: Position;
    expiresAt: number;
    isActive: boolean;
    permissions: {
        canView: boolean;
        canTrack: boolean;
        canShare: boolean;
    };
}

export class GeolocationService {
    private static instance: GeolocationService;
    private watchId: number | null = null;
    private currentPosition: Position | null = null;
    private isTracking = false;
    private geofences: Geofence[] = [];
    private locationHistory: Position[] = [];
    private sharingSessions: Map<string, LocationSharing> = new Map();
    private listeners: Map<string, (position: Position) => void> = new Map();

    private constructor() { }

    public static getInstance(): GeolocationService {
        if (!GeolocationService.instance) {
            GeolocationService.instance = new GeolocationService();
        }
        return GeolocationService.instance;
    }

    /**
     * Obtenir la position actuelle
     */
    public async getCurrentPosition(): Promise<Position> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Géolocalisation non supportée'));
                return;
            }

            const options: PositionOptions = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos: Position = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: Date.now(),
                        altitude: position.coords.altitude,
                        speed: position.coords.speed,
                        heading: position.coords.heading
                    };

                    this.currentPosition = pos;
                    this.locationHistory.push(pos);

                    // Limiter l'historique à 100 positions
                    if (this.locationHistory.length > 100) {
                        this.locationHistory.shift();
                    }

                    resolve(pos);
                },
                (error) => {
                    console.error('Erreur géolocalisation:', error);
                    reject(error);
                },
                options
            );
        });
    }

    /**
     * Démarrer le suivi de position
     */
    public startTracking(_interval: number = 5000): void {
        if (this.isTracking) {
            console.warn('Le suivi est déjà actif');
            return;
        }

        if (!navigator.geolocation) {
            throw new Error('Géolocalisation non supportée');
        }

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const pos: Position = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: Date.now(),
                    altitude: position.coords.altitude,
                    speed: position.coords.speed,
                    heading: position.coords.heading
                };

                this.currentPosition = pos;
                this.locationHistory.push(pos);

                // Notifier tous les listeners
                this.listeners.forEach((callback) => {
                    callback(pos);
                });

                // Vérifier les géofences
                this.checkGeofences(pos);

                // Sauvegarder en base
                this.savePositionToDatabase(pos);
            },
            (error) => {
                console.error('Erreur suivi position:', error);
                this.handleLocationError(error);
            },
            options
        );

        this.isTracking = true;
        console.log('📍 Suivi de position démarré');
    }

    /**
     * Arrêter le suivi de position
     */
    public stopTracking(): void {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        console.log('📍 Suivi de position arrêté');
    }

    /**
     * Calculer la distance entre deux positions
     */
    public calculateDistance(pos1: Position, pos2: Position): number {
        const R = 6371e3; // Rayon de la Terre en mètres
        const φ1 = (pos1.latitude * Math.PI) / 180;
        const φ2 = (pos2.latitude * Math.PI) / 180;
        const Δφ = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
        const Δλ = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance en mètres
    }

    /**
     * Trouver les utilisateurs proches
     */
    public async findNearbyUsers(
        center: Position,
        radius: number = 5000,
        userType?: 'delivery' | 'client'
    ): Promise<LocationData[]> {
        try {
            // Récupérer tous les utilisateurs actifs
            const response = await fetch('/api/geolocation/nearby', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    center,
                    radius,
                    userType
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la recherche d\'utilisateurs proches');
            }

            const data = await response.json();
            return data.users || [];
        } catch (error) {
            console.error('Erreur recherche utilisateurs proches:', error);
            return [];
        }
    }

    /**
     * Partager sa position avec un utilisateur
     */
    public async shareLocation(
        toUserId: string,
        duration: number = 3600000 // 1 heure par défaut
    ): Promise<string> {
        if (!this.currentPosition) {
            throw new Error('Position actuelle non disponible');
        }

        const sharingId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const sharing: LocationSharing = {
            id: sharingId,
            fromUserId: 'current_user', // À remplacer par l'ID utilisateur réel
            toUserId,
            position: this.currentPosition,
            expiresAt: Date.now() + duration,
            isActive: true,
            permissions: {
                canView: true,
                canTrack: true,
                canShare: false
            }
        };

        this.sharingSessions.set(sharingId, sharing);

        // Sauvegarder en base
        await this.saveLocationSharing(sharing);

        return sharingId;
    }

    /**
     * Arrêter le partage de position
     */
    public async stopSharing(sharingId: string): Promise<void> {
        const sharing = this.sharingSessions.get(sharingId);
        if (sharing) {
            sharing.isActive = false;
            this.sharingSessions.delete(sharingId);

            // Mettre à jour en base
            await fetch(`/api/geolocation/sharing/${sharingId}`, {
                method: 'DELETE'
            });
        }
    }

    /**
     * Ajouter un géofence
     */
    public addGeofence(geofence: Geofence): void {
        this.geofences.push(geofence);
        console.log(`📍 Géofence ajoutée: ${geofence.name}`);
    }

    /**
     * Supprimer un géofence
     */
    public removeGeofence(geofenceId: string): void {
        this.geofences = this.geofences.filter(g => g.id !== geofenceId);
        console.log(`📍 Géofence supprimée: ${geofenceId}`);
    }

    /**
     * Vérifier les géofences
     */
    private checkGeofences(position: Position): void {
        this.geofences.forEach(geofence => {
            if (!geofence.isActive) return;

            const distance = this.calculateDistance(position, geofence.center);
            const isInside = distance <= geofence.radius;

            // Logique de détection d'entrée/sortie
            // (nécessite un état précédent pour détecter les transitions)
            if (isInside && geofence.onEnter) {
                geofence.onEnter();
            } else if (!isInside && geofence.onExit) {
                geofence.onExit();
            }
        });
    }

    /**
     * Ajouter un listener pour les mises à jour de position
     */
    public addPositionListener(id: string, callback: (position: Position) => void): void {
        this.listeners.set(id, callback);
    }

    /**
     * Supprimer un listener
     */
    public removePositionListener(id: string): void {
        this.listeners.delete(id);
    }

    /**
     * Obtenir l'historique des positions
     */
    public getLocationHistory(): Position[] {
        return [...this.locationHistory];
    }

    /**
     * Obtenir la position actuelle
     */
    public getCurrentPositionSync(): Position | null {
        return this.currentPosition;
    }

    /**
     * Vérifier si le suivi est actif
     */
    public isTrackingActive(): boolean {
        return this.isTracking;
    }

    /**
     * Sauvegarder la position en base de données
     */
    private async savePositionToDatabase(position: Position): Promise<void> {
        try {
            await fetch('/api/geolocation/position', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    position,
                    timestamp: Date.now()
                })
            });
        } catch (error) {
            console.error('Erreur sauvegarde position:', error);
        }
    }

    /**
     * Sauvegarder le partage de position
     */
    private async saveLocationSharing(sharing: LocationSharing): Promise<void> {
        try {
            await fetch('/api/geolocation/sharing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sharing)
            });
        } catch (error) {
            console.error('Erreur sauvegarde partage:', error);
        }
    }

    /**
     * Gérer les erreurs de géolocalisation
     */
    private handleLocationError(error: GeolocationPositionError): void {
        let message = 'Erreur de géolocalisation inconnue';

        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Permission de géolocalisation refusée';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Position non disponible';
                break;
            case error.TIMEOUT:
                message = 'Timeout de géolocalisation';
                break;
        }

        console.error(`📍 ${message}:`, error.message);

        // Notifier les listeners de l'erreur
        this.listeners.forEach((_callback) => {
            // Créer un événement d'erreur personnalisé
            const errorEvent = new CustomEvent('geolocationError', {
                detail: { error, message }
            });
            window.dispatchEvent(errorEvent);
        });
    }

    /**
     * Obtenir l'adresse à partir des coordonnées
     */
    public async getAddressFromCoordinates(position: Position): Promise<string> {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.longitude},${position.latitude}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN || ''}`
            );

            if (!response.ok) {
                throw new Error('Erreur géocodage inverse');
            }

            const data = await response.json();
            return data.features[0]?.place_name || 'Adresse non trouvée';
        } catch (error) {
            console.error('Erreur géocodage inverse:', error);
            return 'Adresse non trouvée';
        }
    }

    /**
     * Obtenir les coordonnées à partir d'une adresse
     */
    public async getCoordinatesFromAddress(address: string): Promise<Position | null> {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN || ''}`
            );

            if (!response.ok) {
                throw new Error('Erreur géocodage');
            }

            const data = await response.json();
            const feature = data.features[0];

            if (feature) {
                return {
                    latitude: feature.center[1],
                    longitude: feature.center[0],
                    timestamp: Date.now()
                };
            }

            return null;
        } catch (error) {
            console.error('Erreur géocodage:', error);
            return null;
        }
    }
}

export default GeolocationService;
