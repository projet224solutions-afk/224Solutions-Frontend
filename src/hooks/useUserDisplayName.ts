/**
 * HOOK POUR LE NOM D'AFFICHAGE UTILISATEUR
 * Source de vérité unique: profiles.public_id
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UserDisplayInfo {
    standardId: string | null; // ID standardisé profiles.public_id
    displayName: string;
    fullDisplayName: string; // Format: "CLI0001 - Jean Dupont"
}

export const useUserDisplayName = () => {
    const { user, profile } = useAuth();
    const [userDisplay, setUserDisplay] = useState<UserDisplayInfo>({
        standardId: null,
        displayName: 'Utilisateur',
        fullDisplayName: 'Utilisateur'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserDisplayInfo = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                // Source unique: profiles.public_id
                const standardId = (profile as any)?.public_id || null;

                // Construire le nom d'affichage
                let displayName = 'Utilisateur';
                if (profile?.first_name && profile?.last_name) {
                    displayName = `${profile.first_name} ${profile.last_name}`;
                } else if (profile?.first_name) {
                    displayName = profile.first_name;
                } else if (profile?.email) {
                    displayName = profile.email.split('@')[0];
                } else if (user.email) {
                    displayName = user.email.split('@')[0];
                }

                // Format complet avec public_id
                const fullDisplayName = standardId
                    ? `${standardId} - ${displayName}`
                    : displayName;

                setUserDisplay({
                    standardId,
                    displayName,
                    fullDisplayName
                });

            } catch (error) {
                console.error('Erreur lors de la récupération des infos utilisateur:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserDisplayInfo();
    }, [user, profile]);

    return {
        userDisplay,
        loading,
        // Helpers pour l'affichage - rétrocompatibilité
        customId: userDisplay.standardId, // Alias pour compatibilité
        publicId: userDisplay.standardId, // Alias pour compatibilité
        standardId: userDisplay.standardId, // Nom préféré
        displayName: userDisplay.displayName,
        fullDisplayName: userDisplay.fullDisplayName
    };
};

export default useUserDisplayName;
