import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Search, Hash, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchUserId } from "@/hooks/useSearchUserId";
import type { UserProfile } from "@/types/communication.types";

interface ContactUserByIdProps {
  onUserSelected?: (user: UserProfile) => void;
  showNavigation?: boolean;
}

export default function ContactUserById({
  onUserSelected,
  showNavigation = true
}: ContactUserByIdProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { searchById, validateIdFormat, loading } = useSearchUserId();
  const [searchInput, setSearchInput] = useState("");
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Obtenir l'ID de l'utilisateur connecté
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id || null);
    });
  }, []);

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      toast.error(t('contactUserById.veuillezEntrerUnEmailId'));
      return;
    }

    // Valider le format
    if (!validateIdFormat(searchInput)) {
      toast.error("Format ID invalide", {
        description: t('contactUserById.formatsAcceptesUsr0001Ou224')
      });
      return;
    }

    const user = await searchById(searchInput);

    if (user) {
      // Vérifier qu'on ne contacte pas soi-même
      if (user.id === currentUserId) {
        toast.error(t('contactUserById.vousNePouvezPasVous'));
        setFoundUser(null);
        return;
      }

      setFoundUser(user);

      // Callback si fourni
      if (onUserSelected) {
        onUserSelected(user);
      }
    } else {
      setFoundUser(null);
    }
  };

  const handleContact = () => {
    if (!foundUser) return;

    if (showNavigation) {
      // Rediriger vers la conversation directe
      navigate(`/communication/direct/${foundUser.id}`);
      toast.success(`Conversation avec ${foundUser.first_name} ${foundUser.last_name}`);
    }
  };

  return (
    <div className={showNavigation ? "min-h-screen bg-background p-4" : ""}>
      <Card className={showNavigation ? "max-w-md mx-auto mt-10" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-orange-500" />
            Rechercher un utilisateur
          </CardTitle>
          <CardDescription>
            Recherchez un utilisateur par son ID standardisé
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Champ de recherche */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Hash className="w-4 h-4 text-orange-500" />
              ID Standardisé
            </label>
            <div className="flex gap-2">
              <Input
                placeholder={t('contactUserById.emailExempleComUsr0001Uuid')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="font-mono"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !searchInput.trim()}
                size="icon"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Résultat de recherche */}
          {foundUser && (
            <div className="p-4 border rounded-lg bg-orange-50 space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={foundUser.avatar_url} />
                  <AvatarFallback>
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <h4 className="font-semibold">
                    {foundUser.first_name} {foundUser.last_name}
                  </h4>
                  <p className="text-sm text-gray-600">{foundUser.email}</p>

                  {foundUser.public_id && (
                    <div className="flex items-center gap-1 mt-1">
                      <Hash className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-mono text-orange-600">
                        {foundUser.public_id}
                      </span>
                    </div>
                  )}

                  {foundUser.role && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                      {foundUser.role}
                    </span>
                  )}
                </div>
              </div>

              {showNavigation && (
                <Button
                  onClick={handleContact}
                  className="w-full"
                  variant="default"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Démarrer conversation
                </Button>
              )}
            </div>
          )}

          {/* Aide */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">{t('contactUserById.formatsAcceptes')}</p>
            <ul className="list-disc list-inside space-y-0.5 pl-2">
              <li><code className="bg-gray-100 px-1 py-0.5 rounded">USR0001</code> - Format standard (3 lettres + 4 chiffres)</li>
              <li><code className="bg-gray-100 px-1 py-0.5 rounded">224-123-456</code> - Format Guinea (224 + 6 chiffres)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
