/**
 * 👤 PROFIL PUBLIC UTILISATEUR - 224SOLUTIONS
 * Page de profil public d'un utilisateur
 */

import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Phone, MessageCircle, Loader2, User, MapPin } from "lucide-react";
import QuickFooter from "@/components/QuickFooter";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  public_id: string | null;
  created_at: string | null;
}

interface UserAddress {
  street: string;
  city: string;
  country: string;
}

export default function UserPublicProfile() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [address, setAddress] = useState<UserAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url, public_id, created_at')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Erreur chargement profil:', fetchError);
        setError('Utilisateur non trouvé');
        return;
      }

      setProfile(data);

      // Charger l'adresse par défaut
      const { data: addrData } = await supabase
        .from('user_addresses')
        .select('street, city, country')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();

      if (addrData) {
        setAddress(addrData);
      } else {
        // Fallback: première adresse disponible
        const { data: anyAddr } = await supabase
          .from('user_addresses')
          .select('street, city, country')
          .eq('user_id', userId!)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setAddress(anyAddr || null);
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile?.email || 'Utilisateur';
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return profile?.email?.[0]?.toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">{t('userPublicProfile.chargementDuProfil')}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="bg-card border-b border-border p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">{t('userPublicProfile.profil')}</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <User className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{error || 'Utilisateur non trouvé'}</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
                Retour
              </Button>
            </CardContent>
          </Card>
        </div>
        <QuickFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 flex items-center gap-3 sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold">{t('userPublicProfile.profil')}</h1>
      </header>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>

              <h2 className="text-xl font-bold">{getDisplayName()}</h2>

              {profile.public_id && (
                <Badge variant="outline" className="mt-2 font-mono">
                  ID: {profile.public_id}
                </Badge>
              )}

              <Badge variant="secondary" className="mt-2">
                Client
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {profile.email && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{profile.email}</p>
                </div>
              </div>
            )}

            {profile.phone && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('userPublicProfile.telephone')}</p>
                  <p className="text-sm">{profile.phone}</p>
                </div>
              </div>
            )}

            {address && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Adresse</p>
                  <p className="text-sm">
                    {[address.street, address.city, address.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {profile.created_at && (
              <p className="text-xs text-center text-muted-foreground pt-4">
                Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long'
                })}
              </p>
            )}

            {/* Actions */}
            <div className="pt-4">
              <Button
                className="w-full"
                onClick={() => navigate(`/messages?recipientId=${profile.id}`)}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Envoyer un message
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <QuickFooter />
    </div>
  );
}
