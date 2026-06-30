import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Check, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UserSearchResult {
  public_id: string;
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onUserSelect?: (userId: string) => void;
  label?: string;
  placeholder?: string;
}

export const UserSearchInput = ({
  value,
  onChange,
  onUserSelect,
  label = "ID du destinataire",
  placeholder = "ID, email ou téléphone"
}: UserSearchInputProps) => {
  const [searching, setSearching] = useState(false);
  const [userInfo, setUserInfo] = useState<UserSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Charger tous les utilisateurs disponibles au montage (combinant user_ids ET profiles)
  useEffect(() => {
    const loadAvailableUsers = async () => {
      try {
        const { data: currentUser } = await supabase.auth.getUser();
        if (!currentUser.user) return;

        const usersMap = new Map<string, UserSearchResult>();

        // 1. D'abord charger depuis user_ids (système principal pour nouveaux utilisateurs)
        const { data: userIdsData, error: userIdsError } = await supabase
          .from('user_ids')
          .select('user_id, custom_id')
          .neq('user_id', currentUser.user.id);

        if (!userIdsError && userIdsData) {
          for (const uid of userIdsData) {
            if (uid.custom_id && uid.user_id) {
              usersMap.set(uid.user_id, {
                public_id: uid.custom_id,
                user_id: uid.user_id,
                email: null,
                first_name: null,
                last_name: null,
                phone: null
              });
            }
          }
        }

        // 2. Enrichir avec les données de profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, public_id, email, first_name, last_name, phone')
          .neq('id', currentUser.user.id);

        if (!profilesError && profilesData) {
          for (const profile of profilesData) {
            const existing = usersMap.get(profile.id);
            if (existing) {
              // Enrichir les données existantes
              existing.email = profile.email;
              existing.first_name = profile.first_name;
              existing.last_name = profile.last_name;
              existing.phone = profile.phone;
              // Si profiles.public_id existe et est différent, garder le custom_id de user_ids
            } else if (profile.public_id) {
              // Ajouter les utilisateurs qui n'ont pas d'entrée dans user_ids mais ont public_id
              usersMap.set(profile.id, {
                public_id: profile.public_id,
                user_id: profile.id,
                email: profile.email,
                first_name: profile.first_name,
                last_name: profile.last_name,
                phone: profile.phone
              });
            }
          }
        }

        // 3. Charger les agents PDG depuis agents_management
        const { data: agentsData } = await supabase
          .from('agents_management')
          .select('user_id, name, email, phone, agent_code')
          .neq('user_id', currentUser.user.id)
          .not('user_id', 'is', null);

        if (agentsData) {
          for (const agent of agentsData) {
            if (agent.user_id && agent.agent_code && !usersMap.has(agent.user_id)) {
              usersMap.set(agent.user_id, {
                public_id: agent.agent_code,
                user_id: agent.user_id,
                email: agent.email,
                first_name: agent.name,
                last_name: null,
                phone: agent.phone
              });
            }
          }
        }

        setAvailableUsers(Array.from(usersMap.values()));
      } catch (error) {
        console.error('❌ Erreur chargement utilisateurs:', error);
      }
    };

    loadAvailableUsers();
  }, []);

  const searchUser = async (searchId: string) => {
    if (!searchId || searchId.length < 3) {
      setUserInfo(null);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const upperSearchId = searchId.toUpperCase();
      let foundUser: UserSearchResult | null = null;

      // PRIORITÉ 1: Chercher dans user_ids.custom_id (système principal)
      const { data: userIdData, error: _userIdError } = await supabase
        .from('user_ids')
        .select('user_id, custom_id')
        .ilike('custom_id', `%${upperSearchId}%`)
        .limit(1)
        .maybeSingle();

      if (userIdData) {
        console.log('✅ Trouvé dans user_ids:', userIdData);
        // Récupérer les infos du profil
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, phone')
          .eq('id', userIdData.user_id)
          .maybeSingle();

        foundUser = {
          public_id: userIdData.custom_id,
          user_id: userIdData.user_id,
          email: profileData?.email || null,
          first_name: profileData?.first_name || null,
          last_name: profileData?.last_name || null,
          phone: profileData?.phone || null
        };
      }

      // PRIORITÉ 2: Si pas trouvé dans user_ids, chercher dans profiles.public_id
      if (!foundUser) {
        const { data: profileData, error: _profileError } = await supabase
          .from('profiles')
          .select('id, public_id, email, first_name, last_name, phone')
          .ilike('public_id', `%${upperSearchId}%`)
          .limit(1)
          .maybeSingle();

        if (profileData && profileData.public_id) {
          console.log('✅ Trouvé dans profiles.public_id:', profileData);
          foundUser = {
            public_id: profileData.public_id,
            user_id: profileData.id,
            email: profileData.email,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            phone: profileData.phone
          };
        }
      }

      // PRIORITÉ 3: Chercher par email ou téléphone
      if (!foundUser) {
        const { data: profileByContact } = await supabase
          .from('profiles')
          .select('id, public_id, email, first_name, last_name, phone')
          .or(`email.ilike.%${searchId}%,phone.ilike.%${searchId}%`)
          .limit(1)
          .maybeSingle();

        if (profileByContact) {
          // Récupérer le custom_id de user_ids si disponible
          const { data: userIdForContact } = await supabase
            .from('user_ids')
            .select('custom_id')
            .eq('user_id', profileByContact.id)
            .maybeSingle();

          foundUser = {
            public_id: userIdForContact?.custom_id || profileByContact.public_id || 'N/A',
            user_id: profileByContact.id,
            email: profileByContact.email,
            first_name: profileByContact.first_name,
            last_name: profileByContact.last_name,
            phone: profileByContact.phone
          };
        }
      }

      // PRIORITÉ 4: Chercher dans agents_management par code/email/téléphone
      if (!foundUser) {
        const { data: agentData } = await supabase
          .from('agents_management')
          .select('user_id, name, email, phone, agent_code')
          .or(`agent_code.ilike.%${upperSearchId}%,email.ilike.%${searchId}%,phone.ilike.%${searchId}%`)
          .not('user_id', 'is', null)
          .limit(1)
          .maybeSingle();

        if (agentData?.user_id) {
          foundUser = {
            public_id: agentData.agent_code || agentData.user_id,
            user_id: agentData.user_id,
            email: agentData.email,
            first_name: agentData.name,
            last_name: null,
            phone: agentData.phone
          };
        }
      }

      if (foundUser) {
        setUserInfo(foundUser);
        setSearchError(null);
        if (onUserSelect && foundUser.user_id) {
          onUserSelect(foundUser.user_id);
        }
      } else {
        setSearchError(`Destinataire introuvable: ${searchId}`);
        setUserInfo(null);
      }
    } catch (error) {
      console.error('❌ Erreur recherche utilisateur:', error);
      setSearchError('Erreur lors de la recherche');
      setUserInfo(null);
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);

    // Déclencher la recherche après un délai (debounce)
    if (newValue.length >= 3) {
      const timeoutId = setTimeout(() => {
        searchUser(newValue);
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setUserInfo(null);
      setSearchError(null);
    }
  };

  const getUserDisplayName = (user: UserSearchResult) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email || user.phone || 'Utilisateur';
  };

  const filteredUsers = availableUsers.filter(user =>
    user.public_id?.toLowerCase().includes(value.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(value.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(value.toLowerCase()) ||
    user.email?.toLowerCase().includes(value.toLowerCase()) ||
    user.phone?.includes(value)
  );

  const selectUser = (user: UserSearchResult) => {
    onChange(user.public_id);
    setUserInfo(user);
    setSearchError(null);
    setShowSuggestions(false);
    if (onUserSelect && user.user_id) {
      onUserSelect(user.user_id);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="user-search">{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          id="user-search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="pl-10"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Suggestions d'utilisateurs pendant la saisie */}
      {showSuggestions && value && filteredUsers.length > 0 && (
        <ScrollArea className="h-[200px] border rounded-lg bg-background">
          <div className="p-2 space-y-1">
            {filteredUsers.map((user) => (
              <button
                key={user.user_id}
                onClick={() => selectUser(user)}
                className="w-full p-2 hover:bg-muted rounded-lg text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {getUserDisplayName(user)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono ml-2 flex-shrink-0">
                    {user.public_id}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Résultat de la recherche */}
      {userInfo && (
        <div className="mt-2 p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-[#ff4000] flex items-center justify-center">
            <Check className="w-4 h-4 text-[#ff4000] dark:text-[#ff4000]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[#ff4000] dark:text-orange-100">
              {getUserDisplayName(userInfo)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs font-mono">
                {userInfo.public_id}
              </Badge>
              {userInfo.phone && (
                <span className="text-xs text-muted-foreground">{userInfo.phone}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Erreur de recherche */}
      {searchError && (
        <div className="mt-2 p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg">
          <p className="text-sm text-[#ff4000] dark:text-[#ff4000]">
            {searchError}
          </p>
        </div>
      )}

      {/* Liste des utilisateurs disponibles si aucune recherche */}
      {!value && availableUsers.length > 0 && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              Utilisateurs disponibles ({availableUsers.length})
            </p>
          </div>
          <ScrollArea className="h-[150px]">
            <div className="space-y-2">
              {availableUsers.map((user) => (
                <button
                  key={user.user_id}
                  onClick={() => selectUser(user)}
                  className="w-full p-2 hover:bg-background rounded text-left transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {getUserDisplayName(user)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono ml-2 flex-shrink-0">
                      {user.public_id}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
